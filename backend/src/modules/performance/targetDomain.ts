/**
 * What a sales target means, in one place.
 *
 * Every metric here names a canonical source. A salesperson never types in an
 * achievement figure — `actual` is always counted from orders, order lines,
 * visits, confirmed collections or the customer master. A metric with no
 * canonical source does not belong in this list.
 */

export const TARGET_METRICS = [
  "order_value",
  "order_count",
  "line_items",
  "productive_outlets",
  "collection_value",
  "new_customers",
  "visits",
] as const;

export type TargetMetric = (typeof TARGET_METRICS)[number];

export type MetricUnit = "currency" | "count";

export interface MetricDefinition {
  metric: TargetMetric;
  unit: MetricUnit;
  /** Short label for a tile or a chip. */
  label: string;
  /** The sentence a salesperson reads, with {{n}} substituted. */
  remainingTemplate: string;
  /** Where the number comes from, shown when a salesperson asks "says who?". */
  source: string;
}

export const METRIC_DEFINITIONS: Record<TargetMetric, MetricDefinition> = {
  order_value: {
    metric: "order_value",
    unit: "currency",
    label: "Sales",
    remainingTemplate: "{{n}} more to go",
    source: "Orders you placed this period, not counting rejected orders.",
  },
  order_count: {
    metric: "order_count",
    unit: "count",
    label: "Orders",
    remainingTemplate: "{{n}} more orders",
    source: "Orders you placed this period, not counting rejected orders.",
  },
  line_items: {
    metric: "line_items",
    unit: "count",
    label: "Lines",
    remainingTemplate: "{{n}} more lines",
    source: "Lines across the orders you placed this period.",
  },
  productive_outlets: {
    metric: "productive_outlets",
    unit: "count",
    label: "Productive stores",
    remainingTemplate: "{{n}} more stores",
    source: "Stores where your visit produced an order or a collection.",
  },
  collection_value: {
    metric: "collection_value",
    unit: "currency",
    label: "Collections",
    remainingTemplate: "{{n}} more to collect",
    source: "Collections you submitted that Accounts has confirmed.",
  },
  new_customers: {
    metric: "new_customers",
    unit: "count",
    label: "New stores",
    remainingTemplate: "{{n}} more stores",
    source: "Stores added to your list this period.",
  },
  visits: {
    metric: "visits",
    unit: "count",
    label: "Visits",
    remainingTemplate: "{{n}} more visits",
    source: "Store check-ins you recorded this period.",
  },
};

export type TargetStatus = "not_started" | "on_track" | "behind" | "achieved" | "exceeded";

export interface TargetProgress {
  metric: TargetMetric;
  unit: MetricUnit;
  label: string;
  target: number;
  actual: number;
  /** Never negative: once the target is met there is nothing left to do. */
  remaining: number;
  /** Uncapped, so beating a target is visible rather than flattened to 100. */
  completionPct: number;
  status: TargetStatus;
  periodStart: string;
  periodEnd: string;
  source: string;
}

/**
 * `elapsedFraction` is how far through the period we are, so "behind" means
 * behind the pace the period demands rather than merely short of the total.
 * Without it, every target looks "behind" on day one.
 */
export function resolveStatus(
  target: number,
  actual: number,
  elapsedFraction?: number
): TargetStatus {
  if (target <= 0) return "not_started";
  if (actual > target) return "exceeded";
  if (actual >= target) return "achieved";
  if (actual <= 0) return "not_started";
  if (elapsedFraction == null) return "on_track";
  const expected = target * clampFraction(elapsedFraction);
  return actual + 1e-9 >= expected ? "on_track" : "behind";
}

function clampFraction(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Turns a stored target and a counted actual into the numbers a salesperson
 * reads. A zero or negative target is reported honestly as having nothing set
 * rather than dividing by zero into Infinity.
 */
export function buildProgress(input: {
  metric: TargetMetric;
  target: number;
  actual: number;
  periodStart: Date;
  periodEnd: Date;
  elapsedFraction?: number;
}): TargetProgress {
  const definition = METRIC_DEFINITIONS[input.metric];
  const target = Number.isFinite(input.target) ? input.target : 0;
  const actual = Number.isFinite(input.actual) ? Math.max(0, input.actual) : 0;
  const remaining = target > 0 ? Math.max(0, roundForUnit(target - actual, definition.unit)) : 0;
  return {
    metric: input.metric,
    unit: definition.unit,
    label: definition.label,
    target: roundForUnit(target, definition.unit),
    actual: roundForUnit(actual, definition.unit),
    remaining,
    completionPct: target > 0 ? Math.round((actual / target) * 100) : 0,
    status: resolveStatus(target, actual, input.elapsedFraction),
    periodStart: input.periodStart.toISOString().slice(0, 10),
    periodEnd: input.periodEnd.toISOString().slice(0, 10),
    source: definition.source,
  };
}

/** Counts stay whole; money is rounded to the rupee the app displays. */
function roundForUnit(value: number, unit: MetricUnit): number {
  return unit === "count" ? Math.round(value) : Math.round(value);
}

/** 78400 -> "₹78,400", matching the grouping both apps already display. */
export function formatMetric(value: number, unit: MetricUnit): string {
  return unit === "currency"
    ? `₹${Math.round(value).toLocaleString("en-IN")}`
    : String(Math.round(value));
}

/**
 * The one-line sentence the Today screen shows. Deliberately a sentence a
 * salesperson can act on, not a label and a number.
 */
export function remainingSentence(progress: TargetProgress): string {
  if (progress.target <= 0) return "No target set for this period.";
  if (progress.remaining <= 0) {
    return progress.completionPct > 100
      ? `Target beaten — ${progress.completionPct}% of ${formatMetric(progress.target, progress.unit)}.`
      : "Target complete.";
  }
  const definition = METRIC_DEFINITIONS[progress.metric];
  return definition.remainingTemplate.replace(
    "{{n}}",
    formatMetric(progress.remaining, progress.unit)
  );
}

/* ------------------------------ period maths ----------------------------- */

/** UTC midnight, the canonical form of every `@db.Date` in this schema. */
export function startOfDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function endOfDay(value: Date): Date {
  return new Date(startOfDay(value).getTime() + 24 * 60 * 60 * 1000 - 1);
}

export interface PeriodPace {
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  elapsedFraction: number;
}

/**
 * How far through a period we are, counted in whole days and inclusive of both
 * ends. Before the period starts nothing has elapsed; after it ends everything
 * has, so a finished period is never reported as still having time left.
 */
export function periodPace(periodStart: Date, periodEnd: Date, now: Date): PeriodPace {
  const start = startOfDay(periodStart);
  const end = startOfDay(periodEnd);
  const today = startOfDay(now);
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  const rawElapsed = Math.round((today.getTime() - start.getTime()) / 86_400_000) + 1;
  const elapsedDays = Math.min(totalDays, Math.max(0, rawElapsed));
  return {
    totalDays,
    elapsedDays,
    remainingDays: Math.max(0, totalDays - elapsedDays),
    elapsedFraction: elapsedDays / totalDays,
  };
}
