import { z } from "zod";

export const raritySchema = z.enum([
  "normal",
  "magic",
  "rare",
  "unique",
  "gem",
  "currency",
]);

export const itemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  rarity: raritySchema,
  iconUrl: z.string().url().optional(),
  iconSourceUrl: z.string().url().optional(),
  iconCacheKey: z.string().min(1).optional(),
  iconAttribution: z.string().min(1).optional(),
});

export const itemCollectionSchema = z.object({
  league: z.string().min(1),
  patch: z.string().min(1),
  items: z.array(itemSchema),
});

const versionedCollectionFields = {
  league: z.string().min(1),
  patch: z.string().min(1),
};

export const uniqueItemSchema = itemSchema.extend({
  rarity: z.literal("unique"),
  iconUrl: z.string().url(),
  iconSourceUrl: z.string().url().optional(),
  iconCacheKey: z.string().min(1).optional(),
  iconAttribution: z.string().min(1),
});

export const uniqueCollectionSchema = z.object({
  ...versionedCollectionFields,
  uniques: z.array(uniqueItemSchema),
});

export const modStatSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  min: z.number(),
  max: z.number(),
});

export const modSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  domain: z.string().min(1),
  generationType: z
    .enum(["prefix", "suffix", "implicit", "enchant", "unique", "rune"])
    .optional(),
  family: z.string().min(1).optional(),
  minItemLevel: z.number().int().nonnegative(),
  tier: z.number().int().positive().optional(),
  weight: z.number().positive().optional(),
  tags: z.array(z.string().min(1)).optional(),
  stats: z.array(modStatSchema).optional(),
});

export const modCollectionSchema = z.object({
  ...versionedCollectionFields,
  mods: z.array(modSchema),
});

export const gemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["skill", "support", "spirit"]),
  level: z.number().int().positive(),
  requiredLevel: z.number().int().nonnegative().optional(),
  tags: z.array(z.string().min(1)).optional(),
  attributeRequirements: z
    .object({
      strength: z.number().int().nonnegative().optional(),
      dexterity: z.number().int().nonnegative().optional(),
      intelligence: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

export const gemCollectionSchema = z.object({
  ...versionedCollectionFields,
  gems: z.array(gemSchema),
});

export const economyPriceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  chaosEquivalent: z.number().nonnegative(),
  updatedAt: z.string().datetime(),
});

export const economyCollectionSchema = z.object({
  ...versionedCollectionFields,
  prices: z.array(economyPriceSchema),
});

export const priceCheckMatchTypeSchema = z.enum(["id", "name"]);

export const priceCheckRequestSchema = z.object({
  ...versionedCollectionFields,
  item: itemSchema,
});

export const priceCheckResponseSchema = z.object({
  source: z.literal("published-dataset"),
  ...versionedCollectionFields,
  item: itemSchema,
  price: economyPriceSchema.nullable(),
  matchedBy: priceCheckMatchTypeSchema.nullable(),
});

export const accountSnapshotGearItemSchema = z.object({
  slot: z.string().min(1),
  name: z.string().min(1),
  itemId: z.string().min(1).optional(),
  rarity: raritySchema.optional(),
  iconUrl: z.string().url().optional(),
  iconAttribution: z.string().min(1).optional(),
  stats: z.record(z.number()).optional(),
});

export const ladderBuildSchema = z.object({
  id: z.string().min(1),
  account: z.string().min(1),
  character: z.string().min(1),
  className: z.string().min(1),
  level: z.number().int().positive(),
  rank: z.number().int().positive().optional(),
  mainSkill: z.string().min(1).optional(),
  profileUrl: z.string().url().optional(),
  passiveTreeUrl: z.string().url().optional(),
  passiveSkillIds: z.array(z.string().min(1)).optional(),
  equipment: z.array(accountSnapshotGearItemSchema).optional(),
  updatedAt: z.string().datetime().optional(),
});

export const ladderBuildCollectionSchema = z.object({
  ...versionedCollectionFields,
  builds: z.array(ladderBuildSchema),
});

export const datasetSearchResponseSchema = z.object({
  ...versionedCollectionFields,
  query: z.string().min(1),
  items: z.array(itemSchema),
  uniques: z.array(uniqueItemSchema),
  mods: z.array(modSchema),
  gems: z.array(gemSchema),
});

export const accountSnapshotSourceSchema = z.enum([
  "official-poe2-character",
  "clipboard",
  "manual-import",
]);

export const accountSnapshotCapabilitiesSchema = z.object({
  characters: z.boolean(),
  stashes: z.boolean(),
});

export const accountSnapshotCharacterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  className: z.string().min(1),
  level: z.number().int().positive(),
  league: z.string().min(1),
  equipment: z.array(accountSnapshotGearItemSchema),
  passiveSkillIds: z.array(z.string().min(1)).optional(),
});

export const accountSnapshotStashSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  league: z.string().min(1),
  items: z.array(accountSnapshotGearItemSchema),
});

export const accountSnapshotSchema = z.object({
  id: z.string().min(1),
  account: z.string().min(1),
  capturedAt: z.string().datetime(),
  source: accountSnapshotSourceSchema,
  capabilities: accountSnapshotCapabilitiesSchema,
  characters: z.array(accountSnapshotCharacterSchema),
  stashes: z.array(accountSnapshotStashSchema).optional(),
});

export const accountSnapshotWriteResponseSchema = z.object({
  source: z.literal("snapshot-store"),
  objectKey: z.string().min(1),
  snapshot: accountSnapshotSchema,
});

export const poe2CharacterSnapshotCaptureRequestSchema = z.object({
  account: z.string().min(1),
  accessToken: z.string().min(1),
  grantedScopes: z.array(z.string().min(1)).min(1),
  capturedAt: z.string().datetime().optional(),
  snapshotId: z.string().min(1).optional(),
});
export const poe2StoredTokenSnapshotCaptureRequestSchema = z.object({
  account: z.string().min(1),
  capturedAt: z.string().datetime().optional(),
  snapshotId: z.string().min(1).optional(),
});
export const gggOAuthTokenExchangeRequestSchema = z.object({
  account: z.string().min(1),
  code: z.string().min(1),
  codeVerifier: z.string().min(1),
  redirectUri: z.string().url(),
  scopes: z.array(z.string().min(1)).optional(),
});

export const gggOAuthStartRequestSchema = z.object({
  account: z.string().min(1),
  redirectUri: z.string().url().optional(),
  scopes: z.array(z.string().min(1)).optional(),
});

export const gggOAuthStartResponseSchema = z.object({
  source: z.literal("ggg-oauth-start"),
  account: z.string().min(1),
  authorizationUrl: z.string().url(),
  state: z.string().min(1),
  expiresAt: z.string().datetime(),
  redirectUri: z.string().url(),
  requiredScopes: z.array(z.string().min(1)),
});

export const gggOAuthCompleteRequestSchema = z.object({
  state: z.string().min(1),
  code: z.string().min(1),
});

export const gggOAuthTokenExchangeResponseSchema = z.object({
  source: z.literal("ggg-oauth-token-store"),
  account: z.string().min(1),
  objectKey: z.string().min(1),
  token: z.object({
    tokenType: z.literal("encrypted"),
    expiresAt: z.string().datetime(),
    scope: z.array(z.string().min(1)),
    username: z.string().min(1).optional(),
    sub: z.string().min(1).optional(),
  }),
});

export const gggOAuthStatusResponseSchema = z.object({
  source: z.literal("ggg-oauth-status"),
  configured: z.boolean(),
  redirectUri: z.string().url(),
  requiredScopes: z.array(z.string().min(1)),
  features: z.object({
    accountLinking: z.boolean(),
    snapshotCapture: z.boolean(),
  }),
});

export const accountSnapshotListItemSchema = z.object({
  account: z.string().min(1),
  snapshotId: z.string().min(1),
  objectKey: z.string().min(1),
  uploadedAt: z.string().datetime().optional(),
  size: z.number().int().nonnegative().optional(),
});

export const accountSnapshotListResponseSchema = z.object({
  source: z.literal("snapshot-store"),
  account: z.string().min(1),
  snapshots: z.array(accountSnapshotListItemSchema),
});

export const snapshotEntityChangeTypeSchema = z.enum([
  "added",
  "removed",
  "changed",
]);

export const snapshotEquipmentChangeSchema = z.object({
  type: snapshotEntityChangeTypeSchema,
  slot: z.string().min(1),
  beforeName: z.string().min(1).optional(),
  afterName: z.string().min(1).optional(),
});

export const snapshotCharacterChangeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: snapshotEntityChangeTypeSchema,
  beforeLevel: z.number().int().positive().optional(),
  afterLevel: z.number().int().positive().optional(),
  levelDelta: z.number().int(),
  equipmentChanges: z.array(snapshotEquipmentChangeSchema),
});

export const snapshotStashChangeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: snapshotEntityChangeTypeSchema,
  beforeItemCount: z.number().int().nonnegative().optional(),
  afterItemCount: z.number().int().nonnegative().optional(),
  itemCountDelta: z.number().int(),
});

export const accountSnapshotDiffSchema = z.object({
  beforeSnapshotId: z.string().min(1),
  afterSnapshotId: z.string().min(1),
  beforeCapturedAt: z.string().datetime(),
  afterCapturedAt: z.string().datetime(),
  characterChanges: z.array(snapshotCharacterChangeSchema),
  stashChanges: z.array(snapshotStashChangeSchema),
});

export const accountSnapshotDiffRequestSchema = z.object({
  before: accountSnapshotSchema,
  after: accountSnapshotSchema,
});

export const accountSnapshotStoredDiffRequestSchema = z.object({
  account: z.string().min(1),
  beforeSnapshotId: z.string().min(1),
  afterSnapshotId: z.string().min(1),
});

export const advisorStatsSchema = z.record(z.number());

export const advisorGearItemSchema = z.object({
  slot: z.string().min(1),
  name: z.string().min(1),
  stats: advisorStatsSchema,
});

export const upgradeAdvisorCandidateSchema = advisorGearItemSchema.extend({
  estimatedCostChaos: z.number().nonnegative().optional(),
});

export const upgradeAdvisorRequestSchema = z.object({
  weights: advisorStatsSchema,
  equipped: z.array(advisorGearItemSchema),
  candidates: z.array(upgradeAdvisorCandidateSchema),
  maxBudgetChaos: z.number().nonnegative().optional(),
});

export const snapshotUpgradeAdvisorRequestSchema = z.object({
  weights: advisorStatsSchema,
  maxBudgetChaos: z.number().nonnegative().optional(),
});

export const upgradeAdvisorResultSchema = z.object({
  slot: z.string().min(1),
  currentName: z.string().min(1),
  candidateName: z.string().min(1),
  currentScore: z.number(),
  candidateScore: z.number(),
  scoreDelta: z.number(),
  estimatedCostChaos: z.number().nonnegative().optional(),
  valuePerChaos: z.number().optional(),
  currentMissingStats: z.array(z.string()),
  candidateMissingStats: z.array(z.string()),
});

export const upgradeAdvisorResponseSchema = z.object({
  source: z.literal("deterministic-engine"),
  upgrades: z.array(upgradeAdvisorResultSchema),
});

export const craftingModCandidateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  minItemLevel: z.number().int().nonnegative(),
  weight: z.number().positive(),
});

export const craftingEstimateRequestSchema = z.object({
  itemLevel: z.number().int().nonnegative(),
  currencyCostChaos: z.number().nonnegative(),
  targetModIds: z.array(z.string().min(1)).min(1),
  modPool: z.array(craftingModCandidateSchema).min(1),
});

export const craftingEstimateResponseSchema = z.object({
  source: z.literal("deterministic-engine"),
  itemLevel: z.number().int().nonnegative(),
  currencyCostChaos: z.number().nonnegative(),
  eligibleModCount: z.number().int().nonnegative(),
  totalEligibleWeight: z.number().nonnegative(),
  eligibleTargetModIds: z.array(z.string().min(1)),
  blockedTargetModIds: z.array(z.string().min(1)),
  hitProbability: z.number().min(0).max(1),
  expectedAttempts: z.number().positive().optional(),
  expectedCostChaos: z.number().nonnegative().optional(),
});

export const acquisitionRecommendationSchema = z.enum(["buy", "craft"]);

export const buyVsCraftRequestSchema = z.object({
  marketPriceChaos: z.number().nonnegative(),
  crafting: craftingEstimateRequestSchema,
});

export const buyVsCraftResponseSchema = z.object({
  source: z.literal("deterministic-engine"),
  recommendation: acquisitionRecommendationSchema,
  marketPriceChaos: z.number().nonnegative(),
  expectedCraftCostChaos: z.number().nonnegative().optional(),
  savingsChaos: z.number().nonnegative(),
  estimate: craftingEstimateResponseSchema.omit({ source: true }),
});

export const datasetCraftingEstimateRequestSchema = z.object({
  itemLevel: z.number().int().nonnegative(),
  currencyCostChaos: z.number().nonnegative(),
  targetModIds: z.array(z.string().min(1)).min(1),
  marketPriceChaos: z.number().nonnegative().optional(),
});

export const datasetCraftingEstimateResponseSchema = z.object({
  source: z.literal("published-dataset"),
  ...versionedCollectionFields,
  estimate: craftingEstimateResponseSchema,
  comparison: buyVsCraftResponseSchema.optional(),
});

export const datasetSourceKindSchema = z.enum([
  "game-data",
  "economy",
  "ladder",
  "image",
]);

export const datasetSourceSchema = z.object({
  kind: datasetSourceKindSchema,
  name: z.string().min(1),
  url: z.string().url(),
  attribution: z.string().min(1),
});

export const datasetArtifactSchema = z.object({
  ...versionedCollectionFields,
  generatedAt: z.string().datetime(),
  source: z.literal("published-artifact"),
  sources: z.array(datasetSourceSchema).min(1),
  items: z.array(itemSchema),
  uniques: z.array(uniqueItemSchema),
  mods: z.array(modSchema),
  gems: z.array(gemSchema),
  economy: z.array(economyPriceSchema),
  ladderBuilds: z.array(ladderBuildSchema),
});

export const datasetCountsSchema = z.object({
  items: z.number().int().nonnegative(),
  uniques: z.number().int().nonnegative(),
  mods: z.number().int().nonnegative(),
  gems: z.number().int().nonnegative(),
  economy: z.number().int().nonnegative(),
  ladderBuilds: z.number().int().nonnegative(),
});

export const uniqueImageCoverageSchema = z.object({
  resolved: z.number().int().nonnegative(),
  expected: z.number().int().nonnegative(),
  ratio: z.number().min(0).max(1),
  minimum: z.number().min(0).max(1),
});

export const datasetQualityGatesSchema = z.object({
  uniqueImageCoverage: uniqueImageCoverageSchema.optional(),
});

export const datasetManifestSchema = z.object({
  ...versionedCollectionFields,
  generatedAt: z.string().datetime(),
  artifactKey: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  sources: z.array(datasetSourceSchema).min(1),
  qualityGates: datasetQualityGatesSchema.optional(),
  counts: datasetCountsSchema,
});

const versionedQueryParameters = [
  {
    name: "league",
    in: "query",
    required: true,
    schema: { type: "string", minLength: 1 },
  },
  {
    name: "patch",
    in: "query",
    required: true,
    schema: { type: "string", minLength: 1 },
  },
] as const;

const patchQueryParameter = {
  name: "patch",
  in: "query",
  required: true,
  schema: { type: "string", minLength: 1 },
} as const;

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Calandra API",
    version: "0.0.0",
    description:
      "Unofficial Path of Exile 2 companion API. Calandra ships no game assets.",
  },
  paths: {
    "/items": {
      get: {
        operationId: "listItems",
        summary: "List patch-versioned items",
        parameters: versionedQueryParameters,
        responses: {
          "200": {
            description: "Patch-versioned item collection",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ItemCollection" },
              },
            },
          },
          "400": {
            description: "Missing required league or patch query parameter",
          },
        },
      },
    },
    "/items/{id}": {
      get: {
        operationId: "getItem",
        summary: "Get one patch-versioned item",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", minLength: 1 },
          },
          ...versionedQueryParameters,
        ],
        responses: {
          "200": {
            description: "Item",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Item" },
              },
            },
          },
          "404": {
            description: "Item not found in the selected league and patch",
          },
        },
      },
    },
    "/uniques": {
      get: {
        operationId: "listUniques",
        summary: "List patch-versioned unique items",
        parameters: versionedQueryParameters,
        responses: {
          "200": {
            description: "Unique item collection",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UniqueCollection" },
              },
            },
          },
        },
      },
    },
    "/mods": {
      get: {
        operationId: "listMods",
        summary: "List patch-versioned item modifiers",
        parameters: versionedQueryParameters,
        responses: {
          "200": {
            description: "Modifier collection",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ModCollection" },
              },
            },
          },
        },
      },
    },
    "/gems": {
      get: {
        operationId: "listGems",
        summary: "List patch-versioned skill and support gems",
        parameters: versionedQueryParameters,
        responses: {
          "200": {
            description: "Gem collection",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GemCollection" },
              },
            },
          },
        },
      },
    },
    "/economy/{league}": {
      get: {
        operationId: "getEconomy",
        summary: "Get economy prices for a league and patch",
        parameters: [
          {
            name: "league",
            in: "path",
            required: true,
            schema: { type: "string", minLength: 1 },
          },
          patchQueryParameter,
        ],
        responses: {
          "200": {
            description: "Economy price collection",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EconomyCollection" },
              },
            },
          },
        },
      },
    },
    "/search": {
      get: {
        operationId: "searchDataset",
        summary: "Search the patch-versioned item database",
        parameters: [
          ...versionedQueryParameters,
          {
            name: "q",
            in: "query",
            required: true,
            schema: { type: "string", minLength: 1 },
          },
        ],
        responses: {
          "200": {
            description: "Grouped search results from the selected dataset",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/DatasetSearchResponse",
                },
              },
            },
          },
          "400": {
            description: "Missing required league, patch, or q query parameter",
          },
        },
      },
    },
    "/price/check": {
      post: {
        operationId: "checkItemPrice",
        summary: "Check a parsed item against patch-versioned economy data",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PriceCheckRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Deterministic price check result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PriceCheckResponse" },
              },
            },
          },
          "400": {
            description: "Invalid price check request",
          },
        },
      },
    },
    "/builds/ladder": {
      get: {
        operationId: "listLadderBuilds",
        summary: "List patch-versioned ladder build snapshots",
        parameters: [
          ...versionedQueryParameters,
          {
            name: "className",
            in: "query",
            schema: { type: "string" },
            required: false,
          },
          {
            name: "skill",
            in: "query",
            schema: { type: "string" },
            required: false,
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100 },
            required: false,
          },
        ],
        responses: {
          "200": {
            description: "Ladder build collection",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LadderBuildCollection" },
              },
            },
          },
        },
      },
    },
    "/builds/ladder/{id}": {
      get: {
        operationId: "getLadderBuild",
        summary: "Get one patch-versioned ladder build snapshot",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", minLength: 1 },
          },
          ...versionedQueryParameters,
        ],
        responses: {
          "200": {
            description: "Ladder build detail",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LadderBuild" },
              },
            },
          },
          "404": {
            description: "Ladder build not found for league and patch",
          },
        },
      },
    },
    "/datasets/manifest": {
      get: {
        operationId: "getDatasetManifest",
        summary: "Get the validated manifest for one published dataset",
        parameters: versionedQueryParameters,
        responses: {
          "200": {
            description: "Dataset manifest with counts and checksum",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DatasetManifest" },
              },
            },
          },
          "404": {
            description: "Dataset manifest not found for league and patch",
          },
        },
      },
    },
    "/snapshots/diff": {
      post: {
        operationId: "diffAccountSnapshots",
        summary: "Compare two account snapshots with the deterministic engine",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/AccountSnapshotDiffRequest",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Deterministic account snapshot diff",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AccountSnapshotDiff" },
              },
            },
          },
          "400": {
            description: "Invalid account snapshot diff request",
          },
        },
      },
    },
    "/snapshots/{account}/diff": {
      get: {
        operationId: "diffStoredAccountSnapshots",
        summary: "Compare two persisted account snapshots by snapshot id",
        parameters: [
          {
            name: "account",
            in: "path",
            required: true,
            schema: { type: "string", minLength: 1 },
          },
          {
            name: "beforeSnapshotId",
            in: "query",
            required: true,
            schema: { type: "string", minLength: 1 },
          },
          {
            name: "afterSnapshotId",
            in: "query",
            required: true,
            schema: { type: "string", minLength: 1 },
          },
        ],
        responses: {
          "200": {
            description: "Deterministic account snapshot diff",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AccountSnapshotDiff" },
              },
            },
          },
          "400": {
            description: "Missing or invalid stored snapshot diff parameters",
          },
          "404": {
            description: "Account snapshot not found",
          },
          "502": {
            description: "Stored account snapshot failed validation",
          },
          "503": {
            description: "Snapshot storage is not configured",
          },
        },
      },
    },
    "/snapshots": {
      post: {
        operationId: "saveAccountSnapshot",
        summary: "Persist one source-agnostic account snapshot",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AccountSnapshot" },
            },
          },
        },
        responses: {
          "201": {
            description: "Persisted account snapshot metadata",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AccountSnapshotWriteResponse",
                },
              },
            },
          },
          "400": {
            description: "Invalid account snapshot",
          },
          "503": {
            description: "Snapshot storage is not configured",
          },
        },
      },
    },
    "/auth/ggg/exchange": {
      post: {
        operationId: "exchangeGggOAuthToken",
        summary:
          "Exchange a GGG OAuth authorization code and store encrypted tokens",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/GggOAuthTokenExchangeRequest",
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Encrypted GGG OAuth token storage metadata",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/GggOAuthTokenExchangeResponse",
                },
              },
            },
          },
          "400": {
            description: "Invalid GGG OAuth token exchange request",
          },
          "401": {
            description: "Token exchange is unauthorized by Calandra",
          },
          "503": {
            description: "GGG OAuth token storage is not configured",
          },
        },
      },
    },
    "/auth/ggg/start": {
      post: {
        operationId: "startGggOAuthLink",
        summary: "Start browser-safe GGG OAuth account linking",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/GggOAuthStartRequest",
              },
            },
          },
        },
        responses: {
          "201": {
            description: "GGG OAuth authorization URL with server-held PKCE",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/GggOAuthStartResponse",
                },
              },
            },
          },
          "400": {
            description: "Invalid GGG OAuth start request",
          },
          "503": {
            description: "GGG OAuth browser link is not configured",
          },
        },
      },
    },
    "/auth/ggg/complete": {
      post: {
        operationId: "completeGggOAuthLink",
        summary: "Complete browser-safe GGG OAuth account linking",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/GggOAuthCompleteRequest",
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Encrypted GGG OAuth token storage metadata",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/GggOAuthTokenExchangeResponse",
                },
              },
            },
          },
          "400": {
            description: "Invalid GGG OAuth complete request",
          },
          "401": {
            description: "GGG OAuth state is invalid or expired",
          },
          "502": {
            description: "GGG OAuth token exchange failed",
          },
          "503": {
            description: "GGG OAuth browser link is not configured",
          },
        },
      },
    },
    "/auth/ggg/status": {
      get: {
        operationId: "getGggOAuthStatus",
        summary: "Get safe hosted GGG OAuth configuration status",
        responses: {
          "200": {
            description: "Non-secret GGG OAuth status for browser clients",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/GggOAuthStatusResponse",
                },
              },
            },
          },
        },
      },
    },
    "/snapshots/capture/poe2-stored-token": {
      post: {
        operationId: "capturePoe2StoredTokenSnapshot",
        summary:
          "Capture and persist an official PoE2 character snapshot with a stored encrypted GGG OAuth token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Poe2StoredTokenSnapshotCaptureRequest",
              },
            },
          },
        },
        responses: {
          "201": {
            description:
              "Persisted source-agnostic account snapshot captured from a stored encrypted GGG OAuth token",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AccountSnapshotWriteResponse",
                },
              },
            },
          },
          "400": {
            description:
              "Invalid stored-token PoE2 character snapshot capture request",
          },
          "401": {
            description: "Snapshot capture is unauthorized by Calandra or GGG",
          },
          "404": {
            description:
              "No linked encrypted GGG OAuth token exists for the account",
          },
          "503": {
            description: "Stored-token snapshot capture is not configured",
          },
        },
      },
    },
    "/snapshots/capture/poe2-character": {
      post: {
        operationId: "capturePoe2CharacterSnapshot",
        summary: "Capture and persist an official PoE2 character snapshot",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Poe2CharacterSnapshotCaptureRequest",
              },
            },
          },
        },
        responses: {
          "201": {
            description:
              "Persisted source-agnostic account snapshot captured from official PoE2 character data",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AccountSnapshotWriteResponse",
                },
              },
            },
          },
          "400": {
            description: "Invalid PoE2 character snapshot capture request",
          },
          "401": {
            description:
              "Snapshot capture is unauthorized by Calandra or the supplied GGG OAuth token",
          },
          "503": {
            description: "Snapshot bucket or GGG User-Agent is not configured",
          },
        },
      },
    },
    "/snapshots/{account}/{snapshotId}": {
      get: {
        operationId: "getAccountSnapshot",
        summary: "Restore one persisted account snapshot",
        parameters: [
          {
            name: "account",
            in: "path",
            required: true,
            schema: { type: "string", minLength: 1 },
          },
          {
            name: "snapshotId",
            in: "path",
            required: true,
            schema: { type: "string", minLength: 1 },
          },
        ],
        responses: {
          "200": {
            description: "Persisted account snapshot",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AccountSnapshot" },
              },
            },
          },
          "404": {
            description: "Account snapshot not found",
          },
          "502": {
            description: "Stored account snapshot failed validation",
          },
          "503": {
            description: "Snapshot storage is not configured",
          },
        },
      },
    },
    "/snapshots/{account}": {
      get: {
        operationId: "listAccountSnapshots",
        summary: "List persisted account snapshots",
        parameters: [
          {
            name: "account",
            in: "path",
            required: true,
            schema: { type: "string", minLength: 1 },
          },
        ],
        responses: {
          "200": {
            description: "Persisted account snapshot list",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AccountSnapshotListResponse",
                },
              },
            },
          },
          "503": {
            description: "Snapshot storage is not configured",
          },
        },
      },
    },
    "/advisor/upgrades": {
      post: {
        operationId: "rankUpgradeCandidates",
        summary: "Rank upgrade candidates with the deterministic engine",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpgradeAdvisorRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Deterministic upgrade ranking",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpgradeAdvisorResponse" },
              },
            },
          },
          "400": {
            description: "Invalid upgrade advisor request",
          },
        },
      },
    },
    "/advisor/snapshots/{account}/{snapshotId}": {
      post: {
        operationId: "rankSnapshotUpgradeCandidates",
        summary:
          "Rank upgrade candidates for one persisted account snapshot with published dataset prices",
        parameters: [
          {
            name: "account",
            in: "path",
            required: true,
            schema: { type: "string", minLength: 1 },
          },
          {
            name: "snapshotId",
            in: "path",
            required: true,
            schema: { type: "string", minLength: 1 },
          },
          ...versionedQueryParameters,
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/SnapshotUpgradeAdvisorRequest",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Deterministic snapshot upgrade rankings",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpgradeAdvisorResponse" },
              },
            },
          },
          "400": {
            description: "Invalid snapshot upgrade advisor request",
          },
          "404": {
            description: "Account snapshot not found",
          },
          "503": {
            description: "Snapshot storage is not configured",
          },
        },
      },
    },
    "/crafting/estimate": {
      post: {
        operationId: "estimateCraftingPlan",
        summary: "Estimate crafting odds and expected cost deterministically",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CraftingEstimateRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Deterministic crafting estimate",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CraftingEstimateResponse",
                },
              },
            },
          },
          "400": {
            description: "Invalid crafting estimate request",
          },
        },
      },
    },
    "/crafting/buy-vs-craft": {
      post: {
        operationId: "compareBuyVsCraft",
        summary: "Compare market buy price against deterministic crafting cost",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BuyVsCraftRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Deterministic buy-vs-craft recommendation",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BuyVsCraftResponse" },
              },
            },
          },
          "400": {
            description: "Invalid buy-vs-craft request",
          },
        },
      },
    },
    "/crafting/estimate-from-dataset": {
      post: {
        operationId: "estimateDatasetCraftingPlan",
        summary:
          "Estimate crafting odds from the published patch-versioned mod dataset",
        parameters: versionedQueryParameters,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/DatasetCraftingEstimateRequest",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Dataset-backed deterministic crafting estimate",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/DatasetCraftingEstimateResponse",
                },
              },
            },
          },
          "400": {
            description: "Invalid dataset crafting estimate request",
          },
          "404": {
            description: "Dataset artifact or weighted mod pool not found",
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Item: {
        type: "object",
        required: ["id", "name", "category", "rarity"],
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          category: { type: "string", minLength: 1 },
          rarity: {
            type: "string",
            enum: ["normal", "magic", "rare", "unique", "gem", "currency"],
          },
          iconUrl: { type: "string", format: "uri" },
          iconSourceUrl: { type: "string", format: "uri" },
          iconCacheKey: { type: "string", minLength: 1 },
          iconAttribution: { type: "string", minLength: 1 },
        },
      },
      ItemCollection: {
        type: "object",
        required: ["league", "patch", "items"],
        properties: {
          league: { type: "string", minLength: 1 },
          patch: { type: "string", minLength: 1 },
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/Item" },
          },
        },
      },
      Unique: {
        type: "object",
        required: [
          "id",
          "name",
          "category",
          "rarity",
          "iconUrl",
          "iconAttribution",
        ],
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          category: { type: "string", minLength: 1 },
          rarity: { type: "string", enum: ["unique"] },
          iconUrl: { type: "string", format: "uri" },
          iconSourceUrl: { type: "string", format: "uri" },
          iconCacheKey: { type: "string", minLength: 1 },
          iconAttribution: { type: "string", minLength: 1 },
        },
      },
      UniqueCollection: {
        type: "object",
        required: ["league", "patch", "uniques"],
        properties: {
          league: { type: "string", minLength: 1 },
          patch: { type: "string", minLength: 1 },
          uniques: {
            type: "array",
            items: { $ref: "#/components/schemas/Unique" },
          },
        },
      },
      Mod: {
        type: "object",
        required: ["id", "name", "domain", "minItemLevel"],
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          domain: { type: "string", minLength: 1 },
          generationType: {
            type: "string",
            enum: ["prefix", "suffix", "implicit", "enchant", "unique", "rune"],
          },
          family: { type: "string", minLength: 1 },
          minItemLevel: { type: "integer", minimum: 0 },
          tier: { type: "integer", minimum: 1 },
          weight: { type: "number", exclusiveMinimum: 0 },
          tags: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
          stats: {
            type: "array",
            items: { $ref: "#/components/schemas/ModStat" },
          },
        },
      },
      ModStat: {
        type: "object",
        required: ["id", "text", "min", "max"],
        properties: {
          id: { type: "string", minLength: 1 },
          text: { type: "string", minLength: 1 },
          min: { type: "number" },
          max: { type: "number" },
        },
      },
      ModCollection: {
        type: "object",
        required: ["league", "patch", "mods"],
        properties: {
          league: { type: "string", minLength: 1 },
          patch: { type: "string", minLength: 1 },
          mods: { type: "array", items: { $ref: "#/components/schemas/Mod" } },
        },
      },
      Gem: {
        type: "object",
        required: ["id", "name", "kind", "level"],
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          kind: { type: "string", enum: ["skill", "support", "spirit"] },
          level: { type: "integer", minimum: 1 },
          requiredLevel: { type: "integer", minimum: 0 },
          tags: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
          attributeRequirements: {
            type: "object",
            properties: {
              strength: { type: "integer", minimum: 0 },
              dexterity: { type: "integer", minimum: 0 },
              intelligence: { type: "integer", minimum: 0 },
            },
          },
        },
      },
      GemCollection: {
        type: "object",
        required: ["league", "patch", "gems"],
        properties: {
          league: { type: "string", minLength: 1 },
          patch: { type: "string", minLength: 1 },
          gems: { type: "array", items: { $ref: "#/components/schemas/Gem" } },
        },
      },
      EconomyPrice: {
        type: "object",
        required: ["id", "name", "chaosEquivalent", "updatedAt"],
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          chaosEquivalent: { type: "number", minimum: 0 },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      EconomyCollection: {
        type: "object",
        required: ["league", "patch", "prices"],
        properties: {
          league: { type: "string", minLength: 1 },
          patch: { type: "string", minLength: 1 },
          prices: {
            type: "array",
            items: { $ref: "#/components/schemas/EconomyPrice" },
          },
        },
      },
      PriceCheckRequest: {
        type: "object",
        required: ["league", "patch", "item"],
        properties: {
          league: { type: "string", minLength: 1 },
          patch: { type: "string", minLength: 1 },
          item: { $ref: "#/components/schemas/Item" },
        },
      },
      PriceCheckResponse: {
        type: "object",
        required: ["source", "league", "patch", "item", "price", "matchedBy"],
        properties: {
          source: { type: "string", enum: ["published-dataset"] },
          league: { type: "string", minLength: 1 },
          patch: { type: "string", minLength: 1 },
          item: { $ref: "#/components/schemas/Item" },
          price: {
            nullable: true,
            allOf: [{ $ref: "#/components/schemas/EconomyPrice" }],
          },
          matchedBy: {
            type: "string",
            enum: ["id", "name"],
            nullable: true,
          },
        },
      },
      LadderBuild: {
        type: "object",
        required: ["id", "account", "character", "className", "level"],
        properties: {
          id: { type: "string", minLength: 1 },
          account: { type: "string", minLength: 1 },
          character: { type: "string", minLength: 1 },
          className: { type: "string", minLength: 1 },
          level: { type: "integer", minimum: 1 },
          rank: { type: "integer", minimum: 1 },
          mainSkill: { type: "string", minLength: 1 },
          profileUrl: { type: "string", format: "uri" },
          passiveTreeUrl: { type: "string", format: "uri" },
          passiveSkillIds: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
          equipment: {
            type: "array",
            items: { $ref: "#/components/schemas/AccountSnapshotGearItem" },
          },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      LadderBuildCollection: {
        type: "object",
        required: ["league", "patch", "builds"],
        properties: {
          league: { type: "string", minLength: 1 },
          patch: { type: "string", minLength: 1 },
          builds: {
            type: "array",
            items: { $ref: "#/components/schemas/LadderBuild" },
          },
        },
      },
      DatasetSearchResponse: {
        type: "object",
        required: [
          "league",
          "patch",
          "query",
          "items",
          "uniques",
          "mods",
          "gems",
        ],
        properties: {
          league: { type: "string", minLength: 1 },
          patch: { type: "string", minLength: 1 },
          query: { type: "string", minLength: 1 },
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/Item" },
          },
          uniques: {
            type: "array",
            items: { $ref: "#/components/schemas/UniqueItem" },
          },
          mods: { type: "array", items: { $ref: "#/components/schemas/Mod" } },
          gems: { type: "array", items: { $ref: "#/components/schemas/Gem" } },
        },
      },
      AccountSnapshotCapabilities: {
        type: "object",
        required: ["characters", "stashes"],
        properties: {
          characters: { type: "boolean" },
          stashes: { type: "boolean" },
        },
      },
      AccountSnapshotGearItem: {
        type: "object",
        required: ["slot", "name"],
        properties: {
          slot: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          itemId: { type: "string", minLength: 1 },
          rarity: {
            type: "string",
            enum: ["normal", "magic", "rare", "unique", "gem", "currency"],
          },
          iconUrl: { type: "string", format: "uri" },
          iconAttribution: { type: "string", minLength: 1 },
          stats: { type: "object", additionalProperties: { type: "number" } },
        },
      },
      AccountSnapshotCharacter: {
        type: "object",
        required: ["id", "name", "className", "level", "league", "equipment"],
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          className: { type: "string", minLength: 1 },
          level: { type: "integer", minimum: 1 },
          league: { type: "string", minLength: 1 },
          equipment: {
            type: "array",
            items: { $ref: "#/components/schemas/AccountSnapshotGearItem" },
          },
          passiveSkillIds: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
        },
      },
      AccountSnapshotStash: {
        type: "object",
        required: ["id", "name", "league", "items"],
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          league: { type: "string", minLength: 1 },
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/AccountSnapshotGearItem" },
          },
        },
      },
      AccountSnapshot: {
        type: "object",
        required: [
          "id",
          "account",
          "capturedAt",
          "source",
          "capabilities",
          "characters",
        ],
        properties: {
          id: { type: "string", minLength: 1 },
          account: { type: "string", minLength: 1 },
          capturedAt: { type: "string", format: "date-time" },
          source: {
            type: "string",
            enum: ["official-poe2-character", "clipboard", "manual-import"],
          },
          capabilities: {
            $ref: "#/components/schemas/AccountSnapshotCapabilities",
          },
          characters: {
            type: "array",
            items: { $ref: "#/components/schemas/AccountSnapshotCharacter" },
          },
          stashes: {
            type: "array",
            items: { $ref: "#/components/schemas/AccountSnapshotStash" },
          },
        },
      },
      AccountSnapshotWriteResponse: {
        type: "object",
        required: ["source", "objectKey", "snapshot"],
        properties: {
          source: { type: "string", enum: ["snapshot-store"] },
          objectKey: { type: "string", minLength: 1 },
          snapshot: { $ref: "#/components/schemas/AccountSnapshot" },
        },
      },
      Poe2CharacterSnapshotCaptureRequest: {
        type: "object",
        required: ["account", "accessToken", "grantedScopes"],
        properties: {
          account: { type: "string", minLength: 1 },
          accessToken: { type: "string", minLength: 1 },
          grantedScopes: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 1 },
          },
          capturedAt: { type: "string", format: "date-time" },
          snapshotId: { type: "string", minLength: 1 },
        },
      },
      Poe2StoredTokenSnapshotCaptureRequest: {
        type: "object",
        required: ["account"],
        properties: {
          account: { type: "string", minLength: 1 },
          capturedAt: { type: "string", format: "date-time" },
          snapshotId: { type: "string", minLength: 1 },
        },
      },
      GggOAuthTokenExchangeRequest: {
        type: "object",
        required: ["account", "code", "codeVerifier", "redirectUri"],
        properties: {
          account: { type: "string", minLength: 1 },
          code: { type: "string", minLength: 1 },
          codeVerifier: { type: "string", minLength: 1 },
          redirectUri: { type: "string", format: "uri" },
          scopes: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
        },
      },
      GggOAuthStartRequest: {
        type: "object",
        required: ["account"],
        properties: {
          account: { type: "string", minLength: 1 },
          redirectUri: { type: "string", format: "uri" },
          scopes: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
        },
      },
      GggOAuthStartResponse: {
        type: "object",
        required: [
          "source",
          "account",
          "authorizationUrl",
          "state",
          "expiresAt",
          "redirectUri",
          "requiredScopes",
        ],
        properties: {
          source: { type: "string", enum: ["ggg-oauth-start"] },
          account: { type: "string", minLength: 1 },
          authorizationUrl: { type: "string", format: "uri" },
          state: { type: "string", minLength: 1 },
          expiresAt: { type: "string", format: "date-time" },
          redirectUri: { type: "string", format: "uri" },
          requiredScopes: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
        },
      },
      GggOAuthCompleteRequest: {
        type: "object",
        required: ["state", "code"],
        properties: {
          state: { type: "string", minLength: 1 },
          code: { type: "string", minLength: 1 },
        },
      },
      GggOAuthTokenExchangeResponse: {
        type: "object",
        required: ["source", "account", "objectKey", "token"],
        properties: {
          source: { type: "string", enum: ["ggg-oauth-token-store"] },
          account: { type: "string", minLength: 1 },
          objectKey: { type: "string", minLength: 1 },
          token: {
            type: "object",
            required: ["tokenType", "expiresAt", "scope"],
            properties: {
              tokenType: { type: "string", enum: ["encrypted"] },
              expiresAt: { type: "string", format: "date-time" },
              scope: {
                type: "array",
                items: { type: "string", minLength: 1 },
              },
              username: { type: "string", minLength: 1 },
              sub: { type: "string", minLength: 1 },
            },
          },
        },
      },
      GggOAuthStatusResponse: {
        type: "object",
        required: [
          "source",
          "configured",
          "redirectUri",
          "requiredScopes",
          "features",
        ],
        properties: {
          source: { type: "string", enum: ["ggg-oauth-status"] },
          configured: { type: "boolean" },
          redirectUri: { type: "string", format: "uri" },
          requiredScopes: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
          features: {
            type: "object",
            required: ["accountLinking", "snapshotCapture"],
            properties: {
              accountLinking: { type: "boolean" },
              snapshotCapture: { type: "boolean" },
            },
          },
        },
      },
      AccountSnapshotListItem: {
        type: "object",
        required: ["account", "snapshotId", "objectKey"],
        properties: {
          account: { type: "string", minLength: 1 },
          snapshotId: { type: "string", minLength: 1 },
          objectKey: { type: "string", minLength: 1 },
          uploadedAt: { type: "string", format: "date-time" },
          size: { type: "integer", minimum: 0 },
        },
      },
      AccountSnapshotListResponse: {
        type: "object",
        required: ["source", "account", "snapshots"],
        properties: {
          source: { type: "string", enum: ["snapshot-store"] },
          account: { type: "string", minLength: 1 },
          snapshots: {
            type: "array",
            items: { $ref: "#/components/schemas/AccountSnapshotListItem" },
          },
        },
      },
      SnapshotEquipmentChange: {
        type: "object",
        required: ["type", "slot"],
        properties: {
          type: { type: "string", enum: ["added", "removed", "changed"] },
          slot: { type: "string", minLength: 1 },
          beforeName: { type: "string", minLength: 1 },
          afterName: { type: "string", minLength: 1 },
        },
      },
      SnapshotCharacterChange: {
        type: "object",
        required: ["id", "name", "type", "levelDelta", "equipmentChanges"],
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          type: { type: "string", enum: ["added", "removed", "changed"] },
          beforeLevel: { type: "integer", minimum: 1 },
          afterLevel: { type: "integer", minimum: 1 },
          levelDelta: { type: "integer" },
          equipmentChanges: {
            type: "array",
            items: { $ref: "#/components/schemas/SnapshotEquipmentChange" },
          },
        },
      },
      SnapshotStashChange: {
        type: "object",
        required: ["id", "name", "type", "itemCountDelta"],
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          type: { type: "string", enum: ["added", "removed", "changed"] },
          beforeItemCount: { type: "integer", minimum: 0 },
          afterItemCount: { type: "integer", minimum: 0 },
          itemCountDelta: { type: "integer" },
        },
      },
      AccountSnapshotDiff: {
        type: "object",
        required: [
          "beforeSnapshotId",
          "afterSnapshotId",
          "beforeCapturedAt",
          "afterCapturedAt",
          "characterChanges",
          "stashChanges",
        ],
        properties: {
          beforeSnapshotId: { type: "string", minLength: 1 },
          afterSnapshotId: { type: "string", minLength: 1 },
          beforeCapturedAt: { type: "string", format: "date-time" },
          afterCapturedAt: { type: "string", format: "date-time" },
          characterChanges: {
            type: "array",
            items: { $ref: "#/components/schemas/SnapshotCharacterChange" },
          },
          stashChanges: {
            type: "array",
            items: { $ref: "#/components/schemas/SnapshotStashChange" },
          },
        },
      },
      AccountSnapshotDiffRequest: {
        type: "object",
        required: ["before", "after"],
        properties: {
          before: { $ref: "#/components/schemas/AccountSnapshot" },
          after: { $ref: "#/components/schemas/AccountSnapshot" },
        },
      },
      AccountSnapshotStoredDiffRequest: {
        type: "object",
        required: ["account", "beforeSnapshotId", "afterSnapshotId"],
        properties: {
          account: { type: "string", minLength: 1 },
          beforeSnapshotId: { type: "string", minLength: 1 },
          afterSnapshotId: { type: "string", minLength: 1 },
        },
      },
      AdvisorGearItem: {
        type: "object",
        required: ["slot", "name", "stats"],
        properties: {
          slot: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          stats: { type: "object", additionalProperties: { type: "number" } },
        },
      },
      UpgradeAdvisorCandidate: {
        type: "object",
        required: ["slot", "name", "stats"],
        properties: {
          slot: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          stats: { type: "object", additionalProperties: { type: "number" } },
          estimatedCostChaos: { type: "number", minimum: 0 },
        },
      },
      UpgradeAdvisorRequest: {
        type: "object",
        required: ["weights", "equipped", "candidates"],
        properties: {
          weights: { type: "object", additionalProperties: { type: "number" } },
          equipped: {
            type: "array",
            items: { $ref: "#/components/schemas/AdvisorGearItem" },
          },
          candidates: {
            type: "array",
            items: { $ref: "#/components/schemas/UpgradeAdvisorCandidate" },
          },
          maxBudgetChaos: { type: "number", minimum: 0 },
        },
      },
      SnapshotUpgradeAdvisorRequest: {
        type: "object",
        required: ["weights"],
        properties: {
          weights: { type: "object", additionalProperties: { type: "number" } },
          maxBudgetChaos: { type: "number", minimum: 0 },
        },
      },
      UpgradeAdvisorResult: {
        type: "object",
        required: [
          "slot",
          "currentName",
          "candidateName",
          "currentScore",
          "candidateScore",
          "scoreDelta",
          "currentMissingStats",
          "candidateMissingStats",
        ],
        properties: {
          slot: { type: "string", minLength: 1 },
          currentName: { type: "string", minLength: 1 },
          candidateName: { type: "string", minLength: 1 },
          currentScore: { type: "number" },
          candidateScore: { type: "number" },
          scoreDelta: { type: "number" },
          estimatedCostChaos: { type: "number", minimum: 0 },
          valuePerChaos: { type: "number" },
          currentMissingStats: { type: "array", items: { type: "string" } },
          candidateMissingStats: { type: "array", items: { type: "string" } },
        },
      },
      UpgradeAdvisorResponse: {
        type: "object",
        required: ["source", "upgrades"],
        properties: {
          source: { type: "string", enum: ["deterministic-engine"] },
          upgrades: {
            type: "array",
            items: { $ref: "#/components/schemas/UpgradeAdvisorResult" },
          },
        },
      },
      CraftingModCandidate: {
        type: "object",
        required: ["id", "name", "minItemLevel", "weight"],
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          minItemLevel: { type: "integer", minimum: 0 },
          weight: { type: "number", exclusiveMinimum: 0 },
        },
      },
      CraftingEstimateRequest: {
        type: "object",
        required: ["itemLevel", "currencyCostChaos", "targetModIds", "modPool"],
        properties: {
          itemLevel: { type: "integer", minimum: 0 },
          currencyCostChaos: { type: "number", minimum: 0 },
          targetModIds: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 1 },
          },
          modPool: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/components/schemas/CraftingModCandidate" },
          },
        },
      },
      CraftingEstimateResponse: {
        type: "object",
        required: [
          "source",
          "itemLevel",
          "currencyCostChaos",
          "eligibleModCount",
          "totalEligibleWeight",
          "eligibleTargetModIds",
          "blockedTargetModIds",
          "hitProbability",
        ],
        properties: {
          source: { type: "string", enum: ["deterministic-engine"] },
          itemLevel: { type: "integer", minimum: 0 },
          currencyCostChaos: { type: "number", minimum: 0 },
          eligibleModCount: { type: "integer", minimum: 0 },
          totalEligibleWeight: { type: "number", minimum: 0 },
          eligibleTargetModIds: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
          blockedTargetModIds: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
          hitProbability: { type: "number", minimum: 0, maximum: 1 },
          expectedAttempts: { type: "number", exclusiveMinimum: 0 },
          expectedCostChaos: { type: "number", minimum: 0 },
        },
      },
      BuyVsCraftRequest: {
        type: "object",
        required: ["marketPriceChaos", "crafting"],
        properties: {
          marketPriceChaos: { type: "number", minimum: 0 },
          crafting: { $ref: "#/components/schemas/CraftingEstimateRequest" },
        },
      },
      BuyVsCraftResponse: {
        type: "object",
        required: [
          "source",
          "recommendation",
          "marketPriceChaos",
          "savingsChaos",
          "estimate",
        ],
        properties: {
          source: { type: "string", enum: ["deterministic-engine"] },
          recommendation: { type: "string", enum: ["buy", "craft"] },
          marketPriceChaos: { type: "number", minimum: 0 },
          expectedCraftCostChaos: { type: "number", minimum: 0 },
          savingsChaos: { type: "number", minimum: 0 },
          estimate: { $ref: "#/components/schemas/CraftingEstimateResult" },
        },
      },
      CraftingEstimateResult: {
        type: "object",
        required: [
          "itemLevel",
          "currencyCostChaos",
          "eligibleModCount",
          "totalEligibleWeight",
          "eligibleTargetModIds",
          "blockedTargetModIds",
          "hitProbability",
        ],
        properties: {
          itemLevel: { type: "integer", minimum: 0 },
          currencyCostChaos: { type: "number", minimum: 0 },
          eligibleModCount: { type: "integer", minimum: 0 },
          totalEligibleWeight: { type: "number", minimum: 0 },
          eligibleTargetModIds: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
          blockedTargetModIds: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
          hitProbability: { type: "number", minimum: 0, maximum: 1 },
          expectedAttempts: { type: "number", exclusiveMinimum: 0 },
          expectedCostChaos: { type: "number", minimum: 0 },
        },
      },
      DatasetCraftingEstimateRequest: {
        type: "object",
        required: ["itemLevel", "currencyCostChaos", "targetModIds"],
        properties: {
          itemLevel: { type: "integer", minimum: 0 },
          currencyCostChaos: { type: "number", minimum: 0 },
          targetModIds: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 1 },
          },
          marketPriceChaos: { type: "number", minimum: 0 },
        },
      },
      DatasetCraftingEstimateResponse: {
        type: "object",
        required: ["source", "league", "patch", "estimate"],
        properties: {
          source: { type: "string", enum: ["published-dataset"] },
          league: { type: "string", minLength: 1 },
          patch: { type: "string", minLength: 1 },
          estimate: { $ref: "#/components/schemas/CraftingEstimateResponse" },
          comparison: { $ref: "#/components/schemas/BuyVsCraftResponse" },
        },
      },
      DatasetCounts: {
        type: "object",
        required: [
          "items",
          "uniques",
          "mods",
          "gems",
          "economy",
          "ladderBuilds",
        ],
        properties: {
          items: { type: "integer", minimum: 0 },
          uniques: { type: "integer", minimum: 0 },
          mods: { type: "integer", minimum: 0 },
          gems: { type: "integer", minimum: 0 },
          economy: { type: "integer", minimum: 0 },
          ladderBuilds: { type: "integer", minimum: 0 },
        },
      },
      DatasetSource: {
        type: "object",
        required: ["kind", "name", "url", "attribution"],
        properties: {
          kind: {
            type: "string",
            enum: ["game-data", "economy", "ladder", "image"],
          },
          name: { type: "string", minLength: 1 },
          url: { type: "string", format: "uri" },
          attribution: { type: "string", minLength: 1 },
        },
      },
      UniqueImageCoverage: {
        type: "object",
        required: ["resolved", "expected", "ratio", "minimum"],
        properties: {
          resolved: { type: "integer", minimum: 0 },
          expected: { type: "integer", minimum: 0 },
          ratio: { type: "number", minimum: 0, maximum: 1 },
          minimum: { type: "number", minimum: 0, maximum: 1 },
        },
      },
      DatasetQualityGates: {
        type: "object",
        properties: {
          uniqueImageCoverage: {
            $ref: "#/components/schemas/UniqueImageCoverage",
          },
        },
      },
      DatasetManifest: {
        type: "object",
        required: [
          "league",
          "patch",
          "generatedAt",
          "artifactKey",
          "sha256",
          "sources",
          "counts",
        ],
        properties: {
          league: { type: "string", minLength: 1 },
          patch: { type: "string", minLength: 1 },
          generatedAt: { type: "string", format: "date-time" },
          artifactKey: { type: "string", minLength: 1 },
          sha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
          sources: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/components/schemas/DatasetSource" },
          },
          qualityGates: { $ref: "#/components/schemas/DatasetQualityGates" },
          counts: { $ref: "#/components/schemas/DatasetCounts" },
        },
      },
    },
  },
} as const;

export type Rarity = z.infer<typeof raritySchema>;
export type Item = z.infer<typeof itemSchema>;
export type ItemCollection = z.infer<typeof itemCollectionSchema>;
export type UniqueItem = z.infer<typeof uniqueItemSchema>;
export type UniqueCollection = z.infer<typeof uniqueCollectionSchema>;
export type ModStat = z.infer<typeof modStatSchema>;
export type Mod = z.infer<typeof modSchema>;
export type ModCollection = z.infer<typeof modCollectionSchema>;
export type Gem = z.infer<typeof gemSchema>;
export type GemCollection = z.infer<typeof gemCollectionSchema>;
export type EconomyPrice = z.infer<typeof economyPriceSchema>;
export type EconomyCollection = z.infer<typeof economyCollectionSchema>;
export type PriceCheckMatchType = z.infer<typeof priceCheckMatchTypeSchema>;
export type PriceCheckRequest = z.infer<typeof priceCheckRequestSchema>;
export type PriceCheckResponse = z.infer<typeof priceCheckResponseSchema>;
export type LadderBuild = z.infer<typeof ladderBuildSchema>;
export type LadderBuildCollection = z.infer<typeof ladderBuildCollectionSchema>;
export type DatasetSearchResponse = z.infer<typeof datasetSearchResponseSchema>;
export type AccountSnapshotSource = z.infer<typeof accountSnapshotSourceSchema>;
export type AccountSnapshotCapabilities = z.infer<
  typeof accountSnapshotCapabilitiesSchema
>;
export type AccountSnapshotGearItem = z.infer<
  typeof accountSnapshotGearItemSchema
>;
export type AccountSnapshotCharacter = z.infer<
  typeof accountSnapshotCharacterSchema
>;
export type AccountSnapshotStash = z.infer<typeof accountSnapshotStashSchema>;
export type AccountSnapshot = z.infer<typeof accountSnapshotSchema>;
export type AccountSnapshotWriteResponse = z.infer<
  typeof accountSnapshotWriteResponseSchema
>;
export type Poe2CharacterSnapshotCaptureRequest = z.infer<
  typeof poe2CharacterSnapshotCaptureRequestSchema
>;
export type Poe2StoredTokenSnapshotCaptureRequest = z.infer<
  typeof poe2StoredTokenSnapshotCaptureRequestSchema
>;
export type GggOAuthTokenExchangeRequest = z.infer<
  typeof gggOAuthTokenExchangeRequestSchema
>;
export type GggOAuthStartRequest = z.infer<typeof gggOAuthStartRequestSchema>;
export type GggOAuthStartResponse = z.infer<typeof gggOAuthStartResponseSchema>;
export type GggOAuthCompleteRequest = z.infer<
  typeof gggOAuthCompleteRequestSchema
>;
export type GggOAuthTokenExchangeResponse = z.infer<
  typeof gggOAuthTokenExchangeResponseSchema
>;
export type GggOAuthStatusResponse = z.infer<
  typeof gggOAuthStatusResponseSchema
>;
export type AccountSnapshotListItem = z.infer<
  typeof accountSnapshotListItemSchema
>;
export type AccountSnapshotListResponse = z.infer<
  typeof accountSnapshotListResponseSchema
>;
export type SnapshotEntityChangeType = z.infer<
  typeof snapshotEntityChangeTypeSchema
>;
export type SnapshotEquipmentChange = z.infer<
  typeof snapshotEquipmentChangeSchema
>;
export type SnapshotCharacterChange = z.infer<
  typeof snapshotCharacterChangeSchema
>;
export type SnapshotStashChange = z.infer<typeof snapshotStashChangeSchema>;
export type AccountSnapshotDiff = z.infer<typeof accountSnapshotDiffSchema>;
export type AccountSnapshotDiffRequest = z.infer<
  typeof accountSnapshotDiffRequestSchema
>;
export type AccountSnapshotStoredDiffRequest = z.infer<
  typeof accountSnapshotStoredDiffRequestSchema
>;
export type AdvisorStats = z.infer<typeof advisorStatsSchema>;
export type AdvisorGearItem = z.infer<typeof advisorGearItemSchema>;
export type UpgradeAdvisorCandidate = z.infer<
  typeof upgradeAdvisorCandidateSchema
>;
export type UpgradeAdvisorRequest = z.infer<typeof upgradeAdvisorRequestSchema>;
export type SnapshotUpgradeAdvisorRequest = z.infer<
  typeof snapshotUpgradeAdvisorRequestSchema
>;
export type UpgradeAdvisorResult = z.infer<typeof upgradeAdvisorResultSchema>;
export type UpgradeAdvisorResponse = z.infer<
  typeof upgradeAdvisorResponseSchema
>;
export type CraftingModCandidate = z.infer<typeof craftingModCandidateSchema>;
export type CraftingEstimateRequest = z.infer<
  typeof craftingEstimateRequestSchema
>;
export type CraftingEstimateResponse = z.infer<
  typeof craftingEstimateResponseSchema
>;
export type AcquisitionRecommendation = z.infer<
  typeof acquisitionRecommendationSchema
>;
export type BuyVsCraftRequest = z.infer<typeof buyVsCraftRequestSchema>;
export type BuyVsCraftResponse = z.infer<typeof buyVsCraftResponseSchema>;
export type DatasetCraftingEstimateRequest = z.infer<
  typeof datasetCraftingEstimateRequestSchema
>;
export type DatasetCraftingEstimateResponse = z.infer<
  typeof datasetCraftingEstimateResponseSchema
>;
export type DatasetSourceKind = z.infer<typeof datasetSourceKindSchema>;
export type DatasetSource = z.infer<typeof datasetSourceSchema>;
export type DatasetArtifact = z.infer<typeof datasetArtifactSchema>;
export type DatasetCounts = z.infer<typeof datasetCountsSchema>;
export type UniqueImageCoverage = z.infer<typeof uniqueImageCoverageSchema>;
export type DatasetQualityGates = z.infer<typeof datasetQualityGatesSchema>;
export type DatasetManifest = z.infer<typeof datasetManifestSchema>;
