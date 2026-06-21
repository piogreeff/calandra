import { describe, expect, it, vi } from "vitest";
import {
  GggApiConfigurationError,
  GggApiRateLimitError,
  GggApiScopeError,
  GggOAuthTokenEncryptionError,
  assertGggUserAgent,
  calandraPoe2CharacterScopes,
  createGggApiClient,
  createGggUserAgent,
  decryptGggOAuthTokenSet,
  encryptGggOAuthTokenSet,
  getRetryAfterMs,
  gggOAuthScopes,
  poe2CurrencyExchangeSupport,
  poe2ItemTradeSearchSupport,
  poe2StashOAuthSupport,
  type GggOAuthTokenSet,
  type GggHttpResponse,
} from "../src/index";

const userAgent = createGggUserAgent({
  version: "0.1.0",
  appUrl: "https://calandra.pages.dev",
  contact: "maintainer@calandra.dev",
});

describe("GGG official API client hygiene", () => {
  it("builds and validates a descriptive User-Agent with contact", () => {
    expect(userAgent).toBe(
      "calandra/0.1.0 (+https://calandra.pages.dev; maintainer@calandra.dev)",
    );
    expect(() => assertGggUserAgent(userAgent)).not.toThrow();
    expect(() =>
      assertGggUserAgent(
        "calandra/0.1 (+https://calandra.pages.dev; contact@example.com)",
      ),
    ).toThrow(GggApiConfigurationError);
  });

  it("declares the minimal PoE2 character scope and keeps stash support disabled", () => {
    expect(calandraPoe2CharacterScopes).toEqual([
      gggOAuthScopes.accountCharacters,
    ]);
    expect(poe2StashOAuthSupport).toMatchObject({
      supported: false,
      requiredScope: gggOAuthScopes.accountStashes,
    });
  });

  it("enables official PoE2 currency exchange history and disables item trade-search", () => {
    expect(poe2CurrencyExchangeSupport).toMatchObject({
      supported: true,
      requiredScope: gggOAuthScopes.serviceCurrencyExchange,
      realm: "poe2",
      endpoint: "/currency-exchange/poe2",
    });
    expect(poe2ItemTradeSearchSupport).toMatchObject({
      supported: false,
    });
    expect(poe2ItemTradeSearchSupport.reason).toContain(
      "do not call internal trade website",
    );
  });

  it("sends Authorization and User-Agent headers for PoE2 character requests", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse(200, { characters: [{ name: "CalandraTest" }] }),
    );
    const client = createGggApiClient({
      accessToken: "access-token",
      userAgent,
      grantedScopes: calandraPoe2CharacterScopes,
      fetch,
    });

    await expect(client.listPoe2Characters()).resolves.toEqual({
      characters: [{ name: "CalandraTest" }],
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://api.pathofexile.com/character/poe2",
      {
        method: "GET",
        headers: {
          accept: "application/json",
          authorization: "Bearer access-token",
          "User-Agent": userAgent,
        },
      },
    );
  });

  it("requests official PoE2 currency exchange markets with service:cxapi", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse(200, {
        next_change_id: 1782043200,
        markets: [
          {
            league: "Dawn of the Hunt",
            market_id: "chaos|divine",
          },
        ],
      }),
    );
    const client = createGggApiClient({
      accessToken: "service-token",
      userAgent,
      grantedScopes: [gggOAuthScopes.serviceCurrencyExchange],
      fetch,
    });

    await expect(
      client.getPoe2CurrencyExchangeMarkets(1782043200),
    ).resolves.toMatchObject({
      next_change_id: 1782043200,
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://api.pathofexile.com/currency-exchange/poe2/1782043200",
      {
        method: "GET",
        headers: {
          accept: "application/json",
          authorization: "Bearer service-token",
          "User-Agent": userAgent,
        },
      },
    );
  });

  it("rejects PoE2 currency exchange requests without service:cxapi", async () => {
    const client = createGggApiClient({
      accessToken: "service-token",
      userAgent,
      grantedScopes: [],
      fetch: vi.fn(),
    });

    await expect(client.getPoe2CurrencyExchangeMarkets()).rejects.toMatchObject(
      {
        name: "GggApiScopeError",
        requiredScope: gggOAuthScopes.serviceCurrencyExchange,
      },
    );
  });

  it("rejects character requests when the token does not include account:characters", async () => {
    const client = createGggApiClient({
      accessToken: "access-token",
      userAgent,
      grantedScopes: [],
      fetch: vi.fn(),
    });

    await expect(client.listPoe2Characters()).rejects.toThrow(GggApiScopeError);
  });

  it("backs off on 429 using Retry-After before retrying", async () => {
    const sleeps: number[] = [];
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(429, { error: "limited" }, { "retry-after": "2" }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { characters: [] }));
    const client = createGggApiClient({
      accessToken: "access-token",
      userAgent,
      grantedScopes: calandraPoe2CharacterScopes,
      fetch,
      sleep: async (milliseconds) => {
        sleeps.push(milliseconds);
      },
    });

    await expect(client.listPoe2Characters()).resolves.toEqual({
      characters: [],
    });
    expect(sleeps).toEqual([2000]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("derives backoff from active rate-limit state headers when Retry-After is absent", () => {
    expect(
      getRetryAfterMs(
        headers({
          "x-rate-limit-rules": "client,account",
          "x-rate-limit-client-state": "11:5:10",
          "x-rate-limit-account-state": "2:5:0",
        }),
      ),
    ).toBe(10000);
  });

  it("throws a rate-limit error after exhausting retries", async () => {
    const client = createGggApiClient({
      accessToken: "access-token",
      userAgent,
      grantedScopes: calandraPoe2CharacterScopes,
      fetch: vi.fn(async () =>
        jsonResponse(429, { error: "limited" }, { "retry-after": "1" }),
      ),
      maxRetries: 0,
      sleep: async () => undefined,
    });

    await expect(client.listPoe2Characters()).rejects.toMatchObject({
      name: "GggApiRateLimitError",
      retryAfterMs: 1000,
    } satisfies Partial<GggApiRateLimitError>);
  });
});

describe("GGG OAuth token encryption", () => {
  const tokenSet: GggOAuthTokenSet = {
    accessToken: "access-token-secret",
    refreshToken: "refresh-token-secret",
    tokenType: "bearer",
    scope: [gggOAuthScopes.accountCharacters],
    expiresAt: "2026-06-21T20:00:00.000Z",
    sub: "c5b9c286-8d05-47af-be41-67ab10a8c53e",
    username: "CalandraAccount",
  };

  it("encrypts tokens into an envelope without plaintext secrets", async () => {
    const envelope = await encryptGggOAuthTokenSet(tokenSet, {
      key: encryptionKey(1),
    });

    expect(envelope).toMatchObject({
      version: 1,
      algorithm: "AES-256-GCM",
    });
    expect(envelope.iv).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(envelope.ciphertext).not.toContain(tokenSet.accessToken);
    expect(envelope.ciphertext).not.toContain(tokenSet.refreshToken);

    await expect(
      decryptGggOAuthTokenSet(envelope, { key: encryptionKey(1) }),
    ).resolves.toEqual(tokenSet);
  });

  it("uses a fresh IV for each token encryption", async () => {
    const first = await encryptGggOAuthTokenSet(tokenSet, {
      key: encryptionKey(2),
    });
    const second = await encryptGggOAuthTokenSet(tokenSet, {
      key: encryptionKey(2),
    });

    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it("rejects non-AES-256 key lengths", async () => {
    await expect(
      encryptGggOAuthTokenSet(tokenSet, { key: new Uint8Array(16) }),
    ).rejects.toThrow(GggOAuthTokenEncryptionError);
  });

  it("rejects malformed token sets before encryption", async () => {
    await expect(
      encryptGggOAuthTokenSet(
        {
          ...tokenSet,
          accessToken: "",
        },
        { key: encryptionKey(3) },
      ),
    ).rejects.toThrow(GggOAuthTokenEncryptionError);
  });

  it("does not decrypt with the wrong key", async () => {
    const envelope = await encryptGggOAuthTokenSet(tokenSet, {
      key: encryptionKey(4),
    });

    await expect(
      decryptGggOAuthTokenSet(envelope, { key: encryptionKey(5) }),
    ).rejects.toThrow(GggOAuthTokenEncryptionError);
  });
});

function jsonResponse(
  status: number,
  body: unknown,
  responseHeaders: Record<string, string> = {},
): GggHttpResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: headers(responseHeaders),
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

function headers(values: Record<string, string>): GggHttpResponse["headers"] {
  const normalized = new Map(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]),
  );

  return {
    get(name: string) {
      return normalized.get(name.toLowerCase()) ?? null;
    },
  };
}

function encryptionKey(seed: number) {
  return Uint8Array.from({ length: 32 }, (_, index) => (seed + index) % 256);
}
