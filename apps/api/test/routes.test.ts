import { describe, expect, it } from "vitest";
import { api } from "../src/index";

const r2Artifact = JSON.stringify({
  league: "Dawn of the Hunt",
  patch: "0.2.0",
  generatedAt: "2026-06-21T00:00:00.000Z",
  source: "published-artifact",
  items: [
    {
      id: "expert-siphoning-wand",
      name: "Expert Siphoning Wand",
      category: "wand",
      rarity: "magic",
    },
  ],
  uniques: [],
  mods: [],
  gems: [],
  economy: [],
  ladderBuilds: [],
});

const r2ArtifactSha256 =
  "f9a02504025955ed0a2352e142921ab4909596ee6b69809837b44d94abe636d0";

describe("api routes", () => {
  const datasetEnv = {
    APP_URL: "https://calandra.pages.dev",
    DATASET_ARTIFACT_JSON: JSON.stringify({
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      generatedAt: "2026-06-21T00:00:00.000Z",
      source: "published-artifact",
      items: [
        {
          id: "advanced-altar-robe",
          name: "Advanced Altar Robe",
          category: "body-armour",
          rarity: "normal",
        },
      ],
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
          id: "mod-life-1",
          name: "+# to maximum Life",
          domain: "item",
          generationType: "prefix",
          family: "Life",
          minItemLevel: 1,
          tier: 1,
          tags: ["life"],
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
      gems: [
        {
          id: "spark",
          name: "Spark",
          kind: "skill",
          level: 1,
          requiredLevel: 1,
          tags: ["spell", "lightning"],
          attributeRequirements: { intelligence: 10 },
        },
      ],
      economy: [
        {
          id: "divine-orb",
          name: "Divine Orb",
          chaosEquivalent: 142,
          updatedAt: "2026-06-21T00:00:00.000Z",
        },
      ],
      ladderBuilds: [
        {
          id: "deadeye-1",
          account: "example",
          character: "CalandraTest",
          className: "Deadeye",
          level: 92,
        },
      ],
    }),
  };

  it("returns health metadata with the temporary public app URL", async () => {
    const response = await api.request("/health", undefined, {
      APP_URL: "https://calandra.pages.dev",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "calandra-api",
      appUrl: "https://calandra.pages.dev",
    });
  });

  it("returns an empty patch-versioned item collection for a new dataset", async () => {
    const response = await api.request(
      "/items?league=Dawn%20of%20the%20Hunt&patch=0.2.0",
      undefined,
      {
        APP_URL: "https://calandra.pages.dev",
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      items: [],
    });
  });

  it("serves the OpenAPI contract document", async () => {
    const response = await api.request("/openapi.json", undefined, {
      APP_URL: "https://calandra.pages.dev",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      openapi: "3.0.3",
      paths: {
        "/items": {
          get: {
            operationId: "listItems",
          },
        },
      },
    });
  });

  it("returns empty patch-versioned Phase 1 read collections before the dataset is imported", async () => {
    const env = { APP_URL: "https://calandra.pages.dev" };

    await expectJson(
      "/uniques?league=Dawn%20of%20the%20Hunt&patch=0.2.0",
      env,
      {
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        uniques: [],
      },
    );
    await expectJson("/mods?league=Dawn%20of%20the%20Hunt&patch=0.2.0", env, {
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      mods: [],
    });
    await expectJson("/gems?league=Dawn%20of%20the%20Hunt&patch=0.2.0", env, {
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      gems: [],
    });
    await expectJson("/economy/Dawn%20of%20the%20Hunt?patch=0.2.0", env, {
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      prices: [],
    });
    await expectJson(
      "/builds/ladder?league=Dawn%20of%20the%20Hunt&patch=0.2.0",
      env,
      {
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        builds: [],
      },
    );
  });

  it("returns 404 before a dataset manifest is published", async () => {
    const response = await api.request(
      "/datasets/manifest?league=Dawn%20of%20the%20Hunt&patch=0.2.0",
      undefined,
      {
        APP_URL: "https://calandra.pages.dev",
      },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "dataset manifest not found",
      league: "Dawn of the Hunt",
      patch: "0.2.0",
    });
  });

  it("returns 404 for an item missing from the selected league and patch", async () => {
    const response = await api.request(
      "/items/missing?league=Dawn%20of%20the%20Hunt&patch=0.2.0",
      undefined,
      {
        APP_URL: "https://calandra.pages.dev",
      },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "item not found",
      id: "missing",
      league: "Dawn of the Hunt",
      patch: "0.2.0",
    });
  });

  it("serves collection routes from a configured dataset artifact", async () => {
    await expectJson(
      "/items?league=Dawn%20of%20the%20Hunt&patch=0.2.0",
      datasetEnv,
      {
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        items: [
          {
            id: "advanced-altar-robe",
            name: "Advanced Altar Robe",
            category: "body-armour",
            rarity: "normal",
          },
        ],
      },
    );
    await expectJson(
      "/uniques?league=Dawn%20of%20the%20Hunt&patch=0.2.0",
      datasetEnv,
      {
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
      },
    );
    await expectJson(
      "/mods?league=Dawn%20of%20the%20Hunt&patch=0.2.0",
      datasetEnv,
      {
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
            tags: ["life"],
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
      },
    );
    await expectJson(
      "/gems?league=Dawn%20of%20the%20Hunt&patch=0.2.0",
      datasetEnv,
      {
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        gems: [
          {
            id: "spark",
            name: "Spark",
            kind: "skill",
            level: 1,
            requiredLevel: 1,
            tags: ["spell", "lightning"],
            attributeRequirements: { intelligence: 10 },
          },
        ],
      },
    );
    await expectJson(
      "/economy/Dawn%20of%20the%20Hunt?patch=0.2.0",
      datasetEnv,
      {
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
      },
    );
    await expectJson(
      "/builds/ladder?league=Dawn%20of%20the%20Hunt&patch=0.2.0",
      datasetEnv,
      {
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
      },
    );
  });

  it("synthesizes a manifest for an inline dev dataset artifact", async () => {
    const response = await api.request(
      "/datasets/manifest?league=Dawn%20of%20the%20Hunt&patch=0.2.0",
      undefined,
      datasetEnv,
    );
    const body = (await response.json()) as { sha256: string };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      generatedAt: "2026-06-21T00:00:00.000Z",
      artifactKey: "DATASET_ARTIFACT_JSON",
      counts: {
        items: 1,
        uniques: 1,
        mods: 1,
        gems: 1,
        economy: 1,
        ladderBuilds: 1,
      },
    });
    expect(body.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns one item from the configured dataset artifact", async () => {
    await expectJson(
      "/items/advanced-altar-robe?league=Dawn%20of%20the%20Hunt&patch=0.2.0",
      datasetEnv,
      {
        id: "advanced-altar-robe",
        name: "Advanced Altar Robe",
        category: "body-armour",
        rarity: "normal",
      },
    );

    await expectJson(
      "/items/choir-of-the-storm?league=Dawn%20of%20the%20Hunt&patch=0.2.0",
      datasetEnv,
      {
        id: "choir-of-the-storm",
        name: "Choir of the Storm",
        category: "amulet",
        rarity: "unique",
        iconUrl: "https://web.poecdn.com/image/example.png",
        iconAttribution:
          "Game art and item data are property of Grinding Gear Games.",
      },
    );
  });

  it("serves a published dataset artifact from the configured R2 bucket", async () => {
    const requestedKeys: string[] = [];
    const env = {
      APP_URL: "https://calandra.pages.dev",
      DATASET_R2_PREFIX: "datasets",
      DATA_BUCKET: {
        async get(key: string) {
          requestedKeys.push(key);

          return {
            async text() {
              return key.endsWith(".manifest.json")
                ? JSON.stringify({
                    league: "Dawn of the Hunt",
                    patch: "0.2.0",
                    generatedAt: "2026-06-21T00:00:00.000Z",
                    artifactKey: "datasets/Dawn of the Hunt/0.2.0.json",
                    sha256: r2ArtifactSha256,
                    counts: {
                      items: 1,
                      uniques: 0,
                      mods: 0,
                      gems: 0,
                      economy: 0,
                      ladderBuilds: 0,
                    },
                  })
                : r2Artifact;
            },
          };
        },
      },
    };

    await expectJson("/items?league=Dawn%20of%20the%20Hunt&patch=0.2.0", env, {
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      items: [
        {
          id: "expert-siphoning-wand",
          name: "Expert Siphoning Wand",
          category: "wand",
          rarity: "magic",
        },
      ],
    });

    expect(requestedKeys).toEqual([
      "datasets/Dawn of the Hunt/0.2.0.json",
      "datasets/Dawn of the Hunt/0.2.0.manifest.json",
    ]);
  });

  it("serves a validated R2 dataset manifest", async () => {
    const response = await api.request(
      "/datasets/manifest?league=Dawn%20of%20the%20Hunt&patch=0.2.0",
      undefined,
      {
        APP_URL: "https://calandra.pages.dev",
        DATASET_R2_PREFIX: "datasets",
        DATA_BUCKET: {
          async get(key: string) {
            return {
              async text() {
                return key.endsWith(".manifest.json")
                  ? JSON.stringify({
                      league: "Dawn of the Hunt",
                      patch: "0.2.0",
                      generatedAt: "2026-06-21T00:00:00.000Z",
                      artifactKey: "datasets/Dawn of the Hunt/0.2.0.json",
                      sha256: r2ArtifactSha256,
                      counts: {
                        items: 1,
                        uniques: 0,
                        mods: 0,
                        gems: 0,
                        economy: 0,
                        ladderBuilds: 0,
                      },
                    })
                  : r2Artifact;
              },
            };
          },
        },
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      generatedAt: "2026-06-21T00:00:00.000Z",
      artifactKey: "datasets/Dawn of the Hunt/0.2.0.json",
      sha256: r2ArtifactSha256,
      counts: {
        items: 1,
        uniques: 0,
        mods: 0,
        gems: 0,
        economy: 0,
        ladderBuilds: 0,
      },
    });
  });

  it("rejects an R2 artifact when its manifest checksum does not match", async () => {
    const response = await api.request(
      "/items?league=Dawn%20of%20the%20Hunt&patch=0.2.0",
      undefined,
      {
        APP_URL: "https://calandra.pages.dev",
        DATASET_R2_PREFIX: "datasets",
        DATA_BUCKET: {
          async get(key: string) {
            return {
              async text() {
                return key.endsWith(".manifest.json")
                  ? JSON.stringify({
                      league: "Dawn of the Hunt",
                      patch: "0.2.0",
                      generatedAt: "2026-06-21T00:00:00.000Z",
                      artifactKey: "datasets/Dawn of the Hunt/0.2.0.json",
                      sha256: "0".repeat(64),
                      counts: {
                        items: 1,
                        uniques: 0,
                        mods: 0,
                        gems: 0,
                        economy: 0,
                        ladderBuilds: 0,
                      },
                    })
                  : r2Artifact;
              },
            };
          },
        },
      },
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "dataset artifact failed manifest validation",
    });
  });

  it("ranks upgrade candidates with deterministic engine output", async () => {
    const response = await api.request(
      "/advisor/upgrades",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          weights: { life: 1, fireResistance: 0.5, movementSpeed: 2 },
          equipped: [
            { slot: "boots", name: "Current Boots", stats: { life: 40 } },
            { slot: "gloves", name: "Current Gloves", stats: { life: 60 } },
          ],
          candidates: [
            {
              slot: "boots",
              name: "Fast Boots",
              stats: { life: 60, movementSpeed: 20 },
              estimatedCostChaos: 50,
            },
            {
              slot: "gloves",
              name: "Heavy Gloves",
              stats: { life: 95, fireResistance: 20 },
              estimatedCostChaos: 20,
            },
          ],
          maxBudgetChaos: 60,
        }),
      },
      { APP_URL: "https://calandra.pages.dev" },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      source: "deterministic-engine",
      upgrades: [
        {
          slot: "boots",
          currentName: "Current Boots",
          candidateName: "Fast Boots",
          currentScore: 40,
          candidateScore: 100,
          scoreDelta: 60,
          estimatedCostChaos: 50,
          valuePerChaos: 1.2,
          currentMissingStats: ["fireResistance", "movementSpeed"],
          candidateMissingStats: ["fireResistance"],
        },
        {
          slot: "gloves",
          currentName: "Current Gloves",
          candidateName: "Heavy Gloves",
          currentScore: 60,
          candidateScore: 105,
          scoreDelta: 45,
          estimatedCostChaos: 20,
          valuePerChaos: 2.25,
          currentMissingStats: ["fireResistance", "movementSpeed"],
          candidateMissingStats: ["movementSpeed"],
        },
      ],
    });
  });

  it("rejects malformed upgrade advisor payloads", async () => {
    const response = await api.request(
      "/advisor/upgrades",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          weights: {},
          equipped: [],
          candidates: "not-array",
        }),
      },
      { APP_URL: "https://calandra.pages.dev" },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid upgrade advisor request",
    });
  });

  it("estimates crafting odds and cost with deterministic engine output", async () => {
    const response = await api.request(
      "/crafting/estimate",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          itemLevel: 68,
          currencyCostChaos: 2,
          targetModIds: ["life-t2", "life-t1"],
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
            {
              id: "life-t1",
              name: "+# to maximum Life",
              minItemLevel: 75,
              weight: 50,
            },
          ],
        }),
      },
      { APP_URL: "https://calandra.pages.dev" },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      source: "deterministic-engine",
      itemLevel: 68,
      currencyCostChaos: 2,
      eligibleModCount: 2,
      totalEligibleWeight: 400,
      eligibleTargetModIds: ["life-t2"],
      blockedTargetModIds: ["life-t1"],
      hitProbability: 0.25,
      expectedAttempts: 4,
      expectedCostChaos: 8,
    });
  });

  it("rejects malformed crafting estimate payloads", async () => {
    const response = await api.request(
      "/crafting/estimate",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          itemLevel: 68,
          currencyCostChaos: 2,
          targetModIds: [],
          modPool: "not-array",
        }),
      },
      { APP_URL: "https://calandra.pages.dev" },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid crafting estimate request",
    });
  });

  it("diffs account snapshots with deterministic engine output", async () => {
    const response = await api.request(
      "/snapshots/diff",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          before: {
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
                equipment: [
                  {
                    slot: "gloves",
                    name: "Frayed Mail Mitts",
                    stats: { life: 40 },
                  },
                ],
              },
            ],
          },
          after: {
            id: "snapshot-after",
            account: "example",
            capturedAt: "2026-06-21T11:00:00.000Z",
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
                    slot: "gloves",
                    name: "Duskthread Grips",
                    stats: { life: 65 },
                  },
                ],
              },
            ],
          },
        }),
      },
      { APP_URL: "https://calandra.pages.dev" },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
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
    });
  });

  it("rejects malformed account snapshot diff payloads", async () => {
    const response = await api.request(
      "/snapshots/diff",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          before: { id: "snapshot-before" },
          after: "not-a-snapshot",
        }),
      },
      { APP_URL: "https://calandra.pages.dev" },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid account snapshot diff request",
    });
  });
});

async function expectJson(
  path: string,
  env: Record<string, unknown>,
  expected: unknown,
) {
  const response = await api.request(path, undefined, env);

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual(expected);
}
