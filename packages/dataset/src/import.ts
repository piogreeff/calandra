import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  datasetArtifactSchema,
  datasetManifestSchema,
  type DatasetArtifact,
  type DatasetManifest,
} from "@calandra/contract";

const require = createRequire(import.meta.url);

export type DatasetImportOptions = {
  artifactPath: string;
  manifestPath?: string;
  scrapeTarget?: string;
  expectedUniqueCount?: number;
  minimumUniqueImageCoverage?: number;
};

export type UniqueImageCoverage = {
  resolved: number;
  expected: number;
  ratio: number;
  minimum: number;
};

export type DatasetImportResult = {
  league: string;
  patch: string;
  generatedAt: string;
  counts: {
    items: number;
    uniques: number;
    mods: number;
    gems: number;
    economy: number;
    ladderBuilds: number;
  };
  artifact: DatasetArtifact;
  manifest?: DatasetManifest;
  uniqueImageCoverage?: UniqueImageCoverage;
};

export type DatasetPublishOptions = DatasetImportOptions & {
  publishDirectory: string;
  r2Prefix?: string;
};

export type DatasetPublishResult = DatasetImportResult & {
  objectKey: string;
  outputPath: string;
  manifestKey: string;
  manifestPath: string;
  sha256: string;
};

export type DatasetR2PublishOptions = Omit<
  DatasetPublishOptions,
  "publishDirectory"
> & {
  r2Bucket: string;
  publishDirectory?: string;
  wranglerCommand?: string;
  runCommand?: CommandRunner;
};

export type DatasetR2PublishResult = DatasetPublishResult & {
  r2Bucket: string;
  uploadedObjects: string[];
};

export type CommandRunner = (
  command: string,
  args: string[],
) => Promise<void>;

export function validateImportOptions(
  options: DatasetImportOptions,
): DatasetImportOptions {
  if (options.scrapeTarget) {
    throw new Error(
      "Self-host imports must consume a published dataset artifact; scraper targets are maintainer-only.",
    );
  }

  if (!options.artifactPath.trim()) {
    throw new Error("artifactPath is required");
  }

  return options;
}

export async function importDatasetArtifact(
  options: DatasetImportOptions,
): Promise<DatasetImportResult> {
  const validOptions = validateImportOptions(options);
  const raw = await readFile(validOptions.artifactPath, "utf8");
  const artifact = datasetArtifactSchema.parse(
    JSON.parse(raw.replace(/^\uFEFF/, "")),
  );
  const counts = getDatasetCounts(artifact);
  const uniqueImageCoverage = getUniqueImageCoverage(artifact, validOptions);
  const manifest = validOptions.manifestPath
    ? await readAndValidateManifest(
        validOptions.manifestPath,
        raw,
        artifact,
        counts,
      )
    : undefined;

  return {
    league: artifact.league,
    patch: artifact.patch,
    generatedAt: artifact.generatedAt,
    counts,
    artifact,
    ...(manifest ? { manifest } : {}),
    ...(uniqueImageCoverage ? { uniqueImageCoverage } : {}),
  };
}

export async function publishDatasetArtifact(
  options: DatasetPublishOptions,
): Promise<DatasetPublishResult> {
  const result = await importDatasetArtifact(options);
  const objectKey = getDatasetObjectKey(
    result.league,
    result.patch,
    options.r2Prefix,
  );
  const outputPath = join(options.publishDirectory, ...objectKey.split("/"));
  const manifestKey = getDatasetManifestKey(
    result.league,
    result.patch,
    options.r2Prefix,
  );
  const manifestPath = join(
    options.publishDirectory,
    ...manifestKey.split("/"),
  );
  const artifactJson = `${JSON.stringify(result.artifact, null, 2)}\n`;
  const sha256 = createHash("sha256").update(artifactJson).digest("hex");

  await mkdir(dirname(outputPath), { recursive: true });
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(outputPath, artifactJson, "utf8");
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        league: result.league,
        patch: result.patch,
        generatedAt: result.generatedAt,
        artifactKey: objectKey,
        sha256,
        sources: result.artifact.sources,
        ...(result.uniqueImageCoverage
          ? {
              qualityGates: {
                uniqueImageCoverage: result.uniqueImageCoverage,
              },
            }
          : {}),
        counts: result.counts,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return {
    ...result,
    objectKey,
    outputPath,
    manifestKey,
    manifestPath,
    sha256,
  };
}

export async function publishDatasetArtifactToR2(
  options: DatasetR2PublishOptions,
): Promise<DatasetR2PublishResult> {
  if (!options.r2Bucket.trim()) {
    throw new Error("r2Bucket is required");
  }

  const publishDirectory =
    options.publishDirectory ??
    (await mkdtemp(join(tmpdir(), "calandra-dataset-publish-")));
  const result = await publishDatasetArtifact({
    ...options,
    publishDirectory,
  });
  const wranglerInvocation = getWranglerInvocation(options.wranglerCommand);
  const runCommand = options.runCommand ?? runCommandWithInheritedOutput;
  const uploadCommands = getR2UploadCommands({
    r2Bucket: options.r2Bucket,
    artifactObjectKey: result.objectKey,
    artifactPath: result.outputPath,
    manifestObjectKey: result.manifestKey,
    manifestPath: result.manifestPath,
  });

  for (const command of uploadCommands) {
    await runCommand(wranglerInvocation.command, [
      ...wranglerInvocation.argsPrefix,
      ...command,
    ]);
  }

  return {
    ...result,
    r2Bucket: options.r2Bucket,
    uploadedObjects: uploadCommands.map(
      (command) => command[command.indexOf("put") + 1] ?? "",
    ),
  };
}

export function getDatasetObjectKey(
  league: string,
  patch: string,
  r2Prefix = "datasets",
) {
  return `${r2Prefix}/${league}/${patch}.json`;
}

export function getDatasetManifestKey(
  league: string,
  patch: string,
  r2Prefix = "datasets",
) {
  return `${r2Prefix}/${league}/${patch}.manifest.json`;
}

export function getR2UploadCommands({
  r2Bucket,
  artifactObjectKey,
  artifactPath,
  manifestObjectKey,
  manifestPath,
}: {
  r2Bucket: string;
  artifactObjectKey: string;
  artifactPath: string;
  manifestObjectKey: string;
  manifestPath: string;
}) {
  return [
    [
      "r2",
      "object",
      "put",
      `${r2Bucket}/${artifactObjectKey}`,
      "--file",
      artifactPath,
      "--content-type",
      "application/json",
      "--remote",
    ],
    [
      "r2",
      "object",
      "put",
      `${r2Bucket}/${manifestObjectKey}`,
      "--file",
      manifestPath,
      "--content-type",
      "application/json",
      "--remote",
    ],
  ];
}

function getDatasetCounts(artifact: DatasetArtifact) {
  return {
    items: artifact.items.length,
    uniques: artifact.uniques.length,
    mods: artifact.mods.length,
    gems: artifact.gems.length,
    economy: artifact.economy.length,
    ladderBuilds: artifact.ladderBuilds.length,
  };
}

function getUniqueImageCoverage(
  artifact: DatasetArtifact,
  options: DatasetImportOptions,
): UniqueImageCoverage | undefined {
  if (options.expectedUniqueCount === undefined) {
    return undefined;
  }

  const minimum = options.minimumUniqueImageCoverage ?? 0.95;
  const coverage = {
    resolved: artifact.uniques.length,
    expected: options.expectedUniqueCount,
    ratio:
      options.expectedUniqueCount === 0
        ? 1
        : artifact.uniques.length / options.expectedUniqueCount,
    minimum,
  };

  if (coverage.ratio < coverage.minimum) {
    throw new Error(
      `Unique image coverage ${formatPercent(coverage.ratio)} is below required ${formatPercent(coverage.minimum)}.`,
    );
  }

  return coverage;
}

function validateUniqueImageCoverageGate(
  artifact: DatasetArtifact,
  coverage: UniqueImageCoverage | undefined,
) {
  if (!coverage) {
    return;
  }

  const ratio =
    coverage.expected === 0 ? 1 : coverage.resolved / coverage.expected;

  if (
    coverage.resolved !== artifact.uniques.length ||
    coverage.ratio !== ratio ||
    coverage.ratio < coverage.minimum
  ) {
    throw new Error("Dataset manifest unique image coverage mismatch");
  }
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

async function readAndValidateManifest(
  manifestPath: string,
  rawArtifact: string,
  artifact: DatasetArtifact,
  counts: ReturnType<typeof getDatasetCounts>,
) {
  const rawManifest = await readFile(manifestPath, "utf8");
  const manifest = datasetManifestSchema.parse(
    JSON.parse(rawManifest.replace(/^\uFEFF/, "")),
  );
  const sha256 = createHash("sha256").update(rawArtifact).digest("hex");

  if (manifest.sha256 !== sha256) {
    throw new Error("Dataset manifest checksum mismatch");
  }

  if (
    manifest.league !== artifact.league ||
    manifest.patch !== artifact.patch ||
    manifest.generatedAt !== artifact.generatedAt
  ) {
    throw new Error("Dataset manifest version mismatch");
  }

  if (JSON.stringify(manifest.sources) !== JSON.stringify(artifact.sources)) {
    throw new Error("Dataset manifest source attribution mismatch");
  }

  validateUniqueImageCoverageGate(
    artifact,
    manifest.qualityGates?.uniqueImageCoverage,
  );

  if (JSON.stringify(manifest.counts) !== JSON.stringify(counts)) {
    throw new Error("Dataset manifest counts mismatch");
  }

  return manifest;
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
