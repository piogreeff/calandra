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

export const poe2CurrencyExchangeSupport = {
  supported: true,
  requiredScope: gggOAuthScopes.serviceCurrencyExchange,
  realm: gggPoe2Realm,
  endpoint: `/currency-exchange/${gggPoe2Realm}`,
  limitation:
    "Official PoE2 currency exchange data is hourly historical aggregate market data, not current item trade-search results.",
} as const;

export const poe2ItemTradeSearchSupport = {
  supported: false,
  reason:
    "The developer docs do not list item trade-search as a supported API resource; do not call internal trade website, session-cookie, or reverse-engineered endpoints.",
} as const;

export const gggOAuthTokenEnvelopeVersion = 1;
export const gggOAuthTokenEncryptionAlgorithm = "AES-256-GCM";

const gggOAuthTokenIvBytes = 12;
const gggOAuthTokenKeyBytes = 32;

export type GggOAuthScope =
  (typeof gggOAuthScopes)[keyof typeof gggOAuthScopes];

export type GggOAuthTokenSet = {
  accessToken: string;
  tokenType: "bearer";
  scope: readonly string[];
  expiresAt: string;
  refreshToken?: string;
  sub?: string;
  username?: string;
};

export type EncryptedGggOAuthTokenSet = {
  version: typeof gggOAuthTokenEnvelopeVersion;
  algorithm: typeof gggOAuthTokenEncryptionAlgorithm;
  iv: string;
  ciphertext: string;
};

export type GggOAuthTokenEncryptionOptions = {
  key: Uint8Array;
  crypto?: CryptoProvider;
};

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

type CryptoProvider = {
  getRandomValues<T extends Uint8Array>(array: T): T;
  subtle: {
    importKey(
      format: "raw",
      keyData: Uint8Array,
      algorithm: { name: "AES-GCM"; length: 256 },
      extractable: false,
      keyUsages: readonly ("encrypt" | "decrypt")[],
    ): Promise<unknown>;
    encrypt(
      algorithm: { name: "AES-GCM"; iv: Uint8Array },
      key: unknown,
      data: Uint8Array,
    ): Promise<ArrayBuffer>;
    decrypt(
      algorithm: { name: "AES-GCM"; iv: Uint8Array },
      key: unknown,
      data: Uint8Array,
    ): Promise<ArrayBuffer>;
  };
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

export class GggOAuthTokenEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GggOAuthTokenEncryptionError";
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

export async function encryptGggOAuthTokenSet(
  tokenSet: GggOAuthTokenSet,
  options: GggOAuthTokenEncryptionOptions,
): Promise<EncryptedGggOAuthTokenSet> {
  assertGggOAuthTokenEncryptionKey(options.key);
  assertGggOAuthTokenSet(tokenSet);

  const cryptoProvider = getCryptoProvider(options.crypto);
  const iv = cryptoProvider.getRandomValues(
    new Uint8Array(gggOAuthTokenIvBytes),
  );
  const key = await importGggOAuthTokenEncryptionKey(
    cryptoProvider,
    options.key,
    ["encrypt"],
  );
  const plaintext = new TextEncoder().encode(JSON.stringify(tokenSet));
  const ciphertext = await cryptoProvider.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext,
  );

  return {
    version: gggOAuthTokenEnvelopeVersion,
    algorithm: gggOAuthTokenEncryptionAlgorithm,
    iv: base64UrlEncode(iv),
    ciphertext: base64UrlEncode(new Uint8Array(ciphertext)),
  };
}

export async function decryptGggOAuthTokenSet(
  envelope: EncryptedGggOAuthTokenSet,
  options: GggOAuthTokenEncryptionOptions,
): Promise<GggOAuthTokenSet> {
  assertGggOAuthTokenEncryptionKey(options.key);
  assertGggOAuthTokenEnvelope(envelope);

  const cryptoProvider = getCryptoProvider(options.crypto);
  const key = await importGggOAuthTokenEncryptionKey(
    cryptoProvider,
    options.key,
    ["decrypt"],
  );

  try {
    const plaintext = await cryptoProvider.subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlDecode(envelope.iv) },
      key,
      base64UrlDecode(envelope.ciphertext),
    );
    const tokenSet = JSON.parse(new TextDecoder().decode(plaintext)) as unknown;
    assertGggOAuthTokenSet(tokenSet);
    return tokenSet;
  } catch (error) {
    if (error instanceof GggOAuthTokenEncryptionError) {
      throw error;
    }

    throw new GggOAuthTokenEncryptionError(
      "Unable to decrypt GGG OAuth token set.",
    );
  }
}

export function assertGggOAuthTokenEncryptionKey(key: Uint8Array): void {
  if (key.byteLength !== gggOAuthTokenKeyBytes) {
    throw new GggOAuthTokenEncryptionError(
      "GGG OAuth token encryption key must be 32 bytes for AES-256-GCM.",
    );
  }
}

export function assertGggOAuthTokenSet(
  value: unknown,
): asserts value is GggOAuthTokenSet {
  if (!isRecord(value)) {
    throw new GggOAuthTokenEncryptionError(
      "GGG OAuth token set must be an object.",
    );
  }

  if (
    typeof value.accessToken !== "string" ||
    value.accessToken.trim().length === 0
  ) {
    throw new GggOAuthTokenEncryptionError(
      "GGG OAuth token set requires an access token.",
    );
  }

  if (value.tokenType !== "bearer") {
    throw new GggOAuthTokenEncryptionError(
      "GGG OAuth token set must use bearer tokens.",
    );
  }

  if (
    !Array.isArray(value.scope) ||
    value.scope.some((scope) => typeof scope !== "string" || !scope.trim())
  ) {
    throw new GggOAuthTokenEncryptionError(
      "GGG OAuth token set requires non-empty OAuth scopes.",
    );
  }

  if (
    typeof value.expiresAt !== "string" ||
    Number.isNaN(Date.parse(value.expiresAt))
  ) {
    throw new GggOAuthTokenEncryptionError(
      "GGG OAuth token set requires an ISO expiresAt timestamp.",
    );
  }

  for (const optionalField of ["refreshToken", "sub", "username"] as const) {
    const fieldValue = value[optionalField];
    if (fieldValue !== undefined && typeof fieldValue !== "string") {
      throw new GggOAuthTokenEncryptionError(
        `GGG OAuth token set field ${optionalField} must be a string.`,
      );
    }
  }
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
    getPoe2CurrencyExchangeMarkets(id?: string | number) {
      const suffix = id === undefined ? "" : `/${encodeURIComponent(id)}`;

      return requestJson(`${poe2CurrencyExchangeSupport.endpoint}${suffix}`, {
        requiredScope: gggOAuthScopes.serviceCurrencyExchange,
      });
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

function getCryptoProvider(cryptoProvider?: CryptoProvider): CryptoProvider {
  const resolvedProvider =
    cryptoProvider ??
    (globalThis as { crypto?: CryptoProvider | undefined }).crypto;

  if (!resolvedProvider?.subtle || !resolvedProvider.getRandomValues) {
    throw new GggOAuthTokenEncryptionError(
      "Web Crypto is required for GGG OAuth token encryption.",
    );
  }

  return resolvedProvider;
}

function importGggOAuthTokenEncryptionKey(
  cryptoProvider: CryptoProvider,
  key: Uint8Array,
  keyUsages: readonly ("encrypt" | "decrypt")[],
) {
  return cryptoProvider.subtle.importKey(
    "raw",
    key,
    { name: "AES-GCM", length: 256 },
    false,
    keyUsages,
  );
}

function assertGggOAuthTokenEnvelope(
  envelope: EncryptedGggOAuthTokenSet,
): void {
  if (
    envelope.version !== gggOAuthTokenEnvelopeVersion ||
    envelope.algorithm !== gggOAuthTokenEncryptionAlgorithm ||
    !envelope.iv ||
    !envelope.ciphertext
  ) {
    throw new GggOAuthTokenEncryptionError(
      "Invalid encrypted GGG OAuth token envelope.",
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function base64UrlEncode(bytes: Uint8Array): string {
  const encode = (globalThis as { btoa?: (value: string) => string }).btoa;
  if (!encode) {
    throw new GggOAuthTokenEncryptionError(
      "base64 encoding support is required for GGG OAuth token encryption.",
    );
  }

  return encode(bytesToBinaryString(bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const decode = (globalThis as { atob?: (value: string) => string }).atob;
  if (!decode) {
    throw new GggOAuthTokenEncryptionError(
      "base64 decoding support is required for GGG OAuth token encryption.",
    );
  }

  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );
  return binaryStringToBytes(decode(padded));
}

function bytesToBinaryString(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return binary;
}

function binaryStringToBytes(value: string): Uint8Array {
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}
