import {
  accountSnapshotDiffRequestSchema,
  accountSnapshotDiffSchema,
  accountSnapshotListResponseSchema,
  accountSnapshotSchema,
  accountSnapshotStoredDiffRequestSchema,
  accountSnapshotWriteResponseSchema,
  buyVsCraftRequestSchema,
  buyVsCraftResponseSchema,
  craftingEstimateRequestSchema,
  craftingEstimateResponseSchema,
  datasetArtifactSchema,
  datasetManifestSchema,
  type DatasetArtifact,
  type DatasetManifest,
  type UniqueImageCoverage,
  economyCollectionSchema,
  gemCollectionSchema,
  itemCollectionSchema,
  ladderBuildCollectionSchema,
  modCollectionSchema,
  openApiDocument,
  priceCheckRequestSchema,
  priceCheckResponseSchema,
  upgradeAdvisorRequestSchema,
  upgradeAdvisorResponseSchema,
  uniqueCollectionSchema,
} from "@calandra/contract";
import {
  compareBuyVsCraft,
  diffAccountSnapshots,
  estimateCraftingPlan,
  rankLoadoutUpgrades,
} from "@calandra/engine";
import { Hono, type Context } from "hono";

type Bindings = {
  APP_URL?: string;
  DATASET_ARTIFACT_JSON?: string;
  DATASET_R2_PREFIX?: string;
  DATA_BUCKET?: DatasetBucket;
  SNAPSHOT_R2_PREFIX?: string;
  SNAPSHOT_WRITE_TOKEN?: string;
  SNAPSHOT_BUCKET?: SnapshotBucket;
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

api.get("/snapshots/:account/diff", async (context) => {
  const parsed = accountSnapshotStoredDiffRequestSchema.safeParse({
    account: context.req.param("account"),
    beforeSnapshotId: context.req.query("beforeSnapshotId"),
    afterSnapshotId: context.req.query("afterSnapshotId"),
  });

  if (!parsed.success) {
    return context.json(
      { error: "invalid stored account snapshot diff request" },
      400,
    );
  }

  const before = await getStoredAccountSnapshot(context, {
    account: parsed.data.account,
    snapshotId: parsed.data.beforeSnapshotId,
  });

  if (!before.ok) {
    return context.json(before.body, before.status);
  }

  const after = await getStoredAccountSnapshot(context, {
    account: parsed.data.account,
    snapshotId: parsed.data.afterSnapshotId,
  });

  if (!after.ok) {
    return context.json(after.body, after.status);
  }

  return context.json(
    accountSnapshotDiffSchema.parse(
      diffAccountSnapshots(before.snapshot, after.snapshot),
    ),
  );
});

api.get("/snapshots/:account/:snapshotId", async (context) => {
  const account = context.req.param("account");
  const snapshotId = context.req.param("snapshotId");
  const result = await getStoredAccountSnapshot(context, {
    account,
    snapshotId,
  });

  if (!result.ok) {
    return context.json(result.body, result.status);
  }

  return context.json(result.snapshot);
});

async function getStoredAccountSnapshot(
  context: Context<{ Bindings: Bindings }>,
  {
    account,
    snapshotId,
  }: {
    account: string;
    snapshotId: string;
  },
) {
  const snapshotBucket = context.env.SNAPSHOT_BUCKET;

  if (!snapshotBucket?.get) {
    return {
      ok: false as const,
      status: 503 as const,
      body: { error: "snapshot bucket is not configured" },
    };
  }

  const object = await snapshotBucket.get(
    getSnapshotObjectKey(context, {
      account,
      id: snapshotId,
    }),
  );

  if (!object) {
    return {
      ok: false as const,
      status: 404 as const,
      body: { error: "account snapshot not found", account, snapshotId },
    };
  }

  let rawSnapshot: unknown;

  try {
    rawSnapshot = JSON.parse((await object.text()).replace(/^\uFEFF/, ""));
  } catch {
    return {
      ok: false as const,
      status: 502 as const,
      body: { error: "stored account snapshot failed validation" },
    };
  }

  const parsed = accountSnapshotSchema.safeParse(rawSnapshot);

  if (!parsed.success) {
    return {
      ok: false as const,
      status: 502 as const,
      body: { error: "stored account snapshot failed validation" },
    };
  }

  return {
    ok: true as const,
    snapshot: parsed.data,
  };
}

api.get("/snapshots/:account", async (context) => {
  const snapshotBucket = context.env.SNAPSHOT_BUCKET;

  if (!snapshotBucket?.list) {
    return context.json({ error: "snapshot bucket is not configured" }, 503);
  }

  const account = context.req.param("account");
  const prefix = getSnapshotAccountPrefix(context, account);
  const listed = await snapshotBucket.list({ prefix });
  const snapshots = listed.objects
    .map((object) => toSnapshotListItem({ account, prefix, object }))
    .filter((item) => item !== undefined)
    .sort((left, right) => left.snapshotId.localeCompare(right.snapshotId));

  return context.json(
    accountSnapshotListResponseSchema.parse({
      source: "snapshot-store",
      account,
      snapshots,
    }),
  );
});

api.post("/snapshots", async (context) => {
  if (!isSnapshotWriteAuthorized(context)) {
    return context.json({ error: "snapshot write is unauthorized" }, 401);
  }

  const rawBody = await readJsonBody(context);
  const parsed = accountSnapshotSchema.safeParse(rawBody);

  if (!parsed.success) {
    return context.json({ error: "invalid account snapshot" }, 400);
  }

  const snapshotBucket = context.env.SNAPSHOT_BUCKET;

  if (!snapshotBucket?.put) {
    return context.json({ error: "snapshot bucket is not configured" }, 503);
  }

  const objectKey = getSnapshotObjectKey(context, parsed.data);
  await snapshotBucket.put(objectKey, JSON.stringify(parsed.data), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });

  return context.json(
    accountSnapshotWriteResponseSchema.parse({
      source: "snapshot-store",
      objectKey,
      snapshot: parsed.data,
    }),
    201,
  );
});

api.post("/crafting/estimate", async (context) => {
  const rawBody = await readJsonBody(context);
  const parsed = craftingEstimateRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    return context.json({ error: "invalid crafting estimate request" }, 400);
  }

  return context.json(
    craftingEstimateResponseSchema.parse({
      source: "deterministic-engine",
      ...estimateCraftingPlan(parsed.data),
    }),
  );
});

api.post("/crafting/buy-vs-craft", async (context) => {
  const rawBody = await readJsonBody(context);
  const parsed = buyVsCraftRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    return context.json({ error: "invalid buy-vs-craft request" }, 400);
  }

  return context.json(
    buyVsCraftResponseSchema.parse({
      source: "deterministic-engine",
      ...compareBuyVsCraft(parsed.data),
    }),
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

api.post("/price/check", async (context) => {
  const rawBody = await readJsonBody(context);
  const parsed = priceCheckRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    return context.json({ error: "invalid price check request" }, 400);
  }

  const artifact = await getMatchingArtifact(context, parsed.data);
  const priceMatch = findPriceMatch(artifact?.economy ?? [], parsed.data.item);

  return context.json(
    priceCheckResponseSchema.parse({
      source: "published-dataset",
      league: parsed.data.league,
      patch: parsed.data.patch,
      item: parsed.data.item,
      price: priceMatch?.price ?? null,
      matchedBy: priceMatch?.matchedBy ?? null,
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

  const manifest = parseDatasetManifest(await manifestObject.text());
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

  const manifest = parseDatasetManifest(await manifestObject.text());
  await validateDatasetManifest({ artifact, artifactRaw, manifest, objectKey });

  return artifact;
}

function parseDatasetArtifact(raw: string) {
  try {
    return datasetArtifactSchema.parse(JSON.parse(raw.replace(/^\uFEFF/, "")));
  } catch {
    throw new DatasetManifestValidationError(
      "Dataset artifact failed validation",
    );
  }
}

function parseDatasetManifest(raw: string) {
  try {
    return datasetManifestSchema.parse(JSON.parse(raw.replace(/^\uFEFF/, "")));
  } catch {
    throw new DatasetManifestValidationError(
      "Dataset manifest failed validation",
    );
  }
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

function getSnapshotObjectKey(
  context: Context<{ Bindings: Bindings }>,
  snapshot: { account: string; id: string },
) {
  return `${getSnapshotAccountPrefix(context, snapshot.account)}${encodeURIComponent(snapshot.id)}.json`;
}

function getSnapshotAccountPrefix(
  context: Context<{ Bindings: Bindings }>,
  account: string,
) {
  const prefix = context.env.SNAPSHOT_R2_PREFIX ?? "snapshots";

  return `${prefix}/${encodeURIComponent(account)}/`;
}

function isSnapshotWriteAuthorized(
  context: Context<{ Bindings: Bindings }>,
) {
  const writeToken = context.env.SNAPSHOT_WRITE_TOKEN;

  if (!writeToken) {
    return true;
  }

  const authorization = context.req.header("authorization") ?? "";
  const bearerPrefix = "Bearer ";

  if (!authorization.startsWith(bearerPrefix)) {
    return false;
  }

  return timingSafeEqual(authorization.slice(bearerPrefix.length), writeToken);
}

function timingSafeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

function toSnapshotListItem({
  account,
  prefix,
  object,
}: {
  account: string;
  prefix: string;
  object: SnapshotListedObject;
}) {
  if (!object.key.startsWith(prefix) || !object.key.endsWith(".json")) {
    return undefined;
  }

  const encodedSnapshotId = object.key.slice(prefix.length, -".json".length);

  if (!encodedSnapshotId || encodedSnapshotId.includes("/")) {
    return undefined;
  }

  return {
    account,
    snapshotId: decodeURIComponent(encodedSnapshotId),
    objectKey: object.key,
    uploadedAt: serializeSnapshotUploadedAt(object.uploaded),
    size: object.size,
  };
}

function serializeSnapshotUploadedAt(value: Date | string | undefined) {
  if (!value) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
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

  if (JSON.stringify(manifest.sources) !== JSON.stringify(artifact.sources)) {
    throw new DatasetManifestValidationError(
      "Dataset manifest source attribution mismatch",
    );
  }

  validateUniqueImageCoverageGate(
    artifact,
    manifest.qualityGates?.uniqueImageCoverage,
  );

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
    sources: artifact.sources,
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

function validateUniqueImageCoverageGate(
  artifact: DatasetArtifact,
  coverage: UniqueImageCoverage | undefined,
) {
  if (!coverage) {
    return;
  }

  const ratio =
    coverage.expected === 0 ? 1 : coverage.resolved / coverage.expected;

  if (
    coverage.resolved !== artifact.uniques.length ||
    coverage.ratio !== ratio ||
    coverage.ratio < coverage.minimum
  ) {
    throw new DatasetManifestValidationError(
      "Dataset manifest unique image coverage mismatch",
    );
  }
}

function findPriceMatch(
  prices: DatasetArtifact["economy"],
  item: DatasetArtifact["items"][number],
) {
  const idMatch = prices.find((price) => price.id === item.id);
  if (idMatch) {
    return { price: idMatch, matchedBy: "id" as const };
  }

  const itemName = normalizeSearchValue(item.name);
  const nameMatch = prices.find(
    (price) => normalizeSearchValue(price.name) === itemName,
  );

  return nameMatch ? { price: nameMatch, matchedBy: "name" as const } : null;
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

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
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

type SnapshotBucket = {
  get?(key: string): Promise<SnapshotObject | null>;
  list?(options: { prefix?: string }): Promise<SnapshotListResult>;
  put?(
    key: string,
    value: string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
};

type DatasetObject = {
  text(): Promise<string>;
};

type SnapshotObject = {
  text(): Promise<string>;
};

type SnapshotListResult = {
  objects: SnapshotListedObject[];
};

type SnapshotListedObject = {
  key: string;
  uploaded?: Date | string;
  size?: number;
};

class DatasetManifestValidationError extends Error {}

export default api;
