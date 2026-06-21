import { describe, expect, it } from "vitest";
import {
  BuildFileWriteRejectedError,
  ClipboardCaptureRejectedError,
  captureClipboardItemText,
  createInitialClientLogCursor,
  getDefaultPoe2Paths,
  planBuildFileWrite,
  readClientLogAppend,
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
});
