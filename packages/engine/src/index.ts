export type ItemStats = Record<string, number>;
export type StatWeights = Record<string, number>;

export interface ScoreItemInput {
  slot: string;
  name: string;
  stats: ItemStats;
  weights: StatWeights;
}

export interface StatContribution {
  stat: string;
  value: number;
  weight: number;
  score: number;
}

export interface ItemScore {
  slot: string;
  name: string;
  score: number;
  contributions: StatContribution[];
  missingStats: string[];
}

export interface UpgradeComparisonInput {
  current: Omit<ScoreItemInput, "weights">;
  candidate: Omit<ScoreItemInput, "weights">;
  weights: StatWeights;
  estimatedCostChaos?: number | undefined;
}

export interface UpgradeCandidateItem extends Omit<ScoreItemInput, "weights"> {
  estimatedCostChaos?: number | undefined;
}

export interface RankLoadoutUpgradesInput {
  equipped: Array<Omit<ScoreItemInput, "weights">>;
  candidates: UpgradeCandidateItem[];
  weights: StatWeights;
  maxBudgetChaos?: number | undefined;
}

export interface UpgradeComparison {
  slot: string;
  currentName: string;
  candidateName: string;
  currentScore: number;
  candidateScore: number;
  scoreDelta: number;
  estimatedCostChaos?: number | undefined;
  valuePerChaos?: number | undefined;
  currentMissingStats: string[];
  candidateMissingStats: string[];
}

export interface SnapshotGearItem {
  slot: string;
  name: string;
  itemId?: string | undefined;
  stats?: Record<string, number> | undefined;
}

export interface SnapshotCharacter {
  id: string;
  name: string;
  className: string;
  level: number;
  equipment: SnapshotGearItem[];
}

export interface SnapshotStash {
  id: string;
  name: string;
  items: SnapshotGearItem[];
}

export interface AccountSnapshotLike {
  id: string;
  capturedAt: string;
  characters: SnapshotCharacter[];
  stashes?: SnapshotStash[] | undefined;
}

export type SnapshotEntityChangeType = "added" | "removed" | "changed";

export interface SnapshotEquipmentChange {
  type: SnapshotEntityChangeType;
  slot: string;
  beforeName?: string | undefined;
  afterName?: string | undefined;
}

export interface SnapshotCharacterChange {
  id: string;
  name: string;
  type: SnapshotEntityChangeType;
  beforeLevel?: number | undefined;
  afterLevel?: number | undefined;
  levelDelta: number;
  equipmentChanges: SnapshotEquipmentChange[];
}

export interface SnapshotStashChange {
  id: string;
  name: string;
  type: SnapshotEntityChangeType;
  beforeItemCount?: number | undefined;
  afterItemCount?: number | undefined;
  itemCountDelta: number;
}

export interface AccountSnapshotDiff {
  beforeSnapshotId: string;
  afterSnapshotId: string;
  beforeCapturedAt: string;
  afterCapturedAt: string;
  characterChanges: SnapshotCharacterChange[];
  stashChanges: SnapshotStashChange[];
}

export interface CraftingModCandidate {
  id: string;
  name: string;
  minItemLevel: number;
  weight: number;
}

export interface CraftingEstimateInput {
  itemLevel: number;
  currencyCostChaos: number;
  targetModIds: string[];
  modPool: CraftingModCandidate[];
}

export interface CraftingEstimate {
  itemLevel: number;
  currencyCostChaos: number;
  eligibleModCount: number;
  totalEligibleWeight: number;
  eligibleTargetModIds: string[];
  blockedTargetModIds: string[];
  hitProbability: number;
  expectedAttempts?: number | undefined;
  expectedCostChaos?: number | undefined;
}

export interface BuyVsCraftInput {
  marketPriceChaos: number;
  crafting: CraftingEstimateInput;
}

export type AcquisitionRecommendation = "buy" | "craft";

export interface BuyVsCraftComparison {
  recommendation: AcquisitionRecommendation;
  marketPriceChaos: number;
  expectedCraftCostChaos?: number | undefined;
  savingsChaos: number;
  estimate: CraftingEstimate;
}

export function scoreItem(input: ScoreItemInput): ItemScore {
  const contributions = Object.entries(input.weights)
    .filter(([, weight]) => weight !== 0)
    .flatMap(([stat, weight]) => {
      const value = input.stats[stat];
      return value === undefined
        ? []
        : [
            {
              stat,
              value,
              weight,
              score: value * weight,
            },
          ];
    });

  return {
    slot: input.slot,
    name: input.name,
    score: roundScore(
      sum(contributions.map((contribution) => contribution.score)),
    ),
    contributions,
    missingStats: Object.keys(input.weights).filter(
      (stat) => input.weights[stat] !== 0 && input.stats[stat] === undefined,
    ),
  };
}

export function compareUpgradeCandidate(
  input: UpgradeComparisonInput,
): UpgradeComparison {
  const current = scoreItem({ ...input.current, weights: input.weights });
  const candidate = scoreItem({ ...input.candidate, weights: input.weights });
  const scoreDelta = roundScore(candidate.score - current.score);
  const valuePerChaos =
    input.estimatedCostChaos !== undefined && input.estimatedCostChaos > 0
      ? scoreDelta / input.estimatedCostChaos
      : undefined;

  return {
    slot: input.candidate.slot,
    currentName: current.name,
    candidateName: candidate.name,
    currentScore: current.score,
    candidateScore: candidate.score,
    scoreDelta,
    ...(input.estimatedCostChaos !== undefined
      ? { estimatedCostChaos: input.estimatedCostChaos }
      : {}),
    ...(valuePerChaos !== undefined ? { valuePerChaos } : {}),
    currentMissingStats: current.missingStats,
    candidateMissingStats: candidate.missingStats,
  };
}

export function sortUpgradeCandidates(
  candidates: UpgradeComparison[],
): UpgradeComparison[] {
  return [...candidates].sort((left, right) => {
    const deltaDifference = right.scoreDelta - left.scoreDelta;
    if (deltaDifference !== 0) {
      return deltaDifference;
    }

    return (
      (right.valuePerChaos ?? Number.NEGATIVE_INFINITY) -
      (left.valuePerChaos ?? Number.NEGATIVE_INFINITY)
    );
  });
}

export function rankLoadoutUpgrades(
  input: RankLoadoutUpgradesInput,
): UpgradeComparison[] {
  const equippedBySlot = new Map(
    input.equipped.map((item) => [item.slot, item] as const),
  );

  return sortUpgradeCandidates(
    input.candidates.flatMap((candidate) => {
      const current = equippedBySlot.get(candidate.slot);
      if (!current || exceedsBudget(candidate, input.maxBudgetChaos)) {
        return [];
      }

      const comparison = compareUpgradeCandidate({
        current,
        candidate,
        weights: input.weights,
        ...(candidate.estimatedCostChaos !== undefined
          ? { estimatedCostChaos: candidate.estimatedCostChaos }
          : {}),
      });

      return comparison.scoreDelta > 0 ? [comparison] : [];
    }),
  );
}

export function diffAccountSnapshots(
  before: AccountSnapshotLike,
  after: AccountSnapshotLike,
): AccountSnapshotDiff {
  return {
    beforeSnapshotId: before.id,
    afterSnapshotId: after.id,
    beforeCapturedAt: before.capturedAt,
    afterCapturedAt: after.capturedAt,
    characterChanges: diffCharacters(before.characters, after.characters),
    stashChanges: diffStashes(before.stashes ?? [], after.stashes ?? []),
  };
}

export function estimateCraftingPlan(
  input: CraftingEstimateInput,
): CraftingEstimate {
  const targetIds = uniqueSorted(input.targetModIds);
  const eligibleMods = input.modPool.filter(
    (mod) => mod.minItemLevel <= input.itemLevel && mod.weight > 0,
  );
  const eligibleTargetMods = eligibleMods.filter((mod) =>
    targetIds.includes(mod.id),
  );
  const eligibleTargetModIds = uniqueSorted(
    eligibleTargetMods.map((mod) => mod.id),
  );
  const blockedTargetModIds = targetIds.filter(
    (id) => !eligibleTargetModIds.includes(id),
  );
  const totalEligibleWeight = sum(eligibleMods.map((mod) => mod.weight));
  const targetWeight = sum(eligibleTargetMods.map((mod) => mod.weight));
  const hitProbability =
    totalEligibleWeight > 0
      ? roundScore(targetWeight / totalEligibleWeight)
      : 0;
  const expectedAttempts =
    hitProbability > 0 ? roundScore(1 / hitProbability) : undefined;
  const expectedCostChaos =
    expectedAttempts !== undefined
      ? roundScore(expectedAttempts * input.currencyCostChaos)
      : undefined;

  return {
    itemLevel: input.itemLevel,
    currencyCostChaos: input.currencyCostChaos,
    eligibleModCount: eligibleMods.length,
    totalEligibleWeight,
    eligibleTargetModIds,
    blockedTargetModIds,
    hitProbability,
    ...(expectedAttempts !== undefined ? { expectedAttempts } : {}),
    ...(expectedCostChaos !== undefined ? { expectedCostChaos } : {}),
  };
}

export function compareBuyVsCraft(
  input: BuyVsCraftInput,
): BuyVsCraftComparison {
  const estimate = estimateCraftingPlan(input.crafting);
  const expectedCraftCostChaos = estimate.expectedCostChaos;
  const shouldCraft =
    expectedCraftCostChaos !== undefined &&
    expectedCraftCostChaos < input.marketPriceChaos;

  return {
    recommendation: shouldCraft ? "craft" : "buy",
    marketPriceChaos: input.marketPriceChaos,
    ...(expectedCraftCostChaos !== undefined ? { expectedCraftCostChaos } : {}),
    savingsChaos: shouldCraft
      ? roundScore(input.marketPriceChaos - expectedCraftCostChaos)
      : 0,
    estimate,
  };
}

function diffCharacters(
  beforeCharacters: SnapshotCharacter[],
  afterCharacters: SnapshotCharacter[],
): SnapshotCharacterChange[] {
  const beforeById = new Map(
    beforeCharacters.map((character) => [character.id, character]),
  );
  const afterById = new Map(
    afterCharacters.map((character) => [character.id, character]),
  );
  const ids = uniqueSorted([...beforeById.keys(), ...afterById.keys()]);

  return ids.flatMap<SnapshotCharacterChange>((id) => {
    const before = beforeById.get(id);
    const after = afterById.get(id);

    if (before && !after) {
      return [
        {
          id,
          name: before.name,
          type: "removed" as const,
          beforeLevel: before.level,
          levelDelta: -before.level,
          equipmentChanges: before.equipment.map((item) => ({
            type: "removed" as const,
            slot: item.slot,
            beforeName: item.name,
          })),
        },
      ];
    }

    if (!before && after) {
      return [
        {
          id,
          name: after.name,
          type: "added" as const,
          afterLevel: after.level,
          levelDelta: after.level,
          equipmentChanges: after.equipment.map((item) => ({
            type: "added" as const,
            slot: item.slot,
            afterName: item.name,
          })),
        },
      ];
    }

    if (!before || !after) {
      return [];
    }

    const equipmentChanges = diffEquipment(before.equipment, after.equipment);
    const levelDelta = after.level - before.level;

    if (levelDelta === 0 && equipmentChanges.length === 0) {
      return [];
    }

    return [
      {
        id,
        name: after.name,
        type: "changed" as const,
        beforeLevel: before.level,
        afterLevel: after.level,
        levelDelta,
        equipmentChanges,
      },
    ];
  });
}

function diffEquipment(
  beforeEquipment: SnapshotGearItem[],
  afterEquipment: SnapshotGearItem[],
): SnapshotEquipmentChange[] {
  const beforeBySlot = new Map(
    beforeEquipment.map((item) => [item.slot, item]),
  );
  const afterBySlot = new Map(afterEquipment.map((item) => [item.slot, item]));
  const slots = uniqueSorted([...beforeBySlot.keys(), ...afterBySlot.keys()]);

  return slots.flatMap<SnapshotEquipmentChange>((slot) => {
    const before = beforeBySlot.get(slot);
    const after = afterBySlot.get(slot);

    if (before && !after) {
      return [{ type: "removed" as const, slot, beforeName: before.name }];
    }

    if (!before && after) {
      return [{ type: "added" as const, slot, afterName: after.name }];
    }

    if (!before || !after || sameGearItem(before, after)) {
      return [];
    }

    return [
      {
        type: "changed" as const,
        slot,
        beforeName: before.name,
        afterName: after.name,
      },
    ];
  });
}

function diffStashes(
  beforeStashes: SnapshotStash[],
  afterStashes: SnapshotStash[],
): SnapshotStashChange[] {
  const beforeById = new Map(beforeStashes.map((stash) => [stash.id, stash]));
  const afterById = new Map(afterStashes.map((stash) => [stash.id, stash]));
  const ids = uniqueSorted([...beforeById.keys(), ...afterById.keys()]);

  return ids.flatMap<SnapshotStashChange>((id) => {
    const before = beforeById.get(id);
    const after = afterById.get(id);

    if (before && !after) {
      return [
        {
          id,
          name: before.name,
          type: "removed" as const,
          beforeItemCount: before.items.length,
          itemCountDelta: -before.items.length,
        },
      ];
    }

    if (!before && after) {
      return [
        {
          id,
          name: after.name,
          type: "added" as const,
          afterItemCount: after.items.length,
          itemCountDelta: after.items.length,
        },
      ];
    }

    if (!before || !after) {
      return [];
    }

    const itemCountDelta = after.items.length - before.items.length;
    if (itemCountDelta === 0) {
      return [];
    }

    return [
      {
        id,
        name: after.name,
        type: "changed" as const,
        beforeItemCount: before.items.length,
        afterItemCount: after.items.length,
        itemCountDelta,
      },
    ];
  });
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function roundScore(value: number): number {
  return Number(value.toFixed(6));
}

function exceedsBudget(
  candidate: UpgradeCandidateItem,
  maxBudgetChaos: number | undefined,
): boolean {
  return (
    maxBudgetChaos !== undefined &&
    candidate.estimatedCostChaos !== undefined &&
    candidate.estimatedCostChaos > maxBudgetChaos
  );
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function sameGearItem(
  left: SnapshotGearItem,
  right: SnapshotGearItem,
): boolean {
  return (
    left.name === right.name &&
    left.itemId === right.itemId &&
    stableStatsKey(left.stats) === stableStatsKey(right.stats)
  );
}

function stableStatsKey(stats: Record<string, number> | undefined): string {
  return JSON.stringify(
    Object.entries(stats ?? {}).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
}
