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

type TauriGlobals = {
  __TAURI__?: unknown;
  __TAURI_INTERNALS__?: unknown;
};

type Invoke = (command: string) => Promise<DesktopPoe2Paths>;

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
    paths: await invokeCommand("get_default_poe2_paths"),
  };
}

export function isTauriRuntime(globals: TauriGlobals): boolean {
  return (
    globals.__TAURI__ !== undefined ||
    globals.__TAURI_INTERNALS__ !== undefined
  );
}

async function loadTauriInvoke(): Promise<Invoke> {
  const { invoke } = await import("@tauri-apps/api/core");

  return (command) => invoke<DesktopPoe2Paths>(command);
}
