export type DatasetArtifactCliOptions = {
  artifactPath: string;
  manifestPath?: string;
  publishDirectory?: string;
  r2Prefix?: string;
  r2Bucket?: string;
  wranglerCommand?: string;
  expectedUniqueCount?: number;
  minimumUniqueImageCoverage?: number;
};

export type MaintainerArtifactBuildCliOptions = {
  mode: "build-artifact";
  normalizedPath: string;
  outputArtifactPath: string;
  executionContext: "maintainer" | "client" | "self-host";
  sourceUrls: string[];
};

export type MaintainerIconCacheCliOptions = {
  mode: "cache-icons";
  artifactPath: string;
  iconCacheDirectory: string;
  executionContext: "maintainer" | "client" | "self-host";
};

export type DatasetCliOptions =
  | DatasetArtifactCliOptions
  | MaintainerArtifactBuildCliOptions
  | MaintainerIconCacheCliOptions;

export function parseDatasetCliArgs(args: string[]): DatasetCliOptions {
  const scrapeFlag = args.find(
    (argument) =>
      argument.startsWith("--scrape") || argument.startsWith("--target"),
  );

  if (scrapeFlag) {
    throw new Error(
      "Self-host imports must consume a published dataset artifact; scraper targets are maintainer-only.",
    );
  }

  const normalizedPath = getFlagValue(args, "--maintainer-normalized");
  if (normalizedPath) {
    const outputArtifactPath = getFlagValue(args, "--output-artifact");
    const executionContext = getFlagValue(args, "--execution-context");
    const sourceUrls = getFlagValues(args, "--source-url");

    if (!outputArtifactPath || !executionContext || sourceUrls.length === 0) {
      throw new Error(
        "Usage: pnpm dataset:import -- --maintainer-normalized <path> --output-artifact <path> --execution-context maintainer --source-url <url>",
      );
    }

    if (!isDatasetExecutionContext(executionContext)) {
      throw new Error("--execution-context must be maintainer, client, or self-host");
    }

    return {
      mode: "build-artifact",
      normalizedPath,
      outputArtifactPath,
      executionContext,
      sourceUrls,
    };
  }

  if (args.includes("--cache-icons")) {
    const artifactPath = getFlagValue(args, "--artifact");
    const iconCacheDirectory = getFlagValue(args, "--icon-cache-dir");
    const executionContext = getFlagValue(args, "--execution-context");

    if (!artifactPath || !iconCacheDirectory || !executionContext) {
      throw new Error(
        "Usage: pnpm dataset:import -- --cache-icons --artifact <path> --icon-cache-dir <dir> --execution-context maintainer",
      );
    }

    if (!isDatasetExecutionContext(executionContext)) {
      throw new Error(
        "--execution-context must be maintainer, client, or self-host",
      );
    }

    return {
      mode: "cache-icons",
      artifactPath,
      iconCacheDirectory,
      executionContext,
    };
  }

  const artifactPath = getFlagValue(args, "--artifact");

  if (!artifactPath) {
    throw new Error(
      "Usage: pnpm dataset:import -- --artifact <path-to-published-artifact.json> [--publish-dir <dir>] [--r2-bucket <bucket>]",
    );
  }

  const publishDirectory = getFlagValue(args, "--publish-dir");
  const r2Prefix = getFlagValue(args, "--r2-prefix");
  const r2Bucket = getFlagValue(args, "--r2-bucket");
  const wranglerCommand = getFlagValue(args, "--wrangler-command");
  const manifestPath = getFlagValue(args, "--manifest");
  const expectedUniqueCount = getOptionalNumberFlag(
    args,
    "--expected-unique-count",
  );
  const minimumUniqueImageCoverage = getOptionalNumberFlag(
    args,
    "--minimum-unique-image-coverage",
  );

  return {
    artifactPath,
    ...(manifestPath ? { manifestPath } : {}),
    ...(publishDirectory ? { publishDirectory } : {}),
    ...(r2Prefix ? { r2Prefix } : {}),
    ...(r2Bucket ? { r2Bucket } : {}),
    ...(wranglerCommand ? { wranglerCommand } : {}),
    ...(expectedUniqueCount !== undefined ? { expectedUniqueCount } : {}),
    ...(minimumUniqueImageCoverage !== undefined
      ? { minimumUniqueImageCoverage }
      : {}),
  };
}

function getFlagValue(args: string[], flag: string) {
  const index = args.indexOf(flag);

  return index >= 0 ? args[index + 1] : undefined;
}

function getFlagValues(args: string[], flag: string) {
  const values: string[] = [];

  args.forEach((argument, index) => {
    const value = args[index + 1];

    if (argument === flag && value) {
      values.push(value);
    }
  });

  return values;
}

function getOptionalNumberFlag(args: string[], flag: string) {
  const value = getFlagValue(args, flag);

  if (value === undefined) {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${flag} must be a number`);
  }

  return parsed;
}

function isDatasetExecutionContext(
  value: string,
): value is MaintainerArtifactBuildCliOptions["executionContext"] {
  return value === "maintainer" || value === "client" || value === "self-host";
}
