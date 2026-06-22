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
    expect(requestedUrls.some((url) => url.includes("/snapshots/example"))).toBe(
      false,
    );
    expect(html).toContain('value="RealAccount"');
    expect(html).toContain("snapshots/RealAccount/");
  });

  it("shows deterministic advisor rankings and temporary endpoints", async () => {
    vi.stubGlobal("fetch", mockDashboardFetch());

    const html = renderToStaticMarkup(await Home({}));

    expect(html).toContain("Deterministic upgrade rankings");
    expect(html).toContain("Character build preview");
    expect(html).toContain("Visual equipment");
    expect(html).toContain("Passive tree");
    expect(html).toContain("Level 45 Monk");
    expect(html).toContain("2 passive nodes tracked");
    expect(html).toContain("Open passive tree reference");
    expect(html).toContain("Link-out reference only");
    expect(html).toContain("Duskthread Grips");
    expect(html).toContain('alt="Duskthread Grips"');
    expect(html).toContain("https://calandra.pages.dev/demo-gloves.svg");
    expect(html).toContain('alt="Calandra Demo Amulet"');
    expect(html).toContain(
      "https://poe.ninja/poe2/builds/runesofaldur/character/heygyus-0416/ResurrectGodAura/passive-tree",
    );
    expect(html).toContain("Duskthread Grips");
    expect(html).toContain("+43.4");
    expect(html).toContain("14.47 / chaos");
    expect(html).toContain("No LLM values");
    expect(html).toContain("calandra-api.piogreeff.workers.dev");
    expect(html).toContain("calandra.pages.dev");
    expect(html).toContain("Calandra Demo Wand");
    expect(html).toContain('alt="Calandra Demo Amulet icon"');
    expect(html).toContain("https://calandra.pages.dev/demo-unique-placeholder.png");
    expect(html).toContain("Published R2 artifact");
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
    expect(html).toContain("Passive allocation preview");
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
