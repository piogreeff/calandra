import { parseDatasetCliArgs } from "./args";
import {
  readMaintainerNormalizedDataset,
  writeMaintainerDatasetArtifact,
} from "./build-artifact";
import {
  importDatasetArtifact,
  publishDatasetArtifact,
  publishDatasetArtifactToR2,
} from "./import";
import { cacheDatasetIcons, readDatasetArtifact } from "./icon-cache";
import { formatDatasetCliResult } from "./output";

const options = parseDatasetCliArgs(process.argv.slice(2));

if ("mode" in options && options.mode === "cache-icons") {
  const result = await cacheDatasetIcons({
    artifact: await readDatasetArtifact(options.artifactPath),
    outputDirectory: options.iconCacheDirectory,
    executionContext: options.executionContext,
  });

  console.log(
    JSON.stringify(
      {
        manifestPath: result.manifestPath,
        cached: result.cached.length,
      },
      null,
      2,
    ),
  );
} else if ("artifactPath" in options) {
  const result = options.r2Bucket
    ? await publishDatasetArtifactToR2({
        artifactPath: options.artifactPath,
        ...(options.manifestPath ? { manifestPath: options.manifestPath } : {}),
        ...(options.publishDirectory
          ? { publishDirectory: options.publishDirectory }
          : {}),
        ...(options.r2Prefix ? { r2Prefix: options.r2Prefix } : {}),
        r2Bucket: options.r2Bucket,
        ...(options.wranglerCommand
          ? { wranglerCommand: options.wranglerCommand }
          : {}),
        ...(options.expectedUniqueCount !== undefined
          ? { expectedUniqueCount: options.expectedUniqueCount }
          : {}),
        ...(options.minimumUniqueImageCoverage !== undefined
          ? { minimumUniqueImageCoverage: options.minimumUniqueImageCoverage }
          : {}),
      })
    : options.publishDirectory
    ? await publishDatasetArtifact({
        artifactPath: options.artifactPath,
        ...(options.manifestPath ? { manifestPath: options.manifestPath } : {}),
        publishDirectory: options.publishDirectory,
        ...(options.r2Prefix ? { r2Prefix: options.r2Prefix } : {}),
        ...(options.expectedUniqueCount !== undefined
          ? { expectedUniqueCount: options.expectedUniqueCount }
          : {}),
        ...(options.minimumUniqueImageCoverage !== undefined
          ? { minimumUniqueImageCoverage: options.minimumUniqueImageCoverage }
          : {}),
      })
    : await importDatasetArtifact({
        artifactPath: options.artifactPath,
        ...(options.manifestPath ? { manifestPath: options.manifestPath } : {}),
        ...(options.expectedUniqueCount !== undefined
          ? { expectedUniqueCount: options.expectedUniqueCount }
          : {}),
        ...(options.minimumUniqueImageCoverage !== undefined
          ? { minimumUniqueImageCoverage: options.minimumUniqueImageCoverage }
          : {}),
      });

  console.log(JSON.stringify(formatDatasetCliResult(result), null, 2));
} else {
  const artifact = await writeMaintainerDatasetArtifact({
    outputPath: options.outputArtifactPath,
    executionContext: options.executionContext,
    sourceUrls: options.sourceUrls,
    normalized: await readMaintainerNormalizedDataset(options.normalizedPath),
  });

  console.log(
    JSON.stringify(
      {
        artifactPath: options.outputArtifactPath,
        league: artifact.league,
        patch: artifact.patch,
        counts: {
          items: artifact.items.length,
          uniques: artifact.uniques.length,
          mods: artifact.mods.length,
          gems: artifact.gems.length,
          economy: artifact.economy.length,
          ladderBuilds: artifact.ladderBuilds.length,
        },
      },
      null,
      2,
    ),
  );
}
