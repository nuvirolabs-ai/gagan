import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { BASELINE_WINDOW_DAYS, buildBaseline, type RetailerBaseline } from "./baselineDomain";
import { sortTriggers, summarise, triggersFor, type SalesTrigger } from "./triggerDomain";

type Db = PrismaClient | any;

export interface OpportunityResult {
  triggers: SalesTrigger[];
  summary: Array<{ type: string; count: number; headline: string }>;
  generatedAt: Date;
  /** How far back the baselines looked, so a reader can judge them. */
  windowDays: number;
  retailersConsidered: number;
}

/**
 * Next best actions for a salesperson's own book.
 *
 * The whole book is loaded in four queries and reduced in memory rather than
 * asking per retailer: a salesperson with sixty stores would otherwise cost
 * hundreds of round trips on every Today load.
 *
 * Nothing is stored. A trigger is a reading of the current data, so it cannot
 * go stale in a table and be shown as if it were fresh.
 */
export class OpportunityService {
  constructor(private readonly prisma: Db = defaultPrisma) {}

  async forSalesperson(input: {
    salespersonId: string;
    now?: Date;
    limit?: number;
  }): Promise<OpportunityResult> {
    return this.forTeam({ staffIds: [input.salespersonId], now: input.now, limit: input.limit });
  }

  /**
   * The same trigger engine over a whole reporting tree.
   *
   * Nothing is stored, so a manager's view is not a copy of their team's rows —
   * it is the identical computation over a wider retailer set, and a store
   * appears exactly once regardless of how many managers can see it.
   *
   * Query count is fixed at four (staff, retailers, orders, visits) whether the
   * scope is one salesperson or three hundred; only the row counts grow.
   */
  async forTeam(input: {
    staffIds: string[];
    now?: Date;
    limit?: number;
  }): Promise<OpportunityResult> {
    const now = input.now ?? new Date();
    const since = new Date(now.getTime() - BASELINE_WINDOW_DAYS * 86_400_000);
    const empty = {
      triggers: [],
      summary: [],
      generatedAt: now,
      windowDays: BASELINE_WINDOW_DAYS,
      retailersConsidered: 0,
    };
    if (input.staffIds.length === 0) return empty;

    const staff = await this.prisma.staffUser.findMany({
      where: { id: { in: input.staffIds }, salesRepId: { not: null } },
      select: { id: true, salesRepId: true },
    });
    const repIds = staff.map((row: any) => row.salesRepId).filter(Boolean) as string[];
    if (repIds.length === 0) return empty;

    // Ownership is `Retailer.salesRepId` and nothing else; a manager's book is
    // derived from their team's reps rather than assigned to them separately.
    const staffIdByRep = new Map<string, string>(
      staff.map((row: any) => [row.salesRepId as string, row.id as string])
    );

    const retailers = await this.prisma.retailer.findMany({
      where: { salesRepId: { in: repIds }, status: "active" },
      select: { id: true, name: true, overdueAmount: true, salesRepId: true },
      orderBy: { name: "asc" },
    });
    if (retailers.length === 0) return empty;

    const retailerIds = retailers.map((retailer: any) => retailer.id);
    const [orders, visits] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          retailerId: { in: retailerIds },
          createdAt: { gte: since },
          status: { not: "rejected" },
        },
        select: {
          retailerId: true,
          createdAt: true,
          orderTotal: true,
          items: {
            select: { variant: { select: { product: { select: { category: true } } } } },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.salesVisit.findMany({
        where: { retailerId: { in: retailerIds }, checkedInAt: { gte: since } },
        select: { retailerId: true, checkedInAt: true },
        orderBy: { checkedInAt: "desc" },
      }),
    ]);

    const ordersByRetailer = new Map<string, any[]>();
    for (const order of orders as any[]) {
      ordersByRetailer.set(order.retailerId, [...(ordersByRetailer.get(order.retailerId) ?? []), order]);
    }
    const visitsByRetailer = new Map<string, any[]>();
    for (const visit of visits as any[]) {
      visitsByRetailer.set(visit.retailerId, [...(visitsByRetailer.get(visit.retailerId) ?? []), visit]);
    }

    // A retailer's share of the book decides how loudly a missed cycle matters.
    const valueByRetailer = new Map<string, number>();
    for (const order of orders as any[]) {
      valueByRetailer.set(
        order.retailerId,
        (valueByRetailer.get(order.retailerId) ?? 0) + Number(order.orderTotal ?? 0)
      );
    }
    const bookValue = [...valueByRetailer.values()].reduce((sum, value) => sum + value, 0);

    const triggers: SalesTrigger[] = [];
    for (const retailer of retailers as any[]) {
      const baseline = this.baselineFor({
        retailerId: retailer.id,
        orders: ordersByRetailer.get(retailer.id) ?? [],
        visits: visitsByRetailer.get(retailer.id) ?? [],
        now,
      });
      triggers.push(
        ...triggersFor({
          retailerId: retailer.id,
          retailerName: retailer.name,
          salespersonId: staffIdByRep.get(retailer.salesRepId) ?? retailer.salesRepId,
          baseline,
          overdueAmount: Number(retailer.overdueAmount ?? 0),
          valueShare: bookValue > 0 ? (valueByRetailer.get(retailer.id) ?? 0) / bookValue : 0,
          now,
        })
      );
    }

    const sorted = sortTriggers(triggers);
    return {
      // The summary counts everything found; the list is trimmed so Today
      // shows the few things worth doing rather than the whole audit.
      triggers: input.limit ? sorted.slice(0, input.limit) : sorted,
      summary: summarise(sorted),
      generatedAt: now,
      windowDays: BASELINE_WINDOW_DAYS,
      retailersConsidered: retailers.length,
    };
  }

  /** The baseline for one retailer, for the customer screen's "usually" line. */
  async baselineForRetailer(input: { retailerId: string; now?: Date }): Promise<RetailerBaseline> {
    const now = input.now ?? new Date();
    const since = new Date(now.getTime() - BASELINE_WINDOW_DAYS * 86_400_000);
    const [orders, visits] = await Promise.all([
      this.prisma.order.findMany({
        where: { retailerId: input.retailerId, createdAt: { gte: since }, status: { not: "rejected" } },
        select: {
          createdAt: true,
          orderTotal: true,
          items: { select: { variant: { select: { product: { select: { category: true } } } } } },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.salesVisit.findMany({
        where: { retailerId: input.retailerId, checkedInAt: { gte: since } },
        select: { checkedInAt: true },
        orderBy: { checkedInAt: "desc" },
      }),
    ]);
    return this.baselineFor({ retailerId: input.retailerId, orders, visits, now });
  }

  private baselineFor(input: {
    retailerId: string;
    orders: any[];
    visits: any[];
    now: Date;
  }): RetailerBaseline {
    return buildBaseline({
      retailerId: input.retailerId,
      orders: input.orders.map((order) => ({
        placedAt: order.createdAt,
        value: Number(order.orderTotal ?? 0),
        lineItems: order.items?.length ?? 0,
        categories: (order.items ?? [])
          .map((item: any) => item.variant?.product?.category)
          .filter((category: unknown): category is string => typeof category === "string"),
      })),
      visits: input.visits.map((visit) => ({ visitedAt: visit.checkedInAt })),
      now: input.now,
    });
  }
}

export const defaultOpportunityService = new OpportunityService();
