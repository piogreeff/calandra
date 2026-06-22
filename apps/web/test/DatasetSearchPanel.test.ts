import { describe, expect, it } from "vitest";
import {
  datasetIconFallback,
  toDatasetInitialRows,
  toDatasetSearchRows,
} from "../src/components/DatasetSearchPanel";

describe("DatasetSearchPanel helpers", () => {
  it("creates a stable generated icon fallback for missing external images", () => {
    expect(datasetIconFallback("Unique")).toContain("data:image/svg+xml");
    expect(datasetIconFallback("Unique")).toContain("U");
  });

  it("preserves initial item image metadata for visual rows", () => {
    const rows = toDatasetInitialRows([
      {
        id: "calandra-demo-amulet",
        name: "Calandra Demo Amulet",
        category: "amulet",
        rarity: "unique",
        iconUrl: "https://calandra.pages.dev/demo-unique-placeholder.png",
        iconAttribution:
          "Placeholder demo icon URL; no game art is bundled or served by this artifact.",
      },
    ]);

    expect(rows).toEqual([
      {
        id: "initial-calandra-demo-amulet",
        name: "Calandra Demo Amulet",
        kind: "Unique",
        detail: "Amulet",
        iconUrl: "https://calandra.pages.dev/demo-unique-placeholder.png",
        iconAttribution:
          "Placeholder demo icon URL; no game art is bundled or served by this artifact.",
      },
    ]);
  });

  it("flattens grouped search results into labelled dashboard rows", () => {
    const rows = toDatasetSearchRows({
      source: "api",
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
    });

    expect(rows).toEqual([
      {
        id: "item-calandra-demo-wand",
        name: "Calandra Demo Wand",
        kind: "Base",
        detail: "Wand",
        iconUrl: undefined,
        iconAttribution: undefined,
      },
      {
        id: "unique-calandra-demo-amulet",
        name: "Calandra Demo Amulet",
        kind: "Unique",
        detail: "Amulet",
        iconUrl: "https://calandra.pages.dev/demo-unique-placeholder.png",
        iconAttribution:
          "Placeholder demo icon URL; no game art is bundled or served by this artifact.",
      },
      {
        id: "mod-demo-life-prefix",
        name: "+# to maximum Life",
        kind: "Modifier",
        detail: "item",
        iconUrl: undefined,
        iconAttribution: undefined,
      },
      {
        id: "gem-demo-spark",
        name: "Spark",
        kind: "Gem",
        detail: "skill",
        iconUrl: undefined,
        iconAttribution: undefined,
      },
    ]);
  });
});
