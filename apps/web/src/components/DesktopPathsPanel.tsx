"use client";

import { Archive, FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getDesktopPoe2Paths,
  type DesktopPoe2PathState,
} from "../lib/desktop-bridge";

type DesktopPathsPanelState =
  | { status: "loading" }
  | { status: "ready"; bridge: DesktopPoe2PathState }
  | { status: "error" };

export function DesktopPathsPanel({
  loadPaths = getDesktopPoe2Paths,
}: {
  loadPaths?: () => Promise<DesktopPoe2PathState>;
}) {
  const [state, setState] = useState<DesktopPathsPanelState>({
    status: "loading",
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
          <PathRow label="Client.txt" value={paths.clientLogPath} />
          <PathRow
            label="BuildPlanner"
            value={paths.buildPlannerDirectory}
          />
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
