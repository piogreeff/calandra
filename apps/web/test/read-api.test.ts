import { describe, expect, it, vi } from "vitest";
import {
  getDashboardDataset,
  getDashboardSnapshots,
} from "../src/lib/read-api";

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

  it("falls back to empty snapshot restore metadata when the API is unavailable", async () => {
    const snapshots = await getDashboardSnapshots(
      "example",
      "https://calandra-api.piogreeff.workers.dev",
      vi.fn(async () => new Response(null, { status: 503 })),
    );

    expect(snapshots).toEqual({
      source: "fallback",
      account: "example",
      snapshots: [],
    });
  });
});
