import type {
  DatasetImportResult,
  DatasetPublishResult,
  DatasetR2PublishResult,
} from "./import";

export function formatDatasetCliResult(
  result: DatasetImportResult | DatasetPublishResult | DatasetR2PublishResult,
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
    ...(isDatasetR2PublishResult(result)
      ? {
          r2Bucket: result.r2Bucket,
          uploadedObjects: result.uploadedObjects,
        }
      : {}),
  };
}

function isDatasetPublishResult(
  result: DatasetImportResult | DatasetPublishResult | DatasetR2PublishResult,
): result is DatasetPublishResult {
  return "objectKey" in result;
}

function isDatasetR2PublishResult(
  result: DatasetImportResult | DatasetPublishResult | DatasetR2PublishResult,
): result is DatasetR2PublishResult {
  return "r2Bucket" in result;
}
