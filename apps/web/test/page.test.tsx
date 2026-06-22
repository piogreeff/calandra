import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import Home from "../src/app/page";

vi.stubGlobal("React", React);

const datasetSources = [
  {
    kind: "game-data",
    name: "poe2db.tw",
    url: "https://poe2db.tw/",
    attribution:
      "Game data derived from Path of Exile 2 community references; Path of Exile 2 is property of Grinding Gear Games.",
  },
] as const;

describe("home dashboard", () => {
  it("loads snapshot panels for the selected account query", async () => {
    const fetchImplementation = mockDashboardFetch();
    vi.stubGlobal("fetch", fetchImplementation);

    const html = renderToStaticMarkup(
      await Home({ searchParams: Promise.resolve({ account: "RealAccount" }) }),
    );

    const requestedUrls = fetchImplementation.mock.calls.map(([input]) =>
      String(input),
    );

    expect(requestedUrls).toContain(
      "https://calandra-api.piogreeff.workers.dev/snapshots/RealAccount",
    );
    expect(requestedUrls).toContain(
      "https://calandra-api.piogreeff.workers.dev/snapshots/RealAccount/snapshot-2026-06-21T10-00-00Z",
    );
    expect(requestedUrls).toContain(
      "https://calandra-api.piogreeff.workers.dev/advisor/snapshots/RealAccount/snapshot-2026-06-21T10-00-00Z?league=Dawn+of+the+Hunt&patch=0.2.0",
    );
    expect(requestedUrls).toContain(
      "https://calandra-api.piogreeff.workers.dev/crafting/estimate-from-dataset?league=Dawn+of+the+Hunt&patch=0.2.0",
    );
    expect(
      requestedUrls.some((url) => url.includes("/snapshots/example")),
    ).toBe(false);
    expect(html).toContain('value="RealAccount"');
    expect(html).toContain("snapshots/RealAccount/");
  });

  it("restores the selected account snapshot from query params", async () => {
    const fetchImplementation = mockDashboardFetch();
    vi.stubGlobal("fetch", fetchImplementation);

    const html = renderToStaticMarkup(
      await Home({
        searchParams: Promise.resolve({
          account: "RealAccount",
          snapshotId: "snapshot-2026-06-21T09-00-00Z",
        }),
      }),
    );

    const requestedUrls = fetchImplementation.mock.calls.map(([input]) =>
      String(input),
    );

    expect(requestedUrls).toContain(
      "https://calandra-api.piogreeff.workers.dev/snapshots/RealAccount",
    );
    expect(requestedUrls).toContain(
      "https://calandra-api.piogreeff.workers.dev/snapshots/RealAccount/snapshot-2026-06-21T09-00-00Z",
    );
    expect(requestedUrls).toContain(
      "https://calandra-api.piogreeff.workers.dev/advisor/snapshots/RealAccount/snapshot-2026-06-21T09-00-00Z?league=Dawn+of+the+Hunt&patch=0.2.0",
    );
    expect(
      requestedUrls.some((url) =>
        url.endsWith("/snapshots/RealAccount/snapshot-2026-06-21T10-00-00Z"),
      ),
    ).toBe(false);
    expect(html).toContain("Selected snapshot");
    expect(html).toContain("snapshot-2026-06-21T09-00-00Z");
    expect(html).toContain("RealMonkBefore");
    expect(html).toContain("Level 43 Monk");
    expect(html).toContain("Early Gloves");
    expect(html).toContain("+22.0");
    expect(html).toContain(
      "?account=RealAccount&amp;snapshotId=snapshot-2026-06-21T10-00-00Z",
    );
  });

  it("filters ladder builds and previews the selected build from query params", async () => {
    const fetchImplementation = mockDashboardFetch();
    vi.stubGlobal("fetch", fetchImplementation);

    const html = renderToStaticMarkup(
      await Home({
        searchParams: Promise.resolve({
          account: "RealAccount",
          className: "Deadeye",
          skill: "Lightning",
          buildId: "stormweaver-2",
        }),
      }),
    );

    const requestedUrls = fetchImplementation.mock.calls.map(([input]) =>
      String(input),
    );

    expect(requestedUrls).toContain(
      "https://calandra-api.piogreeff.workers.dev/builds/ladder?league=Dawn+of+the+Hunt&patch=0.2.0&className=Deadeye&skill=Lightning&limit=8",
    );
    expect(requestedUrls).toContain(
      "https://calandra-api.piogreeff.workers.dev/builds/ladder/stormweaver-2?league=Dawn+of+the+Hunt&patch=0.2.0",
    );
    expect(html).toContain("Ladder filters");
    expect(html).toContain('name="className"');
    expect(html).toContain('value="Deadeye"');
    expect(html).toContain('name="skill"');
    expect(html).toContain('value="Lightning"');
    expect(html).toContain("Published ladder build");
    expect(html).toContain("StormWeaverTwo");
    expect(html).toContain("Level 94 Deadeye");
    expect(html).toContain("Galvanic Shards");
    expect(html).toContain("Galvanic Bow");
    expect(html).toContain(
      "https://calandra-assets.example/images/Dawn%20of%20the%20Hunt/0.2.0/builds/stormweaver-2/weapon.png",
    );
    expect(html).toContain("Resonance");
    expect(html).toContain("Inspect build");
    expect(html).toContain(
      "?account=RealAccount&amp;className=Deadeye&amp;skill=Lightning&amp;buildId=stormweaver-2",
    );
  });

  it("shows deterministic advisor rankings and temporary endpoints", async () => {
    vi.stubGlobal("fetch", mockDashboardFetch());

    const html = renderToStaticMarkup(await Home({}));

    expect(html).toContain("Deterministic upgrade rankings");
    expect(html).toContain("Loadout workbench");
    expect(html).toContain("Gear with images");
    expect(html).toContain("Image-backed catalog samples");
    expect(html).toContain("3 equipped slots");
    expect(html).toContain("2 with images");
    expect(html).toContain("8 open slots");
    expect(html).toContain("Workbench actions");
    expect(html).toContain("Published ladder build");
    expect(html).toContain("Level 92 Deadeye");
    expect(html).toContain("Equipped gear");
    expect(html).toContain("Stormneedle Spear");
    expect(html).toContain(
      "https://calandra-assets.example/images/Dawn%20of%20the%20Hunt/0.2.0/builds/deadeye-1/weapon.png",
    );
    expect(html).toContain("Open slots");
    expect(html).toContain("Helmet");
    expect(html).toContain("No image");
    expect(html).toContain("Passive tree");
    expect(html).toContain("2 passive nodes tracked");
    expect(html).toContain("Open passive tree reference");
    expect(html).toContain("Published poe.ninja ladder passive summary");
    expect(html).toContain("Duskthread Grips");
    expect(html).toContain("No image");
    expect(html).not.toContain("demo-gloves.svg");
    expect(html).toContain("Calandra Demo Amulet");
    expect(html).toContain(
      "https://calandra-assets.example/images/Dawn%20of%20the%20Hunt/0.2.0/builds/deadeye-1/amulet.png",
    );
    expect(html).toContain(
      "https://poe.ninja/poe2/builds/dawn/character/example/CalandraTest/passive-tree",
    );
    expect(html).toContain("Duskthread Grips");
    expect(html).toContain("Snapshot advisor");
    expect(html).toContain("+60.0");
    expect(html).toContain("5.00 / chaos");
    expect(html).toContain("No LLM values");
    expect(html).toContain("Crafting calculator");
    expect(html).toContain("Dataset mod pool");
    expect(html).toContain("25.0%");
    expect(html).toContain("8 chaos");
    expect(html).toContain("Craft");
    expect(html).toContain("Clipboard price check");
    expect(html).toContain("Parsed clipboard item");
    expect(html).toContain("Stackable Currency");
    expect(html).toContain("Divine Orb");
    expect(html).toContain("142 chaos");
    expect(html).toContain("Matched by name");
    expect(html).toContain("calandra-api.piogreeff.workers.dev");
    expect(html).toContain("calandra.pages.dev");
    expect(html).toContain("Calandra Demo Wand");
    expect(html).toContain('alt="Calandra Demo Amulet icon"');
    expect(html).toContain(
      "https://calandra.pages.dev/demo-unique-placeholder.png",
    );
    expect(html).toContain("Published R2 artifact");
    expect(html).toContain("Visual item catalog");
    expect(html).toContain("3 image-backed records");
    expect(html).toContain("Amulet");
    expect(html).toContain("Choir of the Storm");
    expect(html).toContain('alt="Choir of the Storm icon"');
    expect(html).toContain(
      "https://calandra-assets.example/images/Dawn%20of%20the%20Hunt/0.2.0/uniques/choir-of-the-storm.png",
    );
    expect(html).toContain("Dataset manifest");
    expect(html).toContain("9aaa78cdba51");
    expect(html).toContain("Unique images");
    expect(html).toContain("95.0%");
    expect(html).toContain("19 / 20");
    expect(html).toContain("Source attribution");
    expect(html).toContain("poe2db.tw");
    expect(html).toContain(
      "Game data derived from Path of Exile 2 community references",
    );
    expect(html).toContain("Snapshot restore");
    expect(html).toContain("GGG account link");
    expect(html).toContain("Ready to link");
    expect(html).toContain("Link GGG account");
    expect(html).toContain('name="account"');
    expect(html).toContain("account:characters");
    expect(html).toContain("/auth/ggg/callback");
    expect(html).toContain("snapshot-2026-06-21T10-00-00Z");
    expect(html).toContain("512 B");
    expect(html).toContain("Snapshot diff");
    expect(html).toContain("Monkette");
    expect(html).toContain("+2 levels");
    expect(html).toContain("Gloves");
    expect(html).toContain("Frayed Mail Mitts");
    expect(html).toContain("Duskthread Grips");
    expect(html).toContain("Currency Tab");
    expect(html).toContain("+7 items");
    expect(html).toContain("Ladder builds");
    expect(html).toContain("CalandraTest");
    expect(html).toContain("Level 92 Deadeye");
    expect(html).toContain("#42");
    expect(html).toContain("Lightning Arrow");
    expect(html).toContain("3 gear items tracked");
    expect(html).toContain("Passive highlights");
    expect(html).toContain("Acrobatics");
    expect(html).toContain("Gathering Winds");
    expect(html).toContain("Far Shot");
    expect(html).toContain(
      "Projectile pathing with evasion keystone coverage.",
    );
    expect(html).toContain("Open passive tree");
    expect(html).toContain(
      "https://poe.ninja/poe2/builds/dawn/character/example/CalandraTest/passive-tree",
    );
    expect(html).toContain("example");
    expect(html).toContain("Desktop shell");
    expect(html).toContain("Checking desktop shell");
    expect(html).toContain("Loot filters, BuildPlanner files");
    expect(html).toContain("About Calandra");
    expect(html).toContain("Unofficial fan tool");
    expect(html).toContain(
      "not affiliated with, endorsed by, or associated with Grinding Gear Games",
    );
  });

  it("shows demo snapshot equipment and passive tree when snapshot API is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );

    const html = renderToStaticMarkup(await Home({}));

    expect(html).toContain("Demo snapshot");
    expect(html).toContain("Level 45 Monk");
    expect(html).toContain("Monkette");
    expect(html).toContain("Duskthread Grips");
    expect(html).toContain("Calandra Demo Amulet");
    expect(html).toContain("2 passive nodes tracked");
    expect(html).toContain("passive-1");
    expect(html).toContain("passive-2");
    expect(html).toContain("Latest account snapshot passive allocation");
    expect(html).toContain("fallback-demo-snapshot");
  });
});

function mockDashboardFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("/items?")) {
      return Response.json({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        items: [
          {
            id: "calandra-demo-wand",
            name: "Calandra Demo Wand",
            category: "wand",
            rarity: "magic",
          },
        ],
      });
    }

    if (url.includes("/uniques?")) {
      return Response.json({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        uniques: [
          {
            id: "calandra-demo-amulet",
            name: "Calandra Demo Amulet",
            category: "amulet",
            rarity: "unique",
            iconUrl: "https://calandra.pages.dev/demo-unique-placeholder.png",
            iconAttribution:
              "Placeholder demo icon URL; no game art is bundled or served by this artifact.",
          },
        ],
      });
    }

    if (url.includes("/economy/")) {
      return Response.json({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        prices: [
          {
            id: "demo-divine-orb",
            name: "Divine Orb",
            chaosEquivalent: 142,
            updatedAt: "2026-06-21T13:15:00.000Z",
          },
        ],
      });
    }

    if (
      url.includes("/builds/ladder?") &&
      url.includes("className=Deadeye") &&
      url.includes("skill=Lightning")
    ) {
      return Response.json({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        builds: [
          {
            id: "stormweaver-2",
            account: "example",
            character: "StormWeaverTwo",
            className: "Deadeye",
            level: 94,
            rank: 12,
            mainSkill: "Galvanic Shards",
            passiveTreeUrl:
              "https://poe.ninja/poe2/builds/dawn/character/example/StormWeaverTwo/passive-tree",
            passiveSkillIds: ["resonance", "far-shot"],
            passiveTree: {
              allocatedCount: 2,
              keystones: ["Resonance"],
              notables: ["Far Shot"],
              summary: "Lightning projectile routing with bow scaling.",
            },
          },
        ],
      });
    }

    if (url.includes("/builds/ladder?")) {
      return Response.json({
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
            passiveTreeUrl:
              "https://poe.ninja/poe2/builds/dawn/character/example/CalandraTest/passive-tree",
            passiveSkillIds: ["keystone-1", "notable-2"],
            passiveTree: {
              allocatedCount: 2,
              keystones: ["Acrobatics"],
              notables: ["Gathering Winds", "Far Shot"],
              summary: "Projectile pathing with evasion keystone coverage.",
            },
          },
        ],
      });
    }

    if (url.includes("/crafting/estimate-from-dataset?")) {
      return Response.json({
        source: "published-dataset",
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        estimate: {
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
        },
        comparison: {
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
        },
      });
    }

    if (url.includes("/price/check-text")) {
      return Response.json({
        source: "published-dataset",
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        item: {
          id: "currency/divine-orb",
          name: "Divine Orb",
          category: "currency",
          rarity: "currency",
        },
        parsedItem: {
          itemClass: "Stackable Currency",
          category: "currency",
          rarity: "currency",
          name: "Divine Orb",
          properties: [{ name: "Stack Size", value: "1/10", augmented: false }],
          requirements: [],
          implicitMods: [],
          explicitMods: [],
          corrupted: false,
          identified: true,
        },
        price: {
          id: "divine-orb",
          name: "Divine Orb",
          chaosEquivalent: 142,
          updatedAt: "2026-06-21T00:00:00.000Z",
        },
        matchedBy: "name",
      });
    }

    if (url.includes("/builds/ladder/deadeye-1?")) {
      return Response.json({
        id: "deadeye-1",
        account: "example",
        character: "CalandraTest",
        className: "Deadeye",
        level: 92,
        rank: 42,
        mainSkill: "Lightning Arrow",
        passiveTreeUrl:
          "https://poe.ninja/poe2/builds/dawn/character/example/CalandraTest/passive-tree",
        passiveSkillIds: ["keystone-1", "notable-2"],
        passiveTree: {
          allocatedCount: 2,
          keystones: ["Acrobatics"],
          notables: ["Gathering Winds", "Far Shot"],
          summary: "Projectile pathing with evasion keystone coverage.",
        },
        equipment: [
          {
            slot: "Weapon",
            name: "Stormneedle Spear",
            rarity: "rare",
            iconUrl:
              "https://calandra-assets.example/images/Dawn%20of%20the%20Hunt/0.2.0/builds/deadeye-1/weapon.png",
            iconAttribution:
              "Item art is property of Grinding Gear Games and is cached for attribution-preserving display.",
            stats: { attackSpeed: 18, lightningDamage: 42 },
          },
          {
            slot: "Gloves",
            name: "Duskthread Grips",
            rarity: "rare",
            iconUrl: "https://calandra.pages.dev/demo-gloves.svg",
            iconAttribution:
              "Synthetic Calandra demo icon; no game art is bundled.",
          },
          {
            slot: "Amulet",
            name: "Calandra Demo Amulet",
            rarity: "unique",
            iconUrl:
              "https://calandra-assets.example/images/Dawn%20of%20the%20Hunt/0.2.0/builds/deadeye-1/amulet.png",
            iconAttribution:
              "Item art is property of Grinding Gear Games and is cached for attribution-preserving display.",
            stats: { spirit: 30 },
          },
        ],
      });
    }

    if (url.includes("/builds/ladder/stormweaver-2?")) {
      return Response.json({
        id: "stormweaver-2",
        account: "example",
        character: "StormWeaverTwo",
        className: "Deadeye",
        level: 94,
        rank: 12,
        mainSkill: "Galvanic Shards",
        passiveTreeUrl:
          "https://poe.ninja/poe2/builds/dawn/character/example/StormWeaverTwo/passive-tree",
        passiveSkillIds: ["resonance", "far-shot"],
        passiveTree: {
          allocatedCount: 2,
          keystones: ["Resonance"],
          notables: ["Far Shot"],
          summary: "Lightning projectile routing with bow scaling.",
        },
        equipment: [
          {
            slot: "Weapon",
            name: "Galvanic Bow",
            rarity: "rare",
            iconUrl:
              "https://calandra-assets.example/images/Dawn%20of%20the%20Hunt/0.2.0/builds/stormweaver-2/weapon.png",
            iconAttribution:
              "Item art is property of Grinding Gear Games and is cached for attribution-preserving display.",
            stats: { lightningDamage: 81, attackSpeed: 22 },
          },
        ],
      });
    }

    if (url.includes("/datasets/manifest?")) {
      return Response.json({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        generatedAt: "2026-06-21T13:15:00.000Z",
        artifactKey: "datasets/Dawn of the Hunt/0.2.0.json",
        sha256:
          "9aaa78cdba510700b430fad2090832dbf9d6b9a9408ef27a1beb110ff5a171af",
        sources: datasetSources,
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
          uniques: 1,
          mods: 0,
          gems: 0,
          economy: 1,
          ladderBuilds: 0,
        },
      });
    }

    if (url.includes("/datasets/visual-summary?")) {
      return Response.json({
        source: "published-dataset",
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        totalItems: 4,
        totalUniques: 2,
        totalVisualItems: 3,
        uniqueImageCoverage: {
          resolved: 19,
          expected: 20,
          ratio: 0.95,
          minimum: 0.95,
        },
        categories: [
          {
            category: "amulet",
            totalItems: 1,
            totalUniques: 2,
            iconCount: 2,
            featured: [
              {
                id: "choir-of-the-storm",
                name: "Choir of the Storm",
                category: "amulet",
                rarity: "unique",
                iconUrl:
                  "https://calandra-assets.example/images/Dawn%20of%20the%20Hunt/0.2.0/uniques/choir-of-the-storm.png",
                iconAttribution:
                  "Game art and item data are property of Grinding Gear Games.",
              },
              {
                id: "astramentis",
                name: "Astramentis",
                category: "amulet",
                rarity: "unique",
                iconUrl:
                  "https://calandra-assets.example/images/Dawn%20of%20the%20Hunt/0.2.0/uniques/astramentis.png",
                iconAttribution:
                  "Game art and item data are property of Grinding Gear Games.",
              },
            ],
          },
          {
            category: "wand",
            totalItems: 3,
            totalUniques: 0,
            iconCount: 1,
            featured: [
              {
                id: "advanced-siphoning-wand",
                name: "Advanced Siphoning Wand",
                category: "wand",
                rarity: "magic",
                iconUrl:
                  "https://calandra-assets.example/images/Dawn%20of%20the%20Hunt/0.2.0/items/advanced-siphoning-wand.png",
                iconAttribution:
                  "Game art and item data are property of Grinding Gear Games.",
              },
            ],
          },
        ],
      });
    }

    if (url.endsWith("/auth/ggg/status")) {
      return Response.json({
        source: "ggg-oauth-status",
        configured: true,
        redirectUri: "https://calandra.pages.dev/auth/ggg/callback",
        requiredScopes: ["account:characters"],
        features: {
          accountLinking: true,
          snapshotCapture: true,
        },
      });
    }

    if (url.endsWith("/snapshots/RealAccount")) {
      return Response.json({
        source: "snapshot-store",
        account: "RealAccount",
        snapshots: [
          {
            account: "RealAccount",
            snapshotId: "snapshot-2026-06-21T09-00-00Z",
            objectKey:
              "snapshots/RealAccount/snapshot-2026-06-21T09-00-00Z.json",
            uploadedAt: "2026-06-21T09:01:00.000Z",
            size: 480,
          },
          {
            account: "RealAccount",
            snapshotId: "snapshot-2026-06-21T10-00-00Z",
            objectKey:
              "snapshots/RealAccount/snapshot-2026-06-21T10-00-00Z.json",
            uploadedAt: "2026-06-21T10:01:00.000Z",
            size: 512,
          },
        ],
      });
    }

    if (url.includes("/snapshots/RealAccount/diff?")) {
      return Response.json({
        beforeSnapshotId: "snapshot-2026-06-21T09-00-00Z",
        afterSnapshotId: "snapshot-2026-06-21T10-00-00Z",
        beforeCapturedAt: "2026-06-21T09:00:00.000Z",
        afterCapturedAt: "2026-06-21T10:00:00.000Z",
        characterChanges: [],
        stashChanges: [],
      });
    }

    if (
      url.includes(
        "/advisor/snapshots/RealAccount/snapshot-2026-06-21T09-00-00Z?",
      )
    ) {
      return Response.json({
        source: "deterministic-engine",
        upgrades: [
          {
            slot: "Gloves",
            currentName: "Threadbare Gloves",
            candidateName: "Early Gloves",
            currentScore: 20,
            candidateScore: 42,
            scoreDelta: 22,
            estimatedCostChaos: 6,
            valuePerChaos: 3.6667,
            currentMissingStats: ["life"],
            candidateMissingStats: [],
          },
        ],
      });
    }

    if (url.includes("/snapshots/RealAccount/snapshot-2026-06-21T09-00-00Z")) {
      return Response.json({
        id: "snapshot-2026-06-21T09-00-00Z",
        account: "RealAccount",
        capturedAt: "2026-06-21T09:00:00.000Z",
        source: "manual-import",
        capabilities: { characters: true, stashes: true },
        characters: [
          {
            id: "char-1",
            name: "RealMonkBefore",
            className: "Monk",
            level: 43,
            league: "Dawn of the Hunt",
            passiveSkillIds: ["passive-before"],
            equipment: [
              {
                slot: "Gloves",
                name: "Threadbare Gloves",
                rarity: "normal",
              },
            ],
          },
        ],
        stashes: [
          {
            id: "stash-1",
            name: "Currency Tab",
            league: "Dawn of the Hunt",
            items: [{ slot: "stash", name: "Exalted Orb" }],
          },
        ],
      });
    }

    if (
      url.includes(
        "/advisor/snapshots/RealAccount/snapshot-2026-06-21T10-00-00Z?",
      )
    ) {
      return Response.json({
        source: "deterministic-engine",
        upgrades: [
          {
            slot: "Gloves",
            currentName: "Current Gloves",
            candidateName: "Heavy Gloves",
            currentScore: 40,
            candidateScore: 100,
            scoreDelta: 60,
            estimatedCostChaos: 12,
            valuePerChaos: 5,
            currentMissingStats: ["fireResistance"],
            candidateMissingStats: [],
          },
        ],
      });
    }

    if (url.includes("/snapshots/RealAccount/snapshot-2026-06-21T10-00-00Z")) {
      return Response.json({
        id: "snapshot-2026-06-21T10-00-00Z",
        account: "RealAccount",
        capturedAt: "2026-06-21T10:00:00.000Z",
        source: "manual-import",
        capabilities: { characters: true, stashes: true },
        characters: [
          {
            id: "char-1",
            name: "RealMonk",
            className: "Monk",
            level: 45,
            league: "Dawn of the Hunt",
            passiveSkillIds: ["passive-1", "passive-2"],
            equipment: [
              {
                slot: "Gloves",
                name: "Duskthread Grips",
                rarity: "rare",
                iconUrl: "https://calandra.pages.dev/demo-gloves.svg",
                iconAttribution:
                  "Synthetic Calandra demo icon; no game art is bundled.",
              },
            ],
          },
        ],
        stashes: [],
      });
    }

    if (url.endsWith("/snapshots/example")) {
      return Response.json({
        source: "snapshot-store",
        account: "example",
        snapshots: [
          {
            account: "example",
            snapshotId: "snapshot-2026-06-21T09-00-00Z",
            objectKey: "snapshots/example/snapshot-2026-06-21T09-00-00Z.json",
            uploadedAt: "2026-06-21T09:01:00.000Z",
            size: 480,
          },
          {
            account: "example",
            snapshotId: "snapshot-2026-06-21T10-00-00Z",
            objectKey: "snapshots/example/snapshot-2026-06-21T10-00-00Z.json",
            uploadedAt: "2026-06-21T10:01:00.000Z",
            size: 512,
          },
        ],
      });
    }

    if (url.includes("/snapshots/example/diff?")) {
      return Response.json({
        beforeSnapshotId: "snapshot-2026-06-21T09-00-00Z",
        afterSnapshotId: "snapshot-2026-06-21T10-00-00Z",
        beforeCapturedAt: "2026-06-21T09:00:00.000Z",
        afterCapturedAt: "2026-06-21T10:00:00.000Z",
        characterChanges: [
          {
            id: "char-1",
            name: "Monkette",
            type: "changed",
            beforeLevel: 43,
            afterLevel: 45,
            levelDelta: 2,
            equipmentChanges: [
              {
                type: "changed",
                slot: "Gloves",
                beforeName: "Frayed Mail Mitts",
                afterName: "Duskthread Grips",
              },
            ],
          },
        ],
        stashChanges: [
          {
            id: "stash-1",
            name: "Currency Tab",
            type: "changed",
            beforeItemCount: 1,
            afterItemCount: 8,
            itemCountDelta: 7,
          },
        ],
      });
    }

    if (url.includes("/snapshots/example/snapshot-2026-06-21T09-00-00Z")) {
      return Response.json({
        id: "snapshot-2026-06-21T09-00-00Z",
        account: "example",
        capturedAt: "2026-06-21T09:00:00.000Z",
        source: "manual-import",
        capabilities: { characters: true, stashes: true },
        characters: [
          {
            id: "char-1",
            name: "Monkette",
            className: "Monk",
            level: 43,
            league: "Dawn of the Hunt",
            equipment: [{ slot: "Gloves", name: "Frayed Mail Mitts" }],
          },
        ],
        stashes: [
          {
            id: "stash-1",
            name: "Currency Tab",
            league: "Dawn of the Hunt",
            items: [{ slot: "stash", name: "Exalted Orb" }],
          },
        ],
      });
    }

    if (
      url.includes("/advisor/snapshots/example/snapshot-2026-06-21T10-00-00Z?")
    ) {
      return Response.json({
        source: "deterministic-engine",
        upgrades: [
          {
            slot: "Gloves",
            currentName: "Frayed Mail Mitts",
            candidateName: "Duskthread Grips",
            currentScore: 40,
            candidateScore: 100,
            scoreDelta: 60,
            estimatedCostChaos: 12,
            valuePerChaos: 5,
            currentMissingStats: ["fireResistance"],
            candidateMissingStats: [],
          },
        ],
      });
    }

    if (url.includes("/snapshots/example/snapshot-2026-06-21T10-00-00Z")) {
      return Response.json({
        id: "snapshot-2026-06-21T10-00-00Z",
        account: "example",
        capturedAt: "2026-06-21T10:00:00.000Z",
        source: "manual-import",
        capabilities: { characters: true, stashes: true },
        characters: [
          {
            id: "char-1",
            name: "Monkette",
            className: "Monk",
            level: 45,
            league: "Dawn of the Hunt",
            passiveSkillIds: ["passive-1", "passive-2"],
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
              {
                slot: "Amulet",
                name: "Calandra Demo Amulet",
                rarity: "unique",
                iconUrl: "https://calandra.pages.dev/demo-amulet.svg",
                iconAttribution:
                  "Synthetic Calandra demo icon; no game art is bundled.",
              },
            ],
          },
        ],
        stashes: [
          {
            id: "stash-1",
            name: "Currency Tab",
            league: "Dawn of the Hunt",
            items: [
              { slot: "stash", name: "Exalted Orb" },
              { slot: "stash", name: "Divine Orb" },
              { slot: "stash", name: "Chaos Orb" },
              { slot: "stash", name: "Vaal Orb" },
              { slot: "stash", name: "Regal Orb" },
              { slot: "stash", name: "Alchemy Orb" },
              { slot: "stash", name: "Mirror Shard" },
              { slot: "stash", name: "Gemcutter Prism" },
            ],
          },
        ],
      });
    }

    return new Response(null, { status: 404 });
  });
}
