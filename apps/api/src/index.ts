import {
  accountSnapshotDiffRequestSchema,
  accountSnapshotDiffSchema,
  datasetArtifactSchema,
  datasetManifestSchema,
  type DatasetArtifact,
  type DatasetManifest,
  economyCollectionSchema,
  gemCollectionSchema,
  itemCollectionSchema,
  ladderBuildCollectionSchema,
  modCollectionSchema,
  openApiDocument,
  upgradeAdvisorRequestSchema,
  upgradeAdvisorResponseSchema,
  uniqueCollectionSchema,
} from "@calandra/contract";
import { diffAccountSnapshots, rankLoadoutUpgrades } from "@calandra/engine";
import { Hono, type Context } from "hono";

type Bindings = {
  APP_URL?: string;
  DATASET_ARTIFACT_JSON?: string;
  DATASET_R2_PREFIX?: string;
  DATA_BUCKET?: DatasetBucket;
};

export const api = new Hono<{ Bindings: Bindings }>();

api.onError((error, context) => {
  if (error instanceof DatasetManifestValidationError) {
    return context.json(
      { error: "dataset artifact failed manifest validation" },
      502,
    );
  }

  throw error;
});

api.get("/health", (context) => {
  return context.json({
    ok: true,
    service: "calandra-api",
    appUrl: context.env.APP_URL ?? "https://calandra.pages.dev",
  });
});

api.get("/openapi.json", (context) => {
  return context.json(openApiDocument);
});

api.post("/advisor/upgrades", async (context) => {
  const rawBody = await readJsonBody(context);
  const parsed = upgradeAdvisorRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    return context.json({ error: "invalid upgrade advisor request" }, 400);
  }

  const upgrades = rankLoadoutUpgrades(parsed.data);

  return context.json(
    upgradeAdvisorResponseSchema.parse({
      source: "deterministic-engine",
      upgrades,
    }),
  );
});

api.post("/snapshots/diff", async (context) => {
  const rawBody = await readJsonBody(context);
  const parsed = accountSnapshotDiffRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    return context.json(
      { error: "invalid account snapshot diff request" },
      400,
    );
  }

  return context.json(
    accountSnapshotDiffSchema.parse(
      diffAccountSnapshots(parsed.data.before, parsed.data.after),
    ),
  );
});

api.get("/items", async (context) => {
  const version = getVersionedQuery(context);
  if (!version.ok) return context.json(version.body, 400);
  const artifact = await getMatchingArtifact(context, version);

  const collection = itemCollectionSchema.parse({
    league: version.league,
    patch: version.patch,
    items: artifact?.items ?? [],
  });

  return context.json(collection);
});

api.get("/items/:id", async (context) => {
  const version = getVersionedQuery(context);
  if (!version.ok) return context.json(version.body, 400);
  const artifact = await getMatchingArtifact(context, version);
  const item = artifact
    ? [...artifact.items, ...artifact.uniques].find(
        (candidate) => candidate.id === context.req.param("id"),
      )
    : undefined;

  if (item) {
    return context.json(item);
  }

  return context.json(
    {
      error: "item not found",
      id: context.req.param("id"),
      league: version.league,
      patch: version.patch,
    },
    404,
  );
});

api.get("/uniques", async (context) => {
  const version = getVersionedQuery(context);
  if (!version.ok) return context.json(version.body, 400);
  const artifact = await getMatchingArtifact(context, version);

  return context.json(
    uniqueCollectionSchema.parse({
      ...version,
      uniques: artifact?.uniques ?? [],
    }),
  );
});

api.get("/mods", async (context) => {
  const version = getVersionedQuery(context);
  if (!version.ok) return context.json(version.body, 400);
  const artifact = await getMatchingArtifact(context, version);

  return context.json(
    modCollectionSchema.parse({ ...version, mods: artifact?.mods ?? [] }),
  );
});

api.get("/gems", async (context) => {
  const version = getVersionedQuery(context);
  if (!version.ok) return context.json(version.body, 400);
  const artifact = await getMatchingArtifact(context, version);

  return context.json(
    gemCollectionSchema.parse({ ...version, gems: artifact?.gems ?? [] }),
  );
});

api.get("/economy/:league", async (context) => {
  const league = context.req.param("league");
  const patch = context.req.query("patch");

  if (!patch) {
    return context.json({ error: "patch query parameter is required" }, 400);
  }
  const artifact = await getMatchingArtifact(context, { league, patch });

  return context.json(
    economyCollectionSchema.parse({
      league,
      patch,
      prices: artifact?.economy ?? [],
    }),
  );
});

api.get("/builds/ladder", async (context) => {
  const version = getVersionedQuery(context);
  if (!version.ok) return context.json(version.body, 400);
  const artifact = await getMatchingArtifact(context, version);

  return context.json(
    ladderBuildCollectionSchema.parse({
      ...version,
      builds: artifact?.ladderBuilds ?? [],
    }),
  );
});

api.get("/datasets/manifest", async (context) => {
  const version = getVersionedQuery(context);
  if (!version.ok) return context.json(version.body, 400);
  const manifest = await getMatchingDatasetManifest(context, version);

  if (!manifest) {
    return context.json(
      {
        error: "dataset manifest not found",
        league: version.league,
        patch: version.patch,
      },
      404,
    );
  }

  return context.json(datasetManifestSchema.parse(manifest));
});

async function getMatchingArtifact(
  context: Context<{ Bindings: Bindings }>,
  version: { league: string; patch: string },
) {
  const artifact = await getDatasetArtifact(context, version);

  if (
    !artifact ||
    artifact.league !== version.league ||
    artifact.patch !== version.patch
  ) {
    return undefined;
  }

  return artifact;
}

async function getMatchingDatasetManifest(
  context: Context<{ Bindings: Bindings }>,
  version: { league: string; patch: string },
) {
  const raw = context.env.DATASET_ARTIFACT_JSON;

  if (raw) {
    const artifact = parseDatasetArtifact(raw);

    if (
      artifact.league !== version.league ||
      artifact.patch !== version.patch
    ) {
      return undefined;
    }

    return buildInlineDatasetManifest({ artifact, artifactRaw: raw });
  }

  const objectKey = getDatasetObjectKey(context, version);
  const object = await context.env.DATA_BUCKET?.get(objectKey);

  if (!object) {
    return undefined;
  }

  const artifactRaw = await object.text();
  const artifact = parseDatasetArtifact(artifactRaw);

  if (artifact.league !== version.league || artifact.patch !== version.patch) {
    return undefined;
  }

  const manifestObject = await context.env.DATA_BUCKET?.get(
    getDatasetManifestKey(context, version),
  );

  if (!manifestObject) {
    throw new DatasetManifestValidationError("Dataset manifest missing");
  }

  const manifest = datasetManifestSchema.parse(
    JSON.parse((await manifestObject.text()).replace(/^\uFEFF/, "")),
  );
  await validateDatasetManifest({ artifact, artifactRaw, manifest, objectKey });

  return manifest;
}

async function getDatasetArtifact(
  context: Context<{ Bindings: Bindings }>,
  version: { league: string; patch: string },
): Promise<DatasetArtifact | undefined> {
  const raw = context.env.DATASET_ARTIFACT_JSON;

  if (raw) {
    return parseDatasetArtifact(raw);
  }

  const objectKey = getDatasetObjectKey(context, version);
  const object = await context.env.DATA_BUCKET?.get(objectKey);

  if (!object) {
    return undefined;
  }

  const artifactRaw = await object.text();
  const artifact = parseDatasetArtifact(artifactRaw);
  const manifestObject = await context.env.DATA_BUCKET?.get(
    getDatasetManifestKey(context, version),
  );

  if (!manifestObject) {
    throw new DatasetManifestValidationError("Dataset manifest missing");
  }

  const manifest = datasetManifestSchema.parse(
    JSON.parse((await manifestObject.text()).replace(/^\uFEFF/, "")),
  );
  await validateDatasetManifest({ artifact, artifactRaw, manifest, objectKey });

  return artifact;
}

function parseDatasetArtifact(raw: string) {
  return datasetArtifactSchema.parse(JSON.parse(raw.replace(/^\uFEFF/, "")));
}

async function readJsonBody(context: Context<{ Bindings: Bindings }>) {
  try {
    return await context.req.json();
  } catch {
    return undefined;
  }
}

function getDatasetObjectKey(
  context: Context<{ Bindings: Bindings }>,
  version: { league: string; patch: string },
) {
  const prefix = context.env.DATASET_R2_PREFIX ?? "datasets";

  return `${prefix}/${version.league}/${version.patch}.json`;
}

function getDatasetManifestKey(
  context: Context<{ Bindings: Bindings }>,
  version: { league: string; patch: string },
) {
  const prefix = context.env.DATASET_R2_PREFIX ?? "datasets";

  return `${prefix}/${version.league}/${version.patch}.manifest.json`;
}

async function validateDatasetManifest({
  artifact,
  artifactRaw,
  manifest,
  objectKey,
}: {
  artifact: DatasetArtifact;
  artifactRaw: string;
  manifest: DatasetManifest;
  objectKey: string;
}) {
  const sha256 = await sha256Hex(artifactRaw);

  if (manifest.artifactKey !== objectKey || manifest.sha256 !== sha256) {
    throw new DatasetManifestValidationError(
      "Dataset manifest checksum mismatch",
    );
  }

  if (
    manifest.league !== artifact.league ||
    manifest.patch !== artifact.patch ||
    manifest.generatedAt !== artifact.generatedAt
  ) {
    throw new DatasetManifestValidationError(
      "Dataset manifest version mismatch",
    );
  }

  const counts = getDatasetCounts(artifact);

  if (JSON.stringify(manifest.counts) !== JSON.stringify(counts)) {
    throw new DatasetManifestValidationError(
      "Dataset manifest counts mismatch",
    );
  }
}

async function buildInlineDatasetManifest({
  artifact,
  artifactRaw,
}: {
  artifact: DatasetArtifact;
  artifactRaw: string;
}): Promise<DatasetManifest> {
  return {
    league: artifact.league,
    patch: artifact.patch,
    generatedAt: artifact.generatedAt,
    artifactKey: "DATASET_ARTIFACT_JSON",
    sha256: await sha256Hex(artifactRaw),
    counts: getDatasetCounts(artifact),
  };
}

function getDatasetCounts(artifact: DatasetArtifact) {
  return {
    items: artifact.items.length,
    uniques: artifact.uniques.length,
    mods: artifact.mods.length,
    gems: artifact.gems.length,
    economy: artifact.economy.length,
    ladderBuilds: artifact.ladderBuilds.length,
  };
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getVersionedQuery(context: Context<{ Bindings: Bindings }>) {
  const league = context.req.query("league");
  const patch = context.req.query("patch");

  if (!league || !patch) {
    return {
      ok: false as const,
      body: { error: "league and patch query parameters are required" },
    };
  }

  return { ok: true as const, league, patch };
}

type DatasetBucket = {
  get(key: string): Promise<DatasetObject | null>;
};

type DatasetObject = {
  text(): Promise<string>;
};

class DatasetManifestValidationError extends Error {}

export default api;
