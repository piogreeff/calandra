import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  datasetArtifactSchema,
  type DatasetArtifact,
} from "@calandra/contract";
import {
  type MaintainerIngestionExecutionContext,
  type MaintainerIngestionSource,
  validateMaintainerIngestionRequest,
} from "./maintainer";

export type MaintainerNormalizedDataset = {
  league: string;
  patch: string;
  generatedAt?: string;
  items?: DatasetArtifact["items"];
  uniques?: DatasetArtifact["uniques"];
  mods?: DatasetArtifact["mods"];
  gems?: DatasetArtifact["gems"];
  economy?: DatasetArtifact["economy"];
  ladderBuilds?: DatasetArtifact["ladderBuilds"];
};

export type MaintainerDatasetArtifactBuildOptions = {
  executionContext: MaintainerIngestionExecutionContext;
  sourceUrls: readonly string[];
  normalized: MaintainerNormalizedDataset;
};

export type MaintainerDatasetArtifactWriteOptions =
  MaintainerDatasetArtifactBuildOptions & {
    outputPath: string;
  };

const sourceAttribution = {
  "poe2db.tw":
    "Game data derived from Path of Exile 2 community references; Path of Exile 2 is property of Grinding Gear Games.",
  "poe.ninja":
    "Economy and ladder data derived from poe.ninja community market/build references.",
} as const satisfies Record<MaintainerIngestionSource["host"], string>;

const imageSource = {
  kind: "image",
  name: "Grinding Gear Games CDN",
  url: "https://web.poecdn.com/",
  attribution:
    "Item art is property of Grinding Gear Games and is cached for attribution-preserving display.",
} as const;

export function buildMaintainerDatasetArtifact(
  options: MaintainerDatasetArtifactBuildOptions,
): DatasetArtifact {
  const request = validateMaintainerIngestionRequest({
    executionContext: options.executionContext,
    sourceUrls: options.sourceUrls,
  });
  const sources: DatasetArtifact["sources"] = request.sources.map(
    toDatasetSource,
  );
  const artifact: DatasetArtifact = {
    league: options.normalized.league,
    patch: options.normalized.patch,
    generatedAt: options.normalized.generatedAt ?? new Date().toISOString(),
    source: "published-artifact",
    sources,
    items: options.normalized.items ?? [],
    uniques: options.normalized.uniques ?? [],
    mods: options.normalized.mods ?? [],
    gems: options.normalized.gems ?? [],
    economy: options.normalized.economy ?? [],
    ladderBuilds: options.normalized.ladderBuilds ?? [],
  };

  if (hasCachedImages(artifact)) {
    artifact.sources.push(imageSource);
  }

  return datasetArtifactSchema.parse(artifact);
}

export async function readMaintainerNormalizedDataset(path: string) {
  return JSON.parse(
    (await readFile(path, "utf8")).replace(/^\uFEFF/, ""),
  ) as MaintainerNormalizedDataset;
}

export async function writeMaintainerDatasetArtifact(
  options: MaintainerDatasetArtifactWriteOptions,
) {
  const artifact = buildMaintainerDatasetArtifact(options);

  await mkdir(dirname(options.outputPath), { recursive: true });
  await writeFile(
    options.outputPath,
    `${JSON.stringify(artifact, null, 2)}\n`,
    "utf8",
  );

  return artifact;
}

function toDatasetSource(source: MaintainerIngestionSource) {
  return {
    kind: source.kind,
    name: source.host,
    url: source.url,
    attribution: sourceAttribution[source.host],
  };
}

function hasCachedImages(artifact: DatasetArtifact) {
  return [...artifact.items, ...artifact.uniques].some((item) =>
    Boolean(item.iconCacheKey),
  );
}
