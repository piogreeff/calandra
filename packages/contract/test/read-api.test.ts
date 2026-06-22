import { describe, expect, it } from "vitest";
import {
  accountSnapshotDiffRequestSchema,
  accountSnapshotDiffSchema,
  accountSnapshotListResponseSchema,
  accountSnapshotStoredDiffRequestSchema,
  accountSnapshotWriteResponseSchema,
  accountSnapshotSchema,
  buyVsCraftRequestSchema,
  buyVsCraftResponseSchema,
  craftingEstimateRequestSchema,
  craftingEstimateResponseSchema,
  datasetArtifactSchema,
  datasetManifestSchema,
  datasetSearchResponseSchema,
  economyCollectionSchema,
  gemCollectionSchema,
  gggOAuthCompleteRequestSchema,
  gggOAuthStartRequestSchema,
  gggOAuthStartResponseSchema,
  gggOAuthStatusResponseSchema,
  ladderBuildCollectionSchema,
  ladderBuildSchema,
  modCollectionSchema,
  openApiDocument,
  gggOAuthTokenExchangeRequestSchema,
  gggOAuthTokenExchangeResponseSchema,
  poe2CharacterSnapshotCaptureRequestSchema,
  poe2StoredTokenSnapshotCaptureRequestSchema,
  priceCheckRequestSchema,
  priceCheckResponseSchema,
  snapshotUpgradeAdvisorRequestSchema,
  upgradeAdvisorRequestSchema,
  upgradeAdvisorResponseSchema,
  uniqueCollectionSchema,
} from "../src/index";

const datasetSources = [
  {
    kind: "game-data",
    name: "poe2db.tw",
    url: "https://poe2db.tw/",
    attribution:
      "Game data derived from Path of Exile 2 community references; Path of Exile 2 is property of Grinding Gear Games.",
  },
] as const;

describe("phase 1 read API contract", () => {
  it("models a published dataset artifact keyed by league and patch", () => {
    const artifact = datasetArtifactSchema.parse({
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      generatedAt: "2026-06-21T00:00:00.000Z",
      source: "published-artifact",
      sources: datasetSources,
      items: [],
      uniques: [],
      mods: [],
      gems: [],
      economy: [],
      ladderBuilds: [],
    });

    expect(artifact.league).toBe("Dawn of the Hunt");
    expect(artifact.patch).toBe("0.2.0");
  });

  it("rejects unversioned dataset artifacts", () => {
    expect(() =>
      datasetArtifactSchema.parse({
        generatedAt: "2026-06-21T00:00:00.000Z",
        source: "published-artifact",
        items: [],
        uniques: [],
        mods: [],
        gems: [],
        economy: [],
        ladderBuilds: [],
      }),
    ).toThrow();
  });

  it("requires published dataset artifacts to carry source attribution", () => {
    expect(() =>
      datasetArtifactSchema.parse({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        generatedAt: "2026-06-21T00:00:00.000Z",
        source: "published-artifact",
        items: [],
        uniques: [],
        mods: [],
        gems: [],
        economy: [],
        ladderBuilds: [],
      }),
    ).toThrow();

    const artifact = datasetArtifactSchema.parse({
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      generatedAt: "2026-06-21T00:00:00.000Z",
      source: "published-artifact",
      sources: [
        {
          kind: "game-data",
          name: "poe2db.tw",
          url: "https://poe2db.tw/",
          attribution:
            "Game data derived from Path of Exile 2 community references; Path of Exile 2 is property of Grinding Gear Games.",
        },
        {
          kind: "image",
          name: "Grinding Gear Games CDN",
          url: "https://web.poecdn.com/",
          attribution:
            "Item art is property of Grinding Gear Games and is cached for attribution-preserving display.",
        },
      ],
      items: [],
      uniques: [],
      mods: [],
      gems: [],
      economy: [],
      ladderBuilds: [],
    });

    expect(artifact.sources).toHaveLength(2);
    expect(artifact.sources[0]?.kind).toBe("game-data");
  });

  it("models a published dataset manifest with counts and checksum", () => {
    const manifest = datasetManifestSchema.parse({
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      generatedAt: "2026-06-21T00:00:00.000Z",
      artifactKey: "datasets/Dawn of the Hunt/0.2.0.json",
      sha256:
        "f9a02504025955ed0a2352e142921ab4909596ee6b69809837b44d94abe636d0",
      sources: [
        {
          kind: "economy",
          name: "poe.ninja",
          url: "https://poe.ninja/poe2",
          attribution:
            "Economy prices are derived from poe.ninja's Path of Exile 2 economy dataset.",
        },
      ],
      qualityGates: {
        uniqueImageCoverage: {
          resolved: 19,
          expected: 20,
          ratio: 0.95,
          minimum: 0.95,
        },
      },
      counts: {
        items: 1,
        uniques: 0,
        mods: 0,
        gems: 0,
        economy: 0,
        ladderBuilds: 0,
      },
    });

    expect(manifest.artifactKey).toBe("datasets/Dawn of the Hunt/0.2.0.json");
    expect(manifest.sources[0]?.name).toBe("poe.ninja");
    expect(manifest.qualityGates?.uniqueImageCoverage?.ratio).toBe(0.95);
  });

  it("keeps unique image attribution explicit without bundling assets", () => {
    const collection = uniqueCollectionSchema.parse({
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      uniques: [
        {
          id: "choir-of-the-storm",
          name: "Choir of the Storm",
          category: "amulet",
          rarity: "unique",
          iconUrl: "https://web.poecdn.com/image/example.png",
          iconAttribution:
            "Game art and item data are property of Grinding Gear Games.",
        },
      ],
    });

    expect(collection.uniques[0]?.rarity).toBe("unique");
    expect(collection.uniques[0]?.iconAttribution).toContain(
      "Grinding Gear Games",
    );
  });

  it("validates versioned mods, gems, economy, and ladder collections", () => {
    expect(
      modCollectionSchema.parse({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        mods: [
          {
            id: "mod-life-1",
            name: "+# to maximum Life",
            domain: "item",
            generationType: "prefix",
            family: "Life",
            minItemLevel: 1,
            tier: 1,
            tags: ["life", "defences"],
            stats: [
              {
                id: "base_maximum_life",
                text: "+# to maximum Life",
                min: 80,
                max: 99,
              },
            ],
          },
        ],
      }).mods,
    ).toHaveLength(1);

    expect(
      gemCollectionSchema.parse({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        gems: [
          {
            id: "spark",
            name: "Spark",
            kind: "skill",
            level: 1,
            requiredLevel: 1,
            tags: ["spell", "lightning", "projectile"],
            attributeRequirements: { intelligence: 10 },
          },
        ],
      }).gems,
    ).toHaveLength(1);

    expect(
      economyCollectionSchema.parse({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        prices: [
          {
            id: "divine-orb",
            name: "Divine Orb",
            chaosEquivalent: 142,
            updatedAt: "2026-06-21T00:00:00.000Z",
          },
        ],
      }).prices,
    ).toHaveLength(1);

    expect(
      ladderBuildCollectionSchema.parse({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        builds: [
          {
            id: "deadeye-1",
            account: "example",
            character: "CalandraTest",
            className: "Deadeye",
            level: 92,
            rank: 42,
            mainSkill: "Lightning Arrow",
            profileUrl:
              "https://poe.ninja/poe2/builds/dawn/character/example/CalandraTest",
            passiveTreeUrl:
              "https://poe.ninja/poe2/builds/dawn/character/example/CalandraTest/passive-tree",
            passiveSkillIds: ["keystone-1", "notable-2"],
            updatedAt: "2026-06-22T00:00:00.000Z",
          },
        ],
      }).builds,
    ).toHaveLength(1);
    expect(
      ladderBuildCollectionSchema.parse({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        builds: [
          {
            id: "deadeye-1",
            account: "example",
            character: "CalandraTest",
            className: "Deadeye",
            level: 92,
            rank: 42,
            mainSkill: "Lightning Arrow",
            profileUrl:
              "https://poe.ninja/poe2/builds/dawn/character/example/CalandraTest",
            passiveTreeUrl:
              "https://poe.ninja/poe2/builds/dawn/character/example/CalandraTest/passive-tree",
            passiveSkillIds: ["keystone-1", "notable-2"],
            updatedAt: "2026-06-22T00:00:00.000Z",
          },
        ],
      }).builds[0],
    ).toMatchObject({
      rank: 42,
      mainSkill: "Lightning Arrow",
      passiveSkillIds: ["keystone-1", "notable-2"],
    });
    expect(
      ladderBuildSchema.parse({
        id: "deadeye-1",
        account: "example",
        character: "CalandraTest",
        className: "Deadeye",
        level: 92,
        equipment: [
          {
            slot: "Gloves",
            name: "Duskthread Grips",
            rarity: "rare",
            iconUrl: "https://calandra.pages.dev/demo-gloves.svg",
            iconAttribution:
              "Synthetic Calandra demo icon; no game art is bundled.",
            stats: { life: 65, fireResistance: 18 },
          },
        ],
      }).equipment?.[0],
    ).toMatchObject({ slot: "Gloves", name: "Duskthread Grips" });
  });

  it("models grouped dataset search results for the patch-versioned item database", () => {
    const results = datasetSearchResponseSchema.parse({
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      query: "storm",
      items: [],
      uniques: [
        {
          id: "choir-of-the-storm",
          name: "Choir of the Storm",
          category: "amulet",
          rarity: "unique",
          iconUrl: "https://web.poecdn.com/image/example.png",
          iconAttribution:
            "Game art and item data are property of Grinding Gear Games.",
        },
      ],
      mods: [
        {
          id: "storm-damage-prefix",
          name: "+#% increased Storm Damage",
          domain: "item",
          minItemLevel: 1,
        },
      ],
      gems: [
        {
          id: "storm-wave",
          name: "Storm Wave",
          kind: "skill",
          level: 1,
        },
      ],
    });

    expect(results.query).toBe("storm");
    expect(results.uniques[0]?.rarity).toBe("unique");
    expect(results.mods[0]?.id).toBe("storm-damage-prefix");
    expect(results.gems[0]?.name).toBe("Storm Wave");
  });

  it("exports Phase 1 read endpoints in OpenAPI", () => {
    expect(openApiDocument.paths["/items/{id}"]).toBeDefined();
    expect(openApiDocument.paths["/uniques"]).toBeDefined();
    expect(openApiDocument.paths["/mods"]).toBeDefined();
    expect(openApiDocument.paths["/gems"]).toBeDefined();
    expect(openApiDocument.paths["/economy/{league}"]).toBeDefined();
    expect(openApiDocument.paths["/search"]).toBeDefined();
    expect(openApiDocument.paths["/search"]?.get?.operationId).toBe(
      "searchDataset",
    );
    expect(openApiDocument.paths["/builds/ladder"]).toBeDefined();
    expect(openApiDocument.paths["/builds/ladder/{id}"]).toBeDefined();
    expect(
      openApiDocument.paths["/builds/ladder/{id}"]?.get?.operationId,
    ).toBe("getLadderBuild");
    expect(
      openApiDocument.paths["/builds/ladder"]?.get?.parameters,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "className", in: "query" }),
        expect.objectContaining({ name: "skill", in: "query" }),
        expect.objectContaining({ name: "limit", in: "query" }),
      ]),
    );
    expect(
      openApiDocument.components.schemas.LadderBuild.properties.mainSkill,
    ).toEqual({ type: "string", minLength: 1 });
    expect(
      openApiDocument.components.schemas.LadderBuild.properties.passiveTreeUrl,
    ).toEqual({ type: "string", format: "uri" });
    expect(
      openApiDocument.components.schemas.LadderBuild.properties.passiveSkillIds,
    ).toEqual({
      type: "array",
      items: { type: "string", minLength: 1 },
    });
    expect(
      openApiDocument.components.schemas.LadderBuild.properties.equipment,
    ).toEqual({
      type: "array",
      items: { $ref: "#/components/schemas/AccountSnapshotGearItem" },
    });
    expect(openApiDocument.paths["/datasets/manifest"]).toBeDefined();
    expect(openApiDocument.components.schemas.ModStat).toBeDefined();
    expect(openApiDocument.components.schemas.Mod.properties.stats).toEqual({
      type: "array",
      items: { $ref: "#/components/schemas/ModStat" },
    });
    expect(
      openApiDocument.components.schemas.Gem.properties.attributeRequirements,
    ).toBeDefined();
    expect(openApiDocument.components.schemas.DatasetManifest).toBeDefined();
    expect(
      openApiDocument.components.schemas.DatasetSearchResponse,
    ).toBeDefined();
    expect(
      openApiDocument.components.schemas.DatasetManifest.properties
        .qualityGates,
    ).toEqual({ $ref: "#/components/schemas/DatasetQualityGates" });
  });

  it("models deterministic upgrade advisor requests and responses", () => {
    const request = upgradeAdvisorRequestSchema.parse({
      weights: { life: 1, fireResistance: 0.5 },
      equipped: [{ slot: "ring", name: "Current Ring", stats: { life: 20 } }],
      candidates: [
        {
          slot: "ring",
          name: "Ruby Ring",
          stats: { life: 40, fireResistance: 20 },
          estimatedCostChaos: 10,
        },
      ],
      maxBudgetChaos: 20,
    });

    expect(request.candidates[0]?.estimatedCostChaos).toBe(10);

    const response = upgradeAdvisorResponseSchema.parse({
      source: "deterministic-engine",
      upgrades: [
        {
          slot: "ring",
          currentName: "Current Ring",
          candidateName: "Ruby Ring",
          currentScore: 20,
          candidateScore: 50,
          scoreDelta: 30,
          estimatedCostChaos: 10,
          valuePerChaos: 3,
          currentMissingStats: ["fireResistance"],
          candidateMissingStats: [],
        },
      ],
    });

    expect(response.source).toBe("deterministic-engine");
    expect(openApiDocument.paths["/advisor/upgrades"]?.post?.operationId).toBe(
      "rankUpgradeCandidates",
    );
    expect(
      snapshotUpgradeAdvisorRequestSchema.parse({
        weights: { life: 1, fireResistance: 0.5 },
        maxBudgetChaos: 20,
      }).maxBudgetChaos,
    ).toBe(20);
    expect(
      openApiDocument.paths["/advisor/snapshots/{account}/{snapshotId}"]?.post
        ?.operationId,
    ).toBe("rankSnapshotUpgradeCandidates");
  });

  it("models deterministic crafting estimate requests and responses", () => {
    const request = craftingEstimateRequestSchema.parse({
      itemLevel: 68,
      currencyCostChaos: 2,
      targetModIds: ["life-t2"],
      modPool: [
        {
          id: "life-t2",
          name: "+# to maximum Life",
          minItemLevel: 60,
          weight: 100,
        },
        {
          id: "mana-t2",
          name: "+# to maximum Mana",
          minItemLevel: 60,
          weight: 300,
        },
      ],
    });

    expect(request.modPool[0]?.weight).toBe(100);

    const response = craftingEstimateResponseSchema.parse({
      source: "deterministic-engine",
      itemLevel: 68,
      currencyCostChaos: 2,
      eligibleModCount: 2,
      totalEligibleWeight: 400,
      eligibleTargetModIds: ["life-t2"],
      blockedTargetModIds: [],
      hitProbability: 0.25,
      expectedAttempts: 4,
      expectedCostChaos: 8,
    });

    expect(response.expectedCostChaos).toBe(8);
    expect(openApiDocument.paths["/crafting/estimate"]?.post?.operationId).toBe(
      "estimateCraftingPlan",
    );
    expect(
      openApiDocument.components.schemas.CraftingEstimateRequest,
    ).toBeDefined();
    expect(
      openApiDocument.components.schemas.CraftingEstimateResponse,
    ).toBeDefined();
  });

  it("models deterministic buy-vs-craft requests and responses", () => {
    const request = buyVsCraftRequestSchema.parse({
      marketPriceChaos: 12,
      crafting: {
        itemLevel: 68,
        currencyCostChaos: 2,
        targetModIds: ["life-t2"],
        modPool: [
          {
            id: "life-t2",
            name: "+# to maximum Life",
            minItemLevel: 60,
            weight: 100,
          },
          {
            id: "mana-t2",
            name: "+# to maximum Mana",
            minItemLevel: 60,
            weight: 300,
          },
        ],
      },
    });

    expect(request.marketPriceChaos).toBe(12);

    const response = buyVsCraftResponseSchema.parse({
      source: "deterministic-engine",
      recommendation: "craft",
      marketPriceChaos: 12,
      expectedCraftCostChaos: 8,
      savingsChaos: 4,
      estimate: {
        itemLevel: 68,
        currencyCostChaos: 2,
        eligibleModCount: 2,
        totalEligibleWeight: 400,
        eligibleTargetModIds: ["life-t2"],
        blockedTargetModIds: [],
        hitProbability: 0.25,
        expectedAttempts: 4,
        expectedCostChaos: 8,
      },
    });

    expect(response.recommendation).toBe("craft");
    expect(
      openApiDocument.paths["/crafting/buy-vs-craft"]?.post?.operationId,
    ).toBe("compareBuyVsCraft");
    expect(openApiDocument.components.schemas.BuyVsCraftRequest).toBeDefined();
    expect(openApiDocument.components.schemas.BuyVsCraftResponse).toBeDefined();
  });

  it("models deterministic price-check requests and responses", () => {
    const request = priceCheckRequestSchema.parse({
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      item: {
        id: "divine-orb",
        name: "Divine Orb",
        category: "currency",
        rarity: "currency",
      },
    });

    expect(request.item.name).toBe("Divine Orb");

    const response = priceCheckResponseSchema.parse({
      source: "published-dataset",
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      item: {
        id: "divine-orb",
        name: "Divine Orb",
        category: "currency",
        rarity: "currency",
      },
      price: {
        id: "divine-orb",
        name: "Divine Orb",
        chaosEquivalent: 142,
        updatedAt: "2026-06-21T00:00:00.000Z",
      },
      matchedBy: "id",
    });

    expect(response.price?.chaosEquivalent).toBe(142);
    expect(openApiDocument.paths["/price/check"]?.post?.operationId).toBe(
      "checkItemPrice",
    );
    expect(openApiDocument.components.schemas.PriceCheckRequest).toBeDefined();
    expect(openApiDocument.components.schemas.PriceCheckResponse).toBeDefined();
  });
});

describe("account snapshot contract", () => {
  it("models source-agnostic official PoE2 character snapshots without stash access", () => {
    const snapshot = accountSnapshotSchema.parse({
      id: "snapshot-2026-06-21T10-00-00Z",
      account: "example",
      capturedAt: "2026-06-21T10:00:00.000Z",
      source: "official-poe2-character",
      capabilities: {
        characters: true,
        stashes: false,
      },
      characters: [
        {
          id: "character-1",
          name: "CalandraTest",
          className: "Deadeye",
          level: 73,
          league: "Dawn of the Hunt",
          equipment: [
            {
              slot: "gloves",
              name: "Duskthread Grips",
              rarity: "rare",
              iconUrl: "https://calandra.pages.dev/demo-gloves.svg",
              iconAttribution:
                "Synthetic Calandra demo icon; no game art is bundled.",
              stats: {
                life: 65,
                fireResistance: 18,
              },
            },
          ],
          passiveSkillIds: ["keystone-1"],
        },
      ],
    });

    expect(snapshot.source).toBe("official-poe2-character");
    expect(snapshot.capabilities).toEqual({
      characters: true,
      stashes: false,
    });
    expect(snapshot.characters[0]?.equipment[0]?.iconUrl).toBe(
      "https://calandra.pages.dev/demo-gloves.svg",
    );
    expect(snapshot.characters[0]?.equipment[0]?.iconAttribution).toContain(
      "Synthetic Calandra demo icon",
    );
    expect(snapshot.stashes).toBeUndefined();
  });

  it("allows stash-capable manual imports without implying official PoE2 stash support", () => {
    const snapshot = accountSnapshotSchema.parse({
      id: "manual-import-1",
      account: "example",
      capturedAt: "2026-06-21T10:00:00.000Z",
      source: "manual-import",
      capabilities: {
        characters: true,
        stashes: true,
      },
      characters: [],
      stashes: [
        {
          id: "currency",
          name: "Currency",
          league: "Dawn of the Hunt",
          items: [
            {
              slot: "stash",
              name: "Divine Orb",
              rarity: "currency",
            },
          ],
        },
      ],
    });

    expect(snapshot.stashes).toHaveLength(1);
  });

  it("exports account snapshot schemas in OpenAPI", () => {
    expect(openApiDocument.components.schemas.AccountSnapshot).toBeDefined();
    expect(openApiDocument.paths["/snapshots"]?.post?.operationId).toBe(
      "saveAccountSnapshot",
    );
    expect(
      openApiDocument.paths["/snapshots/capture/poe2-character"]?.post
        ?.operationId,
    ).toBe("capturePoe2CharacterSnapshot");
    expect(
      openApiDocument.paths["/snapshots/{account}/{snapshotId}"]?.get
        ?.operationId,
    ).toBe("getAccountSnapshot");
    expect(
      openApiDocument.paths["/snapshots/{account}"]?.get?.operationId,
    ).toBe("listAccountSnapshots");
    expect(openApiDocument.paths["/snapshots/diff"]?.post?.operationId).toBe(
      "diffAccountSnapshots",
    );
    expect(
      openApiDocument.paths["/snapshots/{account}/diff"]?.get?.operationId,
    ).toBe("diffStoredAccountSnapshots");
    expect(
      openApiDocument.components.schemas.AccountSnapshotListResponse,
    ).toBeDefined();
    expect(
      openApiDocument.components.schemas.AccountSnapshotWriteResponse,
    ).toBeDefined();
    expect(
      openApiDocument.components.schemas.Poe2CharacterSnapshotCaptureRequest,
    ).toBeDefined();
    expect(
      openApiDocument.components.schemas.AccountSnapshotDiffRequest,
    ).toBeDefined();
    expect(
      openApiDocument.components.schemas.AccountSnapshotStoredDiffRequest,
    ).toBeDefined();
    expect(
      openApiDocument.components.schemas.AccountSnapshotDiff,
    ).toBeDefined();
    expect(
      openApiDocument.components.schemas.AccountSnapshot.properties.source,
    ).toEqual({
      type: "string",
      enum: ["official-poe2-character", "clipboard", "manual-import"],
    });
    expect(
      openApiDocument.components.schemas.AccountSnapshot.properties
        .capabilities,
    ).toEqual({
      $ref: "#/components/schemas/AccountSnapshotCapabilities",
    });
    expect(
      openApiDocument.components.schemas.AccountSnapshotGearItem.properties
        .iconUrl,
    ).toEqual({ type: "string", format: "uri" });
    expect(
      openApiDocument.components.schemas.AccountSnapshotGearItem.properties
        .iconAttribution,
    ).toEqual({ type: "string", minLength: 1 });
  });

  it("models persisted account snapshot write responses", () => {
    const snapshot = accountSnapshotSchema.parse({
      id: "snapshot-2026-06-21T10-00-00Z",
      account: "example",
      capturedAt: "2026-06-21T10:00:00.000Z",
      source: "official-poe2-character",
      capabilities: { characters: true, stashes: false },
      characters: [
        {
          id: "character-1",
          name: "CalandraTest",
          className: "Deadeye",
          level: 73,
          league: "Dawn of the Hunt",
          equipment: [{ slot: "gloves", name: "Duskthread Grips" }],
        },
      ],
    });

    expect(
      accountSnapshotWriteResponseSchema.parse({
        source: "snapshot-store",
        objectKey: "snapshots/example/snapshot-2026-06-21T10-00-00Z.json",
        snapshot,
      }).objectKey,
    ).toBe("snapshots/example/snapshot-2026-06-21T10-00-00Z.json");
  });

  it("models official PoE2 character snapshot capture requests without storing OAuth tokens", () => {
    const request = poe2CharacterSnapshotCaptureRequestSchema.parse({
      account: "example",
      accessToken: "ggg-access-token",
      grantedScopes: ["account:characters"],
      capturedAt: "2026-06-21T10:00:00.000Z",
      snapshotId: "snapshot-2026-06-21T10-00-00Z",
    });

    expect(request).toEqual({
      account: "example",
      accessToken: "ggg-access-token",
      grantedScopes: ["account:characters"],
      capturedAt: "2026-06-21T10:00:00.000Z",
      snapshotId: "snapshot-2026-06-21T10-00-00Z",
    });
    expect(
      openApiDocument.components.schemas.Poe2CharacterSnapshotCaptureRequest
        .properties,
    ).not.toHaveProperty("refreshToken");
  });

  it("models GGG OAuth token exchange storage without returning plaintext tokens", () => {
    const request = gggOAuthTokenExchangeRequestSchema.parse({
      account: "example",
      code: "authorization-code",
      codeVerifier: "pkce-verifier",
      redirectUri: "https://calandra.pages.dev/auth/ggg/callback",
      scopes: ["account:characters"],
    });

    expect(request).toEqual({
      account: "example",
      code: "authorization-code",
      codeVerifier: "pkce-verifier",
      redirectUri: "https://calandra.pages.dev/auth/ggg/callback",
      scopes: ["account:characters"],
    });

    const response = gggOAuthTokenExchangeResponseSchema.parse({
      source: "ggg-oauth-token-store",
      account: "example",
      objectKey: "oauth/ggg/example/token.json",
      token: {
        tokenType: "encrypted",
        expiresAt: "2026-06-21T11:00:00.000Z",
        scope: ["account:characters"],
        username: "CalandraAccount",
        sub: "c5b9c286-8d05-47af-be41-67ab10a8c53e",
      },
    });

    expect(response.token.tokenType).toBe("encrypted");
    expect(JSON.stringify(response)).not.toContain("accessToken");
    expect(JSON.stringify(response)).not.toContain("refreshToken");
    expect(openApiDocument.paths["/auth/ggg/exchange"]?.post?.operationId).toBe(
      "exchangeGggOAuthToken",
    );
    expect(
      openApiDocument.components.schemas.GggOAuthTokenExchangeRequest,
    ).toBeDefined();
    expect(
      openApiDocument.components.schemas.GggOAuthTokenExchangeResponse,
    ).toBeDefined();
  });

  it("models safe hosted GGG OAuth configuration status without secrets", () => {
    const response = gggOAuthStatusResponseSchema.parse({
      source: "ggg-oauth-status",
      configured: true,
      redirectUri: "https://calandra.pages.dev/auth/ggg/callback",
      requiredScopes: ["account:characters"],
      features: {
        accountLinking: true,
        snapshotCapture: true,
      },
    });

    expect(response.configured).toBe(true);
    expect(JSON.stringify(response)).not.toContain("clientSecret");
    expect(JSON.stringify(response)).not.toContain("encryption");
    expect(JSON.stringify(response)).not.toContain("write-token");
    expect(openApiDocument.paths["/auth/ggg/status"]?.get?.operationId).toBe(
      "getGggOAuthStatus",
    );
    expect(
      openApiDocument.components.schemas.GggOAuthStatusResponse,
    ).toBeDefined();
  });

  it("models browser-safe GGG OAuth start and complete requests without exposing PKCE secrets", () => {
    const startRequest = gggOAuthStartRequestSchema.parse({
      account: "example",
      redirectUri: "https://calandra.pages.dev/auth/ggg/callback",
      scopes: ["account:characters"],
    });

    expect(startRequest).toEqual({
      account: "example",
      redirectUri: "https://calandra.pages.dev/auth/ggg/callback",
      scopes: ["account:characters"],
    });

    const startResponse = gggOAuthStartResponseSchema.parse({
      source: "ggg-oauth-start",
      account: "example",
      authorizationUrl:
        "https://www.pathofexile.com/oauth/authorize?client_id=ggg-client-id",
      state: "oauth-state",
      expiresAt: "2026-06-21T10:10:00.000Z",
      redirectUri: "https://calandra.pages.dev/auth/ggg/callback",
      requiredScopes: ["account:characters"],
    });

    expect(startResponse.source).toBe("ggg-oauth-start");
    expect(JSON.stringify(startResponse)).not.toContain("codeVerifier");
    expect(JSON.stringify(startResponse)).not.toContain("clientSecret");

    const completeRequest = gggOAuthCompleteRequestSchema.parse({
      state: "oauth-state",
      code: "authorization-code",
    });

    expect(completeRequest).toEqual({
      state: "oauth-state",
      code: "authorization-code",
    });
    expect(openApiDocument.paths["/auth/ggg/start"]?.post?.operationId).toBe(
      "startGggOAuthLink",
    );
    expect(openApiDocument.paths["/auth/ggg/complete"]?.post?.operationId).toBe(
      "completeGggOAuthLink",
    );
    expect(
      openApiDocument.components.schemas.GggOAuthStartRequest,
    ).toBeDefined();
    expect(
      openApiDocument.components.schemas.GggOAuthStartResponse,
    ).toBeDefined();
    expect(
      openApiDocument.components.schemas.GggOAuthCompleteRequest,
    ).toBeDefined();
  });

  it("models stored-token official PoE2 character snapshot capture requests", () => {
    const request = poe2StoredTokenSnapshotCaptureRequestSchema.parse({
      account: "example",
      capturedAt: "2026-06-21T10:00:00.000Z",
      snapshotId: "snapshot-2026-06-21T10-00-00Z",
    });

    expect(request).toEqual({
      account: "example",
      capturedAt: "2026-06-21T10:00:00.000Z",
      snapshotId: "snapshot-2026-06-21T10-00-00Z",
    });
    expect(
      openApiDocument.paths["/snapshots/capture/poe2-stored-token"]?.post
        ?.operationId,
    ).toBe("capturePoe2StoredTokenSnapshot");
    expect(
      openApiDocument.components.schemas.Poe2StoredTokenSnapshotCaptureRequest,
    ).toBeDefined();
    expect(
      openApiDocument.components.schemas.Poe2StoredTokenSnapshotCaptureRequest
        .properties,
    ).not.toHaveProperty("accessToken");
  });

  it("models persisted account snapshot list responses", () => {
    const list = accountSnapshotListResponseSchema.parse({
      source: "snapshot-store",
      account: "example",
      snapshots: [
        {
          account: "example",
          snapshotId: "snapshot-2026-06-21T10-00-00Z",
          objectKey: "snapshots/example/snapshot-2026-06-21T10-00-00Z.json",
          uploadedAt: "2026-06-21T10:01:00.000Z",
          size: 512,
        },
      ],
    });

    expect(list.snapshots[0]?.snapshotId).toBe("snapshot-2026-06-21T10-00-00Z");
  });

  it("models deterministic account snapshot diff requests and responses", () => {
    const before = accountSnapshotSchema.parse({
      id: "snapshot-before",
      account: "example",
      capturedAt: "2026-06-21T10:00:00.000Z",
      source: "official-poe2-character",
      capabilities: { characters: true, stashes: false },
      characters: [
        {
          id: "character-1",
          name: "CalandraTest",
          className: "Deadeye",
          level: 72,
          league: "Dawn of the Hunt",
          equipment: [{ slot: "gloves", name: "Frayed Mail Mitts" }],
        },
      ],
    });
    const after = accountSnapshotSchema.parse({
      ...before,
      id: "snapshot-after",
      capturedAt: "2026-06-21T11:00:00.000Z",
      characters: [
        {
          id: "character-1",
          name: "CalandraTest",
          className: "Deadeye",
          level: 73,
          league: "Dawn of the Hunt",
          equipment: [{ slot: "gloves", name: "Duskthread Grips" }],
        },
      ],
    });

    expect(
      accountSnapshotDiffRequestSchema.parse({ before, after }).before.id,
    ).toBe("snapshot-before");
    expect(
      accountSnapshotDiffSchema.parse({
        beforeSnapshotId: "snapshot-before",
        afterSnapshotId: "snapshot-after",
        beforeCapturedAt: "2026-06-21T10:00:00.000Z",
        afterCapturedAt: "2026-06-21T11:00:00.000Z",
        characterChanges: [
          {
            id: "character-1",
            name: "CalandraTest",
            type: "changed",
            beforeLevel: 72,
            afterLevel: 73,
            levelDelta: 1,
            equipmentChanges: [
              {
                type: "changed",
                slot: "gloves",
                beforeName: "Frayed Mail Mitts",
                afterName: "Duskthread Grips",
              },
            ],
          },
        ],
        stashChanges: [],
      }).characterChanges[0]?.levelDelta,
    ).toBe(1);
  });

  it("models stored account snapshot diff requests by snapshot id", () => {
    const request = accountSnapshotStoredDiffRequestSchema.parse({
      account: "example",
      beforeSnapshotId: "snapshot-before",
      afterSnapshotId: "snapshot-after",
    });

    expect(request).toEqual({
      account: "example",
      beforeSnapshotId: "snapshot-before",
      afterSnapshotId: "snapshot-after",
    });
  });
});
