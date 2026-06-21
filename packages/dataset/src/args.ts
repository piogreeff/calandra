export type DatasetCliOptions = {
  artifactPath: string;
  manifestPath?: string;
  publishDirectory?: string;
  r2Prefix?: string;
  expectedUniqueCount?: number;
  minimumUniqueImageCoverage?: number;
};

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

  const artifactPath = getFlagValue(args, "--artifact");

  if (!artifactPath) {
    throw new Error(
      "Usage: pnpm dataset:import -- --artifact <path-to-published-artifact.json> [--publish-dir <dir>]",
    );
  }

  const publishDirectory = getFlagValue(args, "--publish-dir");
  const r2Prefix = getFlagValue(args, "--r2-prefix");
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
