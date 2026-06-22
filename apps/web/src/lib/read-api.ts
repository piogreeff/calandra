import {
  accountSnapshotDiffSchema,
  accountSnapshotListResponseSchema,
  accountSnapshotSchema,
  accountSnapshotStoredDiffRequestSchema,
  datasetManifestSchema,
  datasetSearchResponseSchema,
  economyCollectionSchema,
  gggOAuthCompleteRequestSchema,
  gggOAuthStartRequestSchema,
  gggOAuthStartResponseSchema,
  gggOAuthStatusResponseSchema,
  gggOAuthTokenExchangeResponseSchema,
  itemCollectionSchema,
  uniqueCollectionSchema,
  type AccountSnapshot,
  type AccountSnapshotDiff,
  type AccountSnapshotListItem,
  type DatasetManifest,
  type DatasetSearchResponse,
  type EconomyPrice,
  type GggOAuthCompleteRequest,
  type GggOAuthStartResponse,
  type GggOAuthStatusResponse,
  type GggOAuthTokenExchangeResponse,
  type Item,
  type UniqueItem,
} from "@calandra/contract";

export const defaultApiBaseUrl =
  process.env["NEXT_PUBLIC_API_URL"] ??
  "https://calandra-api.piogreeff.workers.dev";

export const dashboardDatasetVersion = {
  league: "Dawn of the Hunt",
  patch: "0.2.0",
} as const;

export type DashboardDataset = {
  source: "api" | "fallback";
  items: Array<Item | UniqueItem>;
  prices: EconomyPrice[];
  manifest: DatasetManifest;
};

export type DashboardSnapshots = {
  source: "api" | "fallback";
  account: string;
  snapshots: AccountSnapshotListItem[];
};

export type DashboardSnapshotDiff = {
  source: "api" | "fallback";
  reason: "ready" | "insufficient-snapshots" | "unavailable";
  account: string;
  diff: AccountSnapshotDiff | null;
};

export type DashboardLatestSnapshot = {
  source: "api" | "fallback";
  reason: "ready" | "no-snapshots" | "unavailable";
  account: string;
  snapshot: AccountSnapshot | null;
};

export type DashboardGggOAuthStatus = Omit<GggOAuthStatusResponse, "source"> & {
  source: "api" | "fallback";
};

export type DashboardSearchResults = DatasetSearchResponse & {
  source: "api" | "fallback";
};

const fallbackDataset: DashboardDataset = {
  source: "fallback",
  items: [
    {
      id: "calandra-demo-wand",
      name: "Calandra Demo Wand",
      category: "wand",
      rarity: "magic",
    },
    {
      id: "calandra-demo-robe",
      name: "Calandra Demo Robe",
      category: "body-armour",
      rarity: "normal",
    },
    {
      id: "calandra-demo-amulet",
      name: "Calandra Demo Amulet",
      category: "amulet",
      rarity: "unique",
      iconUrl: "https://calandra.pages.dev/demo-unique-placeholder.png",
      iconAttribution:
        "Placeholder demo icon URL; no game art is bundled or served by this artifact.",
    },
  ],
  prices: [
    {
      id: "demo-divine-orb",
      name: "Divine Orb",
      chaosEquivalent: 142,
      updatedAt: "2026-06-21T13:15:00.000Z",
    },
    {
      id: "demo-exalted-orb",
      name: "Exalted Orb",
      chaosEquivalent: 1,
      updatedAt: "2026-06-21T13:15:00.000Z",
    },
  ],
  manifest: {
    league: dashboardDatasetVersion.league,
    patch: dashboardDatasetVersion.patch,
    generatedAt: "2026-06-21T13:15:00.000Z",
    artifactKey: "fallback/demo-dataset.json",
    sha256: "0".repeat(64),
    sources: [
      {
        kind: "game-data",
        name: "Calandra demo dataset",
        url: "https://calandra.pages.dev",
        attribution:
          "Fallback demo rows are synthetic and do not bundle Path of Exile 2 game data or art.",
      },
    ],
    counts: {
      items: 2,
      uniques: 1,
      mods: 0,
      gems: 0,
      economy: 2,
      ladderBuilds: 0,
    },
  },
};

function fallbackSnapshots(account: string): DashboardSnapshots {
  return {
    source: "fallback",
    account,
    snapshots: [],
  };
}

function fallbackSnapshotDiff(
  account: string,
  reason: Exclude<DashboardSnapshotDiff["reason"], "ready">,
): DashboardSnapshotDiff {
  return {
    source: "fallback",
    reason,
    account,
    diff: null,
  };
}

function fallbackGggOAuthStatus(): DashboardGggOAuthStatus {
  return {
    source: "fallback",
    configured: false,
    redirectUri: "https://calandra.pages.dev/auth/ggg/callback",
    requiredScopes: ["account:characters"],
    features: {
      accountLinking: false,
      snapshotCapture: false,
    },
  };
}

export async function getDashboardDataset(
  apiBaseUrl = defaultApiBaseUrl,
  fetchImplementation: typeof fetch = fetch,
): Promise<DashboardDataset> {
  try {
    const query = new URLSearchParams(dashboardDatasetVersion);
    const [itemCollection, uniqueCollection, economyCollection, manifest] =
      await Promise.all([
        fetchJson(
          fetchImplementation,
          `${apiBaseUrl}/items?${query.toString()}`,
          itemCollectionSchema.parse,
        ),
        fetchJson(
          fetchImplementation,
          `${apiBaseUrl}/uniques?${query.toString()}`,
          uniqueCollectionSchema.parse,
        ),
        fetchJson(
          fetchImplementation,
          `${apiBaseUrl}/economy/${encodeURIComponent(
            dashboardDatasetVersion.league,
          )}?patch=${encodeURIComponent(dashboardDatasetVersion.patch)}`,
          economyCollectionSchema.parse,
        ),
        fetchJson(
          fetchImplementation,
          `${apiBaseUrl}/datasets/manifest?${query.toString()}`,
          datasetManifestSchema.parse,
        ),
      ]);

    return {
      source: "api",
      items: [...itemCollection.items, ...uniqueCollection.uniques],
      prices: economyCollection.prices,
      manifest,
    };
  } catch {
    return fallbackDataset;
  }
}

export async function getDashboardSnapshots(
  account: string,
  apiBaseUrl = defaultApiBaseUrl,
  fetchImplementation: typeof fetch = fetch,
): Promise<DashboardSnapshots> {
  try {
    const snapshotList = accountSnapshotListResponseSchema.parse(
      await fetchJson(
        fetchImplementation,
        `${apiBaseUrl}/snapshots/${encodeURIComponent(account)}`,
        (value) => value,
      ),
    );

    return {
      source: "api",
      account: snapshotList.account,
      snapshots: snapshotList.snapshots,
    };
  } catch {
    return fallbackSnapshots(account);
  }
}

export async function getDashboardGggOAuthStatus(
  apiBaseUrl = defaultApiBaseUrl,
  fetchImplementation: typeof fetch = fetch,
): Promise<DashboardGggOAuthStatus> {
  try {
    const status = await fetchJson(
      fetchImplementation,
      `${apiBaseUrl}/auth/ggg/status`,
      gggOAuthStatusResponseSchema.parse,
    );

    return {
      source: "api",
      configured: status.configured,
      redirectUri: status.redirectUri,
      requiredScopes: status.requiredScopes,
      features: status.features,
    };
  } catch {
    return fallbackGggOAuthStatus();
  }
}

export async function getDashboardLatestSnapshot(
  account: string,
  snapshots: AccountSnapshotListItem[],
  apiBaseUrl = defaultApiBaseUrl,
  fetchImplementation: typeof fetch = fetch,
): Promise<DashboardLatestSnapshot> {
  const latestSnapshot = snapshots[snapshots.length - 1];

  if (!latestSnapshot) {
    return fallbackLatestSnapshot(account, "no-snapshots");
  }

  try {
    const snapshot = await fetchJson(
      fetchImplementation,
      `${apiBaseUrl}/snapshots/${encodeURIComponent(
        account,
      )}/${encodeURIComponent(latestSnapshot.snapshotId)}`,
      accountSnapshotSchema.parse,
    );

    return {
      source: "api",
      reason: "ready",
      account,
      snapshot,
    };
  } catch {
    return fallbackLatestSnapshot(account, "unavailable");
  }
}

export async function startDashboardGggOAuthLink(
  account: string,
  apiBaseUrl = defaultApiBaseUrl,
  fetchImplementation: typeof fetch = fetch,
): Promise<GggOAuthStartResponse> {
  const request = gggOAuthStartRequestSchema.parse({ account });

  return fetchJson(
    fetchImplementation,
    `${apiBaseUrl}/auth/ggg/start`,
    gggOAuthStartResponseSchema.parse,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    },
  );
}

export async function completeDashboardGggOAuthLink(
  request: GggOAuthCompleteRequest,
  apiBaseUrl = defaultApiBaseUrl,
  fetchImplementation: typeof fetch = fetch,
): Promise<GggOAuthTokenExchangeResponse> {
  const parsedRequest = gggOAuthCompleteRequestSchema.parse(request);

  return fetchJson(
    fetchImplementation,
    `${apiBaseUrl}/auth/ggg/complete`,
    gggOAuthTokenExchangeResponseSchema.parse,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsedRequest),
    },
  );
}

export async function getDashboardSearch(
  query: string,
  apiBaseUrl = defaultApiBaseUrl,
  fetchImplementation: typeof fetch = fetch,
): Promise<DashboardSearchResults> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return fallbackSearchResults("");
  }

  try {
    const params = new URLSearchParams({
      ...dashboardDatasetVersion,
      q: normalizedQuery,
    });
    const results = await fetchJson(
      fetchImplementation,
      `${apiBaseUrl}/search?${params.toString()}`,
      datasetSearchResponseSchema.parse,
    );

    return {
      source: "api",
      ...results,
    };
  } catch {
    return fallbackSearchResults(normalizedQuery);
  }
}

export async function getDashboardSnapshotDiff(
  account: string,
  snapshots: AccountSnapshotListItem[],
  apiBaseUrl = defaultApiBaseUrl,
  fetchImplementation: typeof fetch = fetch,
): Promise<DashboardSnapshotDiff> {
  const [beforeSnapshot, afterSnapshot] = snapshots.slice(-2);

  if (!beforeSnapshot || !afterSnapshot) {
    return fallbackSnapshotDiff(account, "insufficient-snapshots");
  }

  try {
    const request = accountSnapshotStoredDiffRequestSchema.parse({
      account,
      beforeSnapshotId: beforeSnapshot.snapshotId,
      afterSnapshotId: afterSnapshot.snapshotId,
    });
    const query = new URLSearchParams({
      beforeSnapshotId: request.beforeSnapshotId,
      afterSnapshotId: request.afterSnapshotId,
    });

    const diff = await fetchJson(
      fetchImplementation,
      `${apiBaseUrl}/snapshots/${encodeURIComponent(
        request.account,
      )}/diff?${query.toString()}`,
      accountSnapshotDiffSchema.parse,
    );

    return {
      source: "api",
      reason: "ready",
      account,
      diff,
    };
  } catch {
    return fallbackSnapshotDiff(account, "unavailable");
  }
}

function fallbackSearchResults(query: string): DashboardSearchResults {
  return {
    source: "fallback",
    ...dashboardDatasetVersion,
    query,
    items: [],
    uniques: [],
    mods: [],
    gems: [],
  };
}

function fallbackLatestSnapshot(
  account: string,
  reason: Exclude<DashboardLatestSnapshot["reason"], "ready">,
): DashboardLatestSnapshot {
  return {
    source: "fallback",
    reason,
    account,
    snapshot: null,
  };
}

async function fetchJson<T>(
  fetchImplementation: typeof fetch,
  url: string,
  parse: (value: unknown) => T,
  init?: RequestInit,
) {
  const response =
    init === undefined
      ? await fetchImplementation(url)
      : await fetchImplementation(url, init);

  if (!response.ok) {
    throw new Error(`Calandra API request failed with HTTP ${response.status}`);
  }

  return parse(await response.json());
}
