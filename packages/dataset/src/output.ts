import type { DatasetImportResult, DatasetPublishResult } from "./import";

export function formatDatasetCliResult(
  result: DatasetImportResult | DatasetPublishResult,
) {
  return {
    league: result.league,
    patch: result.patch,
    generatedAt: result.generatedAt,
    counts: result.counts,
    ...(result.uniqueImageCoverage
      ? { uniqueImageCoverage: result.uniqueImageCoverage }
      : {}),
    ...(isDatasetPublishResult(result)
      ? {
          objectKey: result.objectKey,
          outputPath: result.outputPath,
          manifestKey: result.manifestKey,
          manifestPath: result.manifestPath,
          sha256: result.sha256,
        }
      : {}),
  };
}

function isDatasetPublishResult(
  result: DatasetImportResult | DatasetPublishResult,
): result is DatasetPublishResult {
  return "objectKey" in result;
}
