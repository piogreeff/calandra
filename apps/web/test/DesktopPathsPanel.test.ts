import { describe, expect, it } from "vitest";
import {
  createAdvisorBuildExportRequest,
  createClipboardCaptureRequest,
  createClipboardHotkeyCaptureRequest,
  createClipboardPriceCheckRequest,
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

  it("builds a user-initiated clipboard price-check request", () => {
    expect(
      createClipboardPriceCheckRequest({
        capturedAt: "2026-06-21T18:45:00.000Z",
        apiBaseUrl: "https://calandra-api.piogreeff.workers.dev",
        league: "Dawn of the Hunt",
        patch: "0.2.0",
      }),
    ).toEqual({
      actionId: "clipboard-price-2026-06-21T18-45-00-000Z",
      capturedAt: "2026-06-21T18:45:00.000Z",
      userInitiated: true,
      apiBaseUrl: "https://calandra-api.piogreeff.workers.dev",
      league: "Dawn of the Hunt",
      patch: "0.2.0",
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

  it("builds a user-initiated advisor .build export request", () => {
    expect(
      createAdvisorBuildExportRequest({
        buildPlannerDirectory:
          "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\BuildPlanner",
        capturedAt: "2026-06-21T19:05:00.000Z",
        exportBuild: {
          name: "RealMonkBefore",
          className: "Monk",
          level: 43,
          league: "Dawn of the Hunt",
          patch: "0.2.0",
          passiveSkillIds: ["passive-before"],
          equipment: [{ slot: "Gloves", name: "Threadbare Gloves" }],
          upgrades: [
            {
              slot: "Gloves",
              currentName: "Threadbare Gloves",
              candidateName: "Early Gloves",
              scoreDelta: 22,
              estimatedCostChaos: 6,
            },
          ],
        },
      }),
    ).toEqual({
      buildPlannerDirectory:
        "C:\\Users\\Pio\\Documents\\My Games\\Path of Exile 2\\BuildPlanner",
      fileName: "RealMonkBefore",
      content:
        "# Calandra BuildPlanner export\nname=RealMonkBefore\nclass=Monk\nlevel=43\nleague=Dawn of the Hunt\npatch=0.2.0\nmainSkill=\n\n[passives]\npassive-before\n\n[equipment]\nGloves=Threadbare Gloves\n\n[upgrades]\nGloves=Early Gloves over Threadbare Gloves (+22, 6 chaos)\n",
      actionId: "advisor-export-2026-06-21T19-05-00-000Z",
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
