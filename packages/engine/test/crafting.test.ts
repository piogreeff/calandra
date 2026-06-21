import { describe, expect, it } from "vitest";
import { compareBuyVsCraft, estimateCraftingPlan } from "../src/index";

describe("deterministic crafting estimates", () => {
  it("estimates expected attempts and cost from eligible weighted mods", () => {
    const estimate = estimateCraftingPlan({
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

    expect(estimate).toEqual({
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

  it("reports an impossible target without expected attempts or cost", () => {
    const estimate = estimateCraftingPlan({
      itemLevel: 50,
      currencyCostChaos: 2,
      targetModIds: ["life-t1"],
      modPool: [
        {
          id: "life-t1",
          name: "+# to maximum Life",
          minItemLevel: 75,
          weight: 50,
        },
      ],
    });

    expect(estimate).toEqual({
      itemLevel: 50,
      currencyCostChaos: 2,
      eligibleModCount: 0,
      totalEligibleWeight: 0,
      eligibleTargetModIds: [],
      blockedTargetModIds: ["life-t1"],
      hitProbability: 0,
    });
  });

  it("recommends crafting when expected craft cost beats market price", () => {
    expect(
      compareBuyVsCraft({
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
    ).toEqual({
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

  it("recommends buying when the craft target is impossible", () => {
    expect(
      compareBuyVsCraft({
        marketPriceChaos: 12,
        crafting: {
          itemLevel: 50,
          currencyCostChaos: 2,
          targetModIds: ["life-t1"],
          modPool: [
            {
              id: "life-t1",
              name: "+# to maximum Life",
              minItemLevel: 75,
              weight: 50,
            },
          ],
        },
      }),
    ).toEqual({
      recommendation: "buy",
      marketPriceChaos: 12,
      savingsChaos: 0,
      estimate: {
        itemLevel: 50,
        currencyCostChaos: 2,
        eligibleModCount: 0,
        totalEligibleWeight: 0,
        eligibleTargetModIds: [],
        blockedTargetModIds: ["life-t1"],
        hitProbability: 0,
      },
    });
  });
});
