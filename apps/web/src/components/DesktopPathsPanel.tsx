"use client";

import {
  Archive,
  CheckCircle2,
  Clipboard,
  FolderOpen,
  Loader2,
  MonitorUp,
  ScrollText,
  WalletCards,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  captureDesktopClipboardItem,
  discoverDesktopLocalConfigBackupFiles,
  getDesktopPoe2Paths,
  priceDesktopClipboardItem,
  readDesktopClientLogEvents,
  runDesktopLocalConfigBackup,
  setDesktopOverlayMode,
  subscribeDesktopClipboardHotkey,
  writeDesktopBuildFile,
  type DesktopBuildFileWritePlan,
  type DesktopBuildFileWriteRequest,
  type DesktopClipboardItemCapture,
  type DesktopClipboardItemCaptureRequest,
  type DesktopClipboardPriceCheckRequest,
  type DesktopClipboardPriceCheckResult,
  type DesktopLocalBackupFileRequest,
  type DesktopLocalConfigBackupPlan,
  type DesktopLocalConfigBackupRequest,
  type DesktopOverlayModePlan,
  type DesktopOverlayModeRequest,
  type DesktopPoe2PathState,
} from "../lib/desktop-bridge";
import { dashboardDatasetVersion, defaultApiBaseUrl } from "../lib/read-api";
import type { ParsedClientLogLine } from "@calandra/parser";

export type AdvisorBuildExport = {
  name: string;
  className: string;
  level: number;
  league: string;
  patch: string;
  mainSkill?: string;
  passiveSkillIds: string[];
  equipment: Array<{ slot: string; name: string }>;
  upgrades: Array<{
    slot: string;
    currentName: string;
    candidateName: string;
    scoreDelta: number;
    estimatedCostChaos?: number | undefined;
  }>;
};

type DesktopPathsPanelState =
  | { status: "loading" }
  | { status: "ready"; bridge: DesktopPoe2PathState }
  | { status: "error" };

type LocalBackupState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; plan: DesktopLocalConfigBackupPlan }
  | { status: "empty" }
  | { status: "error"; message: string };

type AdvisorBuildExportState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; plan: DesktopBuildFileWritePlan }
  | { status: "error"; message: string };

type ClipboardCaptureState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; capture: DesktopClipboardItemCapture }
  | { status: "error"; message: string };

type ClipboardPriceCheckState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; result: DesktopClipboardPriceCheckResult }
  | { status: "error"; message: string };

type OverlayModeState =
  | { status: "idle"; overlayEnabled: boolean }
  | { status: "running"; overlayEnabled: boolean }
  | { status: "success"; plan: DesktopOverlayModePlan }
  | { status: "error"; overlayEnabled: boolean; message: string };

type ClientLogWatchState =
  | { status: "idle" }
  | {
      status: "watching";
      cursorOffset: number;
      events: ParsedClientLogLine[];
    }
  | { status: "error"; message: string };

export function DesktopPathsPanel({
  advisorBuildExport = fallbackAdvisorBuildExport,
  loadPaths = getDesktopPoe2Paths,
  captureClipboardItem = captureDesktopClipboardItem,
  priceClipboardItem = priceDesktopClipboardItem,
  readClientLogEvents = readDesktopClientLogEvents,
  setOverlayMode = setDesktopOverlayMode,
  subscribeClipboardHotkey = subscribeDesktopClipboardHotkey,
  discoverBackupFiles = discoverDesktopLocalConfigBackupFiles,
  runBackup = runDesktopLocalConfigBackup,
  writeBuildFile = writeDesktopBuildFile,
  clientLogPollIntervalMs = defaultClientLogPollIntervalMs,
  now = defaultNow,
}: {
  advisorBuildExport?: AdvisorBuildExport;
  loadPaths?: () => Promise<DesktopPoe2PathState>;
  captureClipboardItem?: (
    request: DesktopClipboardItemCaptureRequest,
  ) => Promise<DesktopClipboardItemCapture>;
  priceClipboardItem?: (
    request: DesktopClipboardPriceCheckRequest,
  ) => Promise<DesktopClipboardPriceCheckResult>;
  readClientLogEvents?: (request: {
    clientLogPath: string;
    offset: number;
  }) => Promise<{
    cursorOffset: number;
    lines: ParsedClientLogLine[];
  }>;
  setOverlayMode?: (
    request: DesktopOverlayModeRequest,
  ) => Promise<DesktopOverlayModePlan>;
  subscribeClipboardHotkey?: (
    onPressed: () => void,
  ) => Promise<(() => Promise<void>) | undefined>;
  discoverBackupFiles?: (request: {
    gameDirectory: string;
  }) => Promise<DesktopLocalBackupFileRequest[]>;
  runBackup?: (
    request: DesktopLocalConfigBackupRequest,
  ) => Promise<DesktopLocalConfigBackupPlan>;
  writeBuildFile?: (
    request: DesktopBuildFileWriteRequest,
  ) => Promise<DesktopBuildFileWritePlan>;
  clientLogPollIntervalMs?: number;
  now?: () => Date;
}) {
  const [state, setState] = useState<DesktopPathsPanelState>({
    status: "loading",
  });
  const [backupState, setBackupState] = useState<LocalBackupState>({
    status: "idle",
  });
  const [clipboardState, setClipboardState] = useState<ClipboardCaptureState>({
    status: "idle",
  });
  const [priceCheckState, setPriceCheckState] =
    useState<ClipboardPriceCheckState>({
      status: "idle",
    });
  const [buildExportState, setBuildExportState] =
    useState<AdvisorBuildExportState>({
      status: "idle",
    });
  const [overlayState, setOverlayState] = useState<OverlayModeState>({
    status: "idle",
    overlayEnabled: false,
  });
  const [clientLogState, setClientLogState] = useState<ClientLogWatchState>({
    status: "idle",
  });

  useEffect(() => {
    let cancelled = false;

    void loadPaths()
      .then((bridge) => {
        if (cancelled) return;
        setState({ status: "ready", bridge });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [loadPaths]);

  const paths =
    state.status === "ready" && state.bridge.source === "tauri"
      ? state.bridge.paths
      : null;

  async function handleLocalBackup() {
    if (!paths) return;

    setBackupState({ status: "running" });

    try {
      const files = await discoverBackupFiles({
        gameDirectory: paths.gameDirectory,
      });

      if (files.length === 0) {
        setBackupState({ status: "empty" });
        return;
      }

      const capturedAt = now().toISOString();
      const plan = await runBackup(
        createLocalConfigBackupRequest({
          gameDirectory: paths.gameDirectory,
          capturedAt,
          files,
        }),
      );

      setBackupState({ status: "success", plan });
    } catch (error) {
      setBackupState({
        status: "error",
        message: error instanceof Error ? error.message : "Local backup failed",
      });
    }
  }

  const handleClipboardCapture = useCallback(
    async (source: "button" | "hotkey" = "button") => {
      setClipboardState({ status: "running" });

      try {
        const capturedAt = now().toISOString();
        const request =
          source === "hotkey"
            ? createClipboardHotkeyCaptureRequest(capturedAt)
            : createClipboardCaptureRequest(capturedAt);
        const capture = await captureClipboardItem(request);

        setClipboardState({ status: "success", capture });
      } catch (error) {
        setClipboardState({
          status: "error",
          message:
            error instanceof Error ? error.message : "Clipboard capture failed",
        });
      }
    },
    [captureClipboardItem, now],
  );

  async function handleClipboardPriceCheck() {
    setPriceCheckState({ status: "running" });

    try {
      const result = await priceClipboardItem(
        createClipboardPriceCheckRequest({
          capturedAt: now().toISOString(),
          apiBaseUrl: defaultApiBaseUrl,
          league: dashboardDatasetVersion.league,
          patch: dashboardDatasetVersion.patch,
        }),
      );

      setPriceCheckState({ status: "success", result });
    } catch (error) {
      setPriceCheckState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Clipboard price check failed",
      });
    }
  }

  async function handleOverlayToggle() {
    if (!paths) return;

    const overlayEnabled = !isOverlayEnabled(overlayState);
    setOverlayState({ status: "running", overlayEnabled });

    try {
      const plan = await setOverlayMode(
        createOverlayModeRequest({
          capturedAt: now().toISOString(),
          overlayEnabled,
        }),
      );

      setOverlayState({ status: "success", plan });
    } catch (error) {
      setOverlayState({
        status: "error",
        overlayEnabled: !overlayEnabled,
        message:
          error instanceof Error ? error.message : "Overlay mode change failed",
      });
    }
  }

  async function handleAdvisorBuildExport() {
    if (!paths) return;

    setBuildExportState({ status: "running" });

    try {
      const plan = await writeBuildFile(
        createAdvisorBuildExportRequest({
          buildPlannerDirectory: paths.buildPlannerDirectory,
          capturedAt: now().toISOString(),
          exportBuild: advisorBuildExport,
        }),
      );

      setBuildExportState({ status: "success", plan });
    } catch (error) {
      setBuildExportState({
        status: "error",
        message:
          error instanceof Error ? error.message : ".build export failed",
      });
    }
  }

  useEffect(() => {
    if (!paths) {
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => Promise<void>) | undefined;

    void subscribeClipboardHotkey(() => {
      void handleClipboardCapture("hotkey");
    })
      .then((registeredUnsubscribe) => {
        if (cancelled) {
          void registeredUnsubscribe?.();
          return;
        }

        unsubscribe = registeredUnsubscribe;
      })
      .catch(() => {
        if (cancelled) return;
      });

    return () => {
      cancelled = true;
      void unsubscribe?.();
    };
  }, [handleClipboardCapture, paths, subscribeClipboardHotkey]);

  useEffect(() => {
    if (!paths) {
      setClientLogState({ status: "idle" });
      return;
    }

    let cancelled = false;
    let initialized = false;
    let cursorOffset = 0;
    const clientLogPath = paths.clientLogPath;

    async function pollClientLog() {
      try {
        const result = await readClientLogEvents({
          clientLogPath,
          offset: cursorOffset,
        });

        if (cancelled) return;

        cursorOffset = result.cursorOffset;
        if (!initialized) {
          initialized = true;
          setClientLogState({
            status: "watching",
            cursorOffset,
            events: [],
          });
          return;
        }

        setClientLogState((current) => ({
          status: "watching",
          cursorOffset,
          events: [
            ...result.lines,
            ...(current.status === "watching" ? current.events : []),
          ].slice(0, 4),
        }));
      } catch (error) {
        if (cancelled) return;
        setClientLogState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Client.txt watcher unavailable",
        });
      }
    }

    void pollClientLog();
    const interval = window.setInterval(
      () => void pollClientLog(),
      clientLogPollIntervalMs,
    );

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [clientLogPollIntervalMs, paths, readClientLogEvents]);

  return (
    <section className="min-w-0 rounded-lg border border-base-300/70 bg-base-200/72 p-4 shadow-sm shadow-black/10">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-base-content">
        <span className="grid size-7 place-items-center rounded-md border border-base-300 bg-base-300/50 text-primary">
          <Archive className="size-4" aria-hidden="true" />
        </span>
        <h2>Desktop shell</h2>
      </div>

      <div
        className={`mb-3 rounded-md border p-3 text-xs font-medium ${
          paths
            ? "border-success/30 bg-success/10 text-success"
            : "border-warning/35 bg-warning/10 text-warning"
        }`}
      >
        {formatDesktopStatus(state)}
      </div>

      {paths ? (
        <div className="space-y-3 text-sm">
          <PathRow label="Game folder" value={paths.gameDirectory} />
          <PathRow label="Client.txt" value={paths.clientLogPath} />
          <PathRow label="BuildPlanner" value={paths.buildPlannerDirectory} />
          <ClientLogWatchStatus state={clientLogState} />
          <button
            type="button"
            className="btn btn-accent btn-sm w-full"
            disabled={overlayState.status === "running"}
            aria-pressed={isOverlayEnabled(overlayState)}
            onClick={() => void handleOverlayToggle()}
          >
            {overlayState.status === "running" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <MonitorUp className="size-4" aria-hidden="true" />
            )}
            {isOverlayEnabled(overlayState) ? "Exit overlay" : "Enter overlay"}
          </button>
          <OverlayModeStatus state={overlayState} />
          <button
            type="button"
            className="btn btn-secondary btn-sm w-full"
            disabled={clipboardState.status === "running"}
            aria-keyshortcuts="Control+Shift+C Meta+Shift+C"
            onClick={() => void handleClipboardCapture()}
          >
            {clipboardState.status === "running" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Clipboard className="size-4" aria-hidden="true" />
            )}
            Capture clipboard item
          </button>
          <ClipboardCaptureStatus state={clipboardState} />
          <button
            type="button"
            className="btn btn-warning btn-sm w-full"
            disabled={priceCheckState.status === "running"}
            onClick={() => void handleClipboardPriceCheck()}
          >
            {priceCheckState.status === "running" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <WalletCards className="size-4" aria-hidden="true" />
            )}
            Price clipboard item
          </button>
          <ClipboardPriceCheckStatus state={priceCheckState} />
          <button
            type="button"
            className="btn btn-info btn-sm w-full"
            disabled={buildExportState.status === "running"}
            onClick={() => void handleAdvisorBuildExport()}
          >
            {buildExportState.status === "running" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FolderOpen className="size-4" aria-hidden="true" />
            )}
            Export advisor build
          </button>
          <AdvisorBuildExportStatus state={buildExportState} />
          <button
            type="button"
            className="btn btn-primary btn-sm w-full"
            disabled={backupState.status === "running"}
            onClick={() => void handleLocalBackup()}
          >
            {backupState.status === "running" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Archive className="size-4" aria-hidden="true" />
            )}
            Backup local config
          </button>
          <LocalBackupStatus state={backupState} />
        </div>
      ) : (
        <p className="text-sm text-base-content/70">
          Loot filters, BuildPlanner files, and overlay config stay local-first
          once Calandra is running inside the desktop app.
        </p>
      )}
    </section>
  );
}

export function createClipboardCaptureRequest(
  capturedAt: string,
): DesktopClipboardItemCaptureRequest {
  return createClipboardCaptureRequestWithPrefix("clipboard", capturedAt);
}

export function createClipboardHotkeyCaptureRequest(
  capturedAt: string,
): DesktopClipboardItemCaptureRequest {
  return createClipboardCaptureRequestWithPrefix(
    "clipboard-hotkey",
    capturedAt,
  );
}

export function createClipboardPriceCheckRequest({
  capturedAt,
  apiBaseUrl,
  league,
  patch,
}: {
  capturedAt: string;
  apiBaseUrl: string;
  league: string;
  patch: string;
}): DesktopClipboardPriceCheckRequest {
  return {
    ...createClipboardCaptureRequestWithPrefix("clipboard-price", capturedAt),
    apiBaseUrl,
    league,
    patch,
  };
}

function createClipboardCaptureRequestWithPrefix(
  prefix: string,
  capturedAt: string,
): DesktopClipboardItemCaptureRequest {
  return {
    actionId: `${prefix}-${capturedAt.replace(/[:.]/g, "-")}`,
    capturedAt,
    userInitiated: true,
  };
}

function defaultNow() {
  return new Date();
}

const defaultClientLogPollIntervalMs = 3_000;

export function createLocalConfigBackupRequest({
  gameDirectory,
  capturedAt,
  files,
}: {
  gameDirectory: string;
  capturedAt: string;
  files: DesktopLocalBackupFileRequest[];
}): DesktopLocalConfigBackupRequest {
  return {
    gameDirectory,
    backupDirectory: defaultLocalBackupDirectory(gameDirectory),
    actionId: `local-backup-${capturedAt.replace(/[:.]/g, "-")}`,
    capturedAt,
    userInitiated: true,
    files,
  };
}

export function createOverlayModeRequest({
  capturedAt,
  overlayEnabled,
}: {
  capturedAt: string;
  overlayEnabled: boolean;
}): DesktopOverlayModeRequest {
  return {
    actionId: `overlay-${capturedAt.replace(/[:.]/g, "-")}`,
    overlayEnabled,
    userInitiated: true,
  };
}

export function createAdvisorBuildExportRequest({
  buildPlannerDirectory,
  capturedAt,
  exportBuild,
}: {
  buildPlannerDirectory: string;
  capturedAt: string;
  exportBuild: AdvisorBuildExport;
}): DesktopBuildFileWriteRequest {
  return {
    buildPlannerDirectory,
    fileName: normalizeBuildExportFileName(exportBuild.name),
    content: createBuildPlannerExportContent(exportBuild),
    actionId: `advisor-export-${capturedAt.replace(/[:.]/g, "-")}`,
    userInitiated: true,
  };
}

function createBuildPlannerExportContent(exportBuild: AdvisorBuildExport) {
  return [
    "# Calandra BuildPlanner export",
    `name=${exportBuild.name}`,
    `class=${exportBuild.className}`,
    `level=${exportBuild.level}`,
    `league=${exportBuild.league}`,
    `patch=${exportBuild.patch}`,
    `mainSkill=${exportBuild.mainSkill ?? ""}`,
    "",
    "[passives]",
    ...exportBuild.passiveSkillIds,
    "",
    "[equipment]",
    ...exportBuild.equipment.map((item) => `${item.slot}=${item.name}`),
    "",
    "[upgrades]",
    ...exportBuild.upgrades.map(formatBuildPlannerUpgrade),
    "",
  ].join("\n");
}

function formatBuildPlannerUpgrade(
  upgrade: AdvisorBuildExport["upgrades"][number],
) {
  const cost =
    upgrade.estimatedCostChaos === undefined
      ? "unpriced"
      : `${upgrade.estimatedCostChaos} chaos`;

  return `${upgrade.slot}=${upgrade.candidateName} over ${upgrade.currentName} (+${upgrade.scoreDelta}, ${cost})`;
}

function normalizeBuildExportFileName(value: string) {
  const normalized = value.trim().replace(/[\\/:]/g, "-");

  return normalized || "Calandra Advisor Export";
}

const fallbackAdvisorBuildExport: AdvisorBuildExport = {
  name: "Calandra Advisor Export",
  className: "Unknown",
  level: 0,
  league: dashboardDatasetVersion.league,
  patch: dashboardDatasetVersion.patch,
  passiveSkillIds: [],
  equipment: [],
  upgrades: [],
};

export function defaultLocalBackupDirectory(gameDirectory: string): string {
  const trimmed = gameDirectory.replace(/[\\/]+$/, "");
  const lastSlash = Math.max(
    trimmed.lastIndexOf("\\"),
    trimmed.lastIndexOf("/"),
  );

  if (lastSlash === -1) {
    return "Calandra Backups";
  }

  return `${trimmed.slice(0, lastSlash)}${trimmed[lastSlash]}Calandra Backups`;
}

function ClipboardCaptureStatus({ state }: { state: ClipboardCaptureState }) {
  if (state.status === "idle" || state.status === "running") {
    return null;
  }

  if (state.status === "success") {
    return (
      <div className="rounded-md border border-info/30 bg-info/10 p-3 text-xs text-info">
        <div className="mb-1 flex items-center gap-2 font-semibold">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          <span>{state.capture.contractItem.name}</span>
        </div>
        <p className="text-info/85">
          {state.capture.item.rarity} {state.capture.item.category}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-error/35 bg-error/10 p-3 text-xs text-error">
      <div className="flex items-center gap-2 font-semibold">
        <XCircle className="size-4" aria-hidden="true" />
        <span>{state.message}</span>
      </div>
    </div>
  );
}

function ClipboardPriceCheckStatus({
  state,
}: {
  state: ClipboardPriceCheckState;
}) {
  if (state.status === "idle" || state.status === "running") {
    return null;
  }

  if (state.status === "success") {
    const price = state.result.priceCheck.price;

    return (
      <div className="rounded-md border border-warning/35 bg-warning/10 p-3 text-xs text-warning">
        <div className="mb-1 flex items-center gap-2 font-semibold">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          <span>{state.result.capture.contractItem.name}</span>
        </div>
        <p className="text-warning/85">
          {price ? `${price.chaosEquivalent} chaos` : "No price match"}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-error/35 bg-error/10 p-3 text-xs text-error">
      <div className="flex items-center gap-2 font-semibold">
        <XCircle className="size-4" aria-hidden="true" />
        <span>{state.message}</span>
      </div>
    </div>
  );
}

function ClientLogWatchStatus({ state }: { state: ClientLogWatchState }) {
  if (state.status === "idle") {
    return null;
  }

  if (state.status === "error") {
    return (
      <div className="rounded-md border border-error/35 bg-error/10 p-3 text-xs text-error">
        <div className="flex items-center gap-2 font-semibold">
          <XCircle className="size-4" aria-hidden="true" />
          <span>{state.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-base-300/70 bg-base-100/45 p-3 text-xs text-base-content/75">
      <div className="mb-2 flex items-center gap-2 font-semibold text-base-content">
        <ScrollText className="size-4 text-primary" aria-hidden="true" />
        <span>Watching Client.txt</span>
      </div>
      {state.events.length > 0 ? (
        <div className="space-y-2">
          {state.events.map((event) => (
            <div
              key={`${event.timestamp}-${event.uptimeMs}-${event.message}`}
              className="rounded-md bg-base-200/80 p-2"
            >
              <p className="font-medium text-base-content">
                {formatClientLogEventLabel(event)}
              </p>
              <p className="mt-1 text-base-content/55">{event.timestamp}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-base-content/60">Waiting for new complete lines</p>
      )}
    </div>
  );
}

export function formatClientLogEventLabel(event: ParsedClientLogLine) {
  if (event.event.type === "area-entered") {
    return `Entered ${event.event.areaName}`;
  }

  if (event.event.type === "area-generated") {
    return `Generated ${event.event.areaName} level ${event.event.areaLevel}`;
  }

  return event.message;
}

function OverlayModeStatus({ state }: { state: OverlayModeState }) {
  if (state.status === "idle" || state.status === "running") {
    return null;
  }

  if (state.status === "success") {
    return (
      <div className="rounded-md border border-success/30 bg-success/10 p-3 text-xs text-success">
        <div className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          <span>
            {state.plan.overlayEnabled ? "Overlay active" : "Overlay closed"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-error/35 bg-error/10 p-3 text-xs text-error">
      <div className="flex items-center gap-2 font-semibold">
        <XCircle className="size-4" aria-hidden="true" />
        <span>{state.message}</span>
      </div>
    </div>
  );
}

function AdvisorBuildExportStatus({
  state,
}: {
  state: AdvisorBuildExportState;
}) {
  if (state.status === "idle" || state.status === "running") {
    return null;
  }

  if (state.status === "success") {
    return (
      <div className="rounded-md border border-success/30 bg-success/10 p-3 text-xs text-success">
        <div className="mb-2 flex items-center gap-2 font-semibold">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          <span>Advisor build exported</span>
        </div>
        <p className="break-all font-mono leading-5">{state.plan.outputPath}</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-error/35 bg-error/10 p-3 text-xs text-error">
      <div className="flex items-center gap-2 font-semibold">
        <XCircle className="size-4" aria-hidden="true" />
        <span>{state.message}</span>
      </div>
    </div>
  );
}

function isOverlayEnabled(state: OverlayModeState) {
  if (state.status === "success") {
    return state.plan.overlayEnabled;
  }

  return state.overlayEnabled;
}

function LocalBackupStatus({ state }: { state: LocalBackupState }) {
  if (state.status === "idle" || state.status === "running") {
    return null;
  }

  if (state.status === "success") {
    return (
      <div className="rounded-md border border-success/30 bg-success/10 p-3 text-xs text-success">
        <div className="mb-2 flex items-center gap-2 font-semibold">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          <span>Backed up {state.plan.entries.length} files</span>
        </div>
        <p className="break-all font-mono leading-5">{state.plan.backupRoot}</p>
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div className="rounded-md border border-warning/35 bg-warning/10 p-3 text-xs font-medium text-warning">
        No local config files found
      </div>
    );
  }

  return (
    <div className="rounded-md border border-error/35 bg-error/10 p-3 text-xs text-error">
      <div className="flex items-center gap-2 font-semibold">
        <XCircle className="size-4" aria-hidden="true" />
        <span>{state.message}</span>
      </div>
    </div>
  );
}

function PathRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-base-300/70 bg-base-100/45 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-base-content/55">
        <FolderOpen className="size-3.5" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <p className="break-all font-mono text-xs leading-5 text-base-content">
        {value}
      </p>
    </div>
  );
}

function formatDesktopStatus(state: DesktopPathsPanelState) {
  if (state.status === "loading") {
    return "Checking desktop shell";
  }

  if (state.status === "error") {
    return "Desktop bridge unavailable";
  }

  return state.bridge.source === "tauri"
    ? "Native shell connected"
    : "Standalone web session";
}
