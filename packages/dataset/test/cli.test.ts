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
