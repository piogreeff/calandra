import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  availableThemeNames,
  calandraThemeName,
  calandraThemeTokens,
  rarityTokens,
} from "../src/index";

describe("Calandra UI theme tokens", () => {
  it("exports calandra as the default custom theme name", () => {
    expect(calandraThemeName).toBe("calandra");
    expect(availableThemeNames[0]).toBe(calandraThemeName);
  });

  it("exports the dark gold Calandra palette and rarity colors", () => {
    expect(calandraThemeTokens["--color-base-100"]).toBe("#0d0b08");
    expect(calandraThemeTokens["--color-primary"]).toBe("#c9a227");
    expect(rarityTokens["--rarity-unique"]).toBe("#af6025");
    expect(rarityTokens["--rarity-currency"]).toBe("#aa9e82");
  });

  it("keeps the FlyonUI built-in themes available after calandra", () => {
    expect(availableThemeNames).toEqual(
      expect.arrayContaining([
        "calandra",
        "light",
        "dark",
        "corporate",
        "vscode",
        "spotify",
        "luxury",
        "slack",
      ]),
    );
  });

  it("keeps the exported TypeScript tokens aligned with the CSS token file", () => {
    const directory = dirname(fileURLToPath(import.meta.url));
    const css = readFileSync(join(directory, "../src/theme.css"), "utf8");

    for (const [token, value] of Object.entries({
      ...calandraThemeTokens,
      ...rarityTokens,
    })) {
      expect(css).toContain(`${token}: ${value}`);
    }
  });
});
