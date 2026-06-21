import { describe, expect, it } from "vitest";
import { availableThemes, defaultTheme, isThemeName, themeCookieName } from "../src/lib/theme";

describe("web theme registry", () => {
  it("uses calandra as the default theme", () => {
    expect(defaultTheme).toBe("calandra");
    expect(themeCookieName).toBe("calandra-theme");
  });

  it("registers calandra plus FlyonUI built-in themes", () => {
    expect(availableThemes).toEqual(
      expect.arrayContaining([
        "calandra",
        "light",
        "dark",
        "corporate",
        "vscode",
        "spotify",
        "luxury",
        "slack"
      ])
    );
  });

  it("rejects unknown themes", () => {
    expect(isThemeName("calandra")).toBe(true);
    expect(isThemeName("mirror-orb")).toBe(false);
  });
});
