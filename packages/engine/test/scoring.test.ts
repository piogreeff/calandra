import { describe, expect, it } from "vitest";
import {
  compareUpgradeCandidate,
  rankLoadoutUpgrades,
  scoreItem,
  sortUpgradeCandidates,
} from "../src/index";

describe("deterministic item scoring", () => {
  const weights = {
    life: 1,
    fireResistance: 0.5,
    lightningResistance: 0.5,
    movementSpeed: 2,
  };

  it("scores an item from weighted numeric stats", () => {
    expect(
      scoreItem({
        slot: "boots",
        name: "Storm Tread",
        stats: {
          life: 70,
          fireResistance: 20,
          lightningResistance: 30,
          movementSpeed: 15,
        },
        weights,
      }),
    ).toEqual({
      slot: "boots",
      name: "Storm Tread",
      score: 125,
      contributions: [
        { stat: "life", value: 70, weight: 1, score: 70 },
        { stat: "fireResistance", value: 20, weight: 0.5, score: 10 },
        { stat: "lightningResistance", value: 30, weight: 0.5, score: 15 },
        { stat: "movementSpeed", value: 15, weight: 2, score: 30 },
      ],
      missingStats: [],
    });
  });

  it("reports weighted stats missing from an item", () => {
    const scored = scoreItem({
      slot: "ring",
      name: "Ruby Ring",
      stats: { fireResistance: 28 },
      weights,
    });

    expect(scored.score).toBe(14);
    expect(scored.missingStats).toEqual([
      "life",
      "lightningResistance",
      "movementSpeed",
    ]);
  });

  it("compares an upgrade candidate against the currently equipped item", () => {
    const comparison = compareUpgradeCandidate({
      current: {
        slot: "gloves",
        name: "Old Grips",
        stats: { life: 40, fireResistance: 12 },
      },
      candidate: {
        slot: "gloves",
        name: "Havoc Grips",
        stats: { life: 65, fireResistance: 18, lightningResistance: 22 },
      },
      weights,
      estimatedCostChaos: 35,
    });

    expect(comparison).toMatchObject({
      slot: "gloves",
      currentName: "Old Grips",
      candidateName: "Havoc Grips",
      currentScore: 46,
      candidateScore: 85,
      scoreDelta: 39,
      estimatedCostChaos: 35,
    });
    expect(comparison.valuePerChaos).toBeCloseTo(1.1143, 4);
  });

  it("sorts candidates by score delta, then value per chaos", () => {
    const current = {
      slot: "boots",
      name: "Current Boots",
      stats: { life: 40 },
    };
    const candidates = sortUpgradeCandidates([
      compareUpgradeCandidate({
        current,
        candidate: { slot: "boots", name: "Cheap Boots", stats: { life: 70 } },
        weights,
        estimatedCostChaos: 10,
      }),
      compareUpgradeCandidate({
        current,
        candidate: { slot: "boots", name: "Best Boots", stats: { life: 80 } },
        weights,
        estimatedCostChaos: 80,
      }),
      compareUpgradeCandidate({
        current,
        candidate: {
          slot: "boots",
          name: "Equal Delta Boots",
          stats: { life: 70 },
        },
        weights,
        estimatedCostChaos: 20,
      }),
    ]);

    expect(candidates.map((candidate) => candidate.candidateName)).toEqual([
      "Best Boots",
      "Cheap Boots",
      "Equal Delta Boots",
    ]);
  });

  it("does not compute value per chaos for free or unpriced candidates", () => {
    const comparison = compareUpgradeCandidate({
      current: { slot: "amulet", name: "Old Amulet", stats: { life: 10 } },
      candidate: { slot: "amulet", name: "Found Amulet", stats: { life: 30 } },
      weights,
      estimatedCostChaos: 0,
    });

    expect(comparison.valuePerChaos).toBeUndefined();
    expect(comparison.scoreDelta).toBe(20);
  });

  it("ranks the best upgrade candidates across equipped slots", () => {
    const ranked = rankLoadoutUpgrades({
      equipped: [
        { slot: "boots", name: "Current Boots", stats: { life: 40 } },
        { slot: "gloves", name: "Current Gloves", stats: { life: 60 } },
      ],
      candidates: [
        {
          slot: "boots",
          name: "Fast Boots",
          stats: { life: 60, movementSpeed: 20 },
          estimatedCostChaos: 50,
        },
        {
          slot: "gloves",
          name: "Heavy Gloves",
          stats: { life: 95, fireResistance: 20 },
          estimatedCostChaos: 20,
        },
      ],
      weights,
    });

    expect(ranked.map((candidate) => candidate.candidateName)).toEqual([
      "Fast Boots",
      "Heavy Gloves",
    ]);
    expect(ranked.map((candidate) => candidate.scoreDelta)).toEqual([60, 45]);
  });

  it("filters loadout upgrades by budget and ignores slots without an equipped item", () => {
    const ranked = rankLoadoutUpgrades({
      equipped: [{ slot: "ring", name: "Current Ring", stats: { life: 20 } }],
      candidates: [
        {
          slot: "ring",
          name: "Budget Ring",
          stats: { life: 45, fireResistance: 20 },
          estimatedCostChaos: 15,
        },
        {
          slot: "ring",
          name: "Expensive Ring",
          stats: { life: 100 },
          estimatedCostChaos: 80,
        },
        {
          slot: "amulet",
          name: "Unmatched Amulet",
          stats: { life: 100 },
          estimatedCostChaos: 10,
        },
      ],
      weights,
      maxBudgetChaos: 20,
    });

    expect(ranked.map((candidate) => candidate.candidateName)).toEqual([
      "Budget Ring",
    ]);
  });

  it("keeps unpriced candidates when a budget is provided", () => {
    const ranked = rankLoadoutUpgrades({
      equipped: [
        { slot: "helmet", name: "Current Helmet", stats: { life: 20 } },
      ],
      candidates: [
        { slot: "helmet", name: "Listed Without Price", stats: { life: 50 } },
      ],
      weights,
      maxBudgetChaos: 25,
    });

    expect(ranked.map((candidate) => candidate.candidateName)).toEqual([
      "Listed Without Price",
    ]);
    expect(ranked[0]?.estimatedCostChaos).toBeUndefined();
  });
});
