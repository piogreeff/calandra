"use client";

import {
  Archive,
  CheckCircle2,
  FolderOpen,
  Loader2,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  discoverDesktopLocalConfigBackupFiles,
  getDesktopPoe2Paths,
  runDesktopLocalConfigBackup,
  type DesktopLocalBackupFileRequest,
  type DesktopLocalConfigBackupPlan,
  type DesktopLocalConfigBackupRequest,
  type DesktopPoe2PathState,
} from "../lib/desktop-bridge";

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

export function DesktopPathsPanel({
  loadPaths = getDesktopPoe2Paths,
  discoverBackupFiles = discoverDesktopLocalConfigBackupFiles,
  runBackup = runDesktopLocalConfigBackup,
  now = () => new Date(),
}: {
  loadPaths?: () => Promise<DesktopPoe2PathState>;
  discoverBackupFiles?: (request: {
    gameDirectory: string;
  }) => Promise<DesktopLocalBackupFileRequest[]>;
  runBackup?: (
    request: DesktopLocalConfigBackupRequest,
  ) => Promise<DesktopLocalConfigBackupPlan>;
  now?: () => Date;
}) {
  const [state, setState] = useState<DesktopPathsPanelState>({
    status: "loading",
  });
  const [backupState, setBackupState] = useState<LocalBackupState>({
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
