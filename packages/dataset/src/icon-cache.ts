import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { datasetArtifactSchema, type DatasetArtifact } from "@calandra/contract";
import type { MaintainerIngestionExecutionContext } from "./maintainer";

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
