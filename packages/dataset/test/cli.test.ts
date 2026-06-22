import { describe, expect, it } from "vitest";
import { parseDatasetCliArgs } from "../src/args";

describe("dataset CLI args", () => {
  it("parses artifact publish options", () => {
    expect(
      parseDatasetCliArgs([
        "--artifact",
        "source.json",
        "--manifest",
        "source.manifest.json",
        "--publish-dir",
        "publish",
        "--r2-prefix",
        "datasets",
        "--r2-bucket",
        "calandra-data",
        "--wrangler-command",
        "wrangler",
        "--expected-unique-count",
        "20",
        "--minimum-unique-image-coverage",
        "0.95",
      ]),
    ).toEqual({
      artifactPath: "source.json",
      manifestPath: "source.manifest.json",
      publishDirectory: "publish",
      r2Prefix: "datasets",
      r2Bucket: "calandra-data",
      wranglerCommand: "wrangler",
      expectedUniqueCount: 20,
      minimumUniqueImageCoverage: 0.95,
    });
  });

  it("parses maintainer-normalized artifact build options", () => {
    expect(
      parseDatasetCliArgs([
        "--maintainer-normalized",
        "normalized.json",
        "--output-artifact",
        "artifact.json",
        "--execution-context",
        "maintainer",
        "--source-url",
        "https://poe2db.tw/us/",
        "--source-url",
        "https://poe.ninja/poe2",
      ]),
    ).toEqual({
      mode: "build-artifact",
      normalizedPath: "normalized.json",
      outputArtifactPath: "artifact.json",
      executionContext: "maintainer",
      sourceUrls: ["https://poe2db.tw/us/", "https://poe.ninja/poe2"],
    });
  });

  it("parses maintainer icon cache options", () => {
    expect(
      parseDatasetCliArgs([
        "--cache-icons",
        "--artifact",
        "artifact.json",
        "--icon-cache-dir",
        "dist/icons",
        "--execution-context",
        "maintainer",
      ]),
    ).toEqual({
      mode: "cache-icons",
      artifactPath: "artifact.json",
      iconCacheDirectory: "dist/icons",
      executionContext: "maintainer",
    });
  });

  it("rejects scraper-like flags", () => {
    expect(() =>
      parseDatasetCliArgs([
        "--artifact",
        "source.json",
        "--scrape-target",
        "https://poe2db.tw",
      ]),
    ).toThrow("Self-host imports must consume a published dataset artifact");
  });

  it("rejects invalid numeric coverage flags", () => {
    expect(() =>
      parseDatasetCliArgs([
        "--artifact",
        "source.json",
        "--expected-unique-count",
        "many",
      ]),
    ).toThrow("--expected-unique-count must be a number");
  });
});
