import { describe, expect, it, vi } from "vitest";
import {
  GggApiConfigurationError,
  GggApiRateLimitError,
  GggApiScopeError,
  assertGggUserAgent,
  calandraPoe2CharacterScopes,
  createGggApiClient,
  createGggUserAgent,
  getRetryAfterMs,
  gggOAuthScopes,
  poe2StashOAuthSupport,
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
