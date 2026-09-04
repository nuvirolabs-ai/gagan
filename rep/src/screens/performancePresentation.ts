import { inr } from "../theme";

export type PerformanceMetric = "sales" | "orders" | "visits" | "collections";
export type MetricRow = { date: string; value: number };

/** Keep headline and chart amounts readable on narrow field devices. */
export function compactInr(value: unknown) {
  const amount = Number(value) || 0;
  const absolute = Math.abs(amount);
  if (absolute >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(2).replace(/\.00$/, "")}Cr`;
  if (absolute >= 100_000) return `₹${(amount / 100_000).toFixed(2).replace(/\.00$/, "")}L`;
  if (absolute >= 1_000) return `₹${(amount / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return inr(amount);
}

export function metricRows(visuals: any, metric: PerformanceMetric): MetricRow[] {
  const source =
    metric === "sales"
      ? visuals?.salesTrend ?? []
      : metric === "orders"
        ? visuals?.ordersByDay ?? []
        : metric === "visits"
          ? visuals?.visitsTrend ?? []
          : visuals?.collectionsTrend ?? [];
  return source.map((row: any) => ({
    date: row.date,
    value:
      metric === "sales"
        ? Number(row.value) || 0
        : metric === "orders"
          ? Number(row.orders) || 0
          : metric === "visits"
            ? Number(row.visits) || 0
            : Number(row.confirmedValue) || 0,
  }));
}

/** Keep the default 30-day view to six truthful buckets, never 30 repeated rows. */
export function chartRows(visuals: any, metric: PerformanceMetric, windowDays: 7 | 30): MetricRow[] {
  const rows = metricRows(visuals, metric);
  if (windowDays === 7 || rows.length <= 7) return rows.slice(-7);
  const bucketCount = Math.min(6, rows.length);
  const buckets: MetricRow[] = Array.from({ length: bucketCount }, (_, index) => ({
    date: rows[Math.floor((index * rows.length) / bucketCount)]?.date ?? rows[0]?.date,
    value: 0,
  }));
  rows.forEach((row, index) => {
    const bucket = Math.min(bucketCount - 1, Math.floor((index * bucketCount) / rows.length));
    buckets[bucket].value += row.value;
  });
  return buckets;
}

export function chartDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value.slice(5)
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function metricDisplay(metric: PerformanceMetric, value: number) {
  return metric === "sales" || metric === "collections" ? compactInr(value) : String(value);
}
