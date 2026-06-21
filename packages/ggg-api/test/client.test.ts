import { describe, expect, it, vi } from "vitest";
import {
  GggApiConfigurationError,
  GggApiRateLimitError,
  GggApiScopeError,
  GggOAuthTokenEncryptionError,
  assertGggUserAgent,
  calandraPoe2CharacterScopes,
  capturePoe2CharacterSnapshot,
  createGggApiClient,
  createGggOAuthAuthorizationUrl,
  createGggOAuthPkcePair,
  createGggUserAgent,
  decryptGggOAuthTokenSet,
  encryptGggOAuthTokenSet,
  exchangeGggOAuthAuthorizationCode,
  getRetryAfterMs,
  gggOAuthScopes,
  poe2CurrencyExchangeSupport,
  poe2ItemTradeSearchSupport,
  poe2StashOAuthSupport,
  refreshGggOAuthToken,
  type GggOAuthFetchLike,
  type GggOAuthPkcePair,
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

  it("generates a PKCE verifier and S256 challenge for OAuth authorization", async () => {
    const pkce = await createGggOAuthPkcePair({
      crypto: deterministicPkceCrypto(),
    });

    expect(pkce.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pkce.codeChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pkce.codeChallenge).not.toBe(pkce.codeVerifier);
    expect(pkce.codeChallengeMethod).toBe("S256");
  });

  it("builds an OAuth authorization URL for the temporary hosted app domain", () => {
    const authorizationUrl = createGggOAuthAuthorizationUrl({
      clientId: "calandra-client-id",
      redirectUri: "https://calandra.pages.dev/auth/ggg/callback",
      scopes: calandraPoe2CharacterScopes,
      state: "state-123",
      pkce: testPkce,
    });
    const url = new URL(authorizationUrl);

    expect(`${url.origin}${url.pathname}`).toBe(
      "https://www.pathofexile.com/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("calandra-client-id");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("account:characters");
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://calandra.pages.dev/auth/ggg/callback",
    );
    expect(url.searchParams.get("code_challenge")).toBe("challenge");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("allows a local loopback redirect for the desktop public-client flow", () => {
    const authorizationUrl = createGggOAuthAuthorizationUrl({
      clientId: "calandra-desktop-client",
      redirectUri: "http://127.0.0.1:17633/callback",
      scopes: calandraPoe2CharacterScopes,
      state: "desktop-state",
      pkce: testPkce,
    });

    expect(new URL(authorizationUrl).searchParams.get("redirect_uri")).toBe(
      "http://127.0.0.1:17633/callback",
    );
  });

  it("rejects unsupported OAuth redirects and malformed authorization state", () => {
    expect(() =>
      createGggOAuthAuthorizationUrl({
        clientId: "calandra-client-id",
        redirectUri: "http://example.com/callback",
        scopes: calandraPoe2CharacterScopes,
        state: "state-123",
        pkce: testPkce,
      }),
    ).toThrow(GggApiConfigurationError);
    expect(() =>
      createGggOAuthAuthorizationUrl({
        clientId: "calandra-client-id",
        redirectUri: "https://calandra.pages.dev/auth/ggg/callback",
        scopes: [],
        state: "state-123",
        pkce: testPkce,
      }),
    ).toThrow(GggApiConfigurationError);
    expect(() =>
      createGggOAuthAuthorizationUrl({
        clientId: "calandra-client-id",
        redirectUri: "https://calandra.pages.dev/auth/ggg/callback",
        scopes: calandraPoe2CharacterScopes,
        state: " ",
        pkce: testPkce,
      }),
    ).toThrow(GggApiConfigurationError);
  });

  it("exchanges an OAuth authorization code for a normalized token set", async () => {
    const fetch = vi.fn<
      Parameters<GggOAuthFetchLike>,
      ReturnType<GggOAuthFetchLike>
    >(async () =>
      jsonResponse(200, {
        access_token: "access-token",
        expires_in: 3600,
        token_type: "bearer",
        scope: "account:characters",
        username: "CalandraAccount",
        sub: "c5b9c286-8d05-47af-be41-67ab10a8c53e",
        refresh_token: "refresh-token",
      }),
    );

    await expect(
      exchangeGggOAuthAuthorizationCode({
        clientId: "calandra-client-id",
        redirectUri: "https://calandra.pages.dev/auth/ggg/callback",
        code: "authorization-code",
        codeVerifier: "verifier",
        scopes: calandraPoe2CharacterScopes,
        fetch,
        now: new Date("2026-06-21T15:00:00.000Z"),
      }),
    ).resolves.toEqual({
      accessToken: "access-token",
      expiresAt: "2026-06-21T16:00:00.000Z",
      tokenType: "bearer",
      scope: ["account:characters"],
      username: "CalandraAccount",
      sub: "c5b9c286-8d05-47af-be41-67ab10a8c53e",
      refreshToken: "refresh-token",
    });

    const request = fetch.mock.calls[0];
    if (!request) {
      throw new Error("Expected an OAuth token request.");
    }
    expect(request[0]).toBe("https://www.pathofexile.com/oauth/token");
    expect(request[1]).toMatchObject({
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
    });
    expect(new URLSearchParams(request[1].body).toString()).toBe(
      new URLSearchParams({
        client_id: "calandra-client-id",
        grant_type: "authorization_code",
        code: "authorization-code",
        redirect_uri: "https://calandra.pages.dev/auth/ggg/callback",
        code_verifier: "verifier",
        scope: "account:characters",
      }).toString(),
    );
  });

  it("refreshes an OAuth token without requiring a client secret", async () => {
    const fetch = vi.fn<
      Parameters<GggOAuthFetchLike>,
      ReturnType<GggOAuthFetchLike>
    >(async () =>
      jsonResponse(200, {
        access_token: "next-access-token",
        expires_in: 600,
        token_type: "bearer",
        scope: "account:characters",
      }),
    );

    await expect(
      refreshGggOAuthToken({
        clientId: "calandra-public-client",
        refreshToken: "refresh-token",
        fetch,
        now: new Date("2026-06-21T15:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      accessToken: "next-access-token",
      expiresAt: "2026-06-21T15:10:00.000Z",
      scope: ["account:characters"],
    });

    const request = fetch.mock.calls[0];
    if (!request) {
      throw new Error("Expected an OAuth token request.");
    }
    expect(new URLSearchParams(request[1].body).toString()).toBe(
      new URLSearchParams({
        client_id: "calandra-public-client",
        grant_type: "refresh_token",
        refresh_token: "refresh-token",
      }).toString(),
    );
  });

  it("sends a client secret when a confidential OAuth client is configured", async () => {
    const fetch = vi.fn<
      Parameters<GggOAuthFetchLike>,
      ReturnType<GggOAuthFetchLike>
    >(async () =>
      jsonResponse(200, {
        access_token: "access-token",
        expires_in: 3600,
        token_type: "bearer",
        scope: "account:characters",
      }),
    );

    await exchangeGggOAuthAuthorizationCode({
      clientId: "calandra-confidential-client",
      clientSecret: "client-secret",
      redirectUri: "https://calandra.pages.dev/auth/ggg/callback",
      code: "authorization-code",
      codeVerifier: "verifier",
      fetch,
      now: new Date("2026-06-21T15:00:00.000Z"),
    });

    const request = fetch.mock.calls[0];
    if (!request) {
      throw new Error("Expected an OAuth token request.");
    }
    expect(new URLSearchParams(request[1].body).get("client_secret")).toBe(
      "client-secret",
    );
  });

  it("rejects OAuth token endpoint errors and malformed token responses", async () => {
    await expect(
      exchangeGggOAuthAuthorizationCode({
        clientId: "calandra-client-id",
        redirectUri: "https://calandra.pages.dev/auth/ggg/callback",
        code: "authorization-code",
        codeVerifier: "verifier",
        fetch: vi.fn(async () =>
          jsonResponse(400, { error: "invalid_grant" }),
        ),
      }),
    ).rejects.toMatchObject({
      name: "GggApiHttpError",
      status: 400,
      body: { error: "invalid_grant" },
    });

    await expect(
      refreshGggOAuthToken({
        clientId: "calandra-client-id",
        refreshToken: "refresh-token",
        fetch: vi.fn(async () =>
          jsonResponse(200, {
            access_token: "access-token",
            expires_in: 3600,
            token_type: "bearer",
            scope: "",
          }),
        ),
      }),
    ).rejects.toThrow(GggOAuthTokenEncryptionError);
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

  it("captures a contract-valid source-agnostic account snapshot from official PoE2 characters", async () => {
    const client = {
      listPoe2Characters: vi.fn(async () => ({
        characters: [{ name: "CalandraTest" }],
      })),
      getPoe2Character: vi.fn(async (name: string) => ({
        character: {
          id: "character-1",
          name,
          class: "Deadeye",
          level: "73",
          league: "Dawn of the Hunt",
          equipment: [
            {
              inventoryId: "Weapon",
              typeLine: "Expert Siphoning Wand",
              rarity: "rare",
              id: "item-1",
            },
            {
              slot: "gloves",
              name: "Duskthread Grips",
              rarity: "unique",
            },
          ],
          passiveSkillIds: ["keystone-1"],
        },
      })),
    };

    await expect(
      capturePoe2CharacterSnapshot({
        account: "CalandraAccount",
        id: "snapshot-2026-06-21T18-00-00Z",
        capturedAt: "2026-06-21T18:00:00.000Z",
        client,
      }),
    ).resolves.toEqual({
      id: "snapshot-2026-06-21T18-00-00Z",
      account: "CalandraAccount",
      capturedAt: "2026-06-21T18:00:00.000Z",
      source: "official-poe2-character",
      capabilities: { characters: true, stashes: false },
      characters: [
        {
          id: "character-1",
          name: "CalandraTest",
          className: "Deadeye",
          level: 73,
          league: "Dawn of the Hunt",
          equipment: [
            {
              slot: "Weapon",
              name: "Expert Siphoning Wand",
              itemId: "item-1",
              rarity: "rare",
            },
            {
              slot: "gloves",
              name: "Duskthread Grips",
              rarity: "unique",
            },
          ],
          passiveSkillIds: ["keystone-1"],
        },
      ],
    });

    expect(client.getPoe2Character).toHaveBeenCalledWith("CalandraTest");
  });

  it("uses detailed list entries directly when they already include equipment", async () => {
    const client = {
      listPoe2Characters: vi.fn(async () => ({
        characters: [
          {
            name: "AlreadyDetailed",
            ascendancyClass: "Infernalist",
            level: 82,
            league: "Dawn of the Hunt",
            items: [{ inventoryId: "Ring", typeLine: "Ruby Ring" }],
          },
        ],
      })),
      getPoe2Character: vi.fn(),
    };

    await expect(
      capturePoe2CharacterSnapshot({
        account: "CalandraAccount",
        capturedAt: "2026-06-21T18:00:00.000Z",
        client,
      }),
    ).resolves.toMatchObject({
      id: "snapshot-2026-06-21T18-00-00-000Z",
      characters: [
        {
          id: "AlreadyDetailed",
          className: "Infernalist",
          equipment: [{ slot: "Ring", name: "Ruby Ring" }],
        },
      ],
    });

    expect(client.getPoe2Character).not.toHaveBeenCalled();
  });

  it("rejects official character payloads that cannot satisfy the snapshot contract", async () => {
    const client = {
      listPoe2Characters: vi.fn(async () => ({
        characters: [{ name: "BrokenCharacter" }],
      })),
      getPoe2Character: vi.fn(async () => ({
        character: {
          name: "BrokenCharacter",
          level: 73,
          league: "Dawn of the Hunt",
          equipment: [],
        },
      })),
    };

    await expect(
      capturePoe2CharacterSnapshot({
        account: "CalandraAccount",
        capturedAt: "2026-06-21T18:00:00.000Z",
        client,
      }),
    ).rejects.toThrow(GggApiConfigurationError);
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

const testPkce: GggOAuthPkcePair = {
  codeVerifier: "verifier",
  codeChallenge: "challenge",
  codeChallengeMethod: "S256",
};

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

function deterministicPkceCrypto() {
  return {
    getRandomValues<T extends Uint8Array>(array: T): T {
      for (let index = 0; index < array.length; index += 1) {
        array[index] = index;
      }

      return array;
    },
    subtle: {
      digest(algorithm: "SHA-256", data: Uint8Array) {
        return crypto.subtle.digest(algorithm, data);
      },
    },
  };
}
