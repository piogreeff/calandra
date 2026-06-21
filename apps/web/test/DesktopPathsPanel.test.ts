import { describe, expect, it } from "vitest";
import {
  createClipboardCaptureRequest,
  createClipboardHotkeyCaptureRequest,
  createLocalConfigBackupRequest,
  defaultLocalBackupDirectory,
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

  it("normalizes trailing separators before deriving the backup directory", () => {
    expect(
      defaultLocalBackupDirectory(
        "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\",
      ),
    ).toBe("C:\\Users\\Pio\\Documents\\My Games\\Calandra Backups");
  });
});
