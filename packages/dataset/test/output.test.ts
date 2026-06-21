import { describe, expect, it } from "vitest";
import { type DatasetSource } from "@calandra/contract";
import { formatDatasetCliResult } from "../src/output";

const datasetSources: DatasetSource[] = [
  {
    kind: "game-data",
    name: "poe2db.tw",
    url: "https://poe2db.tw/",
    attribution:
      "Game data derived from Path of Exile 2 community references; Path of Exile 2 is property of Grinding Gear Games.",
  },
];

describe("dataset CLI output", () => {
  it("includes publish manifest fields when present", () => {
    expect(
      formatDatasetCliResult({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        generatedAt: "2026-06-21T00:00:00.000Z",
        counts: {
          items: 0,
          uniques: 0,
          mods: 0,
          gems: 0,
          economy: 0,
          ladderBuilds: 0,
        },
        artifact: {
          league: "Dawn of the Hunt",
          patch: "0.2.0",
          generatedAt: "2026-06-21T00:00:00.000Z",
          source: "published-artifact",
          sources: datasetSources,
          items: [],
          uniques: [],
          mods: [],
          gems: [],
          economy: [],
          ladderBuilds: [],
        },
        objectKey: "datasets/Dawn of the Hunt/0.2.0.json",
        outputPath: "publish/datasets/Dawn of the Hunt/0.2.0.json",
        manifestKey: "datasets/Dawn of the Hunt/0.2.0.manifest.json",
        manifestPath: "publish/datasets/Dawn of the Hunt/0.2.0.manifest.json",
        sha256: "abc123",
      }),
    ).toMatchObject({
      objectKey: "datasets/Dawn of the Hunt/0.2.0.json",
      manifestKey: "datasets/Dawn of the Hunt/0.2.0.manifest.json",
      manifestPath: "publish/datasets/Dawn of the Hunt/0.2.0.manifest.json",
      sha256: "abc123",
    });
  });

  it("includes unique image coverage when calculated", () => {
    expect(
      formatDatasetCliResult({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        generatedAt: "2026-06-21T00:00:00.000Z",
        counts: {
          items: 0,
          uniques: 19,
          mods: 0,
          gems: 0,
          economy: 0,
          ladderBuilds: 0,
        },
        artifact: {
          league: "Dawn of the Hunt",
          patch: "0.2.0",
          generatedAt: "2026-06-21T00:00:00.000Z",
          source: "published-artifact",
          sources: datasetSources,
          items: [],
          uniques: [],
          mods: [],
          gems: [],
          economy: [],
          ladderBuilds: [],
        },
        uniqueImageCoverage: {
          resolved: 19,
          expected: 20,
          ratio: 0.95,
          minimum: 0.95,
        },
      }),
    ).toMatchObject({
      uniqueImageCoverage: {
        resolved: 19,
        expected: 20,
        ratio: 0.95,
        minimum: 0.95,
      },
    });
  });

  it("includes R2 upload details when present", () => {
    expect(
      formatDatasetCliResult({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        generatedAt: "2026-06-21T00:00:00.000Z",
        counts: {
          items: 0,
          uniques: 0,
          mods: 0,
          gems: 0,
          economy: 0,
          ladderBuilds: 0,
        },
        artifact: {
          league: "Dawn of the Hunt",
          patch: "0.2.0",
          generatedAt: "2026-06-21T00:00:00.000Z",
          source: "published-artifact",
          sources: datasetSources,
          items: [],
          uniques: [],
          mods: [],
          gems: [],
          economy: [],
          ladderBuilds: [],
        },
        objectKey: "datasets/Dawn of the Hunt/0.2.0.json",
        outputPath: "publish/datasets/Dawn of the Hunt/0.2.0.json",
        manifestKey: "datasets/Dawn of the Hunt/0.2.0.manifest.json",
        manifestPath: "publish/datasets/Dawn of the Hunt/0.2.0.manifest.json",
        sha256: "abc123",
        r2Bucket: "calandra-data",
        uploadedObjects: [
          "calandra-data/datasets/Dawn of the Hunt/0.2.0.json",
          "calandra-data/datasets/Dawn of the Hunt/0.2.0.manifest.json",
        ],
      }),
    ).toMatchObject({
      r2Bucket: "calandra-data",
      uploadedObjects: [
        "calandra-data/datasets/Dawn of the Hunt/0.2.0.json",
        "calandra-data/datasets/Dawn of the Hunt/0.2.0.manifest.json",
      ],
    });
  });
});
