import {
  accountSnapshotDiffSchema,
  accountSnapshotListResponseSchema,
  accountSnapshotSchema,
  accountSnapshotStoredDiffRequestSchema,
  datasetManifestSchema,
  datasetCraftingEstimateRequestSchema,
  datasetCraftingEstimateResponseSchema,
  datasetSearchResponseSchema,
  economyCollectionSchema,
  gggOAuthCompleteRequestSchema,
  gggOAuthStartRequestSchema,
  gggOAuthStartResponseSchema,
  gggOAuthStatusResponseSchema,
  gggOAuthTokenExchangeResponseSchema,
  itemCollectionSchema,
  ladderBuildCollectionSchema,
  ladderBuildSchema,
  priceCheckTextRequestSchema,
  priceCheckTextResponseSchema,
  snapshotUpgradeAdvisorRequestSchema,
  uniqueCollectionSchema,
  upgradeAdvisorResponseSchema,
  type AccountSnapshot,
  type AccountSnapshotDiff,
  type AccountSnapshotListItem,
  type DatasetManifest,
  type DatasetCraftingEstimateResponse,
  type DatasetSearchResponse,
  type EconomyPrice,
  type GggOAuthCompleteRequest,
  type GggOAuthStartResponse,
  type GggOAuthStatusResponse,
  type GggOAuthTokenExchangeResponse,
  type Item,
  type LadderBuild,
  type PriceCheckTextResponse,
  type UniqueItem,
  type UpgradeAdvisorResponse,
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

export type DashboardLadderBuilds = {
  source: "api" | "fallback";
  builds: LadderBuild[];
};

export type DashboardLadderBuild = {
  source: "api" | "fallback";
  build: LadderBuild | null;
};

export type DashboardSnapshotAdvisor = {
  source: "api" | "fallback";
  response: UpgradeAdvisorResponse;
};

export type DashboardCraftingEstimate = {
  source: "api" | "fallback";
  response: DatasetCraftingEstimateResponse;
};

export type DashboardPriceCheck = {
  source: "api" | "fallback";
  response: PriceCheckTextResponse;
};

export type DashboardLadderBuildFilters = {
  className?: string;
  skill?: string;
  limit?: number;
};

type DashboardSnapshotReadOptions = {
  snapshotReadToken?: string;
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

const fallbackDemoSnapshotId = "fallback-demo-snapshot";
const fallbackDemoCapturedAt = "2026-06-21T10:00:00.000Z";

const fallbackLadderBuilds: LadderBuild[] = [
  {
    id: "demo-resurrect-god-aura",
    account: "heygyus-0416",
    character: "ResurrectGodAura",
    className: "Martial Artist",
    level: 95,
    rank: 18,
    mainSkill: "Twister",
    passiveTreeUrl:
      "https://poe.ninja/poe2/builds/runesofaldur/character/heygyus-0416/ResurrectGodAura/passive-tree",
    passiveSkillIds: ["aura-wheel", "spirit-path", "reservation"],
    passiveTree: {
      url: "https://poe.ninja/poe2/builds/runesofaldur/character/heygyus-0416/ResurrectGodAura/passive-tree",
      allocatedCount: 95,
      keystones: ["Acrobatics"],
      notables: ["Aura wheel", "Spirit reservation", "Deflection"],
      ascendancy: "Martial Artist",
      classStart: "Monk",
      summary:
        "Aura pathing, spirit reservation, and defensive wheel coverage.",
    },
    equipment: [
      {
        slot: "Gloves",
        name: "Duskthread Grips",
        rarity: "rare",
        iconUrl: "https://calandra.pages.dev/demo-gloves.svg",
        iconAttribution:
          "Synthetic Calandra demo icon; no game art is bundled.",
        stats: { life: 65, fireResistance: 18 },
      },
    ],
    updatedAt: "2026-06-21T13:15:00.000Z",
  },
];

const dashboardAdvisorRequest = snapshotUpgradeAdvisorRequestSchema.parse({
  weights: { life: 1, fireResistance: 0.5, movementSpeed: 0.75 },
  maxBudgetChaos: 20,
});

const dashboardCraftingRequest = datasetCraftingEstimateRequestSchema.parse({
  itemLevel: 68,
  currencyCostChaos: 2,
  targetModIds: ["life-t2"],
  marketPriceChaos: 12,
});

const dashboardPriceCheckRequest = priceCheckTextRequestSchema.parse({
  ...dashboardDatasetVersion,
  text: `
Item Class: Stackable Currency
Rarity: Currency
Divine Orb
--------
Stack Size: 1/10
`,
});

const fallbackAdvisorResponse: UpgradeAdvisorResponse = {
  source: "deterministic-engine",
  upgrades: [
    {
      slot: "Gloves",
      currentName: "Frayed Mail Mitts",
      candidateName: "Duskthread Grips",
      currentScore: 58.2,
      candidateScore: 101.6,
      scoreDelta: 43.4,
      estimatedCostChaos: 3,
      valuePerChaos: 14.4667,
      currentMissingStats: ["fireResistance", "attackSpeed"],
      candidateMissingStats: [],
    },
    {
      slot: "Amulet",
      currentName: "Amber Talisman",
      candidateName: "Stormbind Charm",
      currentScore: 76.8,
      candidateScore: 98,
      scoreDelta: 21.2,
      estimatedCostChaos: 8,
      valuePerChaos: 2.65,
      currentMissingStats: ["lightningDamage"],
      candidateMissingStats: ["life"],
    },
    {
      slot: "Boots",
      currentName: "Threadbare Shoes",
      candidateName: "Wanderstep Boots",
      currentScore: 64,
      candidateScore: 79.5,
      scoreDelta: 15.5,
      estimatedCostChaos: 5,
      valuePerChaos: 3.1,
      currentMissingStats: ["movementSpeed"],
      candidateMissingStats: [],
    },
  ],
};

const fallbackCraftingEstimateResponse: DatasetCraftingEstimateResponse = {
  source: "published-dataset",
  league: dashboardDatasetVersion.league,
  patch: dashboardDatasetVersion.patch,
  estimate: {
    source: "deterministic-engine",
    itemLevel: 68,
    currencyCostChaos: 2,
    eligibleModCount: 2,
    totalEligibleWeight: 400,
    eligibleTargetModIds: ["life-t2"],
    blockedTargetModIds: [],
    hitProbability: 0.25,
    expectedAttempts: 4,
    expectedCostChaos: 8,
  },
  comparison: {
    source: "deterministic-engine",
    recommendation: "craft",
    marketPriceChaos: 12,
    expectedCraftCostChaos: 8,
    savingsChaos: 4,
    estimate: {
      itemLevel: 68,
      currencyCostChaos: 2,
      eligibleModCount: 2,
      totalEligibleWeight: 400,
      eligibleTargetModIds: ["life-t2"],
      blockedTargetModIds: [],
      hitProbability: 0.25,
      expectedAttempts: 4,
      expectedCostChaos: 8,
    },
  },
};

const fallbackPriceCheckResponse: PriceCheckTextResponse = {
  source: "published-dataset",
  ...dashboardDatasetVersion,
  item: {
    id: "currency/divine-orb",
    name: "Divine Orb",
    category: "currency",
    rarity: "currency",
  },
  parsedItem: {
    itemClass: "Stackable Currency",
    category: "currency",
    rarity: "currency",
    name: "Divine Orb",
    properties: [{ name: "Stack Size", value: "1/10", augmented: false }],
    requirements: [],
    implicitMods: [],
    explicitMods: [],
    corrupted: false,
    identified: true,
  },
  price: {
    id: "divine-orb",
    name: "Divine Orb",
    chaosEquivalent: 142,
    updatedAt: "2026-06-21T13:15:00.000Z",
  },
  matchedBy: "name",
};

function fallbackSnapshots(account: string): DashboardSnapshots {
  return {
    source: "fallback",
    account,
    snapshots: [
      {
        account,
        snapshotId: fallbackDemoSnapshotId,
        objectKey: `fallback/${account}/${fallbackDemoSnapshotId}.json`,
        uploadedAt: "2026-06-21T10:01:00.000Z",
        size: 768,
      },
    ],
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
  options: DashboardSnapshotReadOptions = {},
): Promise<DashboardSnapshots> {
  try {
    const snapshotList = accountSnapshotListResponseSchema.parse(
      await fetchJson(
        fetchImplementation,
        `${apiBaseUrl}/snapshots/${encodeURIComponent(account)}`,
        (value) => value,
        getSnapshotReadRequestInit(options),
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

export async function getDashboardCraftingEstimate(
  apiBaseUrl = defaultApiBaseUrl,
  fetchImplementation: typeof fetch = fetch,
): Promise<DashboardCraftingEstimate> {
  try {
    const query = new URLSearchParams(dashboardDatasetVersion);
    const response = await fetchJson(
      fetchImplementation,
      `${apiBaseUrl}/crafting/estimate-from-dataset?${query.toString()}`,
      datasetCraftingEstimateResponseSchema.parse,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(dashboardCraftingRequest),
      },
    );

    return { source: "api", response };
  } catch {
    return {
      source: "fallback",
      response: fallbackCraftingEstimateResponse,
    };
  }
}

export async function getDashboardPriceCheck(
  apiBaseUrl = defaultApiBaseUrl,
  fetchImplementation: typeof fetch = fetch,
): Promise<DashboardPriceCheck> {
  try {
    const response = await fetchJson(
      fetchImplementation,
      `${apiBaseUrl}/price/check-text`,
      priceCheckTextResponseSchema.parse,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(dashboardPriceCheckRequest),
      },
    );

    return { source: "api", response };
  } catch {
    return { source: "fallback", response: fallbackPriceCheckResponse };
  }
}

export async function getDashboardLatestSnapshot(
  account: string,
  snapshots: AccountSnapshotListItem[],
  apiBaseUrl = defaultApiBaseUrl,
  fetchImplementation: typeof fetch = fetch,
  options: DashboardSnapshotReadOptions = {},
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
      getSnapshotReadRequestInit(options),
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

export async function getDashboardLadderBuilds(
  apiBaseUrl = defaultApiBaseUrl,
  fetchImplementation: typeof fetch = fetch,
  filters: DashboardLadderBuildFilters = {},
): Promise<DashboardLadderBuilds> {
  try {
    const query = new URLSearchParams(dashboardDatasetVersion);
    if (filters.className) query.set("className", filters.className);
    if (filters.skill) query.set("skill", filters.skill);
    if (filters.limit) query.set("limit", String(filters.limit));
    const collection = await fetchJson(
      fetchImplementation,
      `${apiBaseUrl}/builds/ladder?${query.toString()}`,
      ladderBuildCollectionSchema.parse,
    );

    return {
      source: "api",
      builds: collection.builds,
    };
  } catch {
    return {
      source: "fallback",
      builds: fallbackLadderBuilds,
    };
  }
}

export async function getDashboardLadderBuild(
  id: string | undefined,
  apiBaseUrl = defaultApiBaseUrl,
  fetchImplementation: typeof fetch = fetch,
): Promise<DashboardLadderBuild> {
  if (!id) return { source: "fallback", build: null };

  try {
    const query = new URLSearchParams(dashboardDatasetVersion);
    const build = await fetchJson(
      fetchImplementation,
      `${apiBaseUrl}/builds/ladder/${encodeURIComponent(id)}?${query.toString()}`,
      ladderBuildSchema.parse,
    );

    return { source: "api", build };
  } catch {
    return {
      source: "fallback",
      build: fallbackLadderBuilds.find((build) => build.id === id) ?? null,
    };
  }
}

export async function getDashboardSnapshotAdvisor(
  account: string,
  snapshotId: string | undefined,
  apiBaseUrl = defaultApiBaseUrl,
  fetchImplementation: typeof fetch = fetch,
  options: DashboardSnapshotReadOptions = {},
): Promise<DashboardSnapshotAdvisor> {
  if (!snapshotId) {
    return { source: "fallback", response: fallbackAdvisorResponse };
  }

  try {
    const query = new URLSearchParams(dashboardDatasetVersion);
    const response = await fetchJson(
      fetchImplementation,
      `${apiBaseUrl}/advisor/snapshots/${encodeURIComponent(
        account,
      )}/${encodeURIComponent(snapshotId)}?${query.toString()}`,
      upgradeAdvisorResponseSchema.parse,
      getSnapshotAdvisorRequestInit(options),
    );

    return { source: "api", response };
  } catch {
    return { source: "fallback", response: fallbackAdvisorResponse };
  }
}

export async function getDashboardSnapshotDiff(
  account: string,
  snapshots: AccountSnapshotListItem[],
  apiBaseUrl = defaultApiBaseUrl,
  fetchImplementation: typeof fetch = fetch,
  options: DashboardSnapshotReadOptions = {},
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
      getSnapshotReadRequestInit(options),
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
  const normalizedQuery = query.toLowerCase();
  const matchedItems = normalizedQuery
    ? fallbackDataset.items.filter((item) =>
        [item.id, item.name, item.category, item.rarity].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        ),
      )
    : [];

  return {
    source: "fallback",
    ...dashboardDatasetVersion,
    query,
    items: matchedItems.filter((item) => !isUniqueItem(item)),
    uniques: matchedItems.filter(isUniqueItem),
    mods: [],
    gems: [],
  };
}

function getSnapshotReadRequestInit({
  snapshotReadToken,
}: DashboardSnapshotReadOptions): RequestInit | undefined {
  const token = snapshotReadToken?.trim();

  return token ? { headers: { authorization: `Bearer ${token}` } } : undefined;
}

function getSnapshotAdvisorRequestInit({
  snapshotReadToken,
}: DashboardSnapshotReadOptions): RequestInit {
  const token = snapshotReadToken?.trim();

  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(dashboardAdvisorRequest),
  };
}

function isUniqueItem(item: Item | UniqueItem): item is UniqueItem {
  return (
    item.rarity === "unique" &&
    typeof item.iconUrl === "string" &&
    typeof item.iconAttribution === "string"
  );
}

function fallbackLatestSnapshot(
  account: string,
  reason: Exclude<DashboardLatestSnapshot["reason"], "ready">,
): DashboardLatestSnapshot {
  return {
    source: "fallback",
    reason,
    account,
    snapshot: createFallbackAccountSnapshot(account),
  };
}

function createFallbackAccountSnapshot(account: string): AccountSnapshot {
  return {
    id: fallbackDemoSnapshotId,
    account,
    capturedAt: fallbackDemoCapturedAt,
    source: "manual-import",
    capabilities: { characters: true, stashes: true },
    characters: [
      {
        id: "char-1",
        name: "Monkette",
        className: "Monk",
        level: 45,
        league: dashboardDatasetVersion.league,
        passiveSkillIds: ["passive-1", "passive-2"],
        equipment: [
          {
            slot: "Gloves",
            name: "Duskthread Grips",
            rarity: "rare",
            stats: { life: 65, fireResistance: 18 },
          },
          {
            slot: "Amulet",
            name: "Calandra Demo Amulet",
            rarity: "unique",
            stats: { spirit: 30 },
          },
        ],
      },
    ],
    stashes: [
      {
        id: "stash-1",
        name: "Currency Tab",
        league: dashboardDatasetVersion.league,
        items: [
          { slot: "stash", name: "Exalted Orb" },
          { slot: "stash", name: "Divine Orb" },
        ],
      },
    ],
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
