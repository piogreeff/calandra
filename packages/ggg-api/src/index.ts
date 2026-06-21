import {
  accountSnapshotSchema,
  type AccountSnapshot,
  type AccountSnapshotCharacter,
  type AccountSnapshotGearItem,
  type Rarity,
} from "@calandra/contract";

export const gggApiBaseUrl = "https://api.pathofexile.com";
export const gggOAuthAuthorizeUrl =
  "https://www.pathofexile.com/oauth/authorize";
export const gggOAuthTokenUrl = "https://www.pathofexile.com/oauth/token";
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

type PkceCryptoProvider = {
  getRandomValues<T extends Uint8Array>(array: T): T;
  subtle: {
    digest(algorithm: "SHA-256", data: Uint8Array): Promise<ArrayBuffer>;
  };
};

export type GggOAuthPkcePair = {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
};

export type GggOAuthAuthorizationUrlOptions = {
  clientId: string;
  redirectUri: string;
  scopes: readonly GggOAuthScope[];
  state: string;
  pkce: GggOAuthPkcePair;
};

export type GggOAuthAuthorizationCodeExchangeOptions = {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
  scopes?: readonly GggOAuthScope[];
  fetch: GggOAuthFetchLike;
  tokenUrl?: string;
  now?: Date;
};

export type GggOAuthRefreshTokenOptions = {
  clientId: string;
  clientSecret?: string;
  refreshToken: string;
  scopes?: readonly GggOAuthScope[];
  fetch: GggOAuthFetchLike;
  tokenUrl?: string;
  now?: Date;
};

export type GggPoe2CharacterSnapshotClient = {
  listPoe2Characters(): Promise<unknown>;
  getPoe2Character(name: string): Promise<unknown>;
};

export type CapturePoe2CharacterSnapshotOptions = {
  account: string;
  client: GggPoe2CharacterSnapshotClient;
  capturedAt?: string | Date;
  id?: string;
};

export type GggOAuthFetchLike = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  },
) => Promise<GggHttpResponse>;

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

export async function createGggOAuthPkcePair(options?: {
  crypto?: PkceCryptoProvider;
}): Promise<GggOAuthPkcePair> {
  const cryptoProvider = getPkceCryptoProvider(options?.crypto);
  const verifierBytes = cryptoProvider.getRandomValues(new Uint8Array(32));
  const codeVerifier = base64UrlEncode(verifierBytes);
  const digest = await cryptoProvider.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier),
  );

  return {
    codeVerifier,
    codeChallenge: base64UrlEncode(new Uint8Array(digest)),
    codeChallengeMethod: "S256",
  };
}

export function createGggOAuthAuthorizationUrl(
  options: GggOAuthAuthorizationUrlOptions,
) {
  const clientId = options.clientId.trim();
  const state = options.state.trim();

  if (!clientId) {
    throw new GggApiConfigurationError("GGG OAuth client id is required.");
  }

  if (!state) {
    throw new GggApiConfigurationError("GGG OAuth state is required.");
  }

  if (options.scopes.length === 0) {
    throw new GggApiConfigurationError(
      "GGG OAuth authorization requires at least one scope.",
    );
  }

  assertGggOAuthRedirectUri(options.redirectUri);
  assertGggOAuthPkcePair(options.pkce);

  const url = new URL(gggOAuthAuthorizeUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", options.scopes.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("code_challenge", options.pkce.codeChallenge);
  url.searchParams.set("code_challenge_method", options.pkce.codeChallengeMethod);

  return url.toString();
}

export async function exchangeGggOAuthAuthorizationCode(
  options: GggOAuthAuthorizationCodeExchangeOptions,
): Promise<GggOAuthTokenSet> {
  const clientId = assertNonEmptyString(
    options.clientId,
    "GGG OAuth client id is required.",
  );
  const code = assertNonEmptyString(
    options.code,
    "GGG OAuth authorization code is required.",
  );
  const codeVerifier = assertNonEmptyString(
    options.codeVerifier,
    "GGG OAuth code verifier is required.",
  );
  assertGggOAuthRedirectUri(options.redirectUri);

  return requestGggOAuthToken({
    fetch: options.fetch,
    tokenUrl: options.tokenUrl,
    now: options.now,
    fields: {
      client_id: clientId,
      ...(options.clientSecret
        ? { client_secret: options.clientSecret }
        : {}),
      grant_type: "authorization_code",
      code,
      redirect_uri: options.redirectUri,
      code_verifier: codeVerifier,
      ...(options.scopes ? { scope: options.scopes.join(" ") } : {}),
    },
  });
}

export async function refreshGggOAuthToken(
  options: GggOAuthRefreshTokenOptions,
): Promise<GggOAuthTokenSet> {
  const clientId = assertNonEmptyString(
    options.clientId,
    "GGG OAuth client id is required.",
  );
  const refreshToken = assertNonEmptyString(
    options.refreshToken,
    "GGG OAuth refresh token is required.",
  );

  return requestGggOAuthToken({
    fetch: options.fetch,
    tokenUrl: options.tokenUrl,
    now: options.now,
    fields: {
      client_id: clientId,
      ...(options.clientSecret
        ? { client_secret: options.clientSecret }
        : {}),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      ...(options.scopes ? { scope: options.scopes.join(" ") } : {}),
    },
  });
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
    value.scope.length === 0 ||
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

export async function capturePoe2CharacterSnapshot(
  options: CapturePoe2CharacterSnapshotOptions,
): Promise<AccountSnapshot> {
  const account = assertNonEmptyString(
    options.account,
    "Snapshot account is required.",
  );
  const capturedAt = toSnapshotIsoTimestamp(options.capturedAt ?? new Date());
  const id =
    options.id ??
    `snapshot-${capturedAt.replaceAll(":", "-").replaceAll(".", "-")}`;
  const characterSummaries = extractOfficialCharacterArray(
    await options.client.listPoe2Characters(),
  );
  const characters = await Promise.all(
    characterSummaries.map(async (summary, index) => {
      if (hasOfficialEquipment(summary)) {
        return toSnapshotCharacter(summary, index);
      }

      const name = getRequiredString(
        unwrapOfficialCharacter(summary),
        ["name"],
        `Official PoE2 character summary ${index + 1} is missing a name.`,
      );

      return toSnapshotCharacter(
        await options.client.getPoe2Character(name),
        index,
      );
    }),
  );

  return accountSnapshotSchema.parse({
    id,
    account,
    capturedAt,
    source: "official-poe2-character",
    capabilities: { characters: true, stashes: false },
    characters,
  });
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

function extractOfficialCharacterArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (isRecord(value) && Array.isArray(value.characters)) {
    return value.characters;
  }

  if (isRecord(value) && Array.isArray(value.entries)) {
    return value.entries;
  }

  throw new GggApiConfigurationError(
    "Official PoE2 character list response must contain a characters array.",
  );
}

function toSnapshotCharacter(
  value: unknown,
  index: number,
): AccountSnapshotCharacter {
  const character = unwrapOfficialCharacter(value);
  const name = getRequiredString(
    character,
    ["name"],
    `Official PoE2 character ${index + 1} is missing a name.`,
  );
  const className = getRequiredString(
    character,
    ["className", "class", "ascendancyClass"],
    `Official PoE2 character ${name} is missing a class name.`,
  );
  const league = getRequiredString(
    character,
    ["league"],
    `Official PoE2 character ${name} is missing a league.`,
  );
  const level = getRequiredPositiveInteger(
    character.level,
    `Official PoE2 character ${name} is missing a positive level.`,
  );
  const equipment = getOfficialEquipment(character).map((item, itemIndex) =>
    toSnapshotGearItem(item, name, itemIndex),
  );
  const passiveSkillIds = getOptionalStringArray(character, [
    "passiveSkillIds",
    "passives",
    "passive_skills",
  ]);
  const snapshotCharacter: AccountSnapshotCharacter = {
    id: getOptionalString(character, ["id", "characterId"]) ?? name,
    name,
    className,
    level,
    league,
    equipment,
  };

  if (passiveSkillIds) {
    snapshotCharacter.passiveSkillIds = passiveSkillIds;
  }

  return snapshotCharacter;
}

function toSnapshotGearItem(
  value: unknown,
  characterName: string,
  index: number,
): AccountSnapshotGearItem {
  if (!isRecord(value)) {
    throw new GggApiConfigurationError(
      `Official PoE2 equipment item ${index + 1} for ${characterName} must be an object.`,
    );
  }

  const slot = getRequiredString(
    value,
    ["slot", "inventoryId", "inventory_id"],
    `Official PoE2 equipment item ${index + 1} for ${characterName} is missing a slot.`,
  );
  const name = getRequiredString(
    value,
    ["name", "typeLine", "type_line"],
    `Official PoE2 equipment item ${index + 1} for ${characterName} is missing a name.`,
  );
  const item: AccountSnapshotGearItem = { slot, name };
  const itemId = getOptionalString(value, ["itemId", "id"]);
  const rarity = normalizeRarity(getOptionalString(value, ["rarity"]));
  const stats = getOptionalNumberRecord(value, ["stats", "properties"]);

  if (itemId) {
    item.itemId = itemId;
  }

  if (rarity) {
    item.rarity = rarity;
  }

  if (stats) {
    item.stats = stats;
  }

  return item;
}

function unwrapOfficialCharacter(value: unknown): Record<string, unknown> {
  if (isRecord(value) && isRecord(value.character)) {
    return value.character;
  }

  if (isRecord(value) && isRecord(value.data)) {
    return value.data;
  }

  if (isRecord(value)) {
    return value;
  }

  throw new GggApiConfigurationError(
    "Official PoE2 character response must be an object.",
  );
}

function hasOfficialEquipment(value: unknown): boolean {
  const character = unwrapOfficialCharacter(value);

  return (
    Array.isArray(character.equipment) ||
    Array.isArray(character.items) ||
    Array.isArray(character.inventory)
  );
}

function getOfficialEquipment(character: Record<string, unknown>): unknown[] {
  for (const field of ["equipment", "items", "inventory"] as const) {
    const value = character[field];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function getRequiredString(
  record: Record<string, unknown>,
  fields: readonly string[],
  message: string,
): string {
  const value = getOptionalString(record, fields);
  if (!value) {
    throw new GggApiConfigurationError(message);
  }

  return value;
}

function getOptionalString(
  record: Record<string, unknown>,
  fields: readonly string[],
): string | undefined {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function getRequiredPositiveInteger(value: unknown, message: string): number {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new GggApiConfigurationError(message);
  }

  return numberValue;
}

function getOptionalStringArray(
  record: Record<string, unknown>,
  fields: readonly string[],
): string[] | undefined {
  for (const field of fields) {
    const value = record[field];
    if (Array.isArray(value)) {
      const strings = value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean);

      return strings.length > 0 ? strings : undefined;
    }
  }

  return undefined;
}

function getOptionalNumberRecord(
  record: Record<string, unknown>,
  fields: readonly string[],
): Record<string, number> | undefined {
  for (const field of fields) {
    const value = record[field];
    if (!isRecord(value)) {
      continue;
    }

    const stats = Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, number] => typeof entry[1] === "number",
      ),
    );

    return Object.keys(stats).length > 0 ? stats : undefined;
  }

  return undefined;
}

function normalizeRarity(value: string | undefined): Rarity | undefined {
  const normalized = value?.trim().toLowerCase();

  return normalized === "normal" ||
    normalized === "magic" ||
    normalized === "rare" ||
    normalized === "unique" ||
    normalized === "gem" ||
    normalized === "currency"
    ? normalized
    : undefined;
}

function toSnapshotIsoTimestamp(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.valueOf())) {
    throw new GggApiConfigurationError(
      "Snapshot capturedAt must be a valid date.",
    );
  }

  return date.toISOString();
}

async function requestGggOAuthToken({
  fetch,
  tokenUrl,
  now = new Date(),
  fields,
}: {
  fetch: GggOAuthFetchLike;
  tokenUrl?: string | undefined;
  now?: Date | undefined;
  fields: Record<string, string>;
}) {
  const response = await fetch(tokenUrl ?? gggOAuthTokenUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(fields).toString(),
  });

  if (!response.ok) {
    throw new GggApiHttpError(
      `GGG OAuth token request failed with HTTP ${response.status}.`,
      response.status,
      await readErrorBody(response),
    );
  }

  return toGggOAuthTokenSet(await response.json(), now);
}

function toGggOAuthTokenSet(value: unknown, now: Date): GggOAuthTokenSet {
  if (!isRecord(value)) {
    throw new GggApiConfigurationError(
      "GGG OAuth token response must be an object.",
    );
  }

  const accessToken = assertNonEmptyString(
    value.access_token,
    "GGG OAuth token response requires an access token.",
  );
  const tokenType = assertNonEmptyString(
    value.token_type,
    "GGG OAuth token response requires a token type.",
  ).toLowerCase();
  if (tokenType !== "bearer") {
    throw new GggApiConfigurationError(
      "GGG OAuth token response must use bearer tokens.",
    );
  }

  const expiresIn =
    typeof value.expires_in === "number" ? value.expires_in : Number.NaN;
  if (!Number.isFinite(expiresIn) || expiresIn < 0) {
    throw new GggApiConfigurationError(
      "GGG OAuth token response requires a non-negative expires_in value.",
    );
  }

  const scope = parseOAuthScope(value.scope);
  const refreshToken =
    typeof value.refresh_token === "string" && value.refresh_token.trim()
      ? value.refresh_token
      : undefined;
  const sub =
    typeof value.sub === "string" && value.sub.trim() ? value.sub : undefined;
  const username =
    typeof value.username === "string" && value.username.trim()
      ? value.username
      : undefined;
  const tokenSet: GggOAuthTokenSet = {
    accessToken,
    tokenType: "bearer",
    scope,
    expiresAt: new Date(now.getTime() + expiresIn * 1000).toISOString(),
    ...(refreshToken ? { refreshToken } : {}),
    ...(sub ? { sub } : {}),
    ...(username ? { username } : {}),
  };

  assertGggOAuthTokenSet(tokenSet);
  return tokenSet;
}

function parseOAuthScope(value: unknown) {
  if (typeof value === "string") {
    return value
      .split(/\s+/)
      .map((scope) => scope.trim())
      .filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value.filter((scope): scope is string => typeof scope === "string");
  }

  return [];
}

function defaultSleep(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function assertNonEmptyString(value: unknown, message: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new GggApiConfigurationError(message);
  }

  return value.trim();
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

function getPkceCryptoProvider(
  cryptoProvider?: PkceCryptoProvider,
): PkceCryptoProvider {
  const resolvedProvider =
    cryptoProvider ??
    (globalThis as { crypto?: PkceCryptoProvider | undefined }).crypto;

  if (!resolvedProvider?.subtle?.digest || !resolvedProvider.getRandomValues) {
    throw new GggApiConfigurationError(
      "Web Crypto is required for GGG OAuth PKCE.",
    );
  }

  return resolvedProvider;
}

function assertGggOAuthRedirectUri(redirectUri: string): void {
  let url: URL;

  try {
    url = new URL(redirectUri);
  } catch {
    throw new GggApiConfigurationError(
      "GGG OAuth redirect URI must be a valid URL.",
    );
  }

  const isHttps = url.protocol === "https:";
  const isLoopbackHttp =
    url.protocol === "http:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);

  if (!isHttps && !isLoopbackHttp) {
    throw new GggApiConfigurationError(
      "GGG OAuth redirect URI must be HTTPS or a local loopback HTTP URL.",
    );
  }
}

function assertGggOAuthPkcePair(pkce: GggOAuthPkcePair): void {
  if (
    !pkce.codeVerifier.trim() ||
    !pkce.codeChallenge.trim() ||
    pkce.codeChallengeMethod !== "S256"
  ) {
    throw new GggApiConfigurationError(
      "GGG OAuth PKCE requires a verifier, S256 challenge, and S256 method.",
    );
  }
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
