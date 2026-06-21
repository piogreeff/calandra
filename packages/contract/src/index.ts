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
  iconAttribution: z.string().min(1),
});

export const uniqueCollectionSchema = z.object({
  ...versionedCollectionFields,
  uniques: z.array(uniqueItemSchema),
});

export const modSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  domain: z.string().min(1),
  minItemLevel: z.number().int().nonnegative(),
  tier: z.number().int().positive().optional(),
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

export const ladderBuildSchema = z.object({
  id: z.string().min(1),
  account: z.string().min(1),
  character: z.string().min(1),
  className: z.string().min(1),
  level: z.number().int().positive(),
});

export const ladderBuildCollectionSchema = z.object({
  ...versionedCollectionFields,
  builds: z.array(ladderBuildSchema),
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

export const datasetArtifactSchema = z.object({
  ...versionedCollectionFields,
  generatedAt: z.string().datetime(),
  source: z.literal("published-artifact"),
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

export const datasetManifestSchema = z.object({
  ...versionedCollectionFields,
  generatedAt: z.string().datetime(),
  artifactKey: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
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
    "/builds/ladder": {
      get: {
        operationId: "listLadderBuilds",
        summary: "List patch-versioned ladder build snapshots",
        parameters: versionedQueryParameters,
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
          minItemLevel: { type: "integer", minimum: 0 },
          tier: { type: "integer", minimum: 1 },
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
      LadderBuild: {
        type: "object",
        required: ["id", "account", "character", "className", "level"],
        properties: {
          id: { type: "string", minLength: 1 },
          account: { type: "string", minLength: 1 },
          character: { type: "string", minLength: 1 },
          className: { type: "string", minLength: 1 },
          level: { type: "integer", minimum: 1 },
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
    },
  },
} as const;

export type Rarity = z.infer<typeof raritySchema>;
export type Item = z.infer<typeof itemSchema>;
export type ItemCollection = z.infer<typeof itemCollectionSchema>;
export type UniqueItem = z.infer<typeof uniqueItemSchema>;
export type UniqueCollection = z.infer<typeof uniqueCollectionSchema>;
export type Mod = z.infer<typeof modSchema>;
export type ModCollection = z.infer<typeof modCollectionSchema>;
export type Gem = z.infer<typeof gemSchema>;
export type GemCollection = z.infer<typeof gemCollectionSchema>;
export type EconomyPrice = z.infer<typeof economyPriceSchema>;
export type EconomyCollection = z.infer<typeof economyCollectionSchema>;
export type LadderBuild = z.infer<typeof ladderBuildSchema>;
export type LadderBuildCollection = z.infer<typeof ladderBuildCollectionSchema>;
export type AdvisorStats = z.infer<typeof advisorStatsSchema>;
export type AdvisorGearItem = z.infer<typeof advisorGearItemSchema>;
export type UpgradeAdvisorCandidate = z.infer<
  typeof upgradeAdvisorCandidateSchema
>;
export type UpgradeAdvisorRequest = z.infer<typeof upgradeAdvisorRequestSchema>;
export type UpgradeAdvisorResult = z.infer<typeof upgradeAdvisorResultSchema>;
export type UpgradeAdvisorResponse = z.infer<
  typeof upgradeAdvisorResponseSchema
>;
export type DatasetArtifact = z.infer<typeof datasetArtifactSchema>;
export type DatasetCounts = z.infer<typeof datasetCountsSchema>;
export type DatasetManifest = z.infer<typeof datasetManifestSchema>;
