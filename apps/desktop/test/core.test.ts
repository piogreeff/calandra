import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { win32 } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  BuildFileWriteRejectedError,
  ClipboardCaptureRejectedError,
  LocalBackupRejectedError,
  captureClipboardItemText,
  copyLocalConfigBackup,
  createInitialClientLogCursor,
  getDefaultPoe2Paths,
  planLocalConfigBackup,
  planBuildFileWrite,
  priceClipboardItemText,
  readClientLogAppend,
  writeBuildFile,
} from "../src/index";

describe("desktop core helpers", () => {
  it("resolves default PoE2 paths under the user's Documents folder", () => {
    expect(getDefaultPoe2Paths("C:\\Users\\Pio")).toEqual({
      gameDirectory: "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2",
      clientLogPath:
        "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\Client.txt",
      buildPlannerDirectory:
        "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\BuildPlanner",
    });
  });

  it("normalizes trailing separators when resolving default paths", () => {
    expect(getDefaultPoe2Paths("C:\\Users\\Pio\\")).toMatchObject({
      gameDirectory: "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2",
    });
  });

  it("creates an initial Client.txt cursor without parsing existing history", () => {
    const clientLogContent =
      "2026/06/21 13:52:10 12345678 abc [INFO Client 1234] : You have entered Clearfell.\n";
    const cursor = createInitialClientLogCursor(clientLogContent);

    expect(cursor).toEqual({ offset: clientLogContent.length });
  });

  it("parses only newly appended Client.txt lines", () => {
    const before =
      "2026/06/21 13:52:10 12345678 abc [INFO Client 1234] : You have entered Clearfell.\n";
    const after = `${before}2026/06/21 13:52:11 12345679 abc [INFO Client 1234] : You have entered The Riverbank.\n`;
    const result = readClientLogAppend(after, { offset: before.length });

    expect(result.cursor).toEqual({ offset: after.length });
    expect(result.lines.map((line) => line.event)).toEqual([
      { type: "area-entered", areaName: "The Riverbank" },
    ]);
  });

  it("resets the cursor when Client.txt is truncated or rotated", () => {
    const rotatedContent =
      "2026/06/21 13:52:11 12345679 abc [INFO Client 1234] : You have entered The Riverbank.\n";
    const result = readClientLogAppend(rotatedContent, { offset: 200 });

    expect(result.cursor.offset).toBe(rotatedContent.length);
    expect(result.lines.map((line) => line.event)).toEqual([
      { type: "area-entered", areaName: "The Riverbank" },
    ]);
  });

  it("keeps an incomplete trailing line buffered until it is complete", () => {
    const partial =
      "2026/06/21 13:52:11 12345679 abc [INFO Client 1234] : You have entered The River";
    const first = readClientLogAppend(partial, { offset: 0 });
    const second = readClientLogAppend(`${partial}bank.\n`, first.cursor);

    expect(first).toEqual({ cursor: { offset: 0 }, lines: [] });
    expect(second.lines.map((line) => line.event)).toEqual([
      { type: "area-entered", areaName: "The Riverbank" },
    ]);
    expect(second.cursor.offset).toBe(`${partial}bank.\n`.length);
  });

  it("parses clipboard item text only for a user-initiated capture", () => {
    const captured = captureClipboardItemText(
      `
Item Class: Body Armours
Rarity: Rare
Dragon Shelter
Advanced Altar Robe
--------
Item Level: 67
--------
+72 to maximum Life
`,
      {
        actionId: "hotkey-001",
        capturedAt: "2026-06-21T13:58:00.000Z",
        userInitiated: true,
      },
    );

    expect(captured.actionId).toBe("hotkey-001");
    expect(captured.capturedAt).toBe("2026-06-21T13:58:00.000Z");
    expect(captured.item).toMatchObject({
      name: "Dragon Shelter",
      baseType: "Advanced Altar Robe",
      rarity: "rare",
      itemLevel: 67,
    });
    expect(captured.contractItem).toEqual({
      id: "body-armour/dragon-shelter",
      name: "Dragon Shelter",
      category: "body-armour",
      rarity: "rare",
    });
  });

  it("rejects background clipboard reads", () => {
    expect(() =>
      captureClipboardItemText("Item Class: Body Armours", {
        actionId: "background-poll",
        capturedAt: "2026-06-21T13:58:00.000Z",
        userInitiated: false,
      }),
    ).toThrow(ClipboardCaptureRejectedError);
  });

  it("rejects clipboard captures without an action id", () => {
    expect(() =>
      captureClipboardItemText("Item Class: Body Armours", {
        actionId: " ",
        capturedAt: "2026-06-21T13:58:00.000Z",
        userInitiated: true,
      }),
    ).toThrow(ClipboardCaptureRejectedError);
  });

  it("price-checks clipboard item text with one user-initiated server action", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse({
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
          chaosEquivalent: 42,
          updatedAt: "2026-06-21T00:00:00.000Z",
        },
        matchedBy: "id",
      }),
    );

    const result = await priceClipboardItemText(
      `
Item Class: Body Armours
Rarity: Rare
Dragon Shelter
Advanced Altar Robe
--------
Item Level: 67
--------
+72 to maximum Life
`,
      {
        apiBaseUrl: "https://calandra-api.workers.dev/",
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        actionId: "hotkey-price-001",
        capturedAt: "2026-06-21T13:58:00.000Z",
        userInitiated: true,
        fetch,
      },
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "https://calandra-api.workers.dev/price/check",
      {
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
      },
    );
    expect(result.actionId).toBe("hotkey-price-001");
    expect(result.capture.contractItem.name).toBe("Dragon Shelter");
    expect(result.priceCheck.price?.chaosEquivalent).toBe(42);
  });

  it("does not price-check clipboard text from a background read", async () => {
    const fetch = vi.fn();

    await expect(
      priceClipboardItemText("Item Class: Body Armours", {
        apiBaseUrl: "https://calandra-api.workers.dev",
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        actionId: "background-price",
        capturedAt: "2026-06-21T13:58:00.000Z",
        userInitiated: false,
        fetch,
      }),
    ).rejects.toThrow(ClipboardCaptureRejectedError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("plans a user-initiated .build write inside BuildPlanner", () => {
    const plan = planBuildFileWrite({
      buildPlannerDirectory:
        "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\BuildPlanner",
      fileName: "Storm Monk",
      content: "[build]\nname=Storm Monk\n",
      actionId: "advisor-export-001",
      userInitiated: true,
    });

    expect(plan).toEqual({
      actionId: "advisor-export-001",
      outputPath:
        "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\BuildPlanner\\Storm Monk.build",
      content: "[build]\nname=Storm Monk\n",
    });
  });

  it("preserves an existing .build suffix", () => {
    const plan = planBuildFileWrite({
      buildPlannerDirectory:
        "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\BuildPlanner",
      fileName: "Storm Monk.build",
      content: "[build]\n",
      actionId: "advisor-export-002",
      userInitiated: true,
    });

    expect(plan.outputPath.endsWith("\\Storm Monk.build")).toBe(true);
  });

  it("rejects .build writes outside BuildPlanner", () => {
    expect(() =>
      planBuildFileWrite({
        buildPlannerDirectory:
          "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\BuildPlanner",
        fileName: "..\\Client.txt",
        content: "[build]\n",
        actionId: "advisor-export-003",
        userInitiated: true,
      }),
    ).toThrow(BuildFileWriteRejectedError);
  });

  it("rejects background .build writes", () => {
    expect(() =>
      planBuildFileWrite({
        buildPlannerDirectory:
          "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\BuildPlanner",
        fileName: "Storm Monk",
        content: "[build]\n",
        actionId: "background-export",
        userInitiated: false,
      }),
    ).toThrow(BuildFileWriteRejectedError);
  });

  it("rejects empty .build file names", () => {
    expect(() =>
      planBuildFileWrite({
        buildPlannerDirectory:
          "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\BuildPlanner",
        fileName: " ",
        content: "[build]\n",
        actionId: "advisor-export-004",
        userInitiated: true,
      }),
    ).toThrow(BuildFileWriteRejectedError);
  });

  it("writes a user-initiated .build file inside BuildPlanner", async () => {
    const root = await createTempWindowsTree();
    const buildPlannerDirectory = win32.join(root, "BuildPlanner");

    try {
      const plan = await writeBuildFile({
        buildPlannerDirectory,
        fileName: "Storm Monk",
        content: "[build]\nname=Storm Monk\n",
        actionId: "advisor-export-005",
        userInitiated: true,
      });

      expect(plan.outputPath).toBe(
        win32.join(buildPlannerDirectory, "Storm Monk.build"),
      );
      await expect(readFile(plan.outputPath, "utf8")).resolves.toBe(
        "[build]\nname=Storm Monk\n",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("plans a user-initiated local config backup inside the selected backup root", () => {
    const plan = planLocalConfigBackup({
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
        {
          kind: "build-file",
          sourcePath:
            "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\BuildPlanner\\Storm Monk.build",
        },
        {
          kind: "overlay-config",
          sourcePath:
            "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\Calandra\\overlay.json",
        },
      ],
    });

    expect(plan).toEqual({
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
        {
          kind: "build-file",
          sourcePath:
            "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\BuildPlanner\\Storm Monk.build",
          destinationPath:
            "D:\\Calandra Backups\\Path of Exile 2\\2026-06-21T15-00-00-000Z\\BuildPlanner\\Storm Monk.build",
        },
        {
          kind: "overlay-config",
          sourcePath:
            "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\Calandra\\overlay.json",
          destinationPath:
            "D:\\Calandra Backups\\Path of Exile 2\\2026-06-21T15-00-00-000Z\\Calandra\\overlay.json",
        },
      ],
    });
  });

  it("rejects background local config backups", () => {
    expect(() =>
      planLocalConfigBackup({
        gameDirectory: "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2",
        backupDirectory: "D:\\Calandra Backups",
        actionId: "background-backup",
        capturedAt: "2026-06-21T15:00:00.000Z",
        userInitiated: false,
        files: [
          {
            kind: "loot-filter",
            sourcePath:
              "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\NeverSink.filter",
          },
        ],
      }),
    ).toThrow(LocalBackupRejectedError);
  });

  it("rejects local backup sources outside the PoE2 directory", () => {
    expect(() =>
      planLocalConfigBackup({
        gameDirectory: "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2",
        backupDirectory: "D:\\Calandra Backups",
        actionId: "backup-002",
        capturedAt: "2026-06-21T15:00:00.000Z",
        userInitiated: true,
        files: [
          {
            kind: "overlay-config",
            sourcePath: "C:\\Users\\Pio\\Documents\\secret.txt",
          },
        ],
      }),
    ).toThrow(LocalBackupRejectedError);
  });

  it("copies local config backups into a timestamped backup tree", async () => {
    const root = await createTempWindowsTree();
    const gameDirectory = win32.join(root, "Path of Exile 2");
    const backupDirectory = win32.join(root, "Calandra Backups");
    const filterPath = win32.join(gameDirectory, "NeverSink.filter");
    const buildPath = win32.join(
      gameDirectory,
      "BuildPlanner",
      "Storm Monk.build",
    );
    const overlayPath = win32.join(gameDirectory, "Calandra", "overlay.json");

    try {
      await mkdir(win32.dirname(filterPath), { recursive: true });
      await mkdir(win32.dirname(buildPath), { recursive: true });
      await mkdir(win32.dirname(overlayPath), { recursive: true });
      await writeFile(filterPath, "filter", "utf8");
      await writeFile(buildPath, "[build]\n", "utf8");
      await writeFile(overlayPath, '{"opacity":0.8}\n', "utf8");

      const plan = await copyLocalConfigBackup({
        gameDirectory,
        backupDirectory,
        actionId: "backup-003",
        capturedAt: "2026-06-21T15:00:00.000Z",
        userInitiated: true,
        files: [
          { kind: "loot-filter", sourcePath: filterPath },
          { kind: "build-file", sourcePath: buildPath },
          { kind: "overlay-config", sourcePath: overlayPath },
        ],
      });

      expect(plan.backupRoot).toBe(
        win32.join(
          backupDirectory,
          "Path of Exile 2",
          "2026-06-21T15-00-00-000Z",
        ),
      );
      await expect(
        readFile(win32.join(plan.backupRoot, "NeverSink.filter"), "utf8"),
      ).resolves.toBe("filter");
      await expect(
        readFile(
          win32.join(plan.backupRoot, "BuildPlanner", "Storm Monk.build"),
          "utf8",
        ),
      ).resolves.toBe("[build]\n");
      await expect(
        readFile(
          win32.join(plan.backupRoot, "Calandra", "overlay.json"),
          "utf8",
        ),
      ).resolves.toBe('{"opacity":0.8}\n');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

async function createTempWindowsTree() {
  return mkdtemp(win32.join(tmpdir(), "calandra-desktop-"));
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
