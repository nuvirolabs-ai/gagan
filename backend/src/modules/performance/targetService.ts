import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { isProductiveVisit } from "../field/fieldDomain";
import {
  METRIC_DEFINITIONS,
  TARGET_METRICS,
  buildProgress,
  endOfDay,
  periodPace,
  startOfDay,
  type TargetMetric,
  type TargetProgress,
} from "./targetDomain";

type Db = PrismaClient | any;

export interface Period {
  from: Date;
  to: Date;
}

/** Every metric measured once, so one period costs one pass, not one per target. */
export type MetricActuals = Record<TargetMetric, number>;

export function emptyActuals(): MetricActuals {
  return TARGET_METRICS.reduce((actuals, metric) => {
    actuals[metric] = 0;
    return actuals;
  }, {} as MetricActuals);
}

/** The calendar month `now` falls in — the default period for a target. */
export function currentMonth(now = new Date()): Period {
  return {
    from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    to: endOfDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))),
  };
}

function money(value: unknown): number {
  return value == null ? 0 : Number(value);
}

/**
 * Counts what a salesperson actually did in a period, from the rows the rest of
 * the system already treats as true.
 *
 * Deliberate choices:
 *  - rejected orders are excluded everywhere, because a rejected order is not
 *    a sale and counting it would let a blocked order inflate a target;
 *  - collections count only once Accounts has confirmed them, so a target can
 *    never be met with money the ledger has not accepted;
 *  - a store counts as productive once, however many times it was visited.
 */
export class TargetService {
  constructor(private readonly prisma: Db = defaultPrisma) {}

  private async salesRepIdFor(salespersonId: string): Promise<string | null> {
    const staff = await this.prisma.staffUser.findUnique({
      where: { id: salespersonId },
      select: { salesRepId: true },
    });
    return staff?.salesRepId ?? null;
  }

  async actualsFor(input: { salespersonId: string; period: Period }): Promise<MetricActuals> {
    const salesRepId = await this.salesRepIdFor(input.salespersonId);
    const range = { gte: input.period.from, lte: input.period.to };
    const orderWhere = salesRepId
      ? {
          placedByRepId: salesRepId,
          placedBy: "rep" as const,
          createdAt: range,
          status: { not: "rejected" as const },
        }
      : null;

    const [orderAgg, lineItemCount, visits, collectionAgg, newCustomers, visitCount] =
      await Promise.all([
        orderWhere
          ? this.prisma.order.aggregate({
              where: orderWhere,
              _sum: { orderTotal: true },
              _count: { _all: true },
            })
          : Promise.resolve(null),
        orderWhere
          ? this.prisma.orderItem.count({ where: { order: orderWhere } })
          : Promise.resolve(0),
        this.prisma.salesVisit.findMany({
          where: { salespersonId: input.salespersonId, checkedInAt: range },
          select: { retailerId: true, outcome: true, activities: { select: { type: true } } },
        }),
        this.prisma.collectionSubmission.aggregate({
          where: {
            collectorStaffId: input.salespersonId,
            submittedAt: range,
            status: "confirmed",
          },
          _sum: { amount: true },
        }),
        salesRepId
          ? this.prisma.retailer.count({ where: { salesRepId, createdAt: range } })
          : Promise.resolve(0),
        this.prisma.salesVisit.count({
          where: { salespersonId: input.salespersonId, checkedInAt: range },
        }),
      ]);

    const productiveRetailers = new Set<string>();
    for (const visit of visits) {
      const productive = isProductiveVisit({
        outcome: visit.outcome,
        activityTypes: (visit.activities ?? []).map((activity: any) => activity.type),
      });
      if (productive) productiveRetailers.add(visit.retailerId);
    }

    return {
      order_value: money(orderAgg?._sum?.orderTotal),
      order_count: orderAgg?._count?._all ?? 0,
      line_items: lineItemCount,
      productive_outlets: productiveRetailers.size,
      collection_value: money(collectionAgg?._sum?.amount),
      new_customers: newCustomers,
      visits: visitCount,
    };
  }

  /**
   * The same measurements for a whole group, in a fixed number of queries.
   *
   * Ranking and the leader dashboard both need every salesperson's numbers at
   * once. Calling `actualsFor` in a loop would be one round trip per person per
   * metric; this is five queries whether the team is three people or three
   * hundred.
   */
  async bulkActuals(input: {
    salespeople: ReadonlyArray<{ staffId: string; salesRepId: string | null }>;
    period: Period;
  }): Promise<Map<string, MetricActuals>> {
    const staffIds = input.salespeople.map((person) => person.staffId);
    const salesRepIds = input.salespeople
      .map((person) => person.salesRepId)
      .filter((id): id is string => id != null);
    const range = { gte: input.period.from, lte: input.period.to };

    const [orders, visits, collections, newRetailers] = await Promise.all([
      salesRepIds.length
        ? this.prisma.order.findMany({
            where: {
              placedByRepId: { in: salesRepIds },
              placedBy: "rep",
              createdAt: range,
              status: { not: "rejected" },
            },
            select: {
              placedByRepId: true,
              orderTotal: true,
              _count: { select: { items: true } },
            },
          })
        : Promise.resolve([]),
      staffIds.length
        ? this.prisma.salesVisit.findMany({
            where: { salespersonId: { in: staffIds }, checkedInAt: range },
            select: {
              salespersonId: true,
              retailerId: true,
              outcome: true,
              activities: { select: { type: true } },
            },
          })
        : Promise.resolve([]),
      staffIds.length
        ? this.prisma.collectionSubmission.groupBy({
            by: ["collectorStaffId"],
            where: {
              collectorStaffId: { in: staffIds },
              submittedAt: range,
              status: "confirmed",
            },
            _sum: { amount: true },
          })
        : Promise.resolve([]),
      salesRepIds.length
        ? this.prisma.retailer.groupBy({
            by: ["salesRepId"],
            where: { salesRepId: { in: salesRepIds }, createdAt: range },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);

    const byStaff = new Map<string, MetricActuals>();
    const staffByRep = new Map<string, string>();
    for (const person of input.salespeople) {
      byStaff.set(person.staffId, emptyActuals());
      if (person.salesRepId) staffByRep.set(person.salesRepId, person.staffId);
    }

    for (const order of orders as any[]) {
      const staffId = staffByRep.get(order.placedByRepId);
      const actuals = staffId ? byStaff.get(staffId) : undefined;
      if (!actuals) continue;
      actuals.order_value += money(order.orderTotal);
      actuals.order_count += 1;
      actuals.line_items += order._count?.items ?? 0;
    }

    const productive = new Map<string, Set<string>>();
    for (const visit of visits as any[]) {
      const actuals = byStaff.get(visit.salespersonId);
      if (!actuals) continue;
      actuals.visits += 1;
      const isProductive = isProductiveVisit({
        outcome: visit.outcome,
        activityTypes: (visit.activities ?? []).map((activity: any) => activity.type),
      });
      if (!isProductive) continue;
      const seen = productive.get(visit.salespersonId) ?? new Set<string>();
      seen.add(visit.retailerId);
      productive.set(visit.salespersonId, seen);
    }
    for (const [staffId, retailers] of productive) {
      const actuals = byStaff.get(staffId);
      if (actuals) actuals.productive_outlets = retailers.size;
    }

    for (const row of collections as any[]) {
      const actuals = byStaff.get(row.collectorStaffId);
      if (actuals) actuals.collection_value = money(row._sum?.amount);
    }

    for (const row of newRetailers as any[]) {
      const staffId = row.salesRepId ? staffByRep.get(row.salesRepId) : undefined;
      const actuals = staffId ? byStaff.get(staffId) : undefined;
      if (actuals) actuals.new_customers = row._count?._all ?? 0;
    }

    return byStaff;
  }

  /** Targets stored for a salesperson whose period overlaps the one asked for. */
  async storedTargets(input: { salespersonId: string; period: Period }) {
    return this.prisma.salesTarget.findMany({
      where: {
        salespersonId: input.salespersonId,
        periodStart: { lte: startOfDay(input.period.to) },
        periodEnd: { gte: startOfDay(input.period.from) },
      },
      orderBy: { metric: "asc" },
    });
  }

  /**
   * Target-versus-achievement for a salesperson. A metric with no stored target
   * is absent from the result: this system never invents a goal nobody set.
   */
  async progressFor(input: {
    salespersonId: string;
    period?: Period;
    now?: Date;
    actuals?: MetricActuals;
  }): Promise<TargetProgress[]> {
    const now = input.now ?? new Date();
    const period = input.period ?? currentMonth(now);
    const [targets, actuals] = await Promise.all([
      this.storedTargets({ salespersonId: input.salespersonId, period }),
      input.actuals
        ? Promise.resolve(input.actuals)
        : this.actualsFor({ salespersonId: input.salespersonId, period }),
    ]);

    return targets
      .filter((target: any) => METRIC_DEFINITIONS[target.metric as TargetMetric] != null)
      .map((target: any) => {
        const pace = periodPace(target.periodStart, target.periodEnd, now);
        return buildProgress({
          metric: target.metric as TargetMetric,
          target: money(target.targetValue),
          actual: actuals[target.metric as TargetMetric] ?? 0,
          periodStart: target.periodStart,
          periodEnd: target.periodEnd,
          elapsedFraction: pace.elapsedFraction,
        });
      });
  }

  /**
   * The single target the Today screen leads with: the one the salesperson is
   * most likely to be judged on, preferring value, then productive coverage.
   */
  static headline(progress: readonly TargetProgress[]): TargetProgress | null {
    const preference: TargetMetric[] = [
      "order_value",
      "collection_value",
      "productive_outlets",
      "order_count",
      "line_items",
      "new_customers",
      "visits",
    ];
    for (const metric of preference) {
      const match = progress.find((entry) => entry.metric === metric && entry.target > 0);
      if (match) return match;
    }
    return null;
  }
}

export const defaultTargetService = new TargetService();
