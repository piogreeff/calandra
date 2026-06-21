import { describe, expect, it } from "vitest";
import {
  datasetArtifactSchema,
  datasetManifestSchema,
  economyCollectionSchema,
  gemCollectionSchema,
  ladderBuildCollectionSchema,
  modCollectionSchema,
  openApiDocument,
  upgradeAdvisorRequestSchema,
  upgradeAdvisorResponseSchema,
  uniqueCollectionSchema,
} from "../src/index";

describe("phase 1 read API contract", () => {
  it("models a published dataset artifact keyed by league and patch", () => {
    const artifact = datasetArtifactSchema.parse({
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

  it("models a published dataset manifest with counts and checksum", () => {
    const manifest = datasetManifestSchema.parse({
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      generatedAt: "2026-06-21T00:00:00.000Z",
      artifactKey: "datasets/Dawn of the Hunt/0.2.0.json",
      sha256:
        "f9a02504025955ed0a2352e142921ab4909596ee6b69809837b44d94abe636d0",
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
            minItemLevel: 1,
          },
        ],
      }).mods,
    ).toHaveLength(1);

    expect(
      gemCollectionSchema.parse({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        gems: [{ id: "spark", name: "Spark", kind: "skill", level: 1 }],
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
          },
        ],
      }).builds,
    ).toHaveLength(1);
  });

  it("exports Phase 1 read endpoints in OpenAPI", () => {
    expect(openApiDocument.paths["/items/{id}"]).toBeDefined();
    expect(openApiDocument.paths["/uniques"]).toBeDefined();
    expect(openApiDocument.paths["/mods"]).toBeDefined();
    expect(openApiDocument.paths["/gems"]).toBeDefined();
    expect(openApiDocument.paths["/economy/{league}"]).toBeDefined();
    expect(openApiDocument.paths["/builds/ladder"]).toBeDefined();
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
  });
});
