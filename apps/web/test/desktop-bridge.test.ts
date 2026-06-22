import { describe, expect, it, vi } from "vitest";
import {
  captureDesktopClipboardItem,
  createDesktopThemeStore,
  discoverDesktopLocalConfigBackupFiles,
  getDesktopPoe2Paths,
  isTauriRuntime,
  priceDesktopClipboardItem,
  readDesktopClientLogAppend,
  readDesktopClientLogEvents,
  runDesktopLocalConfigBackup,
  setDesktopOverlayMode,
  subscribeDesktopClipboardHotkey,
  type DesktopClipboardHotkeyEvent,
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

  it("reads and parses appended Client.txt events through the desktop bridge", async () => {
    const invoke = vi.fn(async () => ({
      cursorOffset: 178,
      content:
        "2026/06/21 13:52:11 12345679 abc [INFO Client 1234] : You have entered The Riverbank.\n",
    }));

    await expect(
      readDesktopClientLogEvents(
        {
          clientLogPath:
            "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\Client.txt",
          offset: 91,
        },
        {
          globals: { __TAURI_INTERNALS__: {} },
          invoke,
        },
      ),
    ).resolves.toMatchObject({
      cursorOffset: 178,
      lines: [
        {
          timestamp: "2026/06/21 13:52:11",
          event: {
            type: "area-entered",
            areaName: "The Riverbank",
          },
        },
      ],
    });
    expect(invoke).toHaveBeenCalledWith("read_client_log_append", {
      clientLogPath:
        "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\Client.txt",
      offset: 91,
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

  it("discovers local config backup files through the Tauri desktop command", async () => {
    const invoke = vi.fn(async () => [
      {
        kind: "loot-filter",
        sourcePath:
          "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\NeverSink.filter",
      },
      {
        kind: "build-file",
        sourcePath:
          "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\BuildPlanner\\Storm Monk.build",
      },
    ]);

    await expect(
      discoverDesktopLocalConfigBackupFiles(
        {
          gameDirectory: "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2",
        },
        {
          globals: { __TAURI_INTERNALS__: {} },
          invoke,
        },
      ),
    ).resolves.toEqual([
      {
        kind: "loot-filter",
        sourcePath:
          "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\NeverSink.filter",
      },
      {
        kind: "build-file",
        sourcePath:
          "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\BuildPlanner\\Storm Monk.build",
      },
    ]);
    expect(invoke).toHaveBeenCalledWith("discover_local_config_backup_files", {
      gameDirectory: "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2",
    });
  });

  it("captures and parses a user-initiated clipboard item through Tauri", async () => {
    const invoke = vi.fn(async () => ({
      actionId: "clipboard-001",
      capturedAt: "2026-06-21T18:45:00.000Z",
      text: `
Item Class: Body Armours
Rarity: Rare
Dragon Shelter
Advanced Altar Robe
--------
Item Level: 67
--------
+72 to maximum Life
`,
    }));

    await expect(
      captureDesktopClipboardItem(
        {
          actionId: "clipboard-001",
          capturedAt: "2026-06-21T18:45:00.000Z",
          userInitiated: true,
        },
        {
          globals: { __TAURI_INTERNALS__: {} },
          invoke,
        },
      ),
    ).resolves.toMatchObject({
      actionId: "clipboard-001",
      item: {
        name: "Dragon Shelter",
        baseType: "Advanced Altar Robe",
        itemLevel: 67,
      },
      contractItem: {
        id: "body-armour/dragon-shelter",
        name: "Dragon Shelter",
      },
    });
    expect(invoke).toHaveBeenCalledWith("capture_clipboard_text", {
      actionId: "clipboard-001",
      capturedAt: "2026-06-21T18:45:00.000Z",
      userInitiated: true,
    });
  });

  it("prices a user-initiated clipboard item through the typed API", async () => {
    const invoke = vi.fn(async () => ({
      actionId: "clipboard-price-001",
      capturedAt: "2026-06-21T18:45:00.000Z",
      text: `
Item Class: Body Armours
Rarity: Rare
Dragon Shelter
Advanced Altar Robe
--------
Item Level: 67
--------
+72 to maximum Life
`,
    }));
    const fetchImplementation = vi.fn(async () =>
      Response.json({
        source: "published-dataset",
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        item: {
          id: "body-armour/dragon-shelter",
          name: "Dragon Shelter",
          category: "body-armour",
          rarity: "rare",
        },
        price: {
          id: "body-armour/dragon-shelter",
          name: "Dragon Shelter",
          chaosEquivalent: 18,
          updatedAt: "2026-06-21T18:30:00.000Z",
        },
        matchedBy: "id",
      }),
    );

    await expect(
      priceDesktopClipboardItem(
        {
          actionId: "clipboard-price-001",
          capturedAt: "2026-06-21T18:45:00.000Z",
          userInitiated: true,
          apiBaseUrl: "https://calandra-api.piogreeff.workers.dev/",
          league: "Dawn of the Hunt",
          patch: "0.2.0",
        },
        {
          globals: { __TAURI_INTERNALS__: {} },
          invoke,
          fetchImplementation,
        },
      ),
    ).resolves.toMatchObject({
      capture: {
        contractItem: {
          id: "body-armour/dragon-shelter",
          name: "Dragon Shelter",
        },
      },
      priceCheck: {
        price: {
          chaosEquivalent: 18,
        },
      },
    });

    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://calandra-api.piogreeff.workers.dev/price/check",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          league: "Dawn of the Hunt",
          patch: "0.2.0",
          item: {
            id: "body-armour/dragon-shelter",
            name: "Dragon Shelter",
            category: "body-armour",
            rarity: "rare",
          },
        }),
      }),
    );
  });

  it("subscribes to pressed desktop clipboard hotkey events", async () => {
    const register = vi.fn(
      async (
        _shortcut: string,
        _handler: (event: DesktopClipboardHotkeyEvent) => void,
      ) => undefined,
    );
    const unregister = vi.fn(async (_shortcut: string) => undefined);
    const onPressed = vi.fn();

    const cleanup = await subscribeDesktopClipboardHotkey(onPressed, {
      globals: { __TAURI_INTERNALS__: {} },
      shortcut: "CommandOrControl+Shift+C",
      register,
      unregister,
    });

    expect(cleanup).toEqual(expect.any(Function));

    expect(register).toHaveBeenCalledWith(
      "CommandOrControl+Shift+C",
      expect.any(Function),
    );

    const handler = register.mock.calls[0]?.[1];
    handler?.({
      shortcut: "CommandOrControl+Shift+C",
      state: "Pressed",
    });
    handler?.({
      shortcut: "CommandOrControl+Shift+C",
      state: "Released",
    });

    expect(onPressed).toHaveBeenCalledTimes(1);
    await cleanup?.();
    expect(unregister).toHaveBeenCalledWith("CommandOrControl+Shift+C");
  });

  it("sets overlay mode through the Tauri desktop command", async () => {
    const invoke = vi.fn(async () => ({
      actionId: "overlay-001",
      overlayEnabled: true,
      alwaysOnTop: true,
      decorations: false,
      shadow: false,
    }));

    await expect(
      setDesktopOverlayMode(
        {
          actionId: "overlay-001",
          overlayEnabled: true,
          userInitiated: true,
        },
        {
          globals: { __TAURI_INTERNALS__: {} },
          invoke,
        },
      ),
    ).resolves.toEqual({
      actionId: "overlay-001",
      overlayEnabled: true,
      alwaysOnTop: true,
      decorations: false,
      shadow: false,
    });

    expect(invoke).toHaveBeenCalledWith("set_overlay_mode", {
      actionId: "overlay-001",
      overlayEnabled: true,
      userInitiated: true,
    });
  });

  it("rejects overlay mode changes outside the desktop shell", async () => {
    await expect(
      setDesktopOverlayMode(
        {
          actionId: "overlay-001",
          overlayEnabled: true,
          userInitiated: true,
        },
        {
          globals: {},
          invoke: vi.fn(),
        },
      ),
    ).rejects.toThrow("Overlay mode requires the Calandra desktop shell");
  });

  it("skips desktop clipboard hotkey registration outside Tauri", async () => {
    const register = vi.fn(async () => undefined);
    const unregister = vi.fn(async () => undefined);

    await expect(
      subscribeDesktopClipboardHotkey(vi.fn(), {
        globals: {},
        register,
        unregister,
      }),
    ).resolves.toBeUndefined();

    expect(register).not.toHaveBeenCalled();
  });

  it("detects both Tauri runtime global shapes", () => {
    expect(isTauriRuntime({})).toBe(false);
    expect(isTauriRuntime({ __TAURI__: {} })).toBe(true);
    expect(isTauriRuntime({ __TAURI_INTERNALS__: {} })).toBe(true);
  });
});
