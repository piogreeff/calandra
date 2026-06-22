import { describe, expect, it } from "vitest";
import {
  getMaintainerIngestionSources,
  validateMaintainerIngestionRequest,
} from "../src/maintainer";

describe("maintainer ingestion source policy", () => {
  it("allows the maintainer pipeline to declare poe2db and poe.ninja sources", () => {
    expect(
      validateMaintainerIngestionRequest({
        executionContext: "maintainer",
        sourceUrls: ["https://poe2db.tw/us/", "https://poe.ninja/poe2"],
      }),
    ).toEqual({
      executionContext: "maintainer",
      sources: [
        { kind: "game-data", host: "poe2db.tw", url: "https://poe2db.tw/us/" },
        { kind: "ladder", host: "poe.ninja", url: "https://poe.ninja/poe2" },
      ],
    });
  });

  it("rejects client and self-host ingestion attempts", () => {
    expect(() =>
      validateMaintainerIngestionRequest({
        executionContext: "self-host",
        sourceUrls: ["https://poe2db.tw/us/"],
      }),
    ).toThrow(
      "Dataset ingestion sources are maintainer-only; clients and self-hosts must consume published artifacts.",
    );
  });

  it("rejects banned build-guide sites even for maintainer ingestion", () => {
    expect(() =>
      validateMaintainerIngestionRequest({
        executionContext: "maintainer",
        sourceUrls: ["https://mobalytics.gg/poe-2/unique-items"],
      }),
    ).toThrow("Dataset ingestion may not use Mobalytics or Maxroll sources.");

    expect(() =>
      validateMaintainerIngestionRequest({
        executionContext: "maintainer",
        sourceUrls: ["https://maxroll.gg/poe2/planner"],
      }),
    ).toThrow("Dataset ingestion may not use Mobalytics or Maxroll sources.");
  });

  it("exposes the default source allowlist for scheduled maintainer jobs", () => {
    expect(getMaintainerIngestionSources()).toEqual([
      { kind: "game-data", host: "poe2db.tw", url: "https://poe2db.tw/" },
      { kind: "ladder", host: "poe.ninja", url: "https://poe.ninja/poe2" },
    ]);
  });
});
