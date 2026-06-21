import { parseItemText, toContractItem } from "@calandra/parser";
import type { Item } from "@calandra/contract";
import type { ParsedClipboardItem } from "@calandra/parser";

export type DesktopPoe2Paths = {
  gameDirectory: string;
  clientLogPath: string;
  buildPlannerDirectory: string;
};

export type DesktopPoe2PathState =
  | {
      source: "standalone";
      paths: null;
    }
  | {
      source: "tauri";
      paths: DesktopPoe2Paths;
    };

export type DesktopThemeStore = {
  getThemePreference(): Promise<string | null>;
  setThemePreference(theme: string): Promise<void>;
};

export type DesktopBuildFileWriteRequest = {
  buildPlannerDirectory: string;
  fileName: string;
  content: string;
  actionId: string;
  userInitiated: boolean;
};

export type DesktopBuildFileWritePlan = {
  actionId: string;
  outputPath: string;
  content: string;
};

export type DesktopClientLogAppendRequest = {
  clientLogPath: string;
  offset: number;
};

export type DesktopClientLogAppendResult = {
  cursorOffset: number;
  content: string;
};

export type DesktopClipboardItemCaptureRequest = {
  actionId: string;
  capturedAt: string;
  userInitiated: boolean;
};

export type DesktopClipboardTextCapture = {
  actionId: string;
  capturedAt: string;
  text: string;
};

export type DesktopClipboardItemCapture = DesktopClipboardTextCapture & {
  item: ParsedClipboardItem;
  contractItem: Item;
};

export type DesktopLocalBackupFileRequest = {
  kind: "loot-filter" | "build-file" | "overlay-config";
  sourcePath: string;
};

export type DesktopLocalConfigBackupRequest = {
  gameDirectory: string;
  backupDirectory: string;
  actionId: string;
  capturedAt: string;
  userInitiated: boolean;
  files: DesktopLocalBackupFileRequest[];
};

export type DesktopLocalConfigBackupDiscoveryRequest = {
  gameDirectory: string;
};

export type DesktopLocalBackupEntry = DesktopLocalBackupFileRequest & {
  destinationPath: string;
};

export type DesktopLocalConfigBackupPlan = {
  actionId: string;
  capturedAt: string;
  backupRoot: string;
  entries: DesktopLocalBackupEntry[];
};

type TauriGlobals = {
  __TAURI__?: unknown;
  __TAURI_INTERNALS__?: unknown;
};

type Invoke = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

export async function getDesktopPoe2Paths({
  globals = globalThis as TauriGlobals,
  invoke,
}: {
  globals?: TauriGlobals;
  invoke?: Invoke;
} = {}): Promise<DesktopPoe2PathState> {
  if (!isTauriRuntime(globals)) {
    return {
      source: "standalone",
      paths: null,
    };
  }

  const invokeCommand = invoke ?? (await loadTauriInvoke());

  return {
    source: "tauri",
    paths: (await invokeCommand("get_default_poe2_paths")) as DesktopPoe2Paths,
  };
}

export function createDesktopThemeStore({
  globals = globalThis as TauriGlobals,
  invoke,
}: {
  globals?: TauriGlobals;
  invoke?: Invoke;
} = {}): DesktopThemeStore | undefined {
  if (!isTauriRuntime(globals)) {
    return undefined;
  }

  return {
    async getThemePreference() {
      const invokeCommand = invoke ?? (await loadTauriInvoke());

      return (await invokeCommand("get_theme_preference")) as string | null;
    },
    async setThemePreference(theme) {
      const invokeCommand = invoke ?? (await loadTauriInvoke());

      await invokeCommand("set_theme_preference", { theme });
    },
  };
}

export async function writeDesktopBuildFile(
  request: DesktopBuildFileWriteRequest,
  {
    globals = globalThis as TauriGlobals,
    invoke,
  }: {
    globals?: TauriGlobals;
    invoke?: Invoke;
  } = {},
): Promise<DesktopBuildFileWritePlan> {
  if (!isTauriRuntime(globals)) {
    throw new Error(".build export requires the Calandra desktop shell");
  }

  const invokeCommand = invoke ?? (await loadTauriInvoke());

  return (await invokeCommand(
    "write_build_file",
    request,
  )) as DesktopBuildFileWritePlan;
}

export async function readDesktopClientLogAppend(
  request: DesktopClientLogAppendRequest,
  {
    globals = globalThis as TauriGlobals,
    invoke,
  }: {
    globals?: TauriGlobals;
    invoke?: Invoke;
  } = {},
): Promise<DesktopClientLogAppendResult> {
  if (!isTauriRuntime(globals)) {
    throw new Error("Client.txt reads require the Calandra desktop shell");
  }

  const invokeCommand = invoke ?? (await loadTauriInvoke());

  return (await invokeCommand(
    "read_client_log_append",
    request,
  )) as DesktopClientLogAppendResult;
}

export async function captureDesktopClipboardItem(
  request: DesktopClipboardItemCaptureRequest,
  {
    globals = globalThis as TauriGlobals,
    invoke,
  }: {
    globals?: TauriGlobals;
    invoke?: Invoke;
  } = {},
): Promise<DesktopClipboardItemCapture> {
  if (!isTauriRuntime(globals)) {
    throw new Error(
      "Clipboard item capture requires the Calandra desktop shell",
    );
  }

  const invokeCommand = invoke ?? (await loadTauriInvoke());
  const capture = (await invokeCommand(
    "capture_clipboard_text",
    request,
  )) as DesktopClipboardTextCapture;
  const item = parseItemText(capture.text);

  return {
    ...capture,
    item,
    contractItem: toContractItem(item),
  };
}

export async function runDesktopLocalConfigBackup(
  request: DesktopLocalConfigBackupRequest,
  {
    globals = globalThis as TauriGlobals,
    invoke,
  }: {
    globals?: TauriGlobals;
    invoke?: Invoke;
  } = {},
): Promise<DesktopLocalConfigBackupPlan> {
  if (!isTauriRuntime(globals)) {
    throw new Error("Local backup requires the Calandra desktop shell");
  }

  const invokeCommand = invoke ?? (await loadTauriInvoke());

  return (await invokeCommand(
    "copy_local_config_backup",
    request,
  )) as DesktopLocalConfigBackupPlan;
}

export async function discoverDesktopLocalConfigBackupFiles(
  request: DesktopLocalConfigBackupDiscoveryRequest,
  {
    globals = globalThis as TauriGlobals,
    invoke,
  }: {
    globals?: TauriGlobals;
    invoke?: Invoke;
  } = {},
): Promise<DesktopLocalBackupFileRequest[]> {
  if (!isTauriRuntime(globals)) {
    throw new Error(
      "Local backup discovery requires the Calandra desktop shell",
    );
  }

  const invokeCommand = invoke ?? (await loadTauriInvoke());

  return (await invokeCommand(
    "discover_local_config_backup_files",
    request,
  )) as DesktopLocalBackupFileRequest[];
}

export function isTauriRuntime(globals: TauriGlobals): boolean {
  return (
    globals.__TAURI__ !== undefined || globals.__TAURI_INTERNALS__ !== undefined
  );
}

async function loadTauriInvoke(): Promise<Invoke> {
  const { invoke } = await import("@tauri-apps/api/core");

  return (command, args) => invoke(command, args);
}
