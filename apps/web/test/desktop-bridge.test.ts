import { describe, expect, it, vi } from "vitest";
import {
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

  it("detects both Tauri runtime global shapes", () => {
    expect(isTauriRuntime({})).toBe(false);
    expect(isTauriRuntime({ __TAURI__: {} })).toBe(true);
    expect(isTauriRuntime({ __TAURI_INTERNALS__: {} })).toBe(true);
  });
});
