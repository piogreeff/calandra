import {
  accountSnapshotDiffSchema,
  accountSnapshotListResponseSchema,
  accountSnapshotStoredDiffRequestSchema,
  datasetManifestSchema,
  economyCollectionSchema,
  itemCollectionSchema,
  uniqueCollectionSchema,
  type AccountSnapshotDiff,
  type AccountSnapshotListItem,
  type DatasetManifest,
  type EconomyPrice,
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
