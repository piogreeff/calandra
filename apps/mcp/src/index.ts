import {
  accountSnapshotDiffRequestSchema,
  accountSnapshotDiffSchema,
  buyVsCraftRequestSchema,
  buyVsCraftResponseSchema,
  craftingEstimateRequestSchema,
  craftingEstimateResponseSchema,
  economyCollectionSchema,
  itemCollectionSchema,
  upgradeAdvisorRequestSchema,
  upgradeAdvisorResponseSchema,
} from "@calandra/contract";
import { z } from "zod";

export type CalandraMcpToolName =
  | "search_items"
  | "price_item"
  | "recommend_upgrade"
  | "estimate_crafting"
  | "compare_buy_vs_craft"
  | "diff_snapshots"
  | "get_economy";

export interface CalandraMcpTool {
  name: CalandraMcpToolName;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface McpToolResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
}

export interface CalandraMcpServerOptions {
  apiBaseUrl: string;
  fetch?: FetchLike;
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const versionedToolProperties = {
  league: { type: "string", minLength: 1 },
  patch: { type: "string", minLength: 1 },
};

const searchItemsInputSchema = z.object({
  league: z.string().min(1),
  patch: z.string().min(1),
  query: z.string().min(1),
});

const economyInputSchema = z.object({
  league: z.string().min(1),
  patch: z.string().min(1),
});

const priceItemInputSchema = economyInputSchema.extend({
  item: z.string().min(1),
});

export function listCalandraMcpTools(): CalandraMcpTool[] {
  return [
    {
      name: "search_items",
      description:
        "Search Calandra's patch-versioned item database by item name, id, category, or rarity.",
      inputSchema: {
        type: "object",
        properties: {
          ...versionedToolProperties,
          query: { type: "string", minLength: 1 },
        },
        required: ["league", "patch", "query"],
      },
    },
    {
      name: "price_item",
      description:
        "Find one economy price from Calandra's patch-versioned economy data.",
      inputSchema: {
        type: "object",
        properties: {
          ...versionedToolProperties,
          item: { type: "string", minLength: 1 },
        },
        required: ["league", "patch", "item"],
      },
    },
    {
      name: "recommend_upgrade",
      description:
        "Rank gear upgrade candidates with Calandra's deterministic engine.",
      inputSchema: {
        type: "object",
        properties: {
          weights: { type: "object", additionalProperties: { type: "number" } },
          equipped: { type: "array" },
          candidates: { type: "array" },
          maxBudgetChaos: { type: "number", minimum: 0 },
        },
        required: ["weights", "equipped", "candidates"],
      },
    },
    {
      name: "estimate_crafting",
      description:
        "Estimate crafting odds and expected chaos cost with Calandra's deterministic engine.",
      inputSchema: {
        type: "object",
        properties: {
          itemLevel: { type: "number", minimum: 0 },
          currencyCostChaos: { type: "number", minimum: 0 },
          targetModIds: { type: "array" },
          modPool: { type: "array" },
        },
        required: ["itemLevel", "currencyCostChaos", "targetModIds", "modPool"],
      },
    },
    {
      name: "compare_buy_vs_craft",
      description:
        "Compare a market buy price against deterministic expected crafting cost.",
      inputSchema: {
        type: "object",
        properties: {
          marketPriceChaos: { type: "number", minimum: 0 },
          crafting: { type: "object" },
        },
        required: ["marketPriceChaos", "crafting"],
      },
    },
    {
      name: "diff_snapshots",
      description:
        "Compare two Calandra account snapshots with the deterministic engine.",
      inputSchema: {
        type: "object",
        properties: {
          before: { type: "object" },
          after: { type: "object" },
        },
        required: ["before", "after"],
      },
    },
    {
      name: "get_economy",
      description: "Fetch Calandra's economy prices for one league and patch.",
      inputSchema: {
        type: "object",
        properties: versionedToolProperties,
        required: ["league", "patch"],
      },
    },
  ];
}

export function createCalandraMcpServer(options: CalandraMcpServerOptions) {
  const apiBaseUrl = normalizeBaseUrl(options.apiBaseUrl);
  const fetchImplementation = options.fetch ?? fetch;

  return {
    listTools: listCalandraMcpTools,
    async callTool(
      name: CalandraMcpToolName,
      input: unknown,
    ): Promise<McpToolResult> {
      switch (name) {
        case "search_items":
          return jsonToolResult(
            await searchItems(apiBaseUrl, fetchImplementation, input),
          );
        case "price_item":
          return jsonToolResult(
            await priceItem(apiBaseUrl, fetchImplementation, input),
          );
        case "recommend_upgrade":
          return jsonToolResult(
            await recommendUpgrade(apiBaseUrl, fetchImplementation, input),
          );
        case "estimate_crafting":
          return jsonToolResult(
            await estimateCrafting(apiBaseUrl, fetchImplementation, input),
          );
        case "compare_buy_vs_craft":
          return jsonToolResult(
            await compareBuyVsCraft(apiBaseUrl, fetchImplementation, input),
          );
        case "diff_snapshots":
          return jsonToolResult(
            await diffSnapshots(apiBaseUrl, fetchImplementation, input),
          );
        case "get_economy":
          return jsonToolResult(
            await getEconomy(apiBaseUrl, fetchImplementation, input),
          );
        default:
          throw new Error(`Unknown Calandra MCP tool: ${String(name)}`);
      }
    },
  };
}

async function searchItems(
  apiBaseUrl: string,
  fetchImplementation: FetchLike,
  input: unknown,
) {
  const parsed = searchItemsInputSchema.parse(input);
  const collection = itemCollectionSchema.parse(
    await fetchJson(
      fetchImplementation,
      `${apiBaseUrl}/items?${versionedQuery(parsed)}`,
    ),
  );
  const query = parsed.query.toLowerCase();

  return collection.items.filter((item) =>
    [item.id, item.name, item.category, item.rarity].some((value) =>
      value.toLowerCase().includes(query),
    ),
  );
}

async function priceItem(
  apiBaseUrl: string,
  fetchImplementation: FetchLike,
  input: unknown,
) {
  const parsed = priceItemInputSchema.parse(input);
  const economy = await getEconomy(apiBaseUrl, fetchImplementation, parsed);
  const item = parsed.item.toLowerCase();

  return (
    economy.prices.find((price) =>
      [price.id, price.name].some((value) =>
        value.toLowerCase().includes(item),
      ),
    ) ?? null
  );
}

async function recommendUpgrade(
  apiBaseUrl: string,
  fetchImplementation: FetchLike,
  input: unknown,
) {
  const request = upgradeAdvisorRequestSchema.parse(input);

  return upgradeAdvisorResponseSchema.parse(
    await fetchJson(fetchImplementation, `${apiBaseUrl}/advisor/upgrades`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    }),
  );
}

async function estimateCrafting(
  apiBaseUrl: string,
  fetchImplementation: FetchLike,
  input: unknown,
) {
  const request = craftingEstimateRequestSchema.parse(input);

  return craftingEstimateResponseSchema.parse(
    await fetchJson(fetchImplementation, `${apiBaseUrl}/crafting/estimate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    }),
  );
}

async function compareBuyVsCraft(
  apiBaseUrl: string,
  fetchImplementation: FetchLike,
  input: unknown,
) {
  const request = buyVsCraftRequestSchema.parse(input);

  return buyVsCraftResponseSchema.parse(
    await fetchJson(
      fetchImplementation,
      `${apiBaseUrl}/crafting/buy-vs-craft`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      },
    ),
  );
}

async function diffSnapshots(
  apiBaseUrl: string,
  fetchImplementation: FetchLike,
  input: unknown,
) {
  const request = accountSnapshotDiffRequestSchema.parse(input);

  return accountSnapshotDiffSchema.parse(
    await fetchJson(fetchImplementation, `${apiBaseUrl}/snapshots/diff`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    }),
  );
}

async function getEconomy(
  apiBaseUrl: string,
  fetchImplementation: FetchLike,
  input: unknown,
) {
  const parsed = economyInputSchema.parse(input);

  return economyCollectionSchema.parse(
    await fetchJson(
      fetchImplementation,
      `${apiBaseUrl}/economy/${encodeURIComponent(parsed.league)}?patch=${encodeURIComponent(parsed.patch)}`,
    ),
  );
}

async function fetchJson(
  fetchImplementation: FetchLike,
  url: string,
  init?: RequestInit,
) {
  const response = await fetchImplementation(url, init);
  if (!response.ok) {
    throw new Error(`Calandra API request failed with HTTP ${response.status}`);
  }

  return response.json();
}

function versionedQuery(input: { league: string; patch: string }) {
  const params = new URLSearchParams({
    league: input.league,
    patch: input.patch,
  });

  return params.toString();
}

function normalizeBaseUrl(apiBaseUrl: string) {
  return apiBaseUrl.replace(/\/+$/, "");
}

function jsonToolResult(value: unknown): McpToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}
