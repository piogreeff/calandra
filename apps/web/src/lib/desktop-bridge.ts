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

export function isTauriRuntime(globals: TauriGlobals): boolean {
  return (
    globals.__TAURI__ !== undefined ||
    globals.__TAURI_INTERNALS__ !== undefined
  );
}

async function loadTauriInvoke(): Promise<Invoke> {
  const { invoke } = await import("@tauri-apps/api/core");

  return (command, args) => invoke(command, args);
}
