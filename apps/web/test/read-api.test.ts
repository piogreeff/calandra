import { describe, expect, it, vi } from "vitest";
import { getDashboardDataset } from "../src/lib/read-api";

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
  });

  it("falls back to demo rows when the temporary API is unavailable", async () => {
    const dataset = await getDashboardDataset(
      "https://calandra-api.piogreeff.workers.dev",
      vi.fn(async () => new Response(null, { status: 503 })),
    );

    expect(dataset.source).toBe("fallback");
    expect(dataset.items.length).toBeGreaterThan(0);
    expect(dataset.prices.length).toBeGreaterThan(0);
  });
});
