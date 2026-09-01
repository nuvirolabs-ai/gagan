/**
 * What counts as an achievement, and what it is allowed to say.
 *
 * One engine decides this for every app. Nothing here promises a reward: this
 * product runs no incentive scheme, so an achievement is recognition and the
 * copy never implies otherwise.
 */

import { formatMetric, type TargetProgress } from "./targetDomain";

export type AchievementType =
  | "TARGET_50"
  | "TARGET_75"
  | "TARGET_90"
  | "TARGET_100"
  | "TARGET_EXCEEDED"
  | "PERSONAL_BEST"
  | "NEW_RETAILER_MILESTONE"
  | "RANK_UP"
  | "TOP_10"
  | "TOP_3";

/** How loudly the apps are allowed to present an event. */
export type CelebrationLevel = "major" | "minor";

export interface CandidateAchievement {
  type: AchievementType;
  metric: string | null;
  threshold: number | null;
  actual: number | null;
  title: string;
  message: string;
  celebration: CelebrationLevel;
  periodStart: Date;
  periodEnd: Date;
  /** The measurements behind it, so the event can still be explained later. */
  evidence: Record<string, unknown>;
  dedupeKey: string;
}

/** Milestones on the way to a target, in the order they are crossed. */
const TARGET_LADDER: Array<{ type: AchievementType; pct: number; celebration: CelebrationLevel }> = [
  { type: "TARGET_50", pct: 50, celebration: "minor" },
  { type: "TARGET_75", pct: 75, celebration: "minor" },
  { type: "TARGET_90", pct: 90, celebration: "minor" },
  { type: "TARGET_100", pct: 100, celebration: "major" },
  { type: "TARGET_EXCEEDED", pct: 110, celebration: "major" },
];

/** Counts of new stores worth marking. Beyond this, the target itself carries it. */
const NEW_RETAILER_MILESTONES = [1, 5, 10, 25];

function periodKey(periodStart: Date, periodEnd: Date): string {
  return `${periodStart.toISOString().slice(0, 10)}:${periodEnd.toISOString().slice(0, 10)}`;
}

export function dedupeKeyFor(input: {
  type: AchievementType;
  metric?: string | null;
  periodStart: Date;
  periodEnd: Date;
  threshold?: number | null;
}): string {
  return [
    input.type,
    input.metric ?? "",
    periodKey(input.periodStart, input.periodEnd),
    input.threshold == null ? "" : String(input.threshold),
  ].join("|");
}

/**
 * Milestones earned on the way to a target. Every level at or below the current
 * completion is returned; storage decides which are new, so a salesperson who
 * jumps from 40% to 100% in one order still gets the 100% event and not four
 * separate ones for the levels they blew past.
 */
export function targetAchievements(progress: TargetProgress): CandidateAchievement[] {
  if (progress.target <= 0) return [];
  const crossed = TARGET_LADDER.filter((rung) => progress.completionPct >= rung.pct);
  if (crossed.length === 0) return [];
  // Only the highest rung is worth announcing; the lower ones are implied.
  const rung = crossed[crossed.length - 1];
  const periodStart = new Date(`${progress.periodStart}T00:00:00.000Z`);
  const periodEnd = new Date(`${progress.periodEnd}T00:00:00.000Z`);
  const achievedText = formatMetric(progress.actual, progress.unit);
  const targetText = formatMetric(progress.target, progress.unit);
  const remainingText = formatMetric(progress.remaining, progress.unit);

  const title =
    rung.type === "TARGET_EXCEEDED"
      ? `${progress.label} target beaten`
      : rung.type === "TARGET_100"
        ? `${progress.label} target complete`
        : `${rung.pct}% of your ${progress.label.toLowerCase()} target`;

  const message =
    progress.remaining > 0
      ? `${achievedText} of ${targetText}. ${remainingText} left.`
      : `${achievedText} of ${targetText}.`;

  return [
    {
      type: rung.type,
      metric: progress.metric,
      threshold: rung.pct,
      actual: progress.actual,
      title,
      message,
      celebration: rung.celebration,
      periodStart,
      periodEnd,
      evidence: {
        target: progress.target,
        actual: progress.actual,
        completionPct: progress.completionPct,
        metric: progress.metric,
      },
      dedupeKey: dedupeKeyFor({
        type: rung.type,
        metric: progress.metric,
        periodStart,
        periodEnd,
        threshold: rung.pct,
      }),
    },
  ];
}

/**
 * A personal best is only meaningful against a real history: without at least
 * one earlier completed period to beat, there is no best to break.
 */
export function personalBest(input: {
  metric: string;
  unit: "currency" | "count";
  label: string;
  actual: number;
  previousPeriodValues: readonly number[];
  periodStart: Date;
  periodEnd: Date;
}): CandidateAchievement | null {
  if (input.previousPeriodValues.length === 0) return null;
  if (input.actual <= 0) return null;
  const previousBest = Math.max(...input.previousPeriodValues);
  if (previousBest <= 0) return null;
  if (input.actual <= previousBest) return null;

  return {
    type: "PERSONAL_BEST",
    metric: input.metric,
    threshold: previousBest,
    actual: input.actual,
    title: "New personal best",
    message: `${formatMetric(input.actual, input.unit)} — your best ${input.label.toLowerCase()} yet, past ${formatMetric(previousBest, input.unit)}.`,
    celebration: "major",
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    evidence: {
      metric: input.metric,
      actual: input.actual,
      previousBest,
      periodsCompared: input.previousPeriodValues.length,
    },
    dedupeKey: dedupeKeyFor({
      type: "PERSONAL_BEST",
      metric: input.metric,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    }),
  };
}

export function newRetailerMilestones(input: {
  added: number;
  periodStart: Date;
  periodEnd: Date;
}): CandidateAchievement[] {
  const reached = NEW_RETAILER_MILESTONES.filter((milestone) => input.added >= milestone);
  if (reached.length === 0) return [];
  const milestone = reached[reached.length - 1];
  return [
    {
      type: "NEW_RETAILER_MILESTONE",
      metric: "new_customers",
      threshold: milestone,
      actual: input.added,
      title: milestone === 1 ? "First new store this period" : `${milestone} new stores`,
      message:
        milestone === 1
          ? "Your first store of the period is on the books."
          : `${input.added} stores added to your list this period.`,
      celebration: "minor",
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      evidence: { added: input.added, milestone },
      dedupeKey: dedupeKeyFor({
        type: "NEW_RETAILER_MILESTONE",
        metric: "new_customers",
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        threshold: milestone,
      }),
    },
  ];
}

/**
 * Recognition for where a salesperson stands. A rank is only worth announcing
 * when there are enough people in the scope for it to mean something.
 */
export function rankAchievements(input: {
  rank: number | null;
  previousRank: number | null;
  participants: number;
  scopeLabel: string;
  periodStart: Date;
  periodEnd: Date;
}): CandidateAchievement[] {
  const candidates: CandidateAchievement[] = [];
  if (input.rank == null || input.participants < MIN_RANK_PARTICIPANTS) return candidates;

  if (input.previousRank != null && input.rank < input.previousRank) {
    candidates.push({
      type: "RANK_UP",
      metric: null,
      threshold: input.previousRank,
      actual: input.rank,
      title: "You moved up",
      message: `#${input.previousRank} to #${input.rank} of ${input.participants} in ${input.scopeLabel}.`,
      celebration: "minor",
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      evidence: {
        rank: input.rank,
        previousRank: input.previousRank,
        participants: input.participants,
      },
      dedupeKey: dedupeKeyFor({
        type: "RANK_UP",
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        threshold: input.rank,
      }),
    });
  }

  const podium = input.rank <= 3 ? 3 : input.rank <= 10 ? 10 : null;
  if (podium != null) {
    candidates.push({
      type: podium === 3 ? "TOP_3" : "TOP_10",
      metric: null,
      threshold: podium,
      actual: input.rank,
      title: podium === 3 ? `#${input.rank} in ${input.scopeLabel}` : `Top 10 in ${input.scopeLabel}`,
      message: `#${input.rank} of ${input.participants} this period.`,
      celebration: podium === 3 ? "major" : "minor",
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      evidence: { rank: input.rank, participants: input.participants },
      dedupeKey: dedupeKeyFor({
        type: podium === 3 ? "TOP_3" : "TOP_10",
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        threshold: podium,
      }),
    });
  }
  return candidates;
}

/** Below this, a "rank" is not a standing worth announcing. */
export const MIN_RANK_PARTICIPANTS = 3;
