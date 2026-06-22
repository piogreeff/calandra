import { describe, expect, it, vi } from "vitest";
import {
  completeDashboardGggOAuthLink,
  getDashboardDataset,
  getDashboardGggOAuthStatus,
  getDashboardSearch,
  getDashboardLatestSnapshot,
  getDashboardSnapshotDiff,
  getDashboardSnapshots,
  startDashboardGggOAuthLink,
} from "../src/lib/read-api";

const datasetSources = [
  {
    kind: "game-data",
    name: "poe2db.tw",
    url: "https://poe2db.tw/",
    attribution:
      "Game data derived from Path of Exile 2 community references; Path of Exile 2 is property of Grinding Gear Games.",
  },
] as const;

describe("dashboard read API client", () => {
  it("loads dashboard data from the typed read API", async () => {
    const fetchImplementation = vi.fn(async (input: RequestInfo | URL) => {
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

      if (url.includes("/datasets/manifest?")) {
        return Response.json({
          league: "Dawn of the Hunt",
          patch: "0.2.0",
          generatedAt: "2026-06-21T13:15:00.000Z",
          artifactKey: "datasets/Dawn of the Hunt/0.2.0.json",
          sha256:
            "9aaa78cdba510700b430fad2090832dbf9d6b9a9408ef27a1beb110ff5a171af",
          sources: datasetSources,
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
    });

    const dataset = await getDashboardDataset(
      "https://calandra-api.piogreeff.workers.dev",
      fetchImplementation,
    );

    expect(dataset.source).toBe("api");
    expect(dataset.items.map((item) => item.id)).toEqual([
      "calandra-demo-wand",
      "calandra-demo-amulet",
    ]);
    expect(dataset.prices[0]?.chaosEquivalent).toBe(142);
    expect(dataset.manifest.artifactKey).toBe(
      "datasets/Dawn of the Hunt/0.2.0.json",
    );
  });

  it("falls back to demo rows when the temporary API is unavailable", async () => {
    const dataset = await getDashboardDataset(
      "https://calandra-api.piogreeff.workers.dev",
      vi.fn(async () => new Response(null, { status: 503 })),
    );

    expect(dataset.source).toBe("fallback");
    expect(dataset.items.length).toBeGreaterThan(0);
    expect(dataset.prices.length).toBeGreaterThan(0);
    expect(dataset.manifest.artifactKey).toBe("fallback/demo-dataset.json");
  });

  it("loads grouped dataset search results from the typed search endpoint", async () => {
    const fetchImplementation = vi.fn(async () =>
      Response.json({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        query: "demo",
        items: [
          {
            id: "calandra-demo-wand",
            name: "Calandra Demo Wand",
            category: "wand",
            rarity: "magic",
          },
        ],
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
        mods: [
          {
            id: "demo-life-prefix",
            name: "+# to maximum Life",
            domain: "item",
            minItemLevel: 1,
          },
        ],
        gems: [
          {
            id: "demo-spark",
            name: "Spark",
            kind: "skill",
            level: 1,
          },
        ],
      }),
    );

    const results = await getDashboardSearch(
      "demo",
      "https://calandra-api.piogreeff.workers.dev",
      fetchImplementation,
    );

    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://calandra-api.piogreeff.workers.dev/search?league=Dawn+of+the+Hunt&patch=0.2.0&q=demo",
    );
    expect(results.source).toBe("api");
    expect(results.items[0]?.name).toBe("Calandra Demo Wand");
    expect(results.uniques[0]?.name).toBe("Calandra Demo Amulet");
    expect(results.mods[0]?.id).toBe("demo-life-prefix");
    expect(results.gems[0]?.name).toBe("Spark");
  });

  it("loads safe GGG OAuth status for account linking", async () => {
    const fetchImplementation = vi.fn(async () =>
      Response.json({
        source: "ggg-oauth-status",
        configured: true,
        redirectUri: "https://calandra.pages.dev/auth/ggg/callback",
        requiredScopes: ["account:characters"],
        features: {
          accountLinking: true,
          snapshotCapture: true,
        },
      }),
    );

    const status = await getDashboardGggOAuthStatus(
      "https://calandra-api.piogreeff.workers.dev",
      fetchImplementation,
    );

    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://calandra-api.piogreeff.workers.dev/auth/ggg/status",
    );
    expect(status.source).toBe("api");
    expect(status.features.accountLinking).toBe(true);
    expect(JSON.stringify(status)).not.toContain("clientSecret");
  });

  it("falls back to disabled GGG OAuth status when the API is unavailable", async () => {
    const status = await getDashboardGggOAuthStatus(
      "https://calandra-api.piogreeff.workers.dev",
      vi.fn(async () => new Response(null, { status: 503 })),
    );

    expect(status).toEqual({
      source: "fallback",
      configured: false,
      redirectUri: "https://calandra.pages.dev/auth/ggg/callback",
      requiredScopes: ["account:characters"],
      features: {
        accountLinking: false,
        snapshotCapture: false,
      },
    });
  });

  it("starts browser-safe GGG OAuth with a public API request", async () => {
    const fetchImplementation = vi.fn(
      async (input: RequestInfo | URL, init) => {
        expect(String(input)).toBe(
          "https://calandra-api.piogreeff.workers.dev/auth/ggg/start",
        );
        expect(init).toMatchObject({
          method: "POST",
          headers: { "content-type": "application/json" },
        });
        expect(JSON.parse(String(init?.body))).toEqual({
          account: "example",
        });

        return Response.json({
          source: "ggg-oauth-start",
          account: "example",
          authorizationUrl:
            "https://www.pathofexile.com/oauth/authorize?client_id=calandra",
          state: "oauth-state",
          expiresAt: "2026-06-21T10:10:00.000Z",
          redirectUri: "https://calandra.pages.dev/auth/ggg/callback",
          requiredScopes: ["account:characters"],
        });
      },
    );

    const started = await startDashboardGggOAuthLink(
      "example",
      "https://calandra-api.piogreeff.workers.dev",
      fetchImplementation,
    );

    expect(started.authorizationUrl).toContain(
      "https://www.pathofexile.com/oauth/authorize",
    );
    expect(started.state).toBe("oauth-state");
    expect(JSON.stringify(started)).not.toContain("codeVerifier");
  });

  it("completes browser-safe GGG OAuth with state and code only", async () => {
    const fetchImplementation = vi.fn(
      async (input: RequestInfo | URL, init) => {
        expect(String(input)).toBe(
          "https://calandra-api.piogreeff.workers.dev/auth/ggg/complete",
        );
        expect(init).toMatchObject({
          method: "POST",
          headers: { "content-type": "application/json" },
        });
        expect(JSON.parse(String(init?.body))).toEqual({
          state: "oauth-state",
          code: "authorization-code",
        });

        return Response.json({
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
      },
    );

    const completed = await completeDashboardGggOAuthLink(
      { state: "oauth-state", code: "authorization-code" },
      "https://calandra-api.piogreeff.workers.dev",
      fetchImplementation,
    );

    expect(completed.account).toBe("CalandraAccount");
    expect(completed.token.scope).toEqual(["account:characters"]);
    expect(JSON.stringify(completed)).not.toContain("access_token");
  });

  it("searches the demo dataset when the temporary search API is unavailable", async () => {
    const unavailableAmulet = await getDashboardSearch(
      "amulet",
      "https://calandra-api.piogreeff.workers.dev",
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    const unavailableDemo = await getDashboardSearch(
      "demo",
      "https://calandra-api.piogreeff.workers.dev",
      vi.fn(async () => new Response(null, { status: 503 })),
    );

    expect(unavailableAmulet).toMatchObject({
      source: "fallback",
      query: "amulet",
      items: [],
      uniques: [
        {
          id: "calandra-demo-amulet",
          name: "Calandra Demo Amulet",
          iconUrl: "https://calandra.pages.dev/demo-unique-placeholder.png",
        },
      ],
    });
    expect(unavailableDemo.items.map((item) => item.name)).toEqual([
      "Calandra Demo Wand",
      "Calandra Demo Robe",
    ]);
    expect(unavailableDemo.uniques.map((item) => item.name)).toEqual([
      "Calandra Demo Amulet",
    ]);
  });

  it("returns an empty fallback search result for blank searches", async () => {
    const blank = await getDashboardSearch(
      "   ",
      "https://calandra-api.piogreeff.workers.dev",
      vi.fn(),
    );

    expect(blank).toMatchObject({ source: "fallback", query: "" });
    expect(blank.items).toEqual([]);
  });

  it("loads account snapshot restore metadata from the typed API", async () => {
    const fetchImplementation = vi.fn(async () =>
      Response.json({
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
      }),
    );

    const snapshots = await getDashboardSnapshots(
      "example",
      "https://calandra-api.piogreeff.workers.dev",
      fetchImplementation,
    );

    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://calandra-api.piogreeff.workers.dev/snapshots/example",
    );
    expect(snapshots.source).toBe("api");
    expect(snapshots.account).toBe("example");
    expect(snapshots.snapshots[0]?.snapshotId).toBe(
      "snapshot-2026-06-21T10-00-00Z",
    );
  });

  it("loads the latest account snapshot detail with visual gear metadata", async () => {
    const fetchImplementation = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe(
        "https://calandra-api.piogreeff.workers.dev/snapshots/example/snapshot-2026-06-21T10-00-00Z",
      );

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
            ],
          },
        ],
        stashes: [],
      });
    });

    const snapshot = await getDashboardLatestSnapshot(
      "example",
      [
        {
          account: "example",
          snapshotId: "snapshot-2026-06-21T10-00-00Z",
          objectKey: "snapshots/example/snapshot-2026-06-21T10-00-00Z.json",
        },
      ],
      "https://calandra-api.piogreeff.workers.dev",
      fetchImplementation,
    );

    expect(snapshot.source).toBe("api");
    expect(snapshot.snapshot?.characters[0]?.equipment[0]?.iconUrl).toBe(
      "https://calandra.pages.dev/demo-gloves.svg",
    );
    expect(snapshot.snapshot?.characters[0]?.passiveSkillIds).toHaveLength(2);
  });

  it("falls back to demo snapshot restore metadata when the API is unavailable", async () => {
    const snapshots = await getDashboardSnapshots(
      "example",
      "https://calandra-api.piogreeff.workers.dev",
      vi.fn(async () => new Response(null, { status: 503 })),
    );

    expect(snapshots.source).toBe("fallback");
    expect(snapshots.account).toBe("example");
    expect(snapshots.snapshots[0]?.snapshotId).toBe("fallback-demo-snapshot");
    expect(snapshots.snapshots[0]?.objectKey).toBe(
      "fallback/example/fallback-demo-snapshot.json",
    );
  });

  it("falls back to a demo latest snapshot with passive tree data", async () => {
    const snapshot = await getDashboardLatestSnapshot(
      "example",
      [],
      "https://calandra-api.piogreeff.workers.dev",
      vi.fn(),
    );

    expect(snapshot.source).toBe("fallback");
    expect(snapshot.reason).toBe("no-snapshots");
    expect(snapshot.snapshot?.source).toBe("manual-import");
    expect(snapshot.snapshot?.characters[0]?.name).toBe("Monkette");
    expect(snapshot.snapshot?.characters[0]?.passiveSkillIds).toHaveLength(2);
    expect(snapshot.snapshot?.characters[0]?.equipment[0]?.name).toBe(
      "Duskthread Grips",
    );
  });

  it("loads the latest account snapshot diff through the typed API", async () => {
    const fetchImplementation = vi.fn(
      async (input: RequestInfo | URL, init) => {
        const url = String(input);

        expect(url).toBe(
          "https://calandra-api.piogreeff.workers.dev/snapshots/example/diff?beforeSnapshotId=snapshot-before&afterSnapshotId=snapshot-after",
        );
        expect(init).toBeUndefined();

        return Response.json({
          beforeSnapshotId: "snapshot-before",
          afterSnapshotId: "snapshot-after",
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
              afterItemCount: 2,
              itemCountDelta: 1,
            },
          ],
        });
      },
    );

    const diff = await getDashboardSnapshotDiff(
      "example",
      [
        {
          account: "example",
          snapshotId: "snapshot-before",
          objectKey: "snapshots/example/snapshot-before.json",
        },
        {
          account: "example",
          snapshotId: "snapshot-after",
          objectKey: "snapshots/example/snapshot-after.json",
        },
      ],
      "https://calandra-api.piogreeff.workers.dev",
      fetchImplementation,
    );

    expect(diff.source).toBe("api");
    expect(diff.reason).toBe("ready");
    expect(diff.diff?.characterChanges[0]?.levelDelta).toBe(2);
    expect(diff.diff?.stashChanges[0]?.itemCountDelta).toBe(1);
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it("does not request a snapshot diff until two snapshots are available", async () => {
    const fetchImplementation = vi.fn();

    const diff = await getDashboardSnapshotDiff(
      "example",
      [
        {
          account: "example",
          snapshotId: "snapshot-after",
          objectKey: "snapshots/example/snapshot-after.json",
        },
      ],
      "https://calandra-api.piogreeff.workers.dev",
      fetchImplementation,
    );

    expect(fetchImplementation).not.toHaveBeenCalled();
    expect(diff).toEqual({
      source: "fallback",
      reason: "insufficient-snapshots",
      account: "example",
      diff: null,
    });
  });
});
