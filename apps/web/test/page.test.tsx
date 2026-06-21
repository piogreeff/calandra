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
    expect(html).toContain("Dataset manifest");
    expect(html).toContain("9aaa78cdba51");
    expect(html).toContain("Source attribution");
    expect(html).toContain("poe2db.tw");
    expect(html).toContain(
      "Game data derived from Path of Exile 2 community references",
    );
    expect(html).toContain("Snapshot restore");
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
          uniques: 0,
          mods: 0,
          gems: 0,
          economy: 1,
          ladderBuilds: 0,
        },
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
            equipment: [{ slot: "Gloves", name: "Duskthread Grips" }],
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
