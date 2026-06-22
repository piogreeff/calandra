import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { DatasetArtifact } from "@calandra/contract";
import { describe, expect, it } from "vitest";
import { cacheDatasetIcons } from "../src/icon-cache";

const artifact: DatasetArtifact = {
  league: "Dawn of the Hunt",
  patch: "0.2.0",
  generatedAt: "2026-06-22T00:00:00.000Z",
  source: "published-artifact",
  sources: [
    {
      kind: "game-data",
      name: "poe2db.tw",
      url: "https://poe2db.tw/",
      attribution:
        "Game data derived from Path of Exile 2 community references; Path of Exile 2 is property of Grinding Gear Games.",
    },
    {
      kind: "image",
      name: "Grinding Gear Games CDN",
      url: "https://web.poecdn.com/",
      attribution:
        "Item art is property of Grinding Gear Games and is cached for attribution-preserving display.",
    },
  ],
  items: [],
  uniques: [
    {
      id: "choir-of-the-storm",
      name: "Choir of the Storm",
      category: "amulet",
      rarity: "unique",
      iconUrl:
        "https://calandra-assets.example/images/Dawn%20of%20the%20Hunt/0.2.0/uniques/choir-of-the-storm.png",
      iconSourceUrl: "https://web.poecdn.com/image/choir.png",
      iconCacheKey:
        "images/Dawn of the Hunt/0.2.0/uniques/choir-of-the-storm.png",
      iconAttribution:
        "Game art and item data are property of Grinding Gear Games.",
    },
  ],
  mods: [],
  gems: [],
  economy: [],
  ladderBuilds: [],
};

describe("maintainer icon cache", () => {
  it("caches artifact icon source images and writes attribution metadata", async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), "calandra-icons-"));
    const calls: string[] = [];

    const result = await cacheDatasetIcons({
      artifact,
      outputDirectory,
      executionContext: "maintainer",
      fetchIcon: async (url) => {
        calls.push(url);
        return {
          ok: true,
          status: 200,
          headers: { get: () => "image/png" },
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        };
      },
    });

    expect(calls).toEqual(["https://web.poecdn.com/image/choir.png"]);
    expect(result.cached).toEqual([
      expect.objectContaining({
        itemId: "choir-of-the-storm",
        cacheKey:
          "images/Dawn of the Hunt/0.2.0/uniques/choir-of-the-storm.png",
        sourceUrl: "https://web.poecdn.com/image/choir.png",
        bytes: 3,
        contentType: "image/png",
      }),
    ]);
    await expect(
      readFile(
        join(
          outputDirectory,
          "images",
          "Dawn of the Hunt",
          "0.2.0",
          "uniques",
          "choir-of-the-storm.png",
        ),
      ),
    ).resolves.toEqual(Buffer.from([1, 2, 3]));
    await expect(
      readFile(join(outputDirectory, "icon-cache.manifest.json"), "utf8"),
    ).resolves.toContain("Grinding Gear Games");
  });

  it("rejects icon caching outside the maintainer pipeline", async () => {
    await expect(
      cacheDatasetIcons({
        artifact,
        outputDirectory: await mkdtemp(join(tmpdir(), "calandra-icons-")),
        executionContext: "self-host",
        fetchIcon: async () => {
          throw new Error("should not fetch");
        },
      }),
    ).rejects.toThrow("Icon caching is maintainer-only");
  });
});
