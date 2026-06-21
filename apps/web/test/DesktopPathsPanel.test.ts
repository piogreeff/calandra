import { describe, expect, it } from "vitest";
import {
  createClipboardCaptureRequest,
  createClipboardHotkeyCaptureRequest,
  createLocalConfigBackupRequest,
  createOverlayModeRequest,
  defaultLocalBackupDirectory,
  formatClientLogEventLabel,
} from "../src/components/DesktopPathsPanel";

describe("DesktopPathsPanel helpers", () => {
  it("builds a user-initiated clipboard capture request", () => {
    expect(createClipboardCaptureRequest("2026-06-21T18:45:00.000Z")).toEqual({
      actionId: "clipboard-2026-06-21T18-45-00-000Z",
      capturedAt: "2026-06-21T18:45:00.000Z",
      userInitiated: true,
    });
  });

  it("builds a user-initiated clipboard hotkey capture request", () => {
    expect(
      createClipboardHotkeyCaptureRequest("2026-06-21T18:45:00.000Z"),
    ).toEqual({
      actionId: "clipboard-hotkey-2026-06-21T18-45-00-000Z",
      capturedAt: "2026-06-21T18:45:00.000Z",
      userInitiated: true,
    });
  });

  it("builds a user-initiated local backup request beside the PoE2 folder", () => {
    const request = createLocalConfigBackupRequest({
      gameDirectory: "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2",
      capturedAt: "2026-06-21T18:30:00.000Z",
      files: [
        {
          kind: "loot-filter",
          sourcePath:
            "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\NeverSink.filter",
        },
      ],
    });

    expect(request).toEqual({
      gameDirectory: "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2",
      backupDirectory: "C:\\Users\\Pio\\Documents\\My Games\\Calandra Backups",
      actionId: "local-backup-2026-06-21T18-30-00-000Z",
      capturedAt: "2026-06-21T18:30:00.000Z",
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

  it("builds a user-initiated overlay mode request", () => {
    expect(
      createOverlayModeRequest({
        capturedAt: "2026-06-21T18:55:00.000Z",
        overlayEnabled: true,
      }),
    ).toEqual({
      actionId: "overlay-2026-06-21T18-55-00-000Z",
      overlayEnabled: true,
      userInitiated: true,
    });
  });

  it("formats watched Client.txt events for the desktop panel", () => {
    expect(
      formatClientLogEventLabel({
        timestamp: "2026/06/21 13:52:10",
        uptimeMs: 12345678,
        channel: "INFO Client 1234",
        message: "You have entered Clearfell.",
        raw: "2026/06/21 13:52:10 12345678 abc [INFO Client 1234] : You have entered Clearfell.",
        event: {
          type: "area-entered",
          areaName: "Clearfell",
        },
      }),
    ).toBe("Entered Clearfell");

    expect(
      formatClientLogEventLabel({
        timestamp: "2026/06/21 13:52:11",
        uptimeMs: 12345679,
        channel: "INFO Client 1234",
        message: 'Generating level 68 area "The Riverbank" with seed 987654321',
        raw: '2026/06/21 13:52:11 12345679 abc [INFO Client 1234] : Generating level 68 area "The Riverbank" with seed 987654321',
        event: {
          type: "area-generated",
          areaName: "The Riverbank",
          areaLevel: 68,
          seed: "987654321",
        },
      }),
    ).toBe("Generated The Riverbank level 68");
  });

  it("normalizes trailing separators before deriving the backup directory", () => {
    expect(
      defaultLocalBackupDirectory(
        "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\",
      ),
    ).toBe("C:\\Users\\Pio\\Documents\\My Games\\Calandra Backups");
  });
});
