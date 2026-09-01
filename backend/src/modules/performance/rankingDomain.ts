/**
 * How salespeople are ordered against each other.
 *
 * Ranking is only meaningful inside a stated scope: comparing a salesperson
 * working a dense city beat against one working a rural territory is not a
 * ranking, it is noise. Every result therefore carries the scope it was
 * computed in, and the metric it used.
 */

/**
 * `team` is the reporting tree: a manager's people, or a salesperson measured
 * against the peers who share their manager. `territory` is kept because a
 * territory is still a real comparison basis for a salesperson whose manager
 * has not been recorded, but it is descriptive metadata rather than the
 * authorisation boundary it used to double as.
 */
export type RankingScope = "team" | "territory" | "company";

export type RankingMetric = "target_achievement_pct" | "order_value";

export interface Contender {
  salespersonId: string;
  /** Only used to break ties deterministically, never to order by. */
  name: string;
  value: number;
}

export interface RankedEntry extends Contender {
  rank: number;
}

/**
 * Standard competition ranking: equal values share the better rank and the
 * next distinct value skips the positions consumed (1, 2, 2, 4).
 *
 * Ties break on name then id so the same inputs always produce the same order.
 * Without that, two salespeople on identical numbers would swap places between
 * requests and each would look like they had moved.
 */
export function rankContenders(contenders: readonly Contender[]): RankedEntry[] {
  const sorted = [...contenders].sort(
    (a, b) =>
      b.value - a.value ||
      a.name.localeCompare(b.name) ||
      a.salespersonId.localeCompare(b.salespersonId)
  );

  const ranked: RankedEntry[] = [];
  let lastValue: number | null = null;
  let lastRank = 0;
  sorted.forEach((contender, index) => {
    const rank = lastValue != null && contender.value === lastValue ? lastRank : index + 1;
    ranked.push({ ...contender, rank });
    lastValue = contender.value;
    lastRank = rank;
  });
  return ranked;
}

/**
 * Target achievement only ranks fairly when most of the group is actually
 * carrying a target; otherwise the few who have one are compared against
 * people the system has set no bar for.
 */
export const MIN_TARGET_COVERAGE = 0.6;

export interface MetricChoice {
  metric: RankingMetric;
  reason: string;
}

export function chooseMetric(input: {
  participants: number;
  withTargets: number;
}): MetricChoice {
  if (input.participants === 0) {
    return { metric: "order_value", reason: "Nobody in this scope to rank." };
  }
  const coverage = input.withTargets / input.participants;
  if (coverage >= MIN_TARGET_COVERAGE) {
    return {
      metric: "target_achievement_pct",
      reason: `${input.withTargets} of ${input.participants} carry a target this period, so everyone is ranked on how much of their own target they have done.`,
    };
  }
  return {
    metric: "order_value",
    reason: `Only ${input.withTargets} of ${input.participants} carry a target this period, so ranking falls back to order value rather than comparing against bars most people were never set.`,
  };
}

export const RANKING_METRIC_LABEL: Record<RankingMetric, string> = {
  target_achievement_pct: "Target achieved",
  order_value: "Order value",
};

export interface RankMovement {
  direction: "up" | "down" | "same" | "new";
  places: number;
}

/** A smaller number is a better position, so moving to a lower rank is "up". */
export function rankMovement(rank: number, previousRank: number | null): RankMovement {
  if (previousRank == null) return { direction: "new", places: 0 };
  if (rank === previousRank) return { direction: "same", places: 0 };
  return rank < previousRank
    ? { direction: "up", places: previousRank - rank }
    : { direction: "down", places: rank - previousRank };
}
