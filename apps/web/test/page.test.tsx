import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import Home from "../src/app/page";

vi.stubGlobal("React", React);

describe("home dashboard", () => {
  it("shows deterministic advisor rankings and temporary endpoints", async () => {
    vi.stubGlobal("fetch", mockDashboardFetch());

    const html = renderToStaticMarkup(await Home());

    expect(html).toContain("Deterministic upgrade rankings");
    expect(html).toContain("Duskthread Grips");
    expect(html).toContain("+43.4");
    expect(html).toContain("14.47 / chaos");
    expect(html).toContain("No LLM values");
    expect(html).toContain("calandra-api.piogreeff.workers.dev");
    expect(html).toContain("calandra.pages.dev");
    expect(html).toContain("Calandra Demo Wand");
    expect(html).toContain("Published R2 artifact");
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
        uniques: [],
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

    return new Response(null, { status: 404 });
  });
}
