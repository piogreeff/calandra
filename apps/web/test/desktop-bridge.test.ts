import { describe, expect, it, vi } from "vitest";
import {
  createDesktopThemeStore,
  getDesktopPoe2Paths,
  isTauriRuntime,
  readDesktopClientLogAppend,
  runDesktopLocalConfigBackup,
  writeDesktopBuildFile,
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

  it("writes .build files through the Tauri desktop command", async () => {
    const invoke = vi.fn(async () => ({
      actionId: "advisor-export-001",
      outputPath:
        "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\BuildPlanner\\Storm Monk.build",
      content: "[build]\nname=Storm Monk\n",
    }));

    await expect(
      writeDesktopBuildFile(
        {
          buildPlannerDirectory:
            "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\BuildPlanner",
          fileName: "Storm Monk",
          content: "[build]\nname=Storm Monk\n",
          actionId: "advisor-export-001",
          userInitiated: true,
        },
        {
          globals: { __TAURI_INTERNALS__: {} },
          invoke,
        },
      ),
    ).resolves.toMatchObject({
      outputPath:
        "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\BuildPlanner\\Storm Monk.build",
    });
    expect(invoke).toHaveBeenCalledWith("write_build_file", {
      buildPlannerDirectory:
        "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\BuildPlanner",
      fileName: "Storm Monk",
      content: "[build]\nname=Storm Monk\n",
      actionId: "advisor-export-001",
      userInitiated: true,
    });
  });

  it("rejects .build writes outside the desktop shell", async () => {
    await expect(
      writeDesktopBuildFile(
        {
          buildPlannerDirectory:
            "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\BuildPlanner",
          fileName: "Storm Monk",
          content: "[build]\n",
          actionId: "advisor-export-001",
          userInitiated: true,
        },
        {
          globals: {},
          invoke: vi.fn(),
        },
      ),
    ).rejects.toThrow(".build export requires the Calandra desktop shell");
  });

  it("reads appended Client.txt content through the Tauri desktop command", async () => {
    const invoke = vi.fn(async () => ({
      cursorOffset: 91,
      content:
        "2026/06/21 13:52:11 12345679 abc [INFO Client 1234] : You have entered The Riverbank.\n",
    }));

    await expect(
      readDesktopClientLogAppend(
        {
          clientLogPath:
            "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\Client.txt",
          offset: 0,
        },
        {
          globals: { __TAURI_INTERNALS__: {} },
          invoke,
        },
      ),
    ).resolves.toMatchObject({
      cursorOffset: 91,
      content:
        "2026/06/21 13:52:11 12345679 abc [INFO Client 1234] : You have entered The Riverbank.\n",
    });
    expect(invoke).toHaveBeenCalledWith("read_client_log_append", {
      clientLogPath:
        "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\Client.txt",
      offset: 0,
    });
  });

  it("runs a local config backup through the Tauri desktop command", async () => {
    const invoke = vi.fn(async () => ({
      actionId: "backup-001",
      capturedAt: "2026-06-21T15:00:00.000Z",
      backupRoot:
        "D:\\Calandra Backups\\Path of Exile 2\\2026-06-21T15-00-00-000Z",
      entries: [
        {
          kind: "loot-filter",
          sourcePath:
            "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\NeverSink.filter",
          destinationPath:
            "D:\\Calandra Backups\\Path of Exile 2\\2026-06-21T15-00-00-000Z\\NeverSink.filter",
        },
      ],
    }));

    await expect(
      runDesktopLocalConfigBackup(
        {
          gameDirectory:
            "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2",
          backupDirectory: "D:\\Calandra Backups",
          actionId: "backup-001",
          capturedAt: "2026-06-21T15:00:00.000Z",
          userInitiated: true,
          files: [
            {
              kind: "loot-filter",
              sourcePath:
                "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\NeverSink.filter",
            },
          ],
        },
        {
          globals: { __TAURI_INTERNALS__: {} },
          invoke,
        },
      ),
    ).resolves.toMatchObject({
      actionId: "backup-001",
      entries: [{ kind: "loot-filter" }],
    });
    expect(invoke).toHaveBeenCalledWith("copy_local_config_backup", {
      gameDirectory: "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2",
      backupDirectory: "D:\\Calandra Backups",
      actionId: "backup-001",
      capturedAt: "2026-06-21T15:00:00.000Z",
      userInitiated: true,
      files: [
        {
          kind: "loot-filter",
          sourcePath:
            "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\NeverSink.filter",
        },
      ],
    });
  });

  it("detects both Tauri runtime global shapes", () => {
    expect(isTauriRuntime({})).toBe(false);
    expect(isTauriRuntime({ __TAURI__: {} })).toBe(true);
    expect(isTauriRuntime({ __TAURI_INTERNALS__: {} })).toBe(true);
  });
});
