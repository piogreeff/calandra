import { parseDatasetCliArgs } from "./args";
import { importDatasetArtifact, publishDatasetArtifact } from "./import";
import { formatDatasetCliResult } from "./output";

const options = parseDatasetCliArgs(process.argv.slice(2));

const result = options.publishDirectory
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
