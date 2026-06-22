import { afterEach, describe, expect, it, vi } from "vitest";
import {
  encryptGggOAuthTokenSet,
  type GggOAuthTokenSet,
} from "@calandra/ggg-api";
import { api } from "../src/index";

const datasetSources = [
  {
    kind: "game-data",
    name: "poe2db.tw",
    url: "https://poe2db.tw/",
    attribution:
      "Game data derived from Path of Exile 2 community references; Path of Exile 2 is property of Grinding Gear Games.",
  },
] as const;

const r2Artifact = JSON.stringify({
  league: "Dawn of the Hunt",
  patch: "0.2.0",
  generatedAt: "2026-06-21T00:00:00.000Z",
  source: "published-artifact",
  sources: datasetSources,
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
  "33272bd5d8c37deda60f5681e28372a400d207636abdacfbd1e07f2f359bfff8";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("api routes", () => {
  const datasetEnv = {
    APP_URL: "https://calandra.pages.dev",
    DATASET_ARTIFACT_JSON: JSON.stringify({
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      generatedAt: "2026-06-21T00:00:00.000Z",
      source: "published-artifact",
      sources: datasetSources,
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

  it("returns safe public GGG OAuth status when hosted account linking is configured", async () => {
    const response = await api.request("/auth/ggg/status", undefined, {
      APP_URL: "https://calandra.pages.dev",
      GGG_OAUTH_CLIENT_ID: "ggg-client-id",
      GGG_TOKEN_ENCRYPTION_KEY: base64Key(3),
      GGG_USER_AGENT:
        "calandra/0.1.0 (+https://calandra.pages.dev; maintainer@calandra.dev)",
      SNAPSHOT_BUCKET: {
        async get() {
          return null;
        },
        async put() {
          return undefined;
        },
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body).toEqual({
      source: "ggg-oauth-status",
      configured: true,
      redirectUri: "https://calandra.pages.dev/auth/ggg/callback",
      requiredScopes: ["account:characters"],
      features: {
        accountLinking: true,
        snapshotCapture: true,
      },
    });
    expect(JSON.stringify(body)).not.toContain("ggg-client-id");
    expect(JSON.stringify(body)).not.toContain("GGG_TOKEN_ENCRYPTION_KEY");
    expect(JSON.stringify(body)).not.toContain("SNAPSHOT_WRITE_TOKEN");
  });

  it("returns disabled GGG OAuth status without exposing missing secrets", async () => {
    const response = await api.request("/auth/ggg/status", undefined, {
      APP_URL: "https://calandra.pages.dev",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      source: "ggg-oauth-status",
      configured: false,
      redirectUri: "https://calandra.pages.dev/auth/ggg/callback",
      requiredScopes: ["account:characters"],
      features: {
        accountLinking: false,
        snapshotCapture: false,
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

  it("searches items, uniques, mods, and gems in one patch-versioned dataset query", async () => {
    const response = await api.request(
      "/search?league=Dawn%20of%20the%20Hunt&patch=0.2.0&q=life",
      undefined,
      datasetEnv,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      query: "life",
      items: [],
      uniques: [],
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
      gems: [],
    });
  });

  it("allows browser read access to the dataset search endpoint", async () => {
    const response = await api.request(
      "/search?league=Dawn%20of%20the%20Hunt&patch=0.2.0&q=life",
      {
        headers: {
          origin: "http://127.0.0.1:3010",
        },
      },
      datasetEnv,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("vary")).toContain("Origin");
  });

  it("answers browser preflight requests before route handlers run", async () => {
    const response = await api.request(
      "/search?league=Dawn%20of%20the%20Hunt&patch=0.2.0&q=life",
      {
        method: "OPTIONS",
        headers: {
          origin: "http://127.0.0.1:3010",
          "access-control-request-method": "GET",
        },
      },
      datasetEnv,
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-methods")).toBe(
      "GET, POST, OPTIONS",
    );
  });

  it("requires a non-empty dataset search query", async () => {
    const response = await api.request(
      "/search?league=Dawn%20of%20the%20Hunt&patch=0.2.0&q=%20",
      undefined,
      datasetEnv,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "league, patch, and q query parameters are required",
    });
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
      sources: datasetSources,
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

  it("returns dataset source attribution from the manifest endpoint", async () => {
    const sources = [
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
    ];
    const response = await api.request(
      "/datasets/manifest?league=Dawn%20of%20the%20Hunt&patch=0.2.0",
      undefined,
      {
        APP_URL: "https://calandra.pages.dev",
        DATASET_ARTIFACT_JSON: JSON.stringify({
          league: "Dawn of the Hunt",
          patch: "0.2.0",
          generatedAt: "2026-06-21T00:00:00.000Z",
          source: "published-artifact",
          sources,
          items: [],
          uniques: [],
          mods: [],
          gems: [],
          economy: [],
          ladderBuilds: [],
        }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ sources });
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
                    sources: datasetSources,
                    qualityGates: {
                      uniqueImageCoverage: {
                        resolved: 0,
                        expected: 0,
                        ratio: 1,
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
                      sources: datasetSources,
                      qualityGates: {
                        uniqueImageCoverage: {
                          resolved: 0,
                          expected: 0,
                          ratio: 1,
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
      sources: datasetSources,
      qualityGates: {
        uniqueImageCoverage: {
          resolved: 0,
          expected: 0,
          ratio: 1,
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
                      sources: datasetSources,
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

  it("rejects stale R2 manifests that do not match the current contract", async () => {
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

  it("compares buying and crafting with deterministic engine output", async () => {
    const response = await api.request(
      "/crafting/buy-vs-craft",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
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
        }),
      },
      { APP_URL: "https://calandra.pages.dev" },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
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
  });

  it("rejects malformed buy-vs-craft payloads", async () => {
    const response = await api.request(
      "/crafting/buy-vs-craft",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          marketPriceChaos: -1,
          crafting: "not-a-craft-plan",
        }),
      },
      { APP_URL: "https://calandra.pages.dev" },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid buy-vs-craft request",
    });
  });

  it("checks a parsed item price against patch-versioned economy data", async () => {
    const response = await api.request(
      "/price/check",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          league: "Dawn of the Hunt",
          patch: "0.2.0",
          item: {
            id: "divine-orb",
            name: "Divine Orb",
            category: "currency",
            rarity: "currency",
          },
        }),
      },
      datasetEnv,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
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
  });

  it("returns no price match for an unpriced parsed item", async () => {
    const response = await api.request(
      "/price/check",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          league: "Dawn of the Hunt",
          patch: "0.2.0",
          item: {
            id: "unpriced-boots",
            name: "Unpriced Boots",
            category: "boots",
            rarity: "rare",
          },
        }),
      },
      datasetEnv,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      source: "published-dataset",
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      item: {
        id: "unpriced-boots",
        name: "Unpriced Boots",
        category: "boots",
        rarity: "rare",
      },
      price: null,
      matchedBy: null,
    });
  });

  it("rejects malformed price-check payloads", async () => {
    const response = await api.request(
      "/price/check",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          league: "Dawn of the Hunt",
          item: "not-an-item",
        }),
      },
      { APP_URL: "https://calandra.pages.dev" },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid price check request",
    });
  });

  it("stores source-agnostic account snapshots in the snapshot bucket", async () => {
    const storedObjects: Array<{
      key: string;
      value: string;
      options: unknown;
    }> = [];
    const snapshot = {
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
          equipment: [
            {
              slot: "gloves",
              name: "Duskthread Grips",
              stats: { life: 65 },
            },
          ],
        },
      ],
    };

    const response = await api.request(
      "/snapshots",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(snapshot),
      },
      {
        APP_URL: "https://calandra.pages.dev",
        SNAPSHOT_R2_PREFIX: "snapshots",
        SNAPSHOT_BUCKET: {
          async put(key: string, value: string, options: unknown) {
            storedObjects.push({ key, value, options });
          },
        },
      },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      source: "snapshot-store",
      objectKey: "snapshots/example/snapshot-2026-06-21T10-00-00Z.json",
      snapshot,
    });
    expect(storedObjects).toEqual([
      {
        key: "snapshots/example/snapshot-2026-06-21T10-00-00Z.json",
        value: JSON.stringify(snapshot),
        options: {
          httpMetadata: { contentType: "application/json; charset=utf-8" },
        },
      },
    ]);
  });

  it("rejects account snapshot writes without a bearer token when the write token is configured", async () => {
    const response = await api.request(
      "/snapshots",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "snapshot-2026-06-21T10-00-00Z",
          account: "example",
          capturedAt: "2026-06-21T10:00:00.000Z",
          source: "manual-import",
          capabilities: { characters: true, stashes: true },
          characters: [],
          stashes: [],
        }),
      },
      {
        APP_URL: "https://calandra.pages.dev",
        SNAPSHOT_WRITE_TOKEN: "test-write-token",
        SNAPSHOT_BUCKET: {
          async put() {
            throw new Error("unauthorized writes must not reach R2");
          },
        },
      },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "snapshot write is unauthorized",
    });
  });

  it("accepts account snapshot writes with the configured bearer token", async () => {
    const storedObjects: Array<{
      key: string;
      value: string;
    }> = [];
    const snapshot = {
      id: "snapshot-2026-06-21T10-00-00Z",
      account: "example",
      capturedAt: "2026-06-21T10:00:00.000Z",
      source: "manual-import",
      capabilities: { characters: true, stashes: true },
      characters: [],
      stashes: [],
    };

    const response = await api.request(
      "/snapshots",
      {
        method: "POST",
        headers: {
          authorization: "Bearer test-write-token",
          "content-type": "application/json",
        },
        body: JSON.stringify(snapshot),
      },
      {
        APP_URL: "https://calandra.pages.dev",
        SNAPSHOT_WRITE_TOKEN: "test-write-token",
        SNAPSHOT_R2_PREFIX: "snapshots",
        SNAPSHOT_BUCKET: {
          async put(key: string, value: string) {
            storedObjects.push({ key, value });
          },
        },
      },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      source: "snapshot-store",
      objectKey: "snapshots/example/snapshot-2026-06-21T10-00-00Z.json",
    });
    expect(storedObjects).toEqual([
      {
        key: "snapshots/example/snapshot-2026-06-21T10-00-00Z.json",
        value: JSON.stringify(snapshot),
      },
    ]);
  });

  it("captures official PoE2 characters through GGG OAuth and persists a source-agnostic snapshot", async () => {
    const storedObjects: Array<{
      key: string;
      value: string;
      options: unknown;
    }> = [];
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "https://api.pathofexile.com/character/poe2") {
        expect(init?.headers).toMatchObject({
          authorization: "Bearer ggg-access-token",
          "User-Agent":
            "calandra/0.1.0 (+https://calandra.pages.dev; maintainer@calandra.dev)",
        });

        return jsonResponse({
          characters: [{ name: "CalandraTest" }],
        });
      }

      if (url === "https://api.pathofexile.com/character/poe2/CalandraTest") {
        return jsonResponse({
          character: {
            id: "character-1",
            name: "CalandraTest",
            class: "Deadeye",
            level: 73,
            league: "Dawn of the Hunt",
            equipment: [
              {
                inventoryId: "gloves",
                typeLine: "Duskthread Grips",
                rarity: "rare",
                id: "item-1",
              },
            ],
          },
        });
      }

      throw new Error(`Unexpected GGG API URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetch);

    const response = await api.request(
      "/snapshots/capture/poe2-character",
      {
        method: "POST",
        headers: {
          authorization: "Bearer snapshot-write-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          account: "example",
          accessToken: "ggg-access-token",
          grantedScopes: ["account:characters"],
          capturedAt: "2026-06-21T10:00:00.000Z",
          snapshotId: "snapshot-2026-06-21T10-00-00Z",
        }),
      },
      {
        APP_URL: "https://calandra.pages.dev",
        GGG_USER_AGENT:
          "calandra/0.1.0 (+https://calandra.pages.dev; maintainer@calandra.dev)",
        SNAPSHOT_WRITE_TOKEN: "snapshot-write-token",
        SNAPSHOT_R2_PREFIX: "snapshots",
        SNAPSHOT_BUCKET: {
          async put(key: string, value: string, options: unknown) {
            storedObjects.push({ key, value, options });
          },
        },
      },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      source: "snapshot-store",
      objectKey: "snapshots/example/snapshot-2026-06-21T10-00-00Z.json",
      snapshot: {
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
            equipment: [
              {
                slot: "gloves",
                name: "Duskthread Grips",
                itemId: "item-1",
                rarity: "rare",
              },
            ],
          },
        ],
      },
    });
    expect(storedObjects).toEqual([
      {
        key: "snapshots/example/snapshot-2026-06-21T10-00-00Z.json",
        value: JSON.stringify({
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
              equipment: [
                {
                  slot: "gloves",
                  name: "Duskthread Grips",
                  itemId: "item-1",
                  rarity: "rare",
                },
              ],
            },
          ],
        }),
        options: {
          httpMetadata: { contentType: "application/json; charset=utf-8" },
        },
      },
    ]);
    expect(JSON.stringify(storedObjects)).not.toContain("ggg-access-token");
  });

  it("exchanges a GGG OAuth code, encrypts the token set, and stores only encrypted tokens", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-21T10:00:00.000Z"));
    const storedObjects: Array<{
      key: string;
      value: string;
      options: unknown;
    }> = [];
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://www.pathofexile.com/oauth/token");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      });
      const params = new URLSearchParams(String(init?.body));
      expect(Object.fromEntries(params)).toEqual({
        client_id: "calandra-client-id",
        grant_type: "authorization_code",
        code: "authorization-code",
        redirect_uri: "https://calandra.pages.dev/auth/ggg/callback",
        code_verifier: "pkce-verifier",
        scope: "account:characters",
      });

      return jsonResponse({
        access_token: "ggg-access-token",
        refresh_token: "ggg-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        scope: "account:characters",
        username: "CalandraAccount",
        sub: "c5b9c286-8d05-47af-be41-67ab10a8c53e",
      });
    });
    vi.stubGlobal("fetch", fetch);

    const response = await api.request(
      "/auth/ggg/exchange",
      {
        method: "POST",
        headers: {
          authorization: "Bearer snapshot-write-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          account: "example",
          code: "authorization-code",
          codeVerifier: "pkce-verifier",
          redirectUri: "https://calandra.pages.dev/auth/ggg/callback",
          scopes: ["account:characters"],
        }),
      },
      {
        APP_URL: "https://calandra.pages.dev",
        SNAPSHOT_WRITE_TOKEN: "snapshot-write-token",
        GGG_OAUTH_CLIENT_ID: "calandra-client-id",
        GGG_TOKEN_ENCRYPTION_KEY: base64Key(7),
        GGG_TOKEN_R2_PREFIX: "oauth/ggg",
        SNAPSHOT_BUCKET: {
          async put(key: string, value: string, options: unknown) {
            storedObjects.push({ key, value, options });
          },
        },
      },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
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
    expect(storedObjects).toHaveLength(1);
    expect(storedObjects[0]?.key).toBe("oauth/ggg/example/token.json");
    expect(storedObjects[0]?.options).toEqual({
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
    const stored = JSON.parse(storedObjects[0]?.value ?? "{}");
    expect(stored).toMatchObject({
      account: "example",
      provider: "ggg",
      updatedAt: "2026-06-21T10:00:00.000Z",
      token: {
        expiresAt: "2026-06-21T11:00:00.000Z",
        scope: ["account:characters"],
        username: "CalandraAccount",
        sub: "c5b9c286-8d05-47af-be41-67ab10a8c53e",
      },
      encryptedTokenSet: {
        version: 1,
        algorithm: "AES-256-GCM",
      },
    });
    expect(stored.encryptedTokenSet.iv).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(stored.encryptedTokenSet.ciphertext).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(storedObjects[0]?.value).not.toContain("ggg-access-token");
    expect(storedObjects[0]?.value).not.toContain("ggg-refresh-token");
  });

  it("starts browser-safe GGG OAuth by storing PKCE verifier server-side", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-21T10:00:00.000Z"));
    const storedObjects: Array<{ key: string; value: string }> = [];

    const response = await api.request(
      "/auth/ggg/start",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account: "example" }),
      },
      {
        APP_URL: "https://calandra.pages.dev",
        GGG_OAUTH_CLIENT_ID: "calandra-client-id",
        GGG_TOKEN_R2_PREFIX: "oauth/ggg",
        SNAPSHOT_BUCKET: {
          async put(key: string, value: string) {
            storedObjects.push({ key, value });
          },
        },
      },
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      authorizationUrl: string;
      state: string;
    };
    const authorizationUrl = new URL(body.authorizationUrl);

    expect(body).toMatchObject({
      source: "ggg-oauth-start",
      account: "example",
      expiresAt: "2026-06-21T10:10:00.000Z",
      redirectUri: "https://calandra.pages.dev/auth/ggg/callback",
      requiredScopes: ["account:characters"],
    });
    expect(body.state).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(authorizationUrl.origin).toBe("https://www.pathofexile.com");
    expect(authorizationUrl.pathname).toBe("/oauth/authorize");
    expect(authorizationUrl.searchParams.get("client_id")).toBe(
      "calandra-client-id",
    );
    expect(authorizationUrl.searchParams.get("scope")).toBe(
      "account:characters",
    );
    expect(authorizationUrl.searchParams.get("state")).toBe(body.state);
    expect(authorizationUrl.searchParams.get("code_challenge")).toMatch(
      /^[A-Za-z0-9_-]+$/,
    );
    expect(JSON.stringify(body)).not.toContain("codeVerifier");
    expect(storedObjects).toHaveLength(1);
    expect(storedObjects[0]?.key).toBe(`oauth/ggg/pending/${body.state}.json`);
    expect(storedObjects[0]?.value).toContain("codeVerifier");
  });

  it("completes browser-safe GGG OAuth and stores encrypted tokens without a write token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-21T10:00:00.000Z"));
    const storedObjects: Array<{ key: string; value: string }> = [];
    const pendingState = JSON.stringify({
      account: "example",
      provider: "ggg",
      state: "oauth-state",
      codeVerifier: "pkce-verifier",
      redirectUri: "https://calandra.pages.dev/auth/ggg/callback",
      scopes: ["account:characters"],
      createdAt: "2026-06-21T09:59:00.000Z",
      expiresAt: "2026-06-21T10:09:00.000Z",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        expect(url).toBe("https://www.pathofexile.com/oauth/token");
        const params = new URLSearchParams(String(init?.body));
        expect(Object.fromEntries(params)).toMatchObject({
          client_id: "calandra-client-id",
          grant_type: "authorization_code",
          code: "authorization-code",
          redirect_uri: "https://calandra.pages.dev/auth/ggg/callback",
          code_verifier: "pkce-verifier",
          scope: "account:characters",
        });

        return jsonResponse({
          access_token: "ggg-access-token",
          refresh_token: "ggg-refresh-token",
          token_type: "bearer",
          expires_in: 3600,
          scope: "account:characters",
          username: "CalandraAccount",
        });
      }),
    );

    const response = await api.request(
      "/auth/ggg/complete",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          state: "oauth-state",
          code: "authorization-code",
        }),
      },
      {
        APP_URL: "https://calandra.pages.dev",
        GGG_OAUTH_CLIENT_ID: "calandra-client-id",
        GGG_TOKEN_ENCRYPTION_KEY: base64Key(7),
        GGG_TOKEN_R2_PREFIX: "oauth/ggg",
        SNAPSHOT_WRITE_TOKEN: "snapshot-write-token",
        SNAPSHOT_BUCKET: {
          async get(key: string) {
            return key === "oauth/ggg/pending/oauth-state.json"
              ? {
                  async text() {
                    return pendingState;
                  },
                }
              : null;
          },
          async put(key: string, value: string) {
            storedObjects.push({ key, value });
          },
        },
      },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      source: "ggg-oauth-token-store",
      account: "CalandraAccount",
      objectKey: "oauth/ggg/CalandraAccount/token.json",
      token: {
        tokenType: "encrypted",
        expiresAt: "2026-06-21T11:00:00.000Z",
        scope: ["account:characters"],
        username: "CalandraAccount",
      },
    });
    expect(storedObjects.map((object) => object.key)).toEqual([
      "oauth/ggg/CalandraAccount/token.json",
      "oauth/ggg/pending/oauth-state.json",
    ]);
    expect(storedObjects[0]?.value).not.toContain("ggg-access-token");
    expect(storedObjects[0]?.value).not.toContain("ggg-refresh-token");
    expect(storedObjects[1]?.value).toContain("consumedAt");
  });

  it("rejects GGG OAuth completion when pending state is missing", async () => {
    const response = await api.request(
      "/auth/ggg/complete",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          state: "missing-state",
          code: "authorization-code",
        }),
      },
      {
        APP_URL: "https://calandra.pages.dev",
        GGG_OAUTH_CLIENT_ID: "calandra-client-id",
        GGG_TOKEN_ENCRYPTION_KEY: base64Key(7),
        SNAPSHOT_BUCKET: {
          async get() {
            return null;
          },
          async put() {
            throw new Error("complete must stop before writing tokens");
          },
        },
      },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "GGG OAuth state is invalid or expired",
    });
  });

  it("rejects GGG OAuth exchange without snapshot write authorization", async () => {
    const response = await api.request(
      "/auth/ggg/exchange",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          account: "example",
          code: "authorization-code",
          codeVerifier: "pkce-verifier",
          redirectUri: "https://calandra.pages.dev/auth/ggg/callback",
        }),
      },
      {
        APP_URL: "https://calandra.pages.dev",
        SNAPSHOT_WRITE_TOKEN: "snapshot-write-token",
      },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "snapshot write is unauthorized",
    });
  });

  it("rejects malformed GGG OAuth exchange payloads", async () => {
    const response = await api.request(
      "/auth/ggg/exchange",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          account: "example",
          code: "",
          codeVerifier: "",
          redirectUri: "not-a-url",
        }),
      },
      { APP_URL: "https://calandra.pages.dev" },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid GGG OAuth token exchange request",
    });
  });

  it("requires GGG OAuth exchange configuration before accepting token storage", async () => {
    const response = await api.request(
      "/auth/ggg/exchange",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          account: "example",
          code: "authorization-code",
          codeVerifier: "pkce-verifier",
          redirectUri: "https://calandra.pages.dev/auth/ggg/callback",
        }),
      },
      {
        APP_URL: "https://calandra.pages.dev",
        SNAPSHOT_BUCKET: {
          async put() {
            throw new Error("exchange must stop before writing tokens");
          },
        },
      },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "GGG OAuth token exchange is not configured",
    });
  });
  it("captures an official PoE2 character snapshot using a stored encrypted GGG token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-21T10:00:00.000Z"));
    const encryptionKey = base64Key(7);
    const storedTokenObject = await storedGggTokenObject({
      account: "example",
      key: encryptionKey,
      tokenSet: {
        accessToken: "ggg-access-token",
        refreshToken: "ggg-refresh-token",
        tokenType: "bearer",
        expiresAt: "2026-06-21T11:00:00.000Z",
        scope: ["account:characters"],
        username: "CalandraAccount",
      },
    });
    const requestedKeys: string[] = [];
    const storedObjects: Array<{
      key: string;
      value: string;
      options: unknown;
    }> = [];
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe("Bearer ggg-access-token");
      expect(headers.get("user-agent")).toBe(
        "calandra/0.1.0 (+https://calandra.pages.dev; maintainer@calandra.dev)",
      );

      if (url === "https://api.pathofexile.com/character/poe2") {
        return jsonResponse({ characters: [{ name: "CalandraTest" }] });
      }

      if (url === "https://api.pathofexile.com/character/poe2/CalandraTest") {
        return jsonResponse({
          character: {
            id: "character-1",
            name: "CalandraTest",
            class: "Deadeye",
            level: 73,
            league: "Dawn of the Hunt",
            equipment: [
              {
                inventoryId: "gloves",
                typeLine: "Duskthread Grips",
                rarity: "rare",
                id: "item-1",
              },
            ],
          },
        });
      }

      throw new Error(`Unexpected GGG API URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetch);

    const response = await api.request(
      "/snapshots/capture/poe2-stored-token",
      {
        method: "POST",
        headers: {
          authorization: "Bearer snapshot-write-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          account: "example",
          capturedAt: "2026-06-21T10:00:00.000Z",
          snapshotId: "snapshot-2026-06-21T10-00-00Z",
        }),
      },
      {
        APP_URL: "https://calandra.pages.dev",
        GGG_USER_AGENT:
          "calandra/0.1.0 (+https://calandra.pages.dev; maintainer@calandra.dev)",
        GGG_TOKEN_ENCRYPTION_KEY: encryptionKey,
        GGG_TOKEN_R2_PREFIX: "oauth/ggg",
        SNAPSHOT_R2_PREFIX: "snapshots",
        SNAPSHOT_WRITE_TOKEN: "snapshot-write-token",
        SNAPSHOT_BUCKET: {
          async get(key: string) {
            requestedKeys.push(key);

            return key === "oauth/ggg/example/token.json"
              ? {
                  async text() {
                    return storedTokenObject;
                  },
                }
              : null;
          },
          async put(key: string, value: string, options: unknown) {
            storedObjects.push({ key, value, options });
          },
        },
      },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      source: "snapshot-store",
      objectKey: "snapshots/example/snapshot-2026-06-21T10-00-00Z.json",
      snapshot: {
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
            equipment: [
              {
                slot: "gloves",
                name: "Duskthread Grips",
                itemId: "item-1",
                rarity: "rare",
              },
            ],
          },
        ],
      },
    });
    expect(requestedKeys).toEqual(["oauth/ggg/example/token.json"]);
    expect(storedObjects).toEqual([
      {
        key: "snapshots/example/snapshot-2026-06-21T10-00-00Z.json",
        value: JSON.stringify({
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
              equipment: [
                {
                  slot: "gloves",
                  name: "Duskthread Grips",
                  itemId: "item-1",
                  rarity: "rare",
                },
              ],
            },
          ],
        }),
        options: {
          httpMetadata: { contentType: "application/json; charset=utf-8" },
        },
      },
    ]);
    expect(JSON.stringify(storedObjects)).not.toContain("ggg-access-token");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("refreshes an expired stored GGG token before capturing a PoE2 character snapshot", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-21T10:00:00.000Z"));
    const encryptionKey = base64Key(7);
    const storedTokenObject = await storedGggTokenObject({
      account: "example",
      key: encryptionKey,
      tokenSet: {
        accessToken: "expired-access-token",
        refreshToken: "ggg-refresh-token",
        tokenType: "bearer",
        expiresAt: "2026-06-21T09:59:00.000Z",
        scope: ["account:characters"],
      },
    });
    const storedObjects: Array<{
      key: string;
      value: string;
      options: unknown;
    }> = [];
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "https://www.pathofexile.com/oauth/token") {
        expect(init?.method).toBe("POST");
        const params = new URLSearchParams(String(init?.body));
        expect(Object.fromEntries(params)).toEqual({
          client_id: "calandra-client-id",
          grant_type: "refresh_token",
          refresh_token: "ggg-refresh-token",
          scope: "account:characters",
        });

        return jsonResponse({
          access_token: "refreshed-access-token",
          refresh_token: "refreshed-refresh-token",
          token_type: "bearer",
          expires_in: 3600,
          scope: "account:characters",
        });
      }

      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Bearer refreshed-access-token",
      );

      if (url === "https://api.pathofexile.com/character/poe2") {
        return jsonResponse({ characters: [{ name: "CalandraTest" }] });
      }

      if (url === "https://api.pathofexile.com/character/poe2/CalandraTest") {
        return jsonResponse({
          character: {
            id: "character-1",
            name: "CalandraTest",
            class: "Deadeye",
            level: 74,
            league: "Dawn of the Hunt",
            equipment: [],
          },
        });
      }

      throw new Error(`Unexpected GGG API URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetch);

    const response = await api.request(
      "/snapshots/capture/poe2-stored-token",
      {
        method: "POST",
        headers: {
          authorization: "Bearer snapshot-write-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ account: "example" }),
      },
      {
        APP_URL: "https://calandra.pages.dev",
        GGG_OAUTH_CLIENT_ID: "calandra-client-id",
        GGG_USER_AGENT:
          "calandra/0.1.0 (+https://calandra.pages.dev; maintainer@calandra.dev)",
        GGG_TOKEN_ENCRYPTION_KEY: encryptionKey,
        GGG_TOKEN_R2_PREFIX: "oauth/ggg",
        SNAPSHOT_R2_PREFIX: "snapshots",
        SNAPSHOT_WRITE_TOKEN: "snapshot-write-token",
        SNAPSHOT_BUCKET: {
          async get(key: string) {
            return key === "oauth/ggg/example/token.json"
              ? {
                  async text() {
                    return storedTokenObject;
                  },
                }
              : null;
          },
          async put(key: string, value: string, options: unknown) {
            storedObjects.push({ key, value, options });
          },
        },
      },
    );

    expect(response.status).toBe(201);
    expect(storedObjects.map((object) => object.key)).toEqual([
      "oauth/ggg/example/token.json",
      "snapshots/example/snapshot-2026-06-21T10-00-00-000Z.json",
    ]);
    expect(storedObjects[0]?.value).not.toContain("refreshed-access-token");
    expect(storedObjects[0]?.value).not.toContain("refreshed-refresh-token");
    expect(storedObjects[0]?.value).toContain("encryptedTokenSet");
  });

  it("rejects stored-token snapshot capture without snapshot write authorization", async () => {
    const response = await api.request(
      "/snapshots/capture/poe2-stored-token",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account: "example" }),
      },
      {
        APP_URL: "https://calandra.pages.dev",
        SNAPSHOT_WRITE_TOKEN: "snapshot-write-token",
      },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "snapshot write is unauthorized",
    });
  });

  it("returns 404 when no stored GGG token exists for snapshot capture", async () => {
    const response = await api.request(
      "/snapshots/capture/poe2-stored-token",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account: "example" }),
      },
      {
        APP_URL: "https://calandra.pages.dev",
        GGG_USER_AGENT:
          "calandra/0.1.0 (+https://calandra.pages.dev; maintainer@calandra.dev)",
        GGG_TOKEN_ENCRYPTION_KEY: base64Key(7),
        SNAPSHOT_BUCKET: {
          async get() {
            return null;
          },
          async put() {
            throw new Error("capture must stop before writing snapshots");
          },
        },
      },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "GGG OAuth token is not linked",
      account: "example",
    });
  });

  it("rejects malformed stored-token snapshot capture payloads", async () => {
    const response = await api.request(
      "/snapshots/capture/poe2-stored-token",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account: "" }),
      },
      { APP_URL: "https://calandra.pages.dev" },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid stored-token PoE2 snapshot capture request",
    });
  });
  it("rejects official PoE2 character snapshot capture without GGG configuration", async () => {
    const response = await api.request(
      "/snapshots/capture/poe2-character",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          account: "example",
          accessToken: "ggg-access-token",
          grantedScopes: ["account:characters"],
        }),
      },
      {
        APP_URL: "https://calandra.pages.dev",
        SNAPSHOT_BUCKET: {
          async put() {
            throw new Error("capture must stop before writing snapshots");
          },
        },
      },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "GGG User-Agent is not configured",
    });
  });

  it("rejects malformed official PoE2 character snapshot capture payloads", async () => {
    const response = await api.request(
      "/snapshots/capture/poe2-character",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          account: "example",
          accessToken: "",
          grantedScopes: [],
        }),
      },
      {
        APP_URL: "https://calandra.pages.dev",
        GGG_USER_AGENT:
          "calandra/0.1.0 (+https://calandra.pages.dev; maintainer@calandra.dev)",
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid PoE2 character snapshot capture request",
    });
  });

  it("rejects malformed account snapshot writes", async () => {
    const response = await api.request(
      "/snapshots",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "snapshot-missing-fields",
          account: "example",
        }),
      },
      { APP_URL: "https://calandra.pages.dev" },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid account snapshot",
    });
  });

  it("requires a snapshot bucket before accepting account snapshots", async () => {
    const response = await api.request(
      "/snapshots",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "snapshot-2026-06-21T10-00-00Z",
          account: "example",
          capturedAt: "2026-06-21T10:00:00.000Z",
          source: "manual-import",
          capabilities: { characters: true, stashes: true },
          characters: [],
          stashes: [],
        }),
      },
      { APP_URL: "https://calandra.pages.dev" },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "snapshot bucket is not configured",
    });
  });

  it("restores a persisted account snapshot from the snapshot bucket", async () => {
    const requestedKeys: string[] = [];
    const snapshot = {
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
          equipment: [
            {
              slot: "gloves",
              name: "Duskthread Grips",
              stats: { life: 65 },
            },
          ],
        },
      ],
    };

    const response = await api.request(
      "/snapshots/example/snapshot-2026-06-21T10-00-00Z",
      undefined,
      {
        APP_URL: "https://calandra.pages.dev",
        SNAPSHOT_R2_PREFIX: "snapshots",
        SNAPSHOT_BUCKET: {
          async get(key: string) {
            requestedKeys.push(key);

            return {
              async text() {
                return JSON.stringify(snapshot);
              },
            };
          },
        },
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(snapshot);
    expect(requestedKeys).toEqual([
      "snapshots/example/snapshot-2026-06-21T10-00-00Z.json",
    ]);
  });

  it("returns 404 when a persisted account snapshot is missing", async () => {
    const response = await api.request(
      "/snapshots/example/missing-snapshot",
      undefined,
      {
        APP_URL: "https://calandra.pages.dev",
        SNAPSHOT_BUCKET: {
          async get() {
            return null;
          },
        },
      },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "account snapshot not found",
      account: "example",
      snapshotId: "missing-snapshot",
    });
  });

  it("requires a snapshot bucket before restoring account snapshots", async () => {
    const response = await api.request(
      "/snapshots/example/snapshot-2026-06-21T10-00-00Z",
      undefined,
      { APP_URL: "https://calandra.pages.dev" },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "snapshot bucket is not configured",
    });
  });

  it("rejects corrupted stored account snapshots", async () => {
    const response = await api.request(
      "/snapshots/example/snapshot-2026-06-21T10-00-00Z",
      undefined,
      {
        APP_URL: "https://calandra.pages.dev",
        SNAPSHOT_BUCKET: {
          async get() {
            return {
              async text() {
                return JSON.stringify({ id: "snapshot-missing-fields" });
              },
            };
          },
        },
      },
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "stored account snapshot failed validation",
    });
  });

  it("lists persisted account snapshots from the snapshot bucket", async () => {
    const requestedPrefixes: string[] = [];
    const response = await api.request("/snapshots/example", undefined, {
      APP_URL: "https://calandra.pages.dev",
      SNAPSHOT_R2_PREFIX: "snapshots",
      SNAPSHOT_BUCKET: {
        async list(options: { prefix?: string }) {
          requestedPrefixes.push(options.prefix ?? "");

          return {
            objects: [
              {
                key: "snapshots/example/snapshot-2026-06-21T11-00-00Z.json",
                uploaded: new Date("2026-06-21T11:01:00.000Z"),
                size: 1024,
              },
              {
                key: "snapshots/example/snapshot-2026-06-21T10-00-00Z.json",
                uploaded: new Date("2026-06-21T10:01:00.000Z"),
                size: 512,
              },
              {
                key: "snapshots/example/not-a-json-object.tmp",
                uploaded: new Date("2026-06-21T09:01:00.000Z"),
                size: 128,
              },
            ],
          };
        },
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
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
        {
          account: "example",
          snapshotId: "snapshot-2026-06-21T11-00-00Z",
          objectKey: "snapshots/example/snapshot-2026-06-21T11-00-00Z.json",
          uploadedAt: "2026-06-21T11:01:00.000Z",
          size: 1024,
        },
      ],
    });
    expect(requestedPrefixes).toEqual(["snapshots/example/"]);
  });

  it("returns an empty account snapshot list when none exist", async () => {
    const response = await api.request("/snapshots/example", undefined, {
      APP_URL: "https://calandra.pages.dev",
      SNAPSHOT_BUCKET: {
        async list() {
          return { objects: [] };
        },
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      source: "snapshot-store",
      account: "example",
      snapshots: [],
    });
  });

  it("requires a snapshot bucket before listing account snapshots", async () => {
    const response = await api.request("/snapshots/example", undefined, {
      APP_URL: "https://calandra.pages.dev",
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "snapshot bucket is not configured",
    });
  });

  it("diffs persisted account snapshots by snapshot id from the snapshot bucket", async () => {
    const requestedKeys: string[] = [];
    const snapshotsByKey = new Map([
      [
        "snapshots/example/snapshot-before.json",
        {
          id: "snapshot-before",
          account: "example",
          capturedAt: "2026-06-21T10:00:00.000Z",
          source: "official-poe2-character",
          capabilities: { characters: true, stashes: true },
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
          stashes: [
            {
              id: "currency",
              name: "Currency",
              league: "Dawn of the Hunt",
              items: [{ slot: "stash", name: "Exalted Orb" }],
            },
          ],
        },
      ],
      [
        "snapshots/example/snapshot-after.json",
        {
          id: "snapshot-after",
          account: "example",
          capturedAt: "2026-06-21T11:00:00.000Z",
          source: "official-poe2-character",
          capabilities: { characters: true, stashes: true },
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
          stashes: [
            {
              id: "currency",
              name: "Currency",
              league: "Dawn of the Hunt",
              items: [
                { slot: "stash", name: "Exalted Orb" },
                { slot: "stash", name: "Divine Orb" },
              ],
            },
          ],
        },
      ],
    ]);

    const response = await api.request(
      "/snapshots/example/diff?beforeSnapshotId=snapshot-before&afterSnapshotId=snapshot-after",
      undefined,
      {
        APP_URL: "https://calandra.pages.dev",
        SNAPSHOT_R2_PREFIX: "snapshots",
        SNAPSHOT_BUCKET: {
          async get(key: string) {
            requestedKeys.push(key);
            const snapshot = snapshotsByKey.get(key);

            return snapshot
              ? {
                  async text() {
                    return JSON.stringify(snapshot);
                  },
                }
              : null;
          },
        },
      },
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
      stashChanges: [
        {
          id: "currency",
          name: "Currency",
          type: "changed",
          beforeItemCount: 1,
          afterItemCount: 2,
          itemCountDelta: 1,
        },
      ],
    });
    expect(requestedKeys).toEqual([
      "snapshots/example/snapshot-before.json",
      "snapshots/example/snapshot-after.json",
    ]);
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

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
function base64Key(seed: number) {
  const bytes = Uint8Array.from(
    { length: 32 },
    (_, index) => (seed + index) % 256,
  );

  return btoa(String.fromCharCode(...bytes));
}
async function storedGggTokenObject({
  account,
  key,
  tokenSet,
}: {
  account: string;
  key: string;
  tokenSet: GggOAuthTokenSet;
}) {
  const encryptedTokenSet = await encryptGggOAuthTokenSet(tokenSet, {
    key: parseBase64Key(key),
  });

  return JSON.stringify({
    account,
    provider: "ggg",
    updatedAt: "2026-06-21T09:00:00.000Z",
    token: {
      expiresAt: tokenSet.expiresAt,
      scope: [...tokenSet.scope],
      ...(tokenSet.username ? { username: tokenSet.username } : {}),
      ...(tokenSet.sub ? { sub: tokenSet.sub } : {}),
    },
    encryptedTokenSet,
  });
}

function parseBase64Key(value: string) {
  const base64 = value.trim().replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);

  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
