import { describe, expect, it } from "vitest";
import {
  datasetVisualSummarySchema,
  itemCollectionSchema,
  itemSchema,
  openApiDocument,
  uniqueItemSchema,
} from "../src/index";

describe("item contract", () => {
  it("requires game data to be keyed by league and patch", () => {
    const parsed = itemCollectionSchema.parse({
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      items: []
    });

    expect(parsed).toEqual({
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      items: []
    });
  });

  it("rejects unversioned item collections", () => {
    expect(() => itemCollectionSchema.parse({ items: [] })).toThrow();
  });

  it("captures item image attribution without shipping bundled assets", () => {
    const parsed = itemSchema.parse({
      id: "advanced-altar-robe",
      name: "Advanced Altar Robe",
      category: "body-armour",
      rarity: "normal",
      iconUrl: "https://web.poecdn.com/image/example.png",
      iconSourceUrl: "https://web.poecdn.com/image/example.png",
      iconCacheKey: "images/Dawn of the Hunt/0.2.0/items/advanced-altar-robe.png",
      iconAttribution: "Game art and item data are property of Grinding Gear Games."
    });

    expect(parsed.iconUrl).toContain("web.poecdn.com");
    expect(parsed.iconSourceUrl).toContain("web.poecdn.com");
    expect(parsed.iconCacheKey).toContain("advanced-altar-robe");
    expect(parsed.iconAttribution).toContain("Grinding Gear Games");
  });

  it("models unique item icons as cached artifact references", () => {
    const parsed = uniqueItemSchema.parse({
      id: "choir-of-the-storm",
      name: "Choir of the Storm",
      category: "amulet",
      rarity: "unique",
      iconUrl: "https://calandra-assets.example/images/Dawn%20of%20the%20Hunt/0.2.0/uniques/choir-of-the-storm.png",
      iconSourceUrl: "https://web.poecdn.com/image/choir-of-the-storm.png",
      iconCacheKey: "images/Dawn of the Hunt/0.2.0/uniques/choir-of-the-storm.png",
      iconAttribution: "Game art and item data are property of Grinding Gear Games."
    });

    expect(parsed.iconCacheKey).toBe(
      "images/Dawn of the Hunt/0.2.0/uniques/choir-of-the-storm.png"
    );
  });

  it("exports the items endpoint in the OpenAPI document", () => {
    expect(openApiDocument.openapi).toBe("3.0.3");
    expect(openApiDocument.paths["/items"]?.get?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "league", required: true }),
        expect.objectContaining({ name: "patch", required: true })
      ])
    );
    expect(openApiDocument.components?.schemas?.Item).toBeDefined();
  });

  it("models a patch-versioned visual dataset summary for dashboard galleries", () => {
    const parsed = datasetVisualSummarySchema.parse({
      source: "published-dataset",
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      totalItems: 8,
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
          ],
        },
      ],
    });

    expect(parsed.categories[0]?.featured[0]?.name).toBe(
      "Choir of the Storm",
    );
    expect(openApiDocument.paths["/datasets/visual-summary"]).toBeDefined();
    expect(
      openApiDocument.components?.schemas?.DatasetVisualSummary,
    ).toBeDefined();
  });
});
