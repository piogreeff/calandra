import { describe, expect, it, vi } from "vitest";
import {
  createDesktopThemeStore,
  getDesktopPoe2Paths,
  isTauriRuntime,
} from "../src/lib/desktop-bridge";

describe("desktop bridge", () => {
  it("reports standalone web as unavailable without calling Tauri", async () => {
    const invoke = vi.fn();

    await expect(
      getDesktopPoe2Paths({
        globals: {},
        invoke,
      }),
    ).resolves.toEqual({
      source: "standalone",
      paths: null,
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("loads default PoE2 paths from the Tauri command", async () => {
    const invoke = vi.fn(async () => ({
      gameDirectory: "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2",
      clientLogPath:
        "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\Client.txt",
      buildPlannerDirectory:
        "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\BuildPlanner",
    }));

    await expect(
      getDesktopPoe2Paths({
        globals: { __TAURI_INTERNALS__: {} },
        invoke,
      }),
    ).resolves.toMatchObject({
      source: "tauri",
      paths: {
        clientLogPath:
          "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\Client.txt",
      },
    });
    expect(invoke).toHaveBeenCalledWith("get_default_poe2_paths");
  });

  it("exposes no theme store outside the Tauri runtime", () => {
    const invoke = vi.fn();

    expect(createDesktopThemeStore({ globals: {}, invoke })).toBeUndefined();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("loads and persists theme preferences through Tauri commands", async () => {
    const invoke = vi.fn(async (command: string) => {
      if (command === "get_theme_preference") {
        return "luxury";
      }

      return null;
    });
    const store = createDesktopThemeStore({
      globals: { __TAURI_INTERNALS__: {} },
      invoke,
    });

    await expect(store?.getThemePreference()).resolves.toBe("luxury");
    await expect(store?.setThemePreference("dark")).resolves.toBeUndefined();
    expect(invoke).toHaveBeenCalledWith("get_theme_preference");
    expect(invoke).toHaveBeenCalledWith("set_theme_preference", {
      theme: "dark",
    });
  });

  it("detects both Tauri runtime global shapes", () => {
    expect(isTauriRuntime({})).toBe(false);
    expect(isTauriRuntime({ __TAURI__: {} })).toBe(true);
    expect(isTauriRuntime({ __TAURI_INTERNALS__: {} })).toBe(true);
  });
});
