import { describe, expect, it, vi } from "vitest";
import {
  persistThemePreference,
  readThemePreference,
  resolveInitialTheme,
  type ThemePersistenceHost,
} from "../src/lib/theme-persistence";

describe("theme persistence", () => {
  it("prefers an initial desktop theme over the standalone cookie", () => {
    const host = createHost({
      cookie: "calandra-theme=light",
      initialDesktopTheme: "vscode",
    });

    expect(resolveInitialTheme(host)).toBe("vscode");
  });

  it("reads the Tauri-backed desktop store before falling back to cookies", async () => {
    const host = createHost({
      cookie: "calandra-theme=light",
      desktopTheme: "luxury",
    });

    await expect(readThemePreference(host)).resolves.toBe("luxury");
  });

  it("writes theme changes to the desktop store when it is available", async () => {
    const host = createHost({ desktopTheme: "calandra" });

    await expect(persistThemePreference("dark", host)).resolves.toBe("desktop");
    expect(host.desktopStore?.setThemePreference).toHaveBeenCalledWith("dark");
    expect(host.cookie).toBe("");
  });

  it("falls back to a standalone cookie outside the desktop shell", async () => {
    const host = createHost();

    await expect(persistThemePreference("corporate", host)).resolves.toBe(
      "cookie",
    );
    expect(host.cookie).toContain("calandra-theme=corporate");
    expect(host.cookie).toContain("samesite=lax");
  });

  it("rejects unknown persisted theme values", async () => {
    const host = createHost({ desktopTheme: "mirror-orb" });

    await expect(readThemePreference(host)).resolves.toBe("calandra");
  });

  it("falls back to the standalone cookie when the desktop store read fails", async () => {
    const host = createHost({
      cookie: "calandra-theme=dark",
      desktopError: new Error("store unavailable"),
    });

    await expect(readThemePreference(host)).resolves.toBe("dark");
  });

  it("falls back to a standalone cookie when the desktop store write fails", async () => {
    const host = createHost({
      desktopTheme: "calandra",
      desktopError: new Error("store unavailable"),
    });

    await expect(persistThemePreference("slack", host)).resolves.toBe("cookie");
    expect(host.cookie).toContain("calandra-theme=slack");
  });
});

function createHost({
  cookie = "",
  desktopTheme,
  desktopError,
  initialDesktopTheme,
}: {
  cookie?: string;
  desktopTheme?: string;
  desktopError?: Error;
  initialDesktopTheme?: string;
} = {}): ThemePersistenceHost {
  return {
    cookie,
    initialDesktopTheme,
    setCookie(nextCookie) {
      this.cookie = nextCookie;
    },
    desktopStore:
      desktopTheme === undefined && desktopError === undefined
        ? undefined
        : {
            getThemePreference: vi.fn(async () => {
              if (desktopError) throw desktopError;
              return desktopTheme;
            }),
            setThemePreference: vi.fn(async () => {
              if (desktopError) throw desktopError;
            }),
          },
  };
}
