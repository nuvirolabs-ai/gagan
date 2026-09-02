import type { Prisma, PrismaClient } from "@prisma/client";
import {
  VALID_ORDER_STATUSES,
  fillRate,
  round2,
  sum,
} from "./metricsDomain";
import {
  dateColumn,
  dayKey,
  eachDay,
  rollingWindow,
  type CalendarPeriod,
} from "./period";
import { interpretTrend, percentChange, type TrendMetricId } from "./trendsDomain";
import type { FounderTrend, FounderTrends, MetricUnit, TrendPeriod } from "./types";

type Db = PrismaClient | Prisma.TransactionClient;

const TREND_CACHE_MS = 15_000;
const trendCache = new Map<string, { expiresAt: number; payload: FounderTrends }>();

const PERIOD_DAYS: Record<TrendPeriod, 7 | 30 | 90> = { "7D": 7, "30D": 30, "90D": 90 };

interface DayBucket {
  orders: number;
  collections: number;
  retailers: Set<string>;
  fillOrders: Array<{ status: string; items: Array<{ qtyOrdered: number; qtyDelivered: number | null }> }>;
  sessions: number;
}

function emptyBucket(): DayBucket {
  return { orders: 0, collections: 0, retailers: new Set(), fillOrders: [], sessions: 0 };
}

export class TrendsService {
  constructor(private readonly db: Db) {}

  async getTrends(input: { period?: string; now?: Date }): Promise<FounderTrends> {
    const period = normalizePeriod(input.period);
    const now = input.now ?? new Date();
    const cacheKey = `${period}:${dayKey(now)}`;
    const cached = trendCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.payload;

    const payload = await this.build(period, now);
    trendCache.set(cacheKey, { expiresAt: Date.now() + TREND_CACHE_MS, payload });
    return payload;
  }

  static clearCache() {
    trendCache.clear();
  }

  private async build(period: TrendPeriod, now: Date): Promise<FounderTrends> {
    const days = PERIOD_DAYS[period];
    const { current, previous } = rollingWindow(now, days);
    const span: CalendarPeriod = {
      start: previous.start,
      end: current.end,
      timeZone: current.timeZone,
      label: period,
    };
    const asOf = now.toISOString();

    const [orders, collections, payments, sessions, invoiceCount, invoiceRollup, expectedSalespeople] =
      await Promise.all([
        this.db.order.findMany({
          where: {
            createdAt: { gte: span.start, lt: span.end },
            status: { in: [...VALID_ORDER_STATUSES] },
          },
          select: {
            createdAt: true,
            orderTotal: true,
            retailerId: true,
            status: true,
            items: { select: { qtyOrdered: true, qtyDelivered: true } },
          },
        }),
        this.db.collectionSubmission.findMany({
          where: { status: "confirmed", confirmedAt: { gte: span.start, lt: span.end } },
          select: { confirmedAt: true, amount: true },
        }),
        this.db.payment.findMany({
          where: {
            status: "succeeded",
            settledAt: { gte: span.start, lt: span.end },
            collectionSubmission: { is: null },
          },
          select: { settledAt: true, amount: true },
        }),
        this.db.workdaySession.findMany({
          where: {
            workDate: { gte: dateColumn(span.start), lt: dateColumn(span.end) },
          },
          select: { workDate: true, salespersonId: true },
        }),
        this.db.invoice.count(),
        this.invoiceRollup(now),
        this.db.staffUser.count({
          where: { status: "active", roles: { some: { role: { name: "salesperson" } } } },
        }),
      ]);

    const buckets = new Map<string, DayBucket>();
    for (const day of eachDay(span)) buckets.set(dayKey(day), emptyBucket());

    for (const order of orders) {
      const bucket = buckets.get(dayKey(order.createdAt));
      if (!bucket) continue;
      bucket.orders = round2(bucket.orders + Number(order.orderTotal));
      bucket.retailers.add(order.retailerId);
      bucket.fillOrders.push({
        status: order.status,
        items: order.items.map((item) => ({ qtyOrdered: item.qtyOrdered, qtyDelivered: item.qtyDelivered })),
      });
    }
    for (const row of collections) {
      if (!row.confirmedAt) continue;
      const bucket = buckets.get(dayKey(row.confirmedAt));
      if (bucket) bucket.collections = round2(bucket.collections + Number(row.amount));
    }
    for (const row of payments) {
      if (!row.settledAt) continue;
      const bucket = buckets.get(dayKey(row.settledAt));
      if (bucket) bucket.collections = round2(bucket.collections + Number(row.amount));
    }
    const sessionKeys = new Set<string>();
    for (const session of sessions) {
      const key = `${session.salespersonId}:${dayKey(session.workDate)}`;
      if (sessionKeys.has(key)) continue;
      sessionKeys.add(key);
      const bucket = buckets.get(dayKey(session.workDate));
      if (bucket) bucket.sessions += 1;
    }

    const currentDays = eachDay(current);
    const previousDays = eachDay(previous);

    const ordersTrend = this.moneyTrend({
      id: "orders",
      label: "Orders",
      period,
      asOf,
      currentDays,
      previousDays,
      buckets,
      pick: (bucket) => bucket.orders,
      unit: "inr",
    });
    const collectionsTrend = this.moneyTrend({
      id: "collections",
      label: "Collections",
      period,
      asOf,
      currentDays,
      previousDays,
      buckets,
      pick: (bucket) => bucket.collections,
      unit: "inr",
    });
    const retailersTrend = this.countTrend({
      id: "activeRetailers",
      label: "Active retailers",
      period,
      asOf,
      currentDays,
      previousDays,
      buckets,
      currentValue: uniqueRetailers(currentDays, buckets),
      previousValue: uniqueRetailers(previousDays, buckets),
      pointValue: (bucket) => bucket.retailers.size,
    });
    const fillCurrent = fillRate(currentDays.flatMap((day) => buckets.get(dayKey(day))?.fillOrders ?? []));
    const fillPrevious = fillRate(previousDays.flatMap((day) => buckets.get(dayKey(day))?.fillOrders ?? []));
    const fillTrend = this.rateTrend({
      id: "fillRate",
      label: "Fill rate",
      period,
      asOf,
      currentDays,
      buckets,
      currentValue: fillCurrent,
      previousValue: fillPrevious,
      unavailableReason: "Fill rate is unavailable until fulfilment has started in this period.",
    });

    const overdueAvailable = invoiceCount > 0;
    const overdueTrend: FounderTrend = {
      metric: "overdue",
      label: "Overdue",
      unit: "inr",
      period,
      points: currentDays.map((day) => ({ date: dayKey(day), value: null })),
      currentValue: overdueAvailable ? invoiceRollup.overdue : null,
      availability: overdueAvailable ? "available" : "unavailable",
      unavailableReason: overdueAvailable
        ? undefined
        : "Overdue is unavailable until the local invoice ledger has invoices.",
      comparison: null,
      interpretation: interpretTrend({
        id: "overdue",
        current: overdueAvailable ? invoiceRollup.overdue : null,
        previous: null,
        unavailable: !overdueAvailable,
      }),
      asOf,
      sourceStatus: "partial",
      isStale: true,
    };

    const productivityCurrent = expectedSalespeople === 0 ? null : sessionRatio(currentDays, buckets, expectedSalespeople);
    const productivityPrevious =
      expectedSalespeople === 0 ? null : sessionRatio(previousDays, buckets, expectedSalespeople);
    const salesTrend = this.rateTrend({
      id: "salesTeam",
      label: "Sales team productivity",
      period,
      asOf,
      currentDays,
      buckets,
      currentValue: productivityCurrent,
      previousValue: productivityPrevious,
      pointValue: (bucket) => (expectedSalespeople === 0 ? null : round2((bucket.sessions / expectedSalespeople) * 100)),
      unavailableReason: "Sales-team productivity is unavailable until salespeople are on the roster.",
    });

    const trends = [ordersTrend, collectionsTrend, retailersTrend, fillTrend, overdueTrend, salesTrend];
    const isStale = overdueTrend.isStale || fillCurrent == null;
    return {
      asOf,
      period,
      timeZone: current.timeZone,
      sourceStatus: isStale ? "partial" : "ok",
      isStale,
      trends,
    };
  }

  private moneyTrend(input: {
    id: TrendMetricId;
    label: string;
    period: TrendPeriod;
    asOf: string;
    currentDays: Date[];
    previousDays: Date[];
    buckets: Map<string, DayBucket>;
    pick: (bucket: DayBucket) => number;
    unit: MetricUnit;
  }): FounderTrend {
    const currentValue = sum(input.currentDays.map((day) => input.pick(input.buckets.get(dayKey(day)) ?? emptyBucket())));
    const previousValue = sum(input.previousDays.map((day) => input.pick(input.buckets.get(dayKey(day)) ?? emptyBucket())));
    return this.finishTrend({
      id: input.id,
      label: input.label,
      unit: input.unit,
      period: input.period,
      asOf: input.asOf,
      points: input.currentDays.map((day) => ({
        date: dayKey(day),
        value: input.pick(input.buckets.get(dayKey(day)) ?? emptyBucket()),
      })),
      currentValue,
      previousValue,
    });
  }

  private countTrend(input: {
    id: TrendMetricId;
    label: string;
    period: TrendPeriod;
    asOf: string;
    currentDays: Date[];
    previousDays: Date[];
    buckets: Map<string, DayBucket>;
    currentValue: number;
    previousValue: number;
    pointValue: (bucket: DayBucket) => number;
  }): FounderTrend {
    return this.finishTrend({
      id: input.id,
      label: input.label,
      unit: "count",
      period: input.period,
      asOf: input.asOf,
      points: input.currentDays.map((day) => ({
        date: dayKey(day),
        value: input.pointValue(input.buckets.get(dayKey(day)) ?? emptyBucket()),
      })),
      currentValue: input.currentValue,
      previousValue: input.previousValue,
    });
  }

  private rateTrend(input: {
    id: TrendMetricId;
    label: string;
    period: TrendPeriod;
    asOf: string;
    currentDays: Date[];
    buckets: Map<string, DayBucket>;
    currentValue: number | null;
    previousValue: number | null;
    pointValue?: (bucket: DayBucket) => number | null;
    unavailableReason?: string;
  }): FounderTrend {
    return this.finishTrend({
      id: input.id,
      label: input.label,
      unit: "percent",
      period: input.period,
      asOf: input.asOf,
      points: input.currentDays.map((day) => ({
        date: dayKey(day),
        value: input.pointValue
          ? input.pointValue(input.buckets.get(dayKey(day)) ?? emptyBucket())
          : fillRate(input.buckets.get(dayKey(day))?.fillOrders ?? []),
      })),
      currentValue: input.currentValue,
      previousValue: input.previousValue,
      unavailableReason: input.unavailableReason,
    });
  }

  private finishTrend(input: {
    id: TrendMetricId;
    label: string;
    unit: MetricUnit;
    period: TrendPeriod;
    asOf: string;
    points: Array<{ date: string; value: number | null }>;
    currentValue: number | null;
    previousValue: number | null;
    unavailableReason?: string;
  }): FounderTrend {
    const unavailable = input.currentValue == null;
    const change = percentChange(input.currentValue, input.previousValue);
    const direction =
      change == null ? "flat" : Math.abs(change) < 0.5 ? "flat" : change > 0 ? "up" : "down";
    return {
      metric: input.id,
      label: input.label,
      unit: input.unit,
      period: input.period,
      points: input.points,
      currentValue: input.currentValue,
      availability: unavailable ? "unavailable" : "available",
      unavailableReason: unavailable ? input.unavailableReason : undefined,
      comparison: unavailable
        ? null
        : {
            previousValue: input.previousValue,
            changePercent: change,
            direction,
            label:
              change == null
                ? "No comparable prior period"
                : `${direction === "down" ? "↓" : direction === "up" ? "↑" : "→"}${Math.abs(Math.round(change))}% over ${input.period === "7D" ? "7 days" : input.period === "30D" ? "30 days" : "90 days"}`,
          },
      interpretation: interpretTrend({
        id: input.id,
        current: input.currentValue,
        previous: input.previousValue,
        unavailable,
      }),
      asOf: input.asOf,
      sourceStatus: unavailable ? "partial" : "ok",
      isStale: unavailable,
    };
  }

  private async invoiceRollup(now: Date): Promise<{ outstanding: number; overdue: number }> {
    const invoices = await this.db.invoice.findMany({
      where: { status: { in: ["open", "partially_paid"] }, outstandingAmount: { gt: 0 } },
      select: { outstandingAmount: true, dueDate: true },
    });
    let outstanding = 0;
    let overdue = 0;
    for (const invoice of invoices) {
      const amount = Number(invoice.outstandingAmount);
      outstanding += amount;
      if (invoice.dueDate < now) overdue += amount;
    }
    return { outstanding: round2(outstanding), overdue: round2(overdue) };
  }
}

function normalizePeriod(value: string | undefined): TrendPeriod {
  if (value === "30D" || value === "90D" || value === "7D") return value;
  return "30D";
}

function uniqueRetailers(days: Date[], buckets: Map<string, DayBucket>): number {
  const ids = new Set<string>();
  for (const day of days) {
    const bucket = buckets.get(dayKey(day));
    if (!bucket) continue;
    for (const id of bucket.retailers) ids.add(id);
  }
  return ids.size;
}

function sessionRatio(days: Date[], buckets: Map<string, DayBucket>, expected: number): number {
  const sessionDays = sum(days.map((day) => buckets.get(dayKey(day))?.sessions ?? 0));
  return round2((sessionDays / (expected * days.length)) * 100);
}
