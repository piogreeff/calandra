import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  buildMaintainerDatasetArtifact,
  writeMaintainerDatasetArtifact,
} from "../src/build-artifact";
import { importDatasetArtifact } from "../src/import";

describe("maintainer dataset artifact builder", () => {
  it("builds a patch-versioned artifact from maintainer-normalized records", async () => {
    const artifact = buildMaintainerDatasetArtifact({
      executionContext: "maintainer",
      sourceUrls: ["https://poe2db.tw/us/", "https://poe.ninja/poe2"],
      normalized: {
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        generatedAt: "2026-06-22T00:00:00.000Z",
        items: [
          {
            id: "advanced-altar-robe",
            name: "Advanced Altar Robe",
            category: "body-armour",
            rarity: "normal",
          },
        ],
        uniques: [
          {
            id: "choir-of-the-storm",
            name: "Choir of the Storm",
            category: "amulet",
            rarity: "unique",
            iconUrl:
              "https://calandra-assets.example/images/Dawn%20of%20the%20Hunt/0.2.0/uniques/choir-of-the-storm.png",
            iconSourceUrl:
              "https://web.poecdn.com/image/Art/2DItems/Amulets/Choir.png",
            iconCacheKey:
              "images/Dawn of the Hunt/0.2.0/uniques/choir-of-the-storm.png",
            iconAttribution:
              "Game art and item data are property of Grinding Gear Games.",
          },
        ],
        mods: [],
        gems: [],
        economy: [
          {
            id: "divine-orb",
            name: "Divine Orb",
            chaosEquivalent: 142,
            updatedAt: "2026-06-22T00:00:00.000Z",
          },
        ],
        ladderBuilds: [
          {
            id: "deadeye-1",
            account: "example",
            character: "CalandraTest",
            className: "Deadeye",
            level: 92,
          },
        ],
      },
    });

    expect(artifact).toMatchObject({
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      source: "published-artifact",
      items: [{ id: "advanced-altar-robe" }],
      uniques: [{ id: "choir-of-the-storm" }],
      economy: [{ id: "divine-orb" }],
      ladderBuilds: [{ id: "deadeye-1" }],
    });
    expect(artifact.sources).toEqual([
      expect.objectContaining({ kind: "game-data", name: "poe2db.tw" }),
      expect.objectContaining({ kind: "economy", name: "poe.ninja" }),
      expect.objectContaining({
        kind: "image",
        name: "Grinding Gear Games CDN",
      }),
    ]);
  });

  it("rejects non-maintainer normalized artifact builds", () => {
    expect(() =>
      buildMaintainerDatasetArtifact({
        executionContext: "self-host",
        sourceUrls: ["https://poe2db.tw/us/"],
        normalized: {
          league: "Dawn of the Hunt",
          patch: "0.2.0",
          generatedAt: "2026-06-22T00:00:00.000Z",
        },
      }),
    ).toThrow("Dataset ingestion sources are maintainer-only");
  });

  it("writes importable published artifacts for the existing publish path", async () => {
    const directory = await mkdtemp(join(tmpdir(), "calandra-build-artifact-"));
    const artifactPath = join(directory, "artifact.json");

    await writeMaintainerDatasetArtifact({
      outputPath: artifactPath,
      executionContext: "maintainer",
      sourceUrls: ["https://poe2db.tw/us/"],
      normalized: {
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        generatedAt: "2026-06-22T00:00:00.000Z",
      },
    });

    const raw = await readFile(artifactPath, "utf8");
    expect(JSON.parse(raw)).toMatchObject({
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      source: "published-artifact",
      items: [],
      uniques: [],
    });
    await expect(importDatasetArtifact({ artifactPath })).resolves.toMatchObject(
      {
        counts: {
          items: 0,
          uniques: 0,
          mods: 0,
          gems: 0,
          economy: 0,
          ladderBuilds: 0,
        },
      },
    );
  });
});
