import { describe, expect, it, vi } from "vitest";
import { createCalandraMcpServer, listCalandraMcpTools } from "../src/index";

describe("Calandra MCP tools", () => {
  it("lists the public data and advisor tools", () => {
    expect(listCalandraMcpTools().map((tool) => tool.name)).toEqual([
      "search_items",
      "price_item",
      "recommend_upgrade",
      "estimate_crafting",
      "compare_buy_vs_craft",
      "get_economy",
    ]);
  });

  it("searches patch-versioned items through the Calandra API", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        items: [
          {
            id: "expert-siphoning-wand",
            name: "Expert Siphoning Wand",
            category: "wand",
            rarity: "magic",
          },
          {
            id: "advanced-altar-robe",
            name: "Advanced Altar Robe",
            category: "body-armour",
            rarity: "normal",
          },
        ],
      }),
    );
    const server = createCalandraMcpServer({
      apiBaseUrl: "https://calandra-api.workers.dev",
      fetch,
    });

    const result = await server.callTool("search_items", {
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      query: "wand",
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://calandra-api.workers.dev/items?league=Dawn+of+the+Hunt&patch=0.2.0",
      undefined,
    );
    expect(parseToolJson(result)).toEqual([
      {
        id: "expert-siphoning-wand",
        name: "Expert Siphoning Wand",
        category: "wand",
        rarity: "magic",
      },
    ]);
  });

  it("prices one item from the economy endpoint", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        prices: [
          {
            id: "divine-orb",
            name: "Divine Orb",
            chaosEquivalent: 142,
            updatedAt: "2026-06-21T00:00:00.000Z",
          },
        ],
      }),
    );
    const server = createCalandraMcpServer({
      apiBaseUrl: "https://calandra-api.workers.dev/",
      fetch,
    });

    const result = await server.callTool("price_item", {
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      item: "divine",
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://calandra-api.workers.dev/economy/Dawn%20of%20the%20Hunt?patch=0.2.0",
      undefined,
    );
    expect(parseToolJson(result)).toEqual({
      id: "divine-orb",
      name: "Divine Orb",
      chaosEquivalent: 142,
      updatedAt: "2026-06-21T00:00:00.000Z",
    });
  });

  it("routes upgrade recommendations to the deterministic advisor endpoint", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse({
        source: "deterministic-engine",
        upgrades: [
          {
            slot: "boots",
            currentName: "Current Boots",
            candidateName: "Fast Boots",
            currentScore: 40,
            candidateScore: 100,
            scoreDelta: 60,
            estimatedCostChaos: 50,
            valuePerChaos: 1.2,
            currentMissingStats: ["movementSpeed"],
            candidateMissingStats: [],
          },
        ],
      }),
    );
    const server = createCalandraMcpServer({
      apiBaseUrl: "https://calandra-api.workers.dev",
      fetch,
    });

    const result = await server.callTool("recommend_upgrade", {
      weights: { life: 1, movementSpeed: 2 },
      equipped: [{ slot: "boots", name: "Current Boots", stats: { life: 40 } }],
      candidates: [
        {
          slot: "boots",
          name: "Fast Boots",
          stats: { life: 60, movementSpeed: 20 },
          estimatedCostChaos: 50,
        },
      ],
      maxBudgetChaos: 60,
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://calandra-api.workers.dev/advisor/upgrades",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          weights: { life: 1, movementSpeed: 2 },
          equipped: [
            { slot: "boots", name: "Current Boots", stats: { life: 40 } },
          ],
          candidates: [
            {
              slot: "boots",
              name: "Fast Boots",
              stats: { life: 60, movementSpeed: 20 },
              estimatedCostChaos: 50,
            },
          ],
          maxBudgetChaos: 60,
        }),
      },
    );
    expect(parseToolJson(result)).toEqual({
      source: "deterministic-engine",
      upgrades: [
        {
          slot: "boots",
          currentName: "Current Boots",
          candidateName: "Fast Boots",
          currentScore: 40,
          candidateScore: 100,
          scoreDelta: 60,
          estimatedCostChaos: 50,
          valuePerChaos: 1.2,
          currentMissingStats: ["movementSpeed"],
          candidateMissingStats: [],
        },
      ],
    });
  });

  it("routes crafting estimates to the deterministic crafting endpoint", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse({
        source: "deterministic-engine",
        itemLevel: 68,
        currencyCostChaos: 2,
        eligibleModCount: 2,
        totalEligibleWeight: 400,
        eligibleTargetModIds: ["life-t2"],
        blockedTargetModIds: ["life-t1"],
        hitProbability: 0.25,
        expectedAttempts: 4,
        expectedCostChaos: 8,
      }),
    );
    const server = createCalandraMcpServer({
      apiBaseUrl: "https://calandra-api.workers.dev",
      fetch,
    });

    const result = await server.callTool("estimate_crafting", {
      itemLevel: 68,
      currencyCostChaos: 2,
      targetModIds: ["life-t2", "life-t1"],
      modPool: [
        {
          id: "life-t2",
          name: "+# to maximum Life",
          minItemLevel: 60,
          weight: 100,
        },
        {
          id: "mana-t2",
          name: "+# to maximum Mana",
          minItemLevel: 60,
          weight: 300,
        },
        {
          id: "life-t1",
          name: "+# to maximum Life",
          minItemLevel: 75,
          weight: 50,
        },
      ],
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://calandra-api.workers.dev/crafting/estimate",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          itemLevel: 68,
          currencyCostChaos: 2,
          targetModIds: ["life-t2", "life-t1"],
          modPool: [
            {
              id: "life-t2",
              name: "+# to maximum Life",
              minItemLevel: 60,
              weight: 100,
            },
            {
              id: "mana-t2",
              name: "+# to maximum Mana",
              minItemLevel: 60,
              weight: 300,
            },
            {
              id: "life-t1",
              name: "+# to maximum Life",
              minItemLevel: 75,
              weight: 50,
            },
          ],
        }),
      },
    );
    expect(parseToolJson(result)).toEqual({
      source: "deterministic-engine",
      itemLevel: 68,
      currencyCostChaos: 2,
      eligibleModCount: 2,
      totalEligibleWeight: 400,
      eligibleTargetModIds: ["life-t2"],
      blockedTargetModIds: ["life-t1"],
      hitProbability: 0.25,
      expectedAttempts: 4,
      expectedCostChaos: 8,
    });
  });

  it("routes buy-vs-craft comparisons to the deterministic crafting endpoint", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse({
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
      }),
    );
    const server = createCalandraMcpServer({
      apiBaseUrl: "https://calandra-api.workers.dev",
      fetch,
    });

    const result = await server.callTool("compare_buy_vs_craft", {
      marketPriceChaos: 12,
      crafting: {
        itemLevel: 68,
        currencyCostChaos: 2,
        targetModIds: ["life-t2"],
        modPool: [
          {
            id: "life-t2",
            name: "+# to maximum Life",
            minItemLevel: 60,
            weight: 100,
          },
          {
            id: "mana-t2",
            name: "+# to maximum Mana",
            minItemLevel: 60,
            weight: 300,
          },
        ],
      },
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://calandra-api.workers.dev/crafting/buy-vs-craft",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          marketPriceChaos: 12,
          crafting: {
            itemLevel: 68,
            currencyCostChaos: 2,
            targetModIds: ["life-t2"],
            modPool: [
              {
                id: "life-t2",
                name: "+# to maximum Life",
                minItemLevel: 60,
                weight: 100,
              },
              {
                id: "mana-t2",
                name: "+# to maximum Mana",
                minItemLevel: 60,
                weight: 300,
              },
            ],
          },
        }),
      },
    );
    expect(parseToolJson(result)).toEqual({
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
    });
  });

  it("rejects unknown tool names at runtime", async () => {
    const server = createCalandraMcpServer({
      apiBaseUrl: "https://calandra-api.workers.dev",
      fetch: vi.fn(),
    });

    await expect(server.callTool("unknown_tool" as never, {})).rejects.toThrow(
      "Unknown Calandra MCP tool: unknown_tool",
    );
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function parseToolJson(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0]?.text ?? "null");
}
