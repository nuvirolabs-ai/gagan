import { eachDay, isProductiveVisit, startOfDay } from "./fieldDomain";

export interface VisualOrder {
  createdAt: Date;
  orderTotal: number;
  categories: string[];
}

export interface VisualVisit {
  checkedInAt: Date;
  outcome: string | null;
  activityTypes: string[];
}

export interface VisualCollection {
  submittedAt: Date;
  amount: number;
  status: string;
}

function dayKey(value: Date): string {
  return startOfDay(value).toISOString().slice(0, 10);
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Converts canonical event rows into a small, chart-friendly read model.
 * Empty days are intentionally represented as zero so a trend is honest about
 * the selling window rather than silently joining non-contiguous points.
 */
export function buildPerformanceVisuals(input: {
  from: Date;
  to: Date;
  orders: readonly VisualOrder[];
  visits: readonly VisualVisit[];
  collections: readonly VisualCollection[];
  routeCompletionTrend?: readonly { date: Date; completionPct: number }[];
}) {
  const days = eachDay(input.from, input.to);
  const sales = new Map<string, { value: number; orders: number }>();
  const visits = new Map<string, { visits: number; productiveVisits: number }>();
  const collections = new Map<string, { value: number; confirmedValue: number }>();
  const categories = new Map<string, number>();

  for (const day of days) {
    const key = dayKey(day);
    sales.set(key, { value: 0, orders: 0 });
    visits.set(key, { visits: 0, productiveVisits: 0 });
    collections.set(key, { value: 0, confirmedValue: 0 });
  }

  for (const order of input.orders) {
    const key = dayKey(order.createdAt);
    const row = sales.get(key);
    if (!row) continue;
    row.value += order.orderTotal;
    row.orders += 1;
    for (const category of new Set(order.categories.filter(Boolean))) {
      categories.set(category, (categories.get(category) ?? 0) + order.orderTotal);
    }
  }
  for (const visit of input.visits) {
    const row = visits.get(dayKey(visit.checkedInAt));
    if (!row) continue;
    row.visits += 1;
    if (isProductiveVisit({ outcome: visit.outcome, activityTypes: visit.activityTypes })) {
      row.productiveVisits += 1;
    }
  }
  for (const collection of input.collections) {
    const row = collections.get(dayKey(collection.submittedAt));
    if (!row) continue;
    row.value += collection.amount;
    if (collection.status === "confirmed") row.confirmedValue += collection.amount;
  }

  const salesTrend = days.map((date) => {
    const key = dayKey(date);
    const row = sales.get(key)!;
    return { date: key, value: rounded(row.value), orders: row.orders };
  });
  const visitsTrend = days.map((date) => {
    const key = dayKey(date);
    const row = visits.get(key)!;
    return { date: key, visits: row.visits, productiveVisits: row.productiveVisits };
  });
  const collectionsTrend = days.map((date) => {
    const key = dayKey(date);
    const row = collections.get(key)!;
    return { date: key, submittedValue: rounded(row.value), confirmedValue: rounded(row.confirmedValue) };
  });
  const categoryTotal = [...categories.values()].reduce((sum, value) => sum + value, 0);
  const categoryContribution = [...categories.entries()]
    .map(([category, value]) => ({ category, value: rounded(value), sharePct: categoryTotal ? rounded((value / categoryTotal) * 100) : 0 }))
    .sort((a, b) => b.value - a.value);
  const totalVisits = visitsTrend.reduce((sum, row) => sum + row.visits, 0);
  const productiveVisits = visitsTrend.reduce((sum, row) => sum + row.productiveVisits, 0);

  return {
    window: { from: dayKey(input.from), to: dayKey(input.to), days: days.length },
    salesTrend,
    ordersByDay: salesTrend.map(({ date, orders }) => ({ date, orders })),
    visitsTrend,
    collectionsTrend,
    categoryContribution,
    productivityPct: totalVisits ? rounded((productiveVisits / totalVisits) * 100) : null,
    routeCompletionTrend: input.routeCompletionTrend?.map((row) => ({ date: dayKey(row.date), completionPct: row.completionPct })) ?? [],
    hasEnoughHistory: input.orders.length > 0 || input.visits.length > 0 || input.collections.length > 0,
  };
}
