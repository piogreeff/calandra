import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it, vi } from "vitest";
import {
  createCalandraMcpProtocolServer,
  createCalandraMcpServer,
  listCalandraMcpTools,
} from "../src/index";

describe("Calandra MCP tools", () => {
  it("lists the public data and advisor tools", () => {
    expect(listCalandraMcpTools().map((tool) => tool.name)).toEqual([
      "search_items",
      "price_item",
      "recommend_upgrade",
      "recommend_snapshot_upgrade",
      "estimate_crafting",
      "estimate_dataset_crafting",
      "compare_buy_vs_craft",
      "diff_snapshots",
      "list_snapshots",
      "get_snapshot",
      "check_price",
      "check_price_text",
      "get_economy",
    ]);
  });

  it("searches the patch-versioned dataset through the Calandra API", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse({
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        query: "wand",
        items: [
          {
            id: "expert-siphoning-wand",
            name: "Expert Siphoning Wand",
            category: "wand",
            rarity: "magic",
          },
        ],
        uniques: [],
        mods: [],
        gems: [],
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
      "https://calandra-api.workers.dev/search?league=Dawn+of+the+Hunt&patch=0.2.0&q=wand",
      undefined,
    );
    expect(parseToolJson(result)).toEqual({
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      query: "wand",
      items: [
        {
          id: "expert-siphoning-wand",
          name: "Expert Siphoning Wand",
          category: "wand",
          rarity: "magic",
        },
      ],
      uniques: [],
      mods: [],
      gems: [],
    });
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

  it("routes stored snapshot upgrade recommendations to the dataset-backed advisor endpoint", async () => {
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

    const result = await server.callTool("recommend_snapshot_upgrade", {
      account: "example account",
      snapshotId: "snapshot-2026-06-21T10-00-00Z",
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      weights: { life: 1, movementSpeed: 2 },
      maxBudgetChaos: 60,
      snapshotReadToken: "read-token",
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://calandra-api.workers.dev/advisor/snapshots/example%20account/snapshot-2026-06-21T10-00-00Z?league=Dawn+of+the+Hunt&patch=0.2.0",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer read-token",
        },
        body: JSON.stringify({
          weights: { life: 1, movementSpeed: 2 },
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

  it("routes dataset-backed crafting estimates to the published dataset endpoint", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse({
        source: "published-dataset",
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        estimate: {
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
            blockedTargetModIds: ["life-t1"],
            hitProbability: 0.25,
            expectedAttempts: 4,
            expectedCostChaos: 8,
          },
        },
      }),
    );
    const server = createCalandraMcpServer({
      apiBaseUrl: "https://calandra-api.workers.dev",
      fetch,
    });

    const result = await server.callTool("estimate_dataset_crafting", {
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      itemLevel: 68,
      currencyCostChaos: 2,
      targetModIds: ["life-t2", "life-t1"],
      marketPriceChaos: 12,
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://calandra-api.workers.dev/crafting/estimate-from-dataset?league=Dawn+of+the+Hunt&patch=0.2.0",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          itemLevel: 68,
          currencyCostChaos: 2,
          targetModIds: ["life-t2", "life-t1"],
          marketPriceChaos: 12,
        }),
      },
    );
    expect(parseToolJson(result)).toEqual({
      source: "published-dataset",
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      estimate: {
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
          blockedTargetModIds: ["life-t1"],
          hitProbability: 0.25,
          expectedAttempts: 4,
          expectedCostChaos: 8,
        },
      },
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

  it("routes account snapshot diffs to the deterministic snapshot endpoint", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse({
        beforeSnapshotId: "snapshot-before",
        afterSnapshotId: "snapshot-after",
        beforeCapturedAt: "2026-06-21T10:00:00.000Z",
        afterCapturedAt: "2026-06-21T11:00:00.000Z",
        characterChanges: [
          {
            id: "character-1",
            name: "CalandraTest",
            type: "changed",
            beforeLevel: 72,
            afterLevel: 73,
            levelDelta: 1,
            equipmentChanges: [
              {
                type: "changed",
                slot: "gloves",
                beforeName: "Frayed Mail Mitts",
                afterName: "Duskthread Grips",
              },
            ],
          },
        ],
        stashChanges: [],
      }),
    );
    const server = createCalandraMcpServer({
      apiBaseUrl: "https://calandra-api.workers.dev",
      fetch,
    });
    const request = {
      before: {
        id: "snapshot-before",
        account: "example",
        capturedAt: "2026-06-21T10:00:00.000Z",
        source: "official-poe2-character",
        capabilities: { characters: true, stashes: false },
        characters: [
          {
            id: "character-1",
            name: "CalandraTest",
            className: "Deadeye",
            level: 72,
            league: "Dawn of the Hunt",
            equipment: [
              {
                slot: "gloves",
                name: "Frayed Mail Mitts",
                stats: { life: 40 },
              },
            ],
          },
        ],
      },
      after: {
        id: "snapshot-after",
        account: "example",
        capturedAt: "2026-06-21T11:00:00.000Z",
        source: "official-poe2-character",
        capabilities: { characters: true, stashes: false },
        characters: [
          {
            id: "character-1",
            name: "CalandraTest",
            className: "Deadeye",
            level: 73,
            league: "Dawn of the Hunt",
            equipment: [
              {
                slot: "gloves",
                name: "Duskthread Grips",
                stats: { life: 65 },
              },
            ],
          },
        ],
      },
    };

    const result = await server.callTool("diff_snapshots", request);

    expect(fetch).toHaveBeenCalledWith(
      "https://calandra-api.workers.dev/snapshots/diff",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      },
    );
    expect(parseToolJson(result)).toEqual({
      beforeSnapshotId: "snapshot-before",
      afterSnapshotId: "snapshot-after",
      beforeCapturedAt: "2026-06-21T10:00:00.000Z",
      afterCapturedAt: "2026-06-21T11:00:00.000Z",
      characterChanges: [
        {
          id: "character-1",
          name: "CalandraTest",
          type: "changed",
          beforeLevel: 72,
          afterLevel: 73,
          levelDelta: 1,
          equipmentChanges: [
            {
              type: "changed",
              slot: "gloves",
              beforeName: "Frayed Mail Mitts",
              afterName: "Duskthread Grips",
            },
          ],
        },
      ],
      stashChanges: [],
    });
  });

  it("routes account snapshot listings to the snapshot list endpoint", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse({
        source: "snapshot-store",
        account: "example",
        snapshots: [
          {
            account: "example",
            snapshotId: "snapshot-2026-06-21T10-00-00Z",
            objectKey: "snapshots/example/snapshot-2026-06-21T10-00-00Z.json",
            uploadedAt: "2026-06-21T10:01:00.000Z",
            size: 512,
          },
        ],
      }),
    );
    const server = createCalandraMcpServer({
      apiBaseUrl: "https://calandra-api.workers.dev",
      fetch,
    });

    const result = await server.callTool("list_snapshots", {
      account: "example",
      snapshotReadToken: "read-token",
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://calandra-api.workers.dev/snapshots/example",
      {
        headers: {
          authorization: "Bearer read-token",
        },
      },
    );
    expect(parseToolJson(result)).toEqual({
      source: "snapshot-store",
      account: "example",
      snapshots: [
        {
          account: "example",
          snapshotId: "snapshot-2026-06-21T10-00-00Z",
          objectKey: "snapshots/example/snapshot-2026-06-21T10-00-00Z.json",
          uploadedAt: "2026-06-21T10:01:00.000Z",
          size: 512,
        },
      ],
    });
  });

  it("routes account snapshot restore reads to the snapshot endpoint", async () => {
    const snapshot = {
      id: "snapshot-2026-06-21T10-00-00Z",
      account: "example",
      capturedAt: "2026-06-21T10:00:00.000Z",
      source: "official-poe2-character",
      capabilities: { characters: true, stashes: false },
      characters: [
        {
          id: "character-1",
          name: "CalandraTest",
          className: "Deadeye",
          level: 73,
          league: "Dawn of the Hunt",
          equipment: [
            {
              slot: "gloves",
              name: "Duskthread Grips",
              stats: { life: 65 },
            },
          ],
        },
      ],
    };
    const fetch = vi.fn(async () => jsonResponse(snapshot));
    const server = createCalandraMcpServer({
      apiBaseUrl: "https://calandra-api.workers.dev",
      fetch,
    });

    const result = await server.callTool("get_snapshot", {
      account: "example",
      snapshotId: "snapshot-2026-06-21T10-00-00Z",
      snapshotReadToken: "read-token",
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://calandra-api.workers.dev/snapshots/example/snapshot-2026-06-21T10-00-00Z",
      {
        headers: {
          authorization: "Bearer read-token",
        },
      },
    );
    expect(parseToolJson(result)).toEqual(snapshot);
  });

  it("routes parsed item price checks to the deterministic price endpoint", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse({
        source: "published-dataset",
        league: "Dawn of the Hunt",
        patch: "0.2.0",
        item: {
          id: "divine-orb",
          name: "Divine Orb",
          category: "currency",
          rarity: "currency",
        },
        price: {
          id: "divine-orb",
          name: "Divine Orb",
          chaosEquivalent: 142,
          updatedAt: "2026-06-21T00:00:00.000Z",
        },
        matchedBy: "id",
      }),
    );
    const server = createCalandraMcpServer({
      apiBaseUrl: "https://calandra-api.workers.dev",
      fetch,
    });

    const result = await server.callTool("check_price", {
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      item: {
        id: "divine-orb",
        name: "Divine Orb",
        category: "currency",
        rarity: "currency",
      },
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://calandra-api.workers.dev/price/check",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          league: "Dawn of the Hunt",
          patch: "0.2.0",
          item: {
            id: "divine-orb",
            name: "Divine Orb",
            category: "currency",
            rarity: "currency",
          },
        }),
      },
    );
    expect(parseToolJson(result)).toEqual({
      source: "published-dataset",
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      item: {
        id: "divine-orb",
        name: "Divine Orb",
        category: "currency",
        rarity: "currency",
      },
      price: {
        id: "divine-orb",
        name: "Divine Orb",
        chaosEquivalent: 142,
        updatedAt: "2026-06-21T00:00:00.000Z",
      },
      matchedBy: "id",
    });
  });

  it("routes raw item text price checks to the parse-and-price endpoint", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse({
        source: "published-dataset",
        league: "Dawn of the Hunt",
        patch: "0.2.0",
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
          updatedAt: "2026-06-21T00:00:00.000Z",
        },
        matchedBy: "name",
      }),
    );
    const server = createCalandraMcpServer({
      apiBaseUrl: "https://calandra-api.workers.dev",
      fetch,
    });

    const result = await server.callTool("check_price_text", {
      league: "Dawn of the Hunt",
      patch: "0.2.0",
      text: "Item Class: Stackable Currency\nRarity: Currency\nDivine Orb",
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://calandra-api.workers.dev/price/check-text",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          league: "Dawn of the Hunt",
          patch: "0.2.0",
          text: "Item Class: Stackable Currency\nRarity: Currency\nDivine Orb",
        }),
      },
    );
    expect(parseToolJson(result)).toMatchObject({
      item: { name: "Divine Orb" },
      parsedItem: { itemClass: "Stackable Currency" },
      price: { chaosEquivalent: 142 },
      matchedBy: "name",
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

  it("exposes Calandra tools through the MCP protocol", async () => {
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
    const server = createCalandraMcpProtocolServer({
      apiBaseUrl: "https://calandra-api.workers.dev",
      fetch,
    });
    const client = new Client(
      { name: "calandra-test-client", version: "0.0.0" },
      { capabilities: {} },
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    try {
      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
      ]);

      await expect(client.ping()).resolves.toEqual({});
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual([
        "search_items",
        "price_item",
        "recommend_upgrade",
        "recommend_snapshot_upgrade",
        "estimate_crafting",
        "estimate_dataset_crafting",
        "compare_buy_vs_craft",
        "diff_snapshots",
        "list_snapshots",
        "get_snapshot",
        "check_price",
        "check_price_text",
        "get_economy",
      ]);

      const result = await client.callTool({
        name: "price_item",
        arguments: {
          league: "Dawn of the Hunt",
          patch: "0.2.0",
          item: "divine",
        },
      });

      expect(parseToolJson(result)).toEqual({
        id: "divine-orb",
        name: "Divine Orb",
        chaosEquivalent: 142,
        updatedAt: "2026-06-21T00:00:00.000Z",
      });
    } finally {
      await client.close();
      await server.close();
    }
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function parseToolJson(result: unknown) {
  const firstContent = (
    result as { content?: Array<{ type: string; text?: string }> }
  ).content?.[0];

  return firstContent?.type === "text"
    ? JSON.parse(firstContent.text ?? "null")
    : null;
}
