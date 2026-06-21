import { describe, expect, it } from "vitest";
import { itemCollectionSchema, itemSchema, openApiDocument } from "../src/index";

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
      iconAttribution: "Game art and item data are property of Grinding Gear Games."
    });

    expect(parsed.iconUrl).toContain("web.poecdn.com");
    expect(parsed.iconAttribution).toContain("Grinding Gear Games");
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
});
