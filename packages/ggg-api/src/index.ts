export const gggApiBaseUrl = "https://api.pathofexile.com";
export const gggPoe2Realm = "poe2";

export const gggOAuthScopes = {
  accountCharacters: "account:characters",
  accountStashes: "account:stashes",
  serviceCurrencyExchange: "service:cxapi",
  serviceLeagues: "service:leagues",
  serviceLeagueLadder: "service:leagues:ladder",
} as const;

export const calandraPoe2CharacterScopes = [
  gggOAuthScopes.accountCharacters,
] as const;

export const poe2StashOAuthSupport = {
  supported: false,
  requiredScope: gggOAuthScopes.accountStashes,
  reason:
    "Official Account Stashes are currently documented as PoE1 only; do not substitute session-cookie endpoints.",
} as const;

export type GggOAuthScope =
  (typeof gggOAuthScopes)[keyof typeof gggOAuthScopes];

export type GggApiClientOptions = {
  accessToken: string;
  userAgent: string;
  grantedScopes: readonly string[];
  fetch: FetchLike;
  baseUrl?: string;
  maxRetries?: number;
  sleep?: (milliseconds: number) => Promise<void>;
};

export type GggApiRequestOptions = {
  method?: "GET";
  query?: Record<string, string | number | boolean | undefined>;
  requiredScope?: GggOAuthScope;
};

export type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
  },
) => Promise<GggHttpResponse>;

export type GggHttpResponse = {
  ok: boolean;
  status: number;
  headers: {
    get(name: string): string | null;
  };
  json(): Promise<unknown>;
  text(): Promise<string>;
};

export class GggApiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GggApiConfigurationError";
  }
}

export class GggApiScopeError extends Error {
  constructor(
    message: string,
    public readonly requiredScope: GggOAuthScope,
  ) {
    super(message);
    this.name = "GggApiScopeError";
  }
}

export class GggApiRateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfterMs: number,
  ) {
    super(message);
    this.name = "GggApiRateLimitError";
  }
}

export class GggApiHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "GggApiHttpError";
  }
}

export function createGggUserAgent({
  appName = "calandra",
  version,
  appUrl,
  contact,
}: {
  appName?: string;
  version: string;
  appUrl: string;
  contact: string;
}) {
  const userAgent = `${appName}/${version} (+${appUrl}; ${contact})`;
  assertGggUserAgent(userAgent);
  return userAgent;
}

export function assertGggUserAgent(userAgent: string): void {
  const trimmed = userAgent.trim();

  if (trimmed.length < 20) {
    throw new GggApiConfigurationError(
      "GGG_USER_AGENT must identify Calandra and include contact information.",
    );
  }

  if (trimmed.includes("contact@example.com")) {
    throw new GggApiConfigurationError(
      "GGG_USER_AGENT must not use the placeholder contact@example.com address.",
    );
  }

  if (!trimmed.includes("calandra/") || !trimmed.includes("(+")) {
    throw new GggApiConfigurationError(
      "GGG_USER_AGENT must include the application name, project URL, and contact.",
    );
  }

  if (!/[(;]\s*[^()\s;]+@[^()\s;]+\.[^()\s;]+[)]?$/.test(trimmed)) {
    throw new GggApiConfigurationError(
      "GGG_USER_AGENT must include a contact email address.",
    );
  }
}

export function createGggApiClient(options: GggApiClientOptions) {
  const accessToken = options.accessToken.trim();
  const baseUrl = options.baseUrl ?? gggApiBaseUrl;
  const maxRetries = options.maxRetries ?? 2;
  const sleep = options.sleep ?? defaultSleep;

  if (!accessToken) {
    throw new GggApiConfigurationError("GGG access token is required.");
  }

  assertGggUserAgent(options.userAgent);

  async function requestJson(
    path: string,
    requestOptions: GggApiRequestOptions = {},
  ) {
    assertRequiredScope(options.grantedScopes, requestOptions.requiredScope);

    const url = buildGggUrl(baseUrl, path, requestOptions.query);

    for (let attempt = 0; ; attempt += 1) {
      const response = await options.fetch(url, {
        method: requestOptions.method ?? "GET",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${accessToken}`,
          "User-Agent": options.userAgent,
        },
      });

      if (response.status === 429) {
        const retryAfterMs = getRetryAfterMs(response.headers);
        if (attempt >= maxRetries) {
          throw new GggApiRateLimitError(
            "GGG API rate limit exceeded.",
            retryAfterMs,
          );
        }

        await sleep(retryAfterMs);
        continue;
      }

      if (!response.ok) {
        throw new GggApiHttpError(
          `GGG API request failed with HTTP ${response.status}.`,
          response.status,
          await readErrorBody(response),
        );
      }

      return response.json();
    }
  }

  return {
    requestJson,
    listPoe2Characters() {
      return requestJson(`/character/${gggPoe2Realm}`, {
        requiredScope: gggOAuthScopes.accountCharacters,
      });
    },
    getPoe2Character(name: string) {
      if (!name.trim()) {
        throw new GggApiConfigurationError("Character name is required.");
      }

      return requestJson(
        `/character/${gggPoe2Realm}/${encodeURIComponent(name)}`,
        {
          requiredScope: gggOAuthScopes.accountCharacters,
        },
      );
    },
  };
}

export function getRetryAfterMs(headers: GggHttpResponse["headers"]): number {
  const retryAfter = headers.get("retry-after");
  const parsedRetryAfter = retryAfter ? Number.parseInt(retryAfter, 10) : 0;
  if (Number.isFinite(parsedRetryAfter) && parsedRetryAfter > 0) {
    return parsedRetryAfter * 1000;
  }

  const rules = splitHeaderList(headers.get("x-rate-limit-rules"));
  const activeRestrictionSeconds = rules
    .map((rule) => getActiveRestrictionSeconds(headers, rule))
    .filter((seconds) => seconds > 0);
  const longestRestriction = Math.max(0, ...activeRestrictionSeconds);

  return longestRestriction > 0 ? longestRestriction * 1000 : 1000;
}

function buildGggUrl(
  baseUrl: string,
  path: string,
  query: GggApiRequestOptions["query"],
) {
  if (!path.startsWith("/")) {
    throw new GggApiConfigurationError("GGG API path must start with '/'.");
  }

  const url = new URL(path, baseUrl);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

function assertRequiredScope(
  grantedScopes: readonly string[],
  requiredScope: GggOAuthScope | undefined,
): void {
  if (!requiredScope || grantedScopes.includes(requiredScope)) {
    return;
  }

  throw new GggApiScopeError(
    `GGG API request requires OAuth scope ${requiredScope}.`,
    requiredScope,
  );
}

function splitHeaderList(value: string | null) {
  return value
    ? value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    : [];
}

function getActiveRestrictionSeconds(
  headers: GggHttpResponse["headers"],
  rule: string,
) {
  const state = headers.get(`x-rate-limit-${rule}-state`);
  const activeRestriction = state?.split(":")[2];
  const seconds = activeRestriction
    ? Number.parseInt(activeRestriction, 10)
    : 0;

  return Number.isFinite(seconds) ? seconds : 0;
}

async function readErrorBody(response: GggHttpResponse) {
  try {
    return await response.json();
  } catch {
    return response.text();
  }
}

function defaultSleep(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
