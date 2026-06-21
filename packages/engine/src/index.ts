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

      return [
        compareUpgradeCandidate({
          current,
          candidate,
          weights: input.weights,
          ...(candidate.estimatedCostChaos !== undefined
            ? { estimatedCostChaos: candidate.estimatedCostChaos }
            : {}),
        }),
      ];
    }),
  );
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
