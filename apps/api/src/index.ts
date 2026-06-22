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
  datasetSearchResponseSchema,
  type DatasetArtifact,
  type DatasetManifest,
  type UniqueImageCoverage,
  economyCollectionSchema,
  gemCollectionSchema,
  itemCollectionSchema,
  ladderBuildCollectionSchema,
  modCollectionSchema,
  openApiDocument,
  gggOAuthCompleteRequestSchema,
  gggOAuthStartRequestSchema,
  gggOAuthStartResponseSchema,
  gggOAuthTokenExchangeRequestSchema,
  gggOAuthTokenExchangeResponseSchema,
  gggOAuthStatusResponseSchema,
  poe2CharacterSnapshotCaptureRequestSchema,
  poe2StoredTokenSnapshotCaptureRequestSchema,
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
import {
  GggApiConfigurationError,
  GggApiHttpError,
  GggApiScopeError,
  GggOAuthTokenEncryptionError,
  capturePoe2CharacterSnapshot,
  createGggApiClient,
  createGggOAuthAuthorizationUrl,
  createGggOAuthPkcePair,
  decryptGggOAuthTokenSet,
  encryptGggOAuthTokenSet,
  exchangeGggOAuthAuthorizationCode,
  gggOAuthScopes,
  refreshGggOAuthToken,
  type EncryptedGggOAuthTokenSet,
  type GggOAuthScope,
  type GggOAuthTokenSet,
} from "@calandra/ggg-api";
import { Hono, type Context } from "hono";

type Bindings = {
  APP_URL?: string;
  DATASET_ARTIFACT_JSON?: string;
  DATASET_R2_PREFIX?: string;
  DATA_BUCKET?: DatasetBucket;
  SNAPSHOT_R2_PREFIX?: string;
  SNAPSHOT_WRITE_TOKEN?: string;
  SNAPSHOT_BUCKET?: SnapshotBucket;
  GGG_USER_AGENT?: string;
  GGG_API_BASE_URL?: string;
  GGG_OAUTH_CLIENT_ID?: string;
  GGG_OAUTH_CLIENT_SECRET?: string;
  GGG_OAUTH_TOKEN_URL?: string;
  GGG_TOKEN_ENCRYPTION_KEY?: string;
  GGG_TOKEN_R2_PREFIX?: string;
};

export const api = new Hono<{ Bindings: Bindings }>();

const gggOAuthPendingStateTtlMs = 10 * 60 * 1000;

api.use("*", async (context, next) => {
  for (const [name, value] of Object.entries(getCorsHeaders())) {
    context.header(name, value);
  }

  if (context.req.method === "OPTIONS") {
    return context.body(null, 204);
  }

  await next();
});

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

api.get("/auth/ggg/status", (context) => {
  const accountLinking = isGggOAuthExchangeConfigured(context);
  const snapshotCapture = isGggOAuthSnapshotCaptureConfigured(context);

  return context.json(
    gggOAuthStatusResponseSchema.parse({
      source: "ggg-oauth-status",
      configured: accountLinking && snapshotCapture,
      redirectUri: getGggOAuthRedirectUri(context),
      requiredScopes: [gggOAuthScopes.accountCharacters],
      features: {
        accountLinking,
        snapshotCapture,
      },
    }),
  );
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

async function writeStoredAccountSnapshot(
  context: Context<{ Bindings: Bindings }>,
  snapshot: {
    account: string;
    id: string;
  },
) {
  const snapshotBucket = context.env.SNAPSHOT_BUCKET;

  if (!snapshotBucket?.put) {
    return {
      ok: false as const,
      status: 503 as const,
      body: { error: "snapshot bucket is not configured" },
    };
  }

  const objectKey = getSnapshotObjectKey(context, snapshot);
  await snapshotBucket.put(objectKey, JSON.stringify(snapshot), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });

  return {
    ok: true as const,
    objectKey,
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

api.post("/auth/ggg/start", async (context) => {
  const rawBody = await readJsonBody(context);
  const parsed = gggOAuthStartRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    return context.json({ error: "invalid GGG OAuth start request" }, 400);
  }

  const clientId = context.env.GGG_OAUTH_CLIENT_ID;
  const snapshotBucket = context.env.SNAPSHOT_BUCKET;

  if (!clientId || !snapshotBucket?.put) {
    return context.json(
      { error: "GGG OAuth browser link is not configured" },
      503,
    );
  }

  const requestedScopes = parsed.data.scopes ?? [
    gggOAuthScopes.accountCharacters,
  ];
  const scopes = parseGggOAuthScopes(requestedScopes);

  if (!scopes.ok || !scopes.scopes) {
    return context.json({ error: "invalid GGG OAuth start request" }, 400);
  }

  try {
    const now = new Date();
    const expiresAt = new Date(
      now.valueOf() + gggOAuthPendingStateTtlMs,
    ).toISOString();
    const state = createGggOAuthState();
    const pkce = await createGggOAuthPkcePair();
    const redirectUri =
      parsed.data.redirectUri ?? getGggOAuthRedirectUri(context);
    const authorizationUrl = createGggOAuthAuthorizationUrl({
      clientId,
      redirectUri,
      scopes: scopes.scopes,
      state,
      pkce,
    });

    await snapshotBucket.put(
      getGggOAuthPendingStateObjectKey(context, state),
      JSON.stringify({
        account: parsed.data.account,
        provider: "ggg",
        state,
        codeVerifier: pkce.codeVerifier,
        redirectUri,
        scopes: scopes.scopes,
        createdAt: now.toISOString(),
        expiresAt,
      }),
      { httpMetadata: { contentType: "application/json; charset=utf-8" } },
    );

    return context.json(
      gggOAuthStartResponseSchema.parse({
        source: "ggg-oauth-start",
        account: parsed.data.account,
        authorizationUrl,
        state,
        expiresAt,
        redirectUri,
        requiredScopes: scopes.scopes,
      }),
      201,
    );
  } catch (error) {
    if (error instanceof GggApiConfigurationError) {
      return context.json({ error: "invalid GGG OAuth start request" }, 400);
    }

    throw error;
  }
});

api.post("/auth/ggg/complete", async (context) => {
  const rawBody = await readJsonBody(context);
  const parsed = gggOAuthCompleteRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    return context.json({ error: "invalid GGG OAuth complete request" }, 400);
  }

  const clientId = context.env.GGG_OAUTH_CLIENT_ID;
  const snapshotBucket = context.env.SNAPSHOT_BUCKET;

  if (
    !clientId ||
    !context.env.GGG_TOKEN_ENCRYPTION_KEY ||
    !snapshotBucket?.get ||
    !snapshotBucket.put
  ) {
    return context.json(
      { error: "GGG OAuth browser link is not configured" },
      503,
    );
  }

  let encryptionKey: Uint8Array;

  try {
    encryptionKey = parseGggTokenEncryptionKey(
      context.env.GGG_TOKEN_ENCRYPTION_KEY,
    );
  } catch {
    return context.json(
      { error: "GGG OAuth browser link is not configured" },
      503,
    );
  }

  const pendingStateKey = getGggOAuthPendingStateObjectKey(
    context,
    parsed.data.state,
  );
  const pendingStateObject = await snapshotBucket.get(pendingStateKey);

  if (!pendingStateObject) {
    return context.json(
      { error: "GGG OAuth state is invalid or expired" },
      401,
    );
  }

  const pendingState = parseStoredGggOAuthPendingState(
    await pendingStateObject.text(),
    parsed.data.state,
    new Date(),
  );

  if (!pendingState) {
    return context.json(
      { error: "GGG OAuth state is invalid or expired" },
      401,
    );
  }

  const scopes = parseGggOAuthScopes(pendingState.scopes);

  if (!scopes.ok || !scopes.scopes) {
    return context.json(
      { error: "GGG OAuth state is invalid or expired" },
      401,
    );
  }

  try {
    const tokenSet = await exchangeGggOAuthAuthorizationCode({
      clientId,
      ...(context.env.GGG_OAUTH_CLIENT_SECRET
        ? { clientSecret: context.env.GGG_OAUTH_CLIENT_SECRET }
        : {}),
      code: parsed.data.code,
      codeVerifier: pendingState.codeVerifier,
      redirectUri: pendingState.redirectUri,
      scopes: scopes.scopes,
      fetch: (url, init) => fetch(url, init),
      now: new Date(),
      ...(context.env.GGG_OAUTH_TOKEN_URL
        ? { tokenUrl: context.env.GGG_OAUTH_TOKEN_URL }
        : {}),
    });
    const account = tokenSet.username ?? pendingState.account;
    const encryptedTokenSet = await encryptGggOAuthTokenSet(tokenSet, {
      key: encryptionKey,
    });
    const objectKey = getGggOAuthTokenObjectKey(context, account);

    await snapshotBucket.put(
      objectKey,
      JSON.stringify({
        account,
        provider: "ggg",
        updatedAt: new Date().toISOString(),
        token: buildStoredGggOAuthTokenMetadata(tokenSet),
        encryptedTokenSet,
      }),
      { httpMetadata: { contentType: "application/json; charset=utf-8" } },
    );
    await snapshotBucket.put(
      pendingStateKey,
      JSON.stringify({
        provider: "ggg",
        state: parsed.data.state,
        consumedAt: new Date().toISOString(),
      }),
      { httpMetadata: { contentType: "application/json; charset=utf-8" } },
    );

    return context.json(
      gggOAuthTokenExchangeResponseSchema.parse({
        source: "ggg-oauth-token-store",
        account,
        objectKey,
        token: {
          tokenType: "encrypted",
          ...buildStoredGggOAuthTokenMetadata(tokenSet),
        },
      }),
      201,
    );
  } catch (error) {
    if (
      error instanceof GggApiHttpError &&
      (error.status === 401 || error.status === 403)
    ) {
      return context.json(
        { error: "GGG OAuth code was rejected", status: error.status },
        401,
      );
    }

    if (
      error instanceof GggApiConfigurationError ||
      error instanceof GggOAuthTokenEncryptionError
    ) {
      return context.json(
        { error: "GGG OAuth browser link is not configured" },
        503,
      );
    }

    if (error instanceof GggApiHttpError) {
      return context.json(
        { error: "GGG OAuth token exchange failed", status: error.status },
        502,
      );
    }

    throw error;
  }
});

api.post("/auth/ggg/exchange", async (context) => {
  if (!isSnapshotWriteAuthorized(context)) {
    return context.json({ error: "snapshot write is unauthorized" }, 401);
  }

  const rawBody = await readJsonBody(context);
  const parsed = gggOAuthTokenExchangeRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    return context.json(
      { error: "invalid GGG OAuth token exchange request" },
      400,
    );
  }

  const clientId = context.env.GGG_OAUTH_CLIENT_ID;
  const snapshotBucket = context.env.SNAPSHOT_BUCKET;

  if (
    !clientId ||
    !context.env.GGG_TOKEN_ENCRYPTION_KEY ||
    !snapshotBucket?.put
  ) {
    return context.json(
      { error: "GGG OAuth token exchange is not configured" },
      503,
    );
  }

  const scopes = parseGggOAuthScopes(parsed.data.scopes);

  if (!scopes.ok) {
    return context.json(
      { error: "invalid GGG OAuth token exchange request" },
      400,
    );
  }

  let encryptionKey: Uint8Array;

  try {
    encryptionKey = parseGggTokenEncryptionKey(
      context.env.GGG_TOKEN_ENCRYPTION_KEY,
    );
  } catch {
    return context.json(
      { error: "GGG OAuth token exchange is not configured" },
      503,
    );
  }

  try {
    const tokenSet = await exchangeGggOAuthAuthorizationCode({
      clientId,
      ...(context.env.GGG_OAUTH_CLIENT_SECRET
        ? { clientSecret: context.env.GGG_OAUTH_CLIENT_SECRET }
        : {}),
      code: parsed.data.code,
      codeVerifier: parsed.data.codeVerifier,
      redirectUri: parsed.data.redirectUri,
      ...(scopes.scopes ? { scopes: scopes.scopes } : {}),
      fetch: (url, init) => fetch(url, init),
      now: new Date(),
      ...(context.env.GGG_OAUTH_TOKEN_URL
        ? { tokenUrl: context.env.GGG_OAUTH_TOKEN_URL }
        : {}),
    });
    const encryptedTokenSet = await encryptGggOAuthTokenSet(tokenSet, {
      key: encryptionKey,
    });
    const objectKey = getGggOAuthTokenObjectKey(context, parsed.data.account);
    await snapshotBucket.put(
      objectKey,
      JSON.stringify({
        account: parsed.data.account,
        provider: "ggg",
        updatedAt: new Date().toISOString(),
        token: buildStoredGggOAuthTokenMetadata(tokenSet),
        encryptedTokenSet,
      }),
      { httpMetadata: { contentType: "application/json; charset=utf-8" } },
    );

    return context.json(
      gggOAuthTokenExchangeResponseSchema.parse({
        source: "ggg-oauth-token-store",
        account: parsed.data.account,
        objectKey,
        token: {
          tokenType: "encrypted",
          ...buildStoredGggOAuthTokenMetadata(tokenSet),
        },
      }),
      201,
    );
  } catch (error) {
    if (
      error instanceof GggApiHttpError &&
      (error.status === 401 || error.status === 403)
    ) {
      return context.json(
        { error: "GGG OAuth code was rejected", status: error.status },
        401,
      );
    }

    if (error instanceof GggApiConfigurationError) {
      return context.json(
        { error: "GGG OAuth token exchange is not configured" },
        503,
      );
    }

    if (error instanceof GggOAuthTokenEncryptionError) {
      return context.json(
        { error: "GGG OAuth token exchange is not configured" },
        503,
      );
    }

    if (error instanceof GggApiHttpError) {
      return context.json(
        { error: "GGG OAuth token exchange failed", status: error.status },
        502,
      );
    }

    throw error;
  }
});
api.post("/snapshots/capture/poe2-stored-token", async (context) => {
  if (!isSnapshotWriteAuthorized(context)) {
    return context.json({ error: "snapshot write is unauthorized" }, 401);
  }

  const rawBody = await readJsonBody(context);
  const parsed = poe2StoredTokenSnapshotCaptureRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    return context.json(
      { error: "invalid stored-token PoE2 snapshot capture request" },
      400,
    );
  }

  const snapshotBucket = context.env.SNAPSHOT_BUCKET;

  if (
    !context.env.GGG_USER_AGENT ||
    !context.env.GGG_TOKEN_ENCRYPTION_KEY ||
    !snapshotBucket?.get ||
    !snapshotBucket.put
  ) {
    return context.json(
      { error: "stored-token PoE2 snapshot capture is not configured" },
      503,
    );
  }

  let encryptionKey: Uint8Array;

  try {
    encryptionKey = parseGggTokenEncryptionKey(
      context.env.GGG_TOKEN_ENCRYPTION_KEY,
    );
  } catch {
    return context.json(
      { error: "stored-token PoE2 snapshot capture is not configured" },
      503,
    );
  }

  const tokenObjectKey = getGggOAuthTokenObjectKey(
    context,
    parsed.data.account,
  );
  const tokenObject = await snapshotBucket.get(tokenObjectKey);

  if (!tokenObject) {
    return context.json(
      { error: "GGG OAuth token is not linked", account: parsed.data.account },
      404,
    );
  }

  const storedToken = parseStoredGggOAuthTokenObject(
    await tokenObject.text(),
    parsed.data.account,
  );

  if (!storedToken) {
    return context.json(
      { error: "stored GGG OAuth token failed validation" },
      502,
    );
  }

  try {
    let tokenSet = await decryptGggOAuthTokenSet(
      storedToken.encryptedTokenSet,
      {
        key: encryptionKey,
      },
    );

    if (isGggOAuthTokenExpired(tokenSet, new Date())) {
      if (!tokenSet.refreshToken || !context.env.GGG_OAUTH_CLIENT_ID) {
        return context.json(
          { error: "GGG OAuth token cannot be refreshed" },
          401,
        );
      }

      const refreshScopes = parseGggOAuthScopes(tokenSet.scope);

      if (!refreshScopes.ok) {
        return context.json(
          { error: "stored GGG OAuth token failed validation" },
          502,
        );
      }

      tokenSet = await refreshGggOAuthToken({
        clientId: context.env.GGG_OAUTH_CLIENT_ID,
        ...(context.env.GGG_OAUTH_CLIENT_SECRET
          ? { clientSecret: context.env.GGG_OAUTH_CLIENT_SECRET }
          : {}),
        refreshToken: tokenSet.refreshToken,
        ...(refreshScopes.scopes ? { scopes: refreshScopes.scopes } : {}),
        fetch: (url, init) => fetch(url, init),
        now: new Date(),
        ...(context.env.GGG_OAUTH_TOKEN_URL
          ? { tokenUrl: context.env.GGG_OAUTH_TOKEN_URL }
          : {}),
      });
      await snapshotBucket.put(
        tokenObjectKey,
        JSON.stringify({
          account: parsed.data.account,
          provider: "ggg",
          updatedAt: new Date().toISOString(),
          token: buildStoredGggOAuthTokenMetadata(tokenSet),
          encryptedTokenSet: await encryptGggOAuthTokenSet(tokenSet, {
            key: encryptionKey,
          }),
        }),
        { httpMetadata: { contentType: "application/json; charset=utf-8" } },
      );
    }

    const client = createGggApiClient({
      accessToken: tokenSet.accessToken,
      userAgent: context.env.GGG_USER_AGENT,
      grantedScopes: tokenSet.scope,
      fetch: (url, init) => fetch(url, init),
      ...(context.env.GGG_API_BASE_URL
        ? { baseUrl: context.env.GGG_API_BASE_URL }
        : {}),
    });
    const snapshot = await capturePoe2CharacterSnapshot({
      account: parsed.data.account,
      client,
      ...(parsed.data.capturedAt ? { capturedAt: parsed.data.capturedAt } : {}),
      ...(parsed.data.snapshotId ? { id: parsed.data.snapshotId } : {}),
    });
    const stored = await writeStoredAccountSnapshot(context, snapshot);

    if (!stored.ok) {
      return context.json(stored.body, stored.status);
    }

    return context.json(
      accountSnapshotWriteResponseSchema.parse({
        source: "snapshot-store",
        objectKey: stored.objectKey,
        snapshot,
      }),
      201,
    );
  } catch (error) {
    if (error instanceof GggApiScopeError) {
      return context.json(
        { error: "GGG OAuth token is missing required scope" },
        401,
      );
    }

    if (
      error instanceof GggApiHttpError &&
      (error.status === 401 || error.status === 403)
    ) {
      return context.json(
        { error: "GGG OAuth token was rejected", status: error.status },
        401,
      );
    }

    if (error instanceof GggOAuthTokenEncryptionError) {
      return context.json(
        { error: "stored GGG OAuth token failed validation" },
        502,
      );
    }

    if (error instanceof GggApiConfigurationError) {
      return context.json({ error: error.message }, 400);
    }

    if (error instanceof GggApiHttpError) {
      return context.json(
        { error: "GGG API request failed", status: error.status },
        502,
      );
    }

    throw error;
  }
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

  const stored = await writeStoredAccountSnapshot(context, parsed.data);
  if (!stored.ok) {
    return context.json(stored.body, stored.status);
  }

  return context.json(
    accountSnapshotWriteResponseSchema.parse({
      source: "snapshot-store",
      objectKey: stored.objectKey,
      snapshot: parsed.data,
    }),
    201,
  );
});

api.post("/snapshots/capture/poe2-character", async (context) => {
  if (!isSnapshotWriteAuthorized(context)) {
    return context.json({ error: "snapshot write is unauthorized" }, 401);
  }

  const rawBody = await readJsonBody(context);
  const parsed = poe2CharacterSnapshotCaptureRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    return context.json(
      { error: "invalid PoE2 character snapshot capture request" },
      400,
    );
  }

  if (!context.env.GGG_USER_AGENT) {
    return context.json({ error: "GGG User-Agent is not configured" }, 503);
  }

  try {
    const client = createGggApiClient({
      accessToken: parsed.data.accessToken,
      userAgent: context.env.GGG_USER_AGENT,
      grantedScopes: parsed.data.grantedScopes,
      fetch: (url, init) => fetch(url, init),
      ...(context.env.GGG_API_BASE_URL
        ? { baseUrl: context.env.GGG_API_BASE_URL }
        : {}),
    });
    const snapshot = await capturePoe2CharacterSnapshot({
      account: parsed.data.account,
      client,
      ...(parsed.data.capturedAt ? { capturedAt: parsed.data.capturedAt } : {}),
      ...(parsed.data.snapshotId ? { id: parsed.data.snapshotId } : {}),
    });
    const stored = await writeStoredAccountSnapshot(context, snapshot);

    if (!stored.ok) {
      return context.json(stored.body, stored.status);
    }

    return context.json(
      accountSnapshotWriteResponseSchema.parse({
        source: "snapshot-store",
        objectKey: stored.objectKey,
        snapshot,
      }),
      201,
    );
  } catch (error) {
    if (error instanceof GggApiScopeError) {
      return context.json(
        { error: "GGG OAuth token is missing required scope" },
        401,
      );
    }

    if (
      error instanceof GggApiHttpError &&
      (error.status === 401 || error.status === 403)
    ) {
      return context.json(
        { error: "GGG OAuth token was rejected", status: error.status },
        401,
      );
    }

    if (error instanceof GggApiConfigurationError) {
      return context.json({ error: error.message }, 400);
    }

    if (error instanceof GggApiHttpError) {
      return context.json(
        { error: "GGG API request failed", status: error.status },
        502,
      );
    }

    throw error;
  }
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

api.get("/search", async (context) => {
  const search = getDatasetSearchQuery(context);
  if (!search.ok) return context.json(search.body, 400);
  const artifact = await getMatchingArtifact(context, search);
  const query = normalizeSearchValue(search.q);

  return context.json(
    datasetSearchResponseSchema.parse({
      league: search.league,
      patch: search.patch,
      query: search.q,
      items: artifact?.items.filter((item) => matchesItem(item, query)) ?? [],
      uniques:
        artifact?.uniques.filter((item) => matchesItem(item, query)) ?? [],
      mods: artifact?.mods.filter((mod) => matchesMod(mod, query)) ?? [],
      gems: artifact?.gems.filter((gem) => matchesGem(gem, query)) ?? [],
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
function getGggOAuthTokenObjectKey(
  context: Context<{ Bindings: Bindings }>,
  account: string,
) {
  const prefix = context.env.GGG_TOKEN_R2_PREFIX ?? "oauth/ggg";

  return `${prefix}/${encodeURIComponent(account)}/token.json`;
}

function getGggOAuthPendingStateObjectKey(
  context: Context<{ Bindings: Bindings }>,
  state: string,
) {
  const prefix = context.env.GGG_TOKEN_R2_PREFIX ?? "oauth/ggg";

  return `${prefix}/pending/${encodeURIComponent(state)}.json`;
}

function isGggOAuthExchangeConfigured(
  context: Context<{ Bindings: Bindings }>,
) {
  return Boolean(
    context.env.GGG_OAUTH_CLIENT_ID &&
    context.env.GGG_TOKEN_ENCRYPTION_KEY &&
    context.env.SNAPSHOT_BUCKET?.get &&
    context.env.SNAPSHOT_BUCKET?.put,
  );
}

function isGggOAuthSnapshotCaptureConfigured(
  context: Context<{ Bindings: Bindings }>,
) {
  return Boolean(
    context.env.GGG_OAUTH_CLIENT_ID &&
    context.env.GGG_TOKEN_ENCRYPTION_KEY &&
    context.env.GGG_USER_AGENT &&
    context.env.SNAPSHOT_BUCKET?.get &&
    context.env.SNAPSHOT_BUCKET?.put,
  );
}

function getGggOAuthRedirectUri(context: Context<{ Bindings: Bindings }>) {
  const appUrl = context.env.APP_URL ?? "https://calandra.pages.dev";

  return `${appUrl.replace(/\/$/, "")}/auth/ggg/callback`;
}

function parseGggOAuthScopes(scopes: readonly string[] | undefined) {
  if (!scopes) {
    return { ok: true as const };
  }

  const allowedScopes = new Set(Object.values(gggOAuthScopes));

  if (scopes.some((scope) => !allowedScopes.has(scope as GggOAuthScope))) {
    return { ok: false as const };
  }

  return { ok: true as const, scopes: scopes as readonly GggOAuthScope[] };
}

function parseGggTokenEncryptionKey(value: string | undefined) {
  const decode = (globalThis as { atob?: (encoded: string) => string }).atob;

  if (!value || !decode) {
    throw new Error("GGG token encryption key is unavailable");
  }

  const base64 = value.trim().replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );
  const binary = decode(padded);

  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function createGggOAuthState() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const encode = (globalThis as { btoa?: (value: string) => string }).btoa;

  if (!encode) {
    throw new GggApiConfigurationError("base64 encoding support is required.");
  }

  return encode(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function buildStoredGggOAuthTokenMetadata(tokenSet: {
  expiresAt: string;
  scope: readonly string[];
  username?: string;
  sub?: string;
}) {
  return {
    expiresAt: tokenSet.expiresAt,
    scope: [...tokenSet.scope],
    ...(tokenSet.username ? { username: tokenSet.username } : {}),
    ...(tokenSet.sub ? { sub: tokenSet.sub } : {}),
  };
}
function parseStoredGggOAuthTokenObject(raw: string, account: string) {
  let value: unknown;

  try {
    value = JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch {
    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  if (
    value.account !== account ||
    value.provider !== "ggg" ||
    !isRecord(value.encryptedTokenSet)
  ) {
    return undefined;
  }

  return {
    encryptedTokenSet:
      value.encryptedTokenSet as unknown as EncryptedGggOAuthTokenSet,
  };
}

function parseStoredGggOAuthPendingState(
  raw: string,
  state: string,
  now: Date,
) {
  let value: unknown;

  try {
    value = JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch {
    return undefined;
  }

  if (
    !isRecord(value) ||
    value.provider !== "ggg" ||
    value.state !== state ||
    typeof value.account !== "string" ||
    !value.account.trim() ||
    typeof value.codeVerifier !== "string" ||
    !value.codeVerifier.trim() ||
    typeof value.redirectUri !== "string" ||
    !value.redirectUri.trim() ||
    !Array.isArray(value.scopes) ||
    value.scopes.some((scope) => typeof scope !== "string" || !scope.trim()) ||
    typeof value.expiresAt !== "string" ||
    Date.parse(value.expiresAt) <= now.valueOf()
  ) {
    return undefined;
  }

  return {
    account: value.account,
    codeVerifier: value.codeVerifier,
    redirectUri: value.redirectUri,
    scopes: value.scopes,
  };
}

function isGggOAuthTokenExpired(tokenSet: GggOAuthTokenSet, now: Date) {
  return Date.parse(tokenSet.expiresAt) <= now.valueOf();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getSnapshotAccountPrefix(
  context: Context<{ Bindings: Bindings }>,
  account: string,
) {
  const prefix = context.env.SNAPSHOT_R2_PREFIX ?? "snapshots";

  return `${prefix}/${encodeURIComponent(account)}/`;
}

function isSnapshotWriteAuthorized(context: Context<{ Bindings: Bindings }>) {
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

function matchesItem(item: DatasetArtifact["items"][number], query: string) {
  return [item.id, item.name, item.category, item.rarity].some((value) =>
    normalizeSearchValue(value).includes(query),
  );
}

function matchesMod(mod: DatasetArtifact["mods"][number], query: string) {
  return [
    mod.id,
    mod.name,
    mod.domain,
    mod.generationType,
    mod.family,
    ...(mod.tags ?? []),
    ...(mod.stats?.flatMap((stat) => [stat.id, stat.text]) ?? []),
  ].some((value) => value && normalizeSearchValue(value).includes(query));
}

function matchesGem(gem: DatasetArtifact["gems"][number], query: string) {
  return [gem.id, gem.name, gem.kind, ...(gem.tags ?? [])].some((value) =>
    normalizeSearchValue(value).includes(query),
  );
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

function getDatasetSearchQuery(context: Context<{ Bindings: Bindings }>) {
  const version = getVersionedQuery(context);
  const q = context.req.query("q")?.trim();

  if (!version.ok || !q) {
    return {
      ok: false as const,
      body: { error: "league, patch, and q query parameters are required" },
    };
  }

  return { ok: true as const, league: version.league, patch: version.patch, q };
}

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
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
