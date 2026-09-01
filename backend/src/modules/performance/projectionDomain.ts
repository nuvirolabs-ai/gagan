/**
 * Run-rate projection.
 *
 * This is arithmetic, not a forecast: it extends the pace so far across the
 * days that remain. It is labelled as such everywhere it is shown, and the
 * wording never claims a salesperson *will* land anywhere. A projection is
 * only offered once enough of the period has elapsed for the pace to mean
 * something.
 */

/** The label every surface must show beside a projected number. */
export const PROJECTION_LABEL = "Projected at current run rate";

/** Below this share of the period, the pace is noise rather than a rate. */
export const MIN_ELAPSED_FRACTION_FOR_PROJECTION = 0.2;

export interface SellingDays {
  total: number;
  elapsed: number;
  remaining: number;
}

export interface Projection {
  /** Null when the period is too young to project from honestly. */
  projected: number | null;
  perDay: number | null;
  sellingDays: SellingDays;
  label: string;
  /** Present when no projection was made, saying why. */
  unavailableReason?: string;
}

/**
 * Counts the days a team actually sells on. Falling back to calendar days when
 * no working calendar covers the period is deliberate: it keeps the projection
 * available, and over-counting days makes the projection more conservative
 * rather than flattering.
 */
export function sellingDaysIn(input: {
  periodStart: Date;
  periodEnd: Date;
  now: Date;
  /** ISO dates (YYYY-MM-DD) the calendar marks as non-working. */
  nonWorkingDays?: ReadonlySet<string>;
}): SellingDays {
  const start = startOfDay(input.periodStart);
  const end = startOfDay(input.periodEnd);
  const today = startOfDay(input.now);
  const nonWorking = input.nonWorkingDays ?? new Set<string>();

  let total = 0;
  let elapsed = 0;
  for (let cursor = start; cursor <= end; cursor = new Date(cursor.getTime() + 86_400_000)) {
    const iso = cursor.toISOString().slice(0, 10);
    if (nonWorking.has(iso)) continue;
    total += 1;
    if (cursor <= today) elapsed += 1;
  }
  return { total, elapsed, remaining: Math.max(0, total - elapsed) };
}

export function project(input: { actual: number; sellingDays: SellingDays }): Projection {
  const { sellingDays } = input;
  if (sellingDays.total === 0) {
    return {
      projected: null,
      perDay: null,
      sellingDays,
      label: PROJECTION_LABEL,
      unavailableReason: "No selling days in this period.",
    };
  }
  if (sellingDays.elapsed === 0) {
    return {
      projected: null,
      perDay: null,
      sellingDays,
      label: PROJECTION_LABEL,
      unavailableReason: "The period has not started.",
    };
  }
  if (sellingDays.elapsed / sellingDays.total < MIN_ELAPSED_FRACTION_FOR_PROJECTION) {
    return {
      projected: null,
      perDay: null,
      sellingDays,
      label: PROJECTION_LABEL,
      unavailableReason: `Too early to project — ${sellingDays.elapsed} of ${sellingDays.total} selling days done.`,
    };
  }

  const perDay = input.actual / sellingDays.elapsed;
  return {
    projected: Math.round(perDay * sellingDays.total),
    perDay: Math.round(perDay),
    sellingDays,
    label: PROJECTION_LABEL,
  };
}

export type RiskLevel = "on_track" | "watch" | "at_risk";

export interface RiskAssessment {
  level: RiskLevel;
  projectedAchievementPct: number | null;
  /** Plain sentences a manager can act on, each one a measured fact. */
  reasons: string[];
}

/** Below this projected achievement a target needs intervention. */
export const AT_RISK_PCT = 85;
export const WATCH_PCT = 95;

export function assessRisk(input: {
  target: number;
  projected: number | null;
  reasons?: readonly string[];
}): RiskAssessment {
  const reasons = [...(input.reasons ?? [])];
  if (input.target <= 0 || input.projected == null) {
    return { level: "on_track", projectedAchievementPct: null, reasons };
  }
  const pct = Math.round((input.projected / input.target) * 100);
  const level: RiskLevel = pct < AT_RISK_PCT ? "at_risk" : pct < WATCH_PCT ? "watch" : "on_track";
  if (level !== "on_track") {
    reasons.unshift(`${PROJECTION_LABEL.toLowerCase()}: ${pct}% of target.`);
  }
  return { level, projectedAchievementPct: pct, reasons };
}

function startOfDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}
