/**
 * Behavioural baselines for a retailer, computed from what they have actually
 * done rather than from a model.
 *
 * Everything here is descriptive statistics over a bounded window of recent
 * history. Nothing predicts. A baseline says "this shop usually orders every
 * twelve days"; it never says the shop will order tomorrow.
 */

/** How far back a baseline looks. Older behaviour is not current behaviour. */
export const BASELINE_WINDOW_DAYS = 180;

/** At most this many orders inform a baseline, newest first. */
export const BASELINE_MAX_ORDERS = 12;

/**
 * Two orders give one gap, which is not a cycle. Three orders give two gaps,
 * which is the least that can be called "usually".
 */
export const MIN_ORDERS_FOR_INTERVAL = 3;

/** Below this, "typical order value" is one number wearing a disguise. */
export const MIN_ORDERS_FOR_VALUE = 3;

export interface OrderObservation {
  placedAt: Date;
  value: number;
  lineItems: number;
  categories: readonly string[];
}

export interface VisitObservation {
  visitedAt: Date;
}

export interface RetailerBaseline {
  retailerId: string;
  orderCount: number;
  /** Null until there is enough history for the word "usually" to be honest. */
  medianIntervalDays: number | null;
  medianOrderValue: number | null;
  averageOrderValue: number | null;
  medianLineItems: number | null;
  lastOrderAt: Date | null;
  daysSinceLastOrder: number | null;
  lastVisitAt: Date | null;
  daysSinceLastVisit: number | null;
  /** Categories present in at least half of the observed orders. */
  regularCategories: string[];
  lastOrderValue: number | null;
  lastOrderLineItems: number | null;
  lastOrderCategories: string[];
  /** Direction of the last three orders against the three before them. */
  trend: "rising" | "steady" | "falling" | "unknown";
  /** True when there is enough history to say anything about a cycle. */
  hasIntervalBaseline: boolean;
  hasValueBaseline: boolean;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function wholeDaysBetween(from: Date, to: Date): number {
  return Math.floor((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

function startOfDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

/**
 * Builds the baseline for one retailer. Orders may arrive in any order; they
 * are sorted newest-first here so callers cannot change the answer by changing
 * their query's ordering.
 */
export function buildBaseline(input: {
  retailerId: string;
  orders: readonly OrderObservation[];
  visits: readonly VisitObservation[];
  now: Date;
}): RetailerBaseline {
  const orders = [...input.orders]
    .sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime())
    .slice(0, BASELINE_MAX_ORDERS);
  const visits = [...input.visits].sort((a, b) => b.visitedAt.getTime() - a.visitedAt.getTime());

  const intervals: number[] = [];
  for (let index = 0; index < orders.length - 1; index += 1) {
    const gap = wholeDaysBetween(orders[index + 1].placedAt, orders[index].placedAt);
    if (gap > 0) intervals.push(gap);
  }

  const values = orders.map((order) => order.value);
  const lineItems = orders.map((order) => order.lineItems);
  const hasIntervalBaseline = orders.length >= MIN_ORDERS_FOR_INTERVAL && intervals.length > 0;
  const hasValueBaseline = orders.length >= MIN_ORDERS_FOR_VALUE;

  const categoryCounts = new Map<string, number>();
  for (const order of orders) {
    for (const category of new Set(order.categories)) {
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
  }
  const regularCategories = [...categoryCounts.entries()]
    .filter(([, count]) => orders.length > 0 && count / orders.length >= 0.5)
    .map(([category]) => category)
    .sort();

  const lastOrder = orders[0] ?? null;
  const lastVisit = visits[0] ?? null;

  return {
    retailerId: input.retailerId,
    orderCount: orders.length,
    medianIntervalDays: hasIntervalBaseline ? median(intervals) : null,
    medianOrderValue: hasValueBaseline ? median(values) : null,
    averageOrderValue: hasValueBaseline ? mean(values) : null,
    medianLineItems: hasValueBaseline ? median(lineItems) : null,
    lastOrderAt: lastOrder?.placedAt ?? null,
    daysSinceLastOrder: lastOrder ? wholeDaysBetween(lastOrder.placedAt, input.now) : null,
    lastVisitAt: lastVisit?.visitedAt ?? null,
    daysSinceLastVisit: lastVisit ? wholeDaysBetween(lastVisit.visitedAt, input.now) : null,
    regularCategories,
    lastOrderValue: lastOrder?.value ?? null,
    lastOrderLineItems: lastOrder?.lineItems ?? null,
    lastOrderCategories: lastOrder ? [...new Set(lastOrder.categories)].sort() : [],
    trend: trendOf(values),
    hasIntervalBaseline,
    hasValueBaseline,
  };
}

/**
 * Compares the three most recent orders with the three before them. Fewer than
 * six orders is not enough to call a direction, so it stays unknown rather than
 * reading noise as a trend.
 */
export function trendOf(newestFirstValues: readonly number[]): RetailerBaseline["trend"] {
  if (newestFirstValues.length < 6) return "unknown";
  const recent = mean(newestFirstValues.slice(0, 3)) ?? 0;
  const earlier = mean(newestFirstValues.slice(3, 6)) ?? 0;
  if (earlier <= 0) return "unknown";
  const change = (recent - earlier) / earlier;
  if (change >= 0.15) return "rising";
  if (change <= -0.15) return "falling";
  return "steady";
}
