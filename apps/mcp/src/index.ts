import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import {
  accountSnapshotDiffRequestSchema,
  accountSnapshotDiffSchema,
  accountSnapshotListResponseSchema,
  accountSnapshotSchema,
  buyVsCraftRequestSchema,
  buyVsCraftResponseSchema,
  craftingEstimateRequestSchema,
  craftingEstimateResponseSchema,
  datasetCraftingEstimateRequestSchema,
  datasetCraftingEstimateResponseSchema,
  datasetSearchResponseSchema,
  economyCollectionSchema,
  priceCheckRequestSchema,
  priceCheckResponseSchema,
  snapshotUpgradeAdvisorRequestSchema,
  upgradeAdvisorRequestSchema,
  upgradeAdvisorResponseSchema,
} from "@calandra/contract";
import { z } from "zod";

export type CalandraMcpToolName =
  | "search_items"
  | "price_item"
  | "recommend_upgrade"
  | "recommend_snapshot_upgrade"
  | "estimate_crafting"
  | "estimate_dataset_crafting"
  | "compare_buy_vs_craft"
  | "diff_snapshots"
  | "list_snapshots"
  | "get_snapshot"
  | "check_price"
  | "get_economy";

export interface CalandraMcpTool {
  name: CalandraMcpToolName;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, object>;
    required: string[];
  };
}

export type McpToolResult = CallToolResult;

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

const listSnapshotsInputSchema = z.object({
  account: z.string().min(1),
});

const getSnapshotInputSchema = listSnapshotsInputSchema.extend({
  snapshotId: z.string().min(1),
});

const snapshotUpgradeInputSchema = snapshotUpgradeAdvisorRequestSchema.extend({
  account: z.string().min(1),
  snapshotId: z.string().min(1),
  league: z.string().min(1),
  patch: z.string().min(1),
  snapshotReadToken: z.string().min(1).optional(),
});

const datasetCraftingEstimateInputSchema =
  datasetCraftingEstimateRequestSchema.extend({
    league: z.string().min(1),
    patch: z.string().min(1),
  });

export function listCalandraMcpTools(): CalandraMcpTool[] {
  return [
    {
      name: "search_items",
      description:
        "Search Calandra's patch-versioned dataset across items, uniques, modifiers, and gems.",
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
      name: "recommend_snapshot_upgrade",
      description:
        "Rank upgrade candidates for a stored account snapshot using Calandra's published dataset.",
      inputSchema: {
        type: "object",
        properties: {
          ...versionedToolProperties,
          account: { type: "string", minLength: 1 },
          snapshotId: { type: "string", minLength: 1 },
          weights: { type: "object", additionalProperties: { type: "number" } },
          maxBudgetChaos: { type: "number", minimum: 0 },
          snapshotReadToken: { type: "string", minLength: 1 },
        },
        required: ["league", "patch", "account", "snapshotId", "weights"],
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
      name: "estimate_dataset_crafting",
      description:
        "Estimate crafting odds and buy-vs-craft from Calandra's published patch-versioned dataset.",
      inputSchema: {
        type: "object",
        properties: {
          ...versionedToolProperties,
          itemLevel: { type: "number", minimum: 0 },
          currencyCostChaos: { type: "number", minimum: 0 },
          targetModIds: { type: "array" },
          marketPriceChaos: { type: "number", minimum: 0 },
        },
        required: [
          "league",
          "patch",
          "itemLevel",
          "currencyCostChaos",
          "targetModIds",
        ],
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
      name: "list_snapshots",
      description:
        "List persisted Calandra account snapshots available for restore or diffing.",
      inputSchema: {
        type: "object",
        properties: {
          account: { type: "string", minLength: 1 },
        },
        required: ["account"],
      },
    },
    {
      name: "get_snapshot",
      description:
        "Fetch one persisted Calandra account snapshot for restore or diffing.",
      inputSchema: {
        type: "object",
        properties: {
          account: { type: "string", minLength: 1 },
          snapshotId: { type: "string", minLength: 1 },
        },
        required: ["account", "snapshotId"],
      },
    },
    {
      name: "check_price",
      description:
        "Check a parsed item against Calandra's patch-versioned economy data.",
      inputSchema: {
        type: "object",
        properties: {
          ...versionedToolProperties,
          item: { type: "object" },
        },
        required: ["league", "patch", "item"],
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
        case "recommend_snapshot_upgrade":
          return jsonToolResult(
            await recommendSnapshotUpgrade(
              apiBaseUrl,
              fetchImplementation,
              input,
            ),
          );
        case "estimate_crafting":
          return jsonToolResult(
            await estimateCrafting(apiBaseUrl, fetchImplementation, input),
          );
        case "estimate_dataset_crafting":
          return jsonToolResult(
            await estimateDatasetCrafting(
              apiBaseUrl,
              fetchImplementation,
              input,
            ),
          );
        case "compare_buy_vs_craft":
          return jsonToolResult(
            await compareBuyVsCraft(apiBaseUrl, fetchImplementation, input),
          );
        case "diff_snapshots":
          return jsonToolResult(
            await diffSnapshots(apiBaseUrl, fetchImplementation, input),
          );
        case "list_snapshots":
          return jsonToolResult(
            await listSnapshots(apiBaseUrl, fetchImplementation, input),
          );
        case "get_snapshot":
          return jsonToolResult(
            await getSnapshot(apiBaseUrl, fetchImplementation, input),
          );
        case "check_price":
          return jsonToolResult(
            await checkPrice(apiBaseUrl, fetchImplementation, input),
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

export function createCalandraMcpProtocolServer(
  options: CalandraMcpServerOptions,
) {
  const registry = createCalandraMcpServer(options);
  const server = new Server(
    { name: "calandra", version: "0.0.0" },
    {
      capabilities: {
        tools: {},
      },
      instructions:
        "Use Calandra tools for read-only Path of Exile 2 item, economy, snapshot, crafting, and upgrade-advisor queries.",
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: listCalandraMcpTools().map(toMcpTool),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return registry.callTool(
      request.params.name as CalandraMcpToolName,
      request.params.arguments ?? {},
    );
  });

  return server;
}

async function searchItems(
  apiBaseUrl: string,
  fetchImplementation: FetchLike,
  input: unknown,
) {
  const parsed = searchItemsInputSchema.parse(input);

  return datasetSearchResponseSchema.parse(
    await fetchJson(
      fetchImplementation,
      `${apiBaseUrl}/search?${datasetSearchQuery(parsed)}`,
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

async function recommendSnapshotUpgrade(
  apiBaseUrl: string,
  fetchImplementation: FetchLike,
  input: unknown,
) {
  const parsed = snapshotUpgradeInputSchema.parse(input);
  const { account, snapshotId, league, patch, snapshotReadToken, ...request } =
    parsed;
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (snapshotReadToken) {
    headers["x-calandra-snapshot-read-token"] = snapshotReadToken;
  }

  return upgradeAdvisorResponseSchema.parse(
    await fetchJson(
      fetchImplementation,
      `${apiBaseUrl}/advisor/snapshots/${encodeURIComponent(account)}/${encodeURIComponent(snapshotId)}?${versionedQuery({ league, patch })}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      },
    ),
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

async function estimateDatasetCrafting(
  apiBaseUrl: string,
  fetchImplementation: FetchLike,
  input: unknown,
) {
  const parsed = datasetCraftingEstimateInputSchema.parse(input);
  const { league, patch, ...request } = parsed;

  return datasetCraftingEstimateResponseSchema.parse(
    await fetchJson(
      fetchImplementation,
      `${apiBaseUrl}/crafting/estimate-from-dataset?${versionedQuery({ league, patch })}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      },
    ),
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

async function listSnapshots(
  apiBaseUrl: string,
  fetchImplementation: FetchLike,
  input: unknown,
) {
  const parsed = listSnapshotsInputSchema.parse(input);

  return accountSnapshotListResponseSchema.parse(
    await fetchJson(
      fetchImplementation,
      `${apiBaseUrl}/snapshots/${encodeURIComponent(parsed.account)}`,
    ),
  );
}

async function getSnapshot(
  apiBaseUrl: string,
  fetchImplementation: FetchLike,
  input: unknown,
) {
  const parsed = getSnapshotInputSchema.parse(input);

  return accountSnapshotSchema.parse(
    await fetchJson(
      fetchImplementation,
      `${apiBaseUrl}/snapshots/${encodeURIComponent(parsed.account)}/${encodeURIComponent(parsed.snapshotId)}`,
    ),
  );
}

async function checkPrice(
  apiBaseUrl: string,
  fetchImplementation: FetchLike,
  input: unknown,
) {
  const request = priceCheckRequestSchema.parse(input);

  return priceCheckResponseSchema.parse(
    await fetchJson(fetchImplementation, `${apiBaseUrl}/price/check`, {
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

function datasetSearchQuery(input: {
  league: string;
  patch: string;
  query: string;
}) {
  const params = new URLSearchParams({
    league: input.league,
    patch: input.patch,
    q: input.query,
  });

  return params.toString();
}

function normalizeBaseUrl(apiBaseUrl: string) {
  return apiBaseUrl.replace(/\/+$/, "");
}

function toMcpTool(tool: CalandraMcpTool): Tool {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  };
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
