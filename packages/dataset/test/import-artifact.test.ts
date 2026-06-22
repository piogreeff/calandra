import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  getR2UploadCommands,
  importDatasetArtifact,
  publishDatasetArtifact,
  publishDatasetArtifactToR2,
  validateImportOptions,
} from "../src/import";

const datasetSources = [
  {
    kind: "game-data",
    name: "poe2db.tw",
    url: "https://poe2db.tw/",
    attribution:
      "Game data derived from Path of Exile 2 community references; Path of Exile 2 is property of Grinding Gear Games.",
  },
] as const;

describe("dataset artifact import", () => {
  it("loads a published artifact without scraper configuration", async () => {
    const directory = await mkdtemp(join(tmpdir(), "calandra-dataset-"));
    const artifactPath = join(directory, "dawn-0.2.0.json");

    await writeFile(
      artifactPath,
      JSON.stringify({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        generatedAt: "2026-06-21T00:00:00.000Z",
        source: "published-artifact",
        sources: datasetSources,
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
            iconUrl: "https://web.poecdn.com/image/example.png",
            iconAttribution:
              "Game art and item data are property of Grinding Gear Games.",
          },
        ],
        mods: [
          {
            id: "mod-life-1",
            name: "+# to maximum Life",
            domain: "item",
            generationType: "prefix",
            family: "Life",
            minItemLevel: 1,
            tier: 1,
            tags: ["life"],
            stats: [
              {
                id: "base_maximum_life",
                text: "+# to maximum Life",
                min: 80,
                max: 99,
              },
            ],
          },
        ],
        gems: [
          {
            id: "spark",
            name: "Spark",
            kind: "skill",
            level: 1,
            requiredLevel: 1,
            tags: ["spell", "lightning"],
            attributeRequirements: { intelligence: 10 },
          },
        ],
        economy: [
          {
            id: "divine-orb",
            name: "Divine Orb",
            chaosEquivalent: 142,
            updatedAt: "2026-06-21T00:00:00.000Z",
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
      }),
      "utf8",
    );

    const result = await importDatasetArtifact({ artifactPath });

    expect(result.league).toBe("Dawn of the Hunt");
    expect(result.patch).toBe("0.2.0");
    expect(result.counts).toEqual({
      items: 1,
      uniques: 1,
      mods: 1,
      gems: 1,
      economy: 1,
      ladderBuilds: 1,
    });
    expect(result.artifact.mods[0]?.stats?.[0]).toMatchObject({
      id: "base_maximum_life",
      min: 80,
      max: 99,
    });
    expect(result.artifact.gems[0]?.attributeRequirements).toEqual({
      intelligence: 10,
    });
  });

  it("accepts UTF-8 BOM-prefixed artifact files written by Windows tools", async () => {
    const directory = await mkdtemp(join(tmpdir(), "calandra-dataset-"));
    const artifactPath = join(directory, "windows-artifact.json");

    await writeFile(
      artifactPath,
      `\uFEFF${JSON.stringify({
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
      })}`,
      "utf8",
    );

    const result = await importDatasetArtifact({ artifactPath });

    expect(result.counts.items).toBe(0);
    expect(result.league).toBe("Dawn of the Hunt");
  });

  it("rejects scraper configuration in the self-host import path", () => {
    expect(() =>
      validateImportOptions({
        artifactPath: "dataset.json",
        scrapeTarget: "https://poe2db.tw",
      }),
    ).toThrow("Self-host imports must consume a published dataset artifact");
  });

  it("reports unique image coverage against the expected published unique count", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "calandra-dataset-coverage-"),
    );
    const artifactPath = join(directory, "artifact.json");

    await writeFile(
      artifactPath,
      JSON.stringify({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        generatedAt: "2026-06-21T00:00:00.000Z",
        source: "published-artifact",
        sources: datasetSources,
        items: [],
        uniques: makeUniques(19),
        mods: [],
        gems: [],
        economy: [],
        ladderBuilds: [],
      }),
      "utf8",
    );

    const result = await importDatasetArtifact({
      artifactPath,
      expectedUniqueCount: 20,
      minimumUniqueImageCoverage: 0.95,
    });

    expect(result.uniqueImageCoverage).toEqual({
      resolved: 19,
      expected: 20,
      ratio: 0.95,
      minimum: 0.95,
    });
  });

  it("rejects a published artifact below the required unique image coverage", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "calandra-dataset-low-coverage-"),
    );
    const artifactPath = join(directory, "artifact.json");

    await writeFile(
      artifactPath,
      JSON.stringify({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        generatedAt: "2026-06-21T00:00:00.000Z",
        source: "published-artifact",
        sources: datasetSources,
        items: [],
        uniques: makeUniques(18),
        mods: [],
        gems: [],
        economy: [],
        ladderBuilds: [],
      }),
      "utf8",
    );

    await expect(
      importDatasetArtifact({
        artifactPath,
        expectedUniqueCount: 20,
        minimumUniqueImageCoverage: 0.95,
      }),
    ).rejects.toThrow("Unique image coverage 90.00% is below required 95.00%");
  });

  it("counts only uniques with HTTPS icon URLs as resolved image coverage", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "calandra-dataset-icon-coverage-"),
    );
    const artifactPath = join(directory, "artifact.json");

    await writeFile(
      artifactPath,
      JSON.stringify({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        generatedAt: "2026-06-21T00:00:00.000Z",
        source: "published-artifact",
        sources: datasetSources,
        items: [],
        uniques: [
          ...makeUniques(18),
          {
            id: "unique-with-insecure-icon",
            name: "Unique With Insecure Icon",
            category: "amulet",
            rarity: "unique",
            iconUrl: "http://web.poecdn.com/image/insecure-unique.png",
            iconAttribution:
              "Game art and item data are property of Grinding Gear Games.",
          },
        ],
        mods: [],
        gems: [],
        economy: [],
        ladderBuilds: [],
      }),
      "utf8",
    );

    await expect(
      importDatasetArtifact({
        artifactPath,
        expectedUniqueCount: 20,
        minimumUniqueImageCoverage: 0.95,
      }),
    ).rejects.toThrow("Unique image coverage 90.00% is below required 95.00%");
  });

  it("publishes an artifact into the same object layout the API reads from R2", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "calandra-dataset-publish-"),
    );
    const artifactPath = join(directory, "source.json");
    const publishDirectory = join(directory, "publish");

    await writeFile(
      artifactPath,
      JSON.stringify({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        generatedAt: "2026-06-21T00:00:00.000Z",
        source: "published-artifact",
        sources: datasetSources,
        items: [
          {
            id: "expert-siphoning-wand",
            name: "Expert Siphoning Wand",
            category: "wand",
            rarity: "magic",
          },
        ],
        uniques: [],
        mods: [],
        gems: [],
        economy: [],
        ladderBuilds: [],
      }),
      "utf8",
    );

    const result = await publishDatasetArtifact({
      artifactPath,
      publishDirectory,
      r2Prefix: "datasets",
    });

    expect(result.objectKey).toBe("datasets/Dawn of the Hunt/0.2.0.json");
    expect(result.outputPath).toBe(
      join(publishDirectory, "datasets", "Dawn of the Hunt", "0.2.0.json"),
    );
    expect(result.manifestKey).toBe(
      "datasets/Dawn of the Hunt/0.2.0.manifest.json",
    );
    expect(result.manifestPath).toBe(
      join(
        publishDirectory,
        "datasets",
        "Dawn of the Hunt",
        "0.2.0.manifest.json",
      ),
    );

    const publishedRaw = await readFile(result.outputPath, "utf8");
    const published = JSON.parse(publishedRaw);
    const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));

    expect(published.items).toEqual([
      {
        id: "expert-siphoning-wand",
        name: "Expert Siphoning Wand",
        category: "wand",
        rarity: "magic",
      },
    ]);
    expect(manifest).toMatchObject({
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      artifactKey: "datasets/Dawn of the Hunt/0.2.0.json",
      counts: {
        items: 1,
        uniques: 0,
        mods: 0,
        gems: 0,
        economy: 0,
        ladderBuilds: 0,
      },
    });
    expect(manifest.sha256).toBe(
      createHash("sha256").update(publishedRaw).digest("hex"),
    );
  });

  it("publishes a latest pointer for the selected league", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "calandra-dataset-latest-"),
    );
    const artifactPath = join(directory, "source.json");
    const publishDirectory = join(directory, "publish");

    await writeFile(
      artifactPath,
      JSON.stringify({
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
      }),
      "utf8",
    );

    const result = await publishDatasetArtifact({
      artifactPath,
      publishDirectory,
      r2Prefix: "datasets",
    });
    const latest = JSON.parse(await readFile(result.latestPath, "utf8"));

    expect(result.latestKey).toBe("datasets/Dawn of the Hunt/latest.json");
    expect(latest).toEqual({
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      generatedAt: "2026-06-21T00:00:00.000Z",
      artifactKey: "datasets/Dawn of the Hunt/0.2.0.json",
      manifestKey: "datasets/Dawn of the Hunt/0.2.0.manifest.json",
    });
  });

  it("preserves source attribution in published artifacts and manifests", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "calandra-dataset-provenance-"),
    );
    const artifactPath = join(directory, "source.json");
    const publishDirectory = join(directory, "publish");
    const sources = [
      {
        kind: "game-data",
        name: "poe2db.tw",
        url: "https://poe2db.tw/",
        attribution:
          "Game data derived from Path of Exile 2 community references; Path of Exile 2 is property of Grinding Gear Games.",
      },
      {
        kind: "economy",
        name: "poe.ninja",
        url: "https://poe.ninja/poe2",
        attribution:
          "Economy prices are derived from poe.ninja's Path of Exile 2 economy dataset.",
      },
    ];

    await writeFile(
      artifactPath,
      JSON.stringify({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        generatedAt: "2026-06-21T00:00:00.000Z",
        source: "published-artifact",
        sources,
        items: [],
        uniques: [],
        mods: [],
        gems: [],
        economy: [],
        ladderBuilds: [],
      }),
      "utf8",
    );

    const result = await publishDatasetArtifact({
      artifactPath,
      publishDirectory,
    });
    const published = JSON.parse(await readFile(result.outputPath, "utf8"));
    const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));

    expect(result.artifact.sources).toEqual(sources);
    expect(published.sources).toEqual(sources);
    expect(manifest.sources).toEqual(sources);
  });

  it("writes unique image coverage quality gates into published manifests", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "calandra-dataset-quality-"),
    );
    const artifactPath = join(directory, "source.json");
    const publishDirectory = join(directory, "publish");

    await writeFile(
      artifactPath,
      JSON.stringify({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        generatedAt: "2026-06-21T00:00:00.000Z",
        source: "published-artifact",
        sources: datasetSources,
        items: [],
        uniques: makeUniques(19),
        mods: [],
        gems: [],
        economy: [],
        ladderBuilds: [],
      }),
      "utf8",
    );

    const result = await publishDatasetArtifact({
      artifactPath,
      publishDirectory,
      expectedUniqueCount: 20,
      minimumUniqueImageCoverage: 0.95,
    });
    const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));

    expect(result.uniqueImageCoverage).toEqual({
      resolved: 19,
      expected: 20,
      ratio: 0.95,
      minimum: 0.95,
    });
    expect(manifest.qualityGates).toEqual({
      uniqueImageCoverage: {
        resolved: 19,
        expected: 20,
        ratio: 0.95,
        minimum: 0.95,
      },
    });
  });

  it("validates a published artifact against its manifest during import", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "calandra-dataset-verified-"),
    );
    const artifactPath = join(directory, "source.json");
    const publishDirectory = join(directory, "publish");

    await writeFile(
      artifactPath,
      JSON.stringify({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        generatedAt: "2026-06-21T00:00:00.000Z",
        source: "published-artifact",
        sources: datasetSources,
        items: [
          {
            id: "expert-siphoning-wand",
            name: "Expert Siphoning Wand",
            category: "wand",
            rarity: "magic",
          },
        ],
        uniques: [],
        mods: [],
        gems: [],
        economy: [],
        ladderBuilds: [],
      }),
      "utf8",
    );

    const published = await publishDatasetArtifact({
      artifactPath,
      publishDirectory,
    });
    const imported = await importDatasetArtifact({
      artifactPath: published.outputPath,
      manifestPath: published.manifestPath,
    });

    expect(imported.manifest).toMatchObject({
      artifactKey: "datasets/Dawn of the Hunt/0.2.0.json",
      sha256: published.sha256,
      sources: datasetSources,
      counts: { items: 1 },
    });
  });

  it("rejects a manifest that overstates resolved HTTPS unique images", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "calandra-dataset-bad-image-gate-"),
    );
    const artifactPath = join(directory, "artifact.json");
    const manifestPath = join(directory, "manifest.json");
    const artifact = {
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      generatedAt: "2026-06-21T00:00:00.000Z",
      source: "published-artifact",
      sources: datasetSources,
      items: [],
      uniques: [
        ...makeUniques(18),
        {
          id: "unique-with-insecure-icon",
          name: "Unique With Insecure Icon",
          category: "amulet",
          rarity: "unique",
          iconUrl: "http://web.poecdn.com/image/insecure-unique.png",
          iconAttribution:
            "Game art and item data are property of Grinding Gear Games.",
        },
      ],
      mods: [],
      gems: [],
      economy: [],
      ladderBuilds: [],
    };
    const artifactRaw = JSON.stringify(artifact);

    await writeFile(artifactPath, artifactRaw, "utf8");
    await writeFile(
      manifestPath,
      JSON.stringify({
        league: artifact.league,
        patch: artifact.patch,
        generatedAt: artifact.generatedAt,
        artifactKey: "datasets/Dawn of the Hunt/0.2.0.json",
        sha256: createHash("sha256").update(artifactRaw).digest("hex"),
        sources: datasetSources,
        counts: {
          items: 0,
          uniques: 19,
          mods: 0,
          gems: 0,
          economy: 0,
          ladderBuilds: 0,
        },
        qualityGates: {
          uniqueImageCoverage: {
            resolved: 19,
            expected: 20,
            ratio: 0.95,
            minimum: 0.95,
          },
        },
      }),
      "utf8",
    );

    await expect(
      importDatasetArtifact({ artifactPath, manifestPath }),
    ).rejects.toThrow("Dataset manifest unique image coverage mismatch");
  });

  it("publishes an artifact and manifest to R2 with Wrangler commands", async () => {
    const directory = await mkdtemp(join(tmpdir(), "calandra-dataset-r2-"));
    const artifactPath = join(directory, "source.json");
    const publishDirectory = join(directory, "publish");
    const commands: Array<{ command: string; args: string[] }> = [];

    await writeFile(
      artifactPath,
      JSON.stringify({
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
      }),
      "utf8",
    );

    const result = await publishDatasetArtifactToR2({
      artifactPath,
      publishDirectory,
      r2Bucket: "calandra-data",
      wranglerCommand: "wrangler",
      runCommand: async (command, args) => {
        commands.push({ command, args });
      },
    });

    expect(result.r2Bucket).toBe("calandra-data");
    expect(result.uploadedObjects).toEqual([
      "calandra-data/datasets/Dawn of the Hunt/0.2.0.json",
      "calandra-data/datasets/Dawn of the Hunt/0.2.0.manifest.json",
      "calandra-data/datasets/Dawn of the Hunt/latest.json",
    ]);
    expect(commands).toEqual([
      {
        command: "wrangler",
        args: [
          "r2",
          "object",
          "put",
          "calandra-data/datasets/Dawn of the Hunt/0.2.0.json",
          "--file",
          join(publishDirectory, "datasets", "Dawn of the Hunt", "0.2.0.json"),
          "--content-type",
          "application/json",
          "--remote",
        ],
      },
      {
        command: "wrangler",
        args: [
          "r2",
          "object",
          "put",
          "calandra-data/datasets/Dawn of the Hunt/0.2.0.manifest.json",
          "--file",
          join(
            publishDirectory,
            "datasets",
            "Dawn of the Hunt",
            "0.2.0.manifest.json",
          ),
          "--content-type",
          "application/json",
          "--remote",
        ],
      },
      {
        command: "wrangler",
        args: [
          "r2",
          "object",
          "put",
          "calandra-data/datasets/Dawn of the Hunt/latest.json",
          "--file",
          join(publishDirectory, "datasets", "Dawn of the Hunt", "latest.json"),
          "--content-type",
          "application/json",
          "--remote",
        ],
      },
    ]);
  });

  it("requires unique image coverage metadata before publishing uniques to R2", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "calandra-dataset-r2-coverage-"),
    );
    const artifactPath = join(directory, "source.json");
    const publishDirectory = join(directory, "publish");

    await writeFile(
      artifactPath,
      JSON.stringify({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        generatedAt: "2026-06-21T00:00:00.000Z",
        source: "published-artifact",
        sources: datasetSources,
        items: [],
        uniques: makeUniques(1),
        mods: [],
        gems: [],
        economy: [],
        ladderBuilds: [],
      }),
      "utf8",
    );

    await expect(
      publishDatasetArtifactToR2({
        artifactPath,
        publishDirectory,
        r2Bucket: "calandra-data",
        wranglerCommand: "wrangler",
        runCommand: async () => {
          throw new Error("R2 upload must not run without coverage metadata");
        },
      }),
    ).rejects.toThrow(
      "expectedUniqueCount is required before publishing unique item images to R2.",
    );
  });

  it("builds R2 upload commands for the artifact and manifest", () => {
    expect(
      getR2UploadCommands({
        r2Bucket: "calandra-data",
        artifactObjectKey: "datasets/Dawn of the Hunt/0.2.0.json",
        artifactPath: "publish/artifact.json",
        manifestObjectKey: "datasets/Dawn of the Hunt/0.2.0.manifest.json",
        manifestPath: "publish/manifest.json",
      }),
    ).toEqual([
      [
        "r2",
        "object",
        "put",
        "calandra-data/datasets/Dawn of the Hunt/0.2.0.json",
        "--file",
        "publish/artifact.json",
        "--content-type",
        "application/json",
        "--remote",
      ],
      [
        "r2",
        "object",
        "put",
        "calandra-data/datasets/Dawn of the Hunt/0.2.0.manifest.json",
        "--file",
        "publish/manifest.json",
        "--content-type",
        "application/json",
        "--remote",
      ],
    ]);
  });

  it("rejects an artifact when the manifest checksum does not match", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "calandra-dataset-bad-manifest-"),
    );
    const artifactPath = join(directory, "artifact.json");
    const manifestPath = join(directory, "manifest.json");

    await writeFile(
      artifactPath,
      JSON.stringify({
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
      }),
      "utf8",
    );
    await writeFile(
      manifestPath,
      JSON.stringify({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        generatedAt: "2026-06-21T00:00:00.000Z",
        artifactKey: "datasets/Dawn of the Hunt/0.2.0.json",
        sha256: "0".repeat(64),
        sources: datasetSources,
        counts: {
          items: 0,
          uniques: 0,
          mods: 0,
          gems: 0,
          economy: 0,
          ladderBuilds: 0,
        },
      }),
      "utf8",
    );

    await expect(
      importDatasetArtifact({ artifactPath, manifestPath }),
    ).rejects.toThrow("Dataset manifest checksum mismatch");
  });
});

function makeUniques(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `unique-${index + 1}`,
    name: `Unique ${index + 1}`,
    category: "amulet",
    rarity: "unique",
    iconUrl: `https://web.poecdn.com/image/unique-${index + 1}.png`,
    iconAttribution:
      "Game art and item data are property of Grinding Gear Games.",
  }));
}
