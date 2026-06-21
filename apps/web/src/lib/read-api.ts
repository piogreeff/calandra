import {
  economyCollectionSchema,
  itemCollectionSchema,
  uniqueCollectionSchema,
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
};

export async function getDashboardDataset(
  apiBaseUrl = defaultApiBaseUrl,
  fetchImplementation: typeof fetch = fetch,
): Promise<DashboardDataset> {
  try {
    const query = new URLSearchParams(dashboardDatasetVersion);
    const [itemCollection, uniqueCollection, economyCollection] =
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
      ]);

    return {
      source: "api",
      items: [...itemCollection.items, ...uniqueCollection.uniques],
      prices: economyCollection.prices,
    };
  } catch {
    return fallbackDataset;
  }
}

async function fetchJson<T>(
  fetchImplementation: typeof fetch,
  url: string,
  parse: (value: unknown) => T,
) {
  const response = await fetchImplementation(url);

  if (!response.ok) {
    throw new Error(`Calandra API request failed with HTTP ${response.status}`);
  }

  return parse(await response.json());
}
