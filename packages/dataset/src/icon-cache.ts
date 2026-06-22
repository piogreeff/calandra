import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { datasetArtifactSchema, type DatasetArtifact } from "@calandra/contract";
import type { MaintainerIngestionExecutionContext } from "./maintainer";

const require = createRequire(import.meta.url);

export type IconFetchResponse = {
  ok: boolean;
  status: number;
  headers?: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type IconFetch = (url: string) => Promise<IconFetchResponse>;

export type IconCacheEntry = {
  itemId: string;
  itemName: string;
  cacheKey: string;
  sourceUrl: string;
  attribution: string;
  contentType?: string;
  bytes: number;
};

export type IconCacheResult = {
  manifestPath: string;
  cached: IconCacheEntry[];
};

export type IconCacheManifest = {
  league: string;
  patch: string;
  source: "maintainer-icon-cache";
  sources: DatasetArtifact["sources"];
  count: number;
  icons: IconCacheEntry[];
};

export type IconCacheR2PublishOptions = {
  executionContext: MaintainerIngestionExecutionContext;
  iconCacheDirectory: string;
  manifestPath: string;
  r2Bucket: string;
  wranglerCommand?: string;
  runCommand?: CommandRunner;
};

export type IconCacheR2PublishResult = {
  r2Bucket: string;
  uploadedObjects: string[];
};

export type CommandRunner = (
  command: string,
  args: string[],
) => Promise<void>;

export type IconCacheOptions = {
  artifact: DatasetArtifact;
  outputDirectory: string;
  executionContext: MaintainerIngestionExecutionContext;
  fetchIcon?: IconFetch;
};

export async function readDatasetArtifact(path: string) {
  return datasetArtifactSchema.parse(
    JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/, "")),
  );
}

export async function cacheDatasetIcons(
  options: IconCacheOptions,
): Promise<IconCacheResult> {
  if (options.executionContext !== "maintainer") {
    throw new Error("Icon caching is maintainer-only.");
  }

  const fetchIcon = options.fetchIcon ?? defaultFetchIcon;
  const cached: IconCacheEntry[] = [];

  for (const item of getCacheableIconItems(options.artifact)) {
    const response = await fetchIcon(item.iconSourceUrl);

    if (!response.ok) {
      throw new Error(
        `Icon fetch failed for ${item.iconSourceUrl}: ${response.status}`,
      );
    }

    const body = Buffer.from(await response.arrayBuffer());
    const outputPath = getIconOutputPath(
      options.outputDirectory,
      item.iconCacheKey,
    );

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, body);
    const contentType = response.headers?.get("content-type");

    cached.push({
      itemId: item.id,
      itemName: item.name,
      cacheKey: item.iconCacheKey,
      sourceUrl: item.iconSourceUrl,
      attribution: item.iconAttribution,
      ...(contentType ? { contentType } : {}),
      bytes: body.byteLength,
    });
  }

  const manifestPath = join(options.outputDirectory, "icon-cache.manifest.json");
  await mkdir(options.outputDirectory, { recursive: true });
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        league: options.artifact.league,
        patch: options.artifact.patch,
        generatedAt: new Date().toISOString(),
        source: "maintainer-icon-cache",
        sources: options.artifact.sources.filter(
          (source) => source.kind === "image",
        ),
        count: cached.length,
        icons: cached,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return { manifestPath, cached };
}

export async function publishIconCacheToR2(
  options: IconCacheR2PublishOptions,
): Promise<IconCacheR2PublishResult> {
  if (options.executionContext !== "maintainer") {
    throw new Error("Icon cache publishing is maintainer-only.");
  }

  if (!options.r2Bucket.trim()) {
    throw new Error("r2Bucket is required");
  }

  const manifest = await readIconCacheManifest(options.manifestPath);
  const wranglerInvocation = getWranglerInvocation(options.wranglerCommand);
  const runCommand = options.runCommand ?? runCommandWithInheritedOutput;
  const uploadCommands = getIconCacheUploadCommands({
    iconCacheDirectory: options.iconCacheDirectory,
    manifestPath: options.manifestPath,
    manifest,
    r2Bucket: options.r2Bucket,
  });

  for (const command of uploadCommands) {
    await runCommand(wranglerInvocation.command, [
      ...wranglerInvocation.argsPrefix,
      ...command,
    ]);
  }

  return {
    r2Bucket: options.r2Bucket,
    uploadedObjects: uploadCommands.map(
      (command) => command[command.indexOf("put") + 1] ?? "",
    ),
  };
}

export async function readIconCacheManifest(path: string) {
  return JSON.parse(
    (await readFile(path, "utf8")).replace(/^\uFEFF/, ""),
  ) as IconCacheManifest;
}

export function getIconCacheUploadCommands({
  iconCacheDirectory,
  manifestPath,
  manifest,
  r2Bucket,
}: {
  iconCacheDirectory: string;
  manifestPath: string;
  manifest: IconCacheManifest;
  r2Bucket: string;
}) {
  const manifestKey = `images/${manifest.league}/${manifest.patch}/icon-cache.manifest.json`;
  const commands = manifest.icons.map((icon) => [
    "r2",
    "object",
    "put",
    `${r2Bucket}/${icon.cacheKey}`,
    "--file",
    getIconOutputPath(iconCacheDirectory, icon.cacheKey),
    "--content-type",
    icon.contentType ?? "application/octet-stream",
    "--remote",
  ]);

  commands.push([
    "r2",
    "object",
    "put",
    `${r2Bucket}/${manifestKey}`,
    "--file",
    manifestPath,
    "--content-type",
    "application/json",
    "--remote",
  ]);

  return commands;
}

function getCacheableIconItems(artifact: DatasetArtifact) {
  return [...artifact.items, ...artifact.uniques].filter(
    (
      item,
    ): item is typeof item & {
      iconSourceUrl: string;
      iconCacheKey: string;
      iconAttribution: string;
    } =>
      Boolean(item.iconSourceUrl) &&
      Boolean(item.iconCacheKey) &&
      Boolean(item.iconAttribution),
  );
}

function getIconOutputPath(outputDirectory: string, cacheKey: string) {
  const parts = cacheKey.split(/[\\/]/);

  if (parts.some((part) => part === ".." || part === "")) {
    throw new Error(`Invalid icon cache key: ${cacheKey}`);
  }

  const root = resolve(outputDirectory);
  const outputPath = resolve(outputDirectory, ...parts);

  if (!outputPath.startsWith(`${root}${sep}`) && outputPath !== root) {
    throw new Error(`Invalid icon cache key: ${cacheKey}`);
  }

  return outputPath;
}

async function defaultFetchIcon(url: string): Promise<IconFetchResponse> {
  return fetch(url);
}

function runCommandWithInheritedOutput(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with exit ${code}`));
    });
  });
}

function getWranglerInvocation(wranglerCommand: string | undefined) {
  if (wranglerCommand) {
    return { command: wranglerCommand, argsPrefix: [] };
  }

  return {
    command: process.execPath,
    argsPrefix: [
      join(
        dirname(require.resolve("wrangler/package.json")),
        "bin",
        "wrangler.js",
      ),
    ],
  };
}
