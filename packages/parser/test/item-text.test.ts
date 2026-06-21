import { describe, expect, it } from "vitest";
import {
  ItemTextParseError,
  parseItemText,
  toContractItem,
} from "../src/index";

describe("item text parser", () => {
  it("parses a rare equipment clipboard item into structured fields", () => {
    const parsed = parseItemText(`
Item Class: Body Armours
Rarity: Rare
Dragon Shelter
Advanced Altar Robe
--------
Quality: +20% (augmented)
Energy Shield: 88 (augmented)
--------
Requirements:
Level: 52
Int: 97
--------
Item Level: 67
--------
+72 to maximum Life
+31% to Fire Resistance
+29% to Lightning Resistance
`);

    expect(parsed).toMatchObject({
      itemClass: "Body Armours",
      category: "body-armour",
      rarity: "rare",
      name: "Dragon Shelter",
      baseType: "Advanced Altar Robe",
      quality: 20,
      itemLevel: 67,
      corrupted: false,
      identified: true,
    });
    expect(parsed.properties).toEqual([
      { name: "Quality", value: "+20%", augmented: true },
      { name: "Energy Shield", value: "88", augmented: true },
    ]);
    expect(parsed.requirements).toEqual([
      { name: "Level", value: 52 },
      { name: "Int", value: 97 },
    ]);
    expect(parsed.explicitMods).toEqual([
      "+72 to maximum Life",
      "+31% to Fire Resistance",
      "+29% to Lightning Resistance",
    ]);
  });

  it("separates implicit and explicit mods on a unique item", () => {
    const parsed = parseItemText(`
Item Class: Amulets
Rarity: Unique
Choir of the Storm
Lapis Amulet
--------
Requirements:
Level: 36
--------
Item Level: 80
--------
+23 to Intelligence (implicit)
--------
Trigger Level 30 Lightning Bolt Skill on Critical Hit
+15% to Lightning Resistance
`);

    expect(parsed.rarity).toBe("unique");
    expect(parsed.name).toBe("Choir of the Storm");
    expect(parsed.baseType).toBe("Lapis Amulet");
    expect(parsed.category).toBe("amulet");
    expect(parsed.implicitMods).toEqual(["+23 to Intelligence"]);
    expect(parsed.explicitMods).toEqual([
      "Trigger Level 30 Lightning Bolt Skill on Critical Hit",
      "+15% to Lightning Resistance",
    ]);
  });

  it("keeps colon-containing lines after item level as explicit modifiers", () => {
    const parsed = parseItemText(`
Item Class: Wands
Rarity: Rare
Glyph Weaver
Expert Siphoning Wand
--------
Physical Damage: 12-22
--------
Item Level: 73
--------
Grants Skill: Level 12 Fireball
`);

    expect(parsed.properties).toEqual([
      { name: "Physical Damage", value: "12-22", augmented: false },
    ]);
    expect(parsed.explicitMods).toEqual(["Grants Skill: Level 12 Fireball"]);
  });

  it("converts parsed clipboard output into the shared item contract shape", () => {
    const parsed = parseItemText(`
Item Class: Stackable Currency
Rarity: Currency
Exalted Orb
--------
Stack Size: 1/20
`);

    expect(toContractItem(parsed)).toEqual({
      id: "currency/exalted-orb",
      name: "Exalted Orb",
      category: "currency",
      rarity: "currency",
    });
  });

  it("rejects clipboard text without item metadata", () => {
    expect(() => parseItemText("not an item")).toThrow(ItemTextParseError);
  });
});
