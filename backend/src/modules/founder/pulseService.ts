import type { Prisma, PrismaClient } from "@prisma/client";
import { INVENTORY_STALE_AFTER_MS } from "../inventory/inventoryService";
import { detectBlockers, remainingQty, summarizeBlocked } from "./blockedDomain";
import {
  collectionsHealth,
  fulfilmentHealth,
  inventoryHealth,
  receivablesHealth,
  salesHealth,
  salesTeamHealth,
  systemsHealth,
} from "./healthDomain";
import { composeInsights, composeSummary } from "./insightsDomain";
import { composeIssues } from "./issuesDomain";
import {
  OPEN_ORDER_STATUSES,
  VALID_ORDER_STATUSES,
  deltaVsComparable,
  fillRate,
  metric,
  round2,
  sum,
} from "./metricsDomain";
import { comparableDay, dateColumn, greetingFor, periodForDay, type CalendarPeriod } from "./period";
import type { FounderPulse } from "./types";

type Db = PrismaClient | Prisma.TransactionClient;

const PULSE_CACHE_MS = 15_000;

interface PulseCacheEntry {
  expiresAt: number;
  payload: FounderPulse;
}

const pulseCache = new Map<string, PulseCacheEntry>();

export class PulseService {
  constructor(private readonly db: Db) {}

  async getPulse(input: { staffId: string; name: string; now?: Date }): Promise<FounderPulse> {
    const now = input.now ?? new Date();
    const period = periodForDay(now);
    const cacheKey = `${input.staffId}:${period.start.toISOString()}`;
    const cached = pulseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.payload;

    const payload = await this.build(input.staffId, input.name, now, period);
    pulseCache.set(cacheKey, { expiresAt: Date.now() + PULSE_CACHE_MS, payload });
    return payload;
  }

  /** Tests only — avoid leaking state across cases. */
  static clearCache() {
    pulseCache.clear();
  }

  private async build(staffId: string, name: string, now: Date, period: CalendarPeriod): Promise<FounderPulse> {
    const asOf = now.toISOString();
    const previous = comparableDay(period);

    const [
      todayOrders,
      previousOrders,
      todayCollections,
      previousCollections,
      todayUnlinkedPayments,
      previousUnlinkedPayments,
      openOrders,
      openApprovals,
      snapshots,
      invoiceRollup,
      invoiceCount,
      expectedSalespeople,
      openSessions,
      calendar,
      failedOutbox,
      oldestFailed,
      pendingDecisions,
      dispatchedToday,
      invoicedToday,
    ] = await Promise.all([
      this.ordersIn(period),
      this.ordersIn(previous),
      this.confirmedCollections(period),
      this.confirmedCollections(previous),
      this.unlinkedSucceededPayments(period),
      this.unlinkedSucceededPayments(previous),
      this.openOrders(),
      this.openApprovals(),
      this.snapshots(),
      this.invoiceRollup(now),
      this.db.invoice.count(),
      this.db.staffUser.count({
        where: { status: "active", roles: { some: { role: { name: "salesperson" } } } },
      }),
      this.db.workdaySession.count({
        where: { status: "open", workDate: dateColumn(now) },
      }),
      this.db.workingCalendar.findUnique({ where: { date: dateColumn(now) } }),
      this.db.sapOutbox.count({ where: { status: "failed" } }),
      this.db.sapOutbox.findFirst({
        where: { status: "failed" },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      this.db.approvalRequest.count({
        where: { status: { in: ["open", "escalated"] }, requiredPermission: "legal.decide" },
      }),
      this.db.order.aggregate({
        where: {
          createdAt: { gte: period.start, lt: period.end },
          status: { in: ["out_for_delivery", "delivered"] },
        },
        _sum: { orderTotal: true },
        _count: true,
      }),
      this.db.invoice.aggregate({
        where: { invoiceDate: { gte: period.start, lt: period.end } },
        _sum: { total: true },
      }),
    ]);

    const ordersToday = sum(todayOrders.map((order) => Number(order.orderTotal)));
    const ordersComparable = sum(previousOrders.map((order) => Number(order.orderTotal)));
    const collectionsToday = round2(todayCollections + todayUnlinkedPayments);
    const collectionsComparable = round2(previousCollections + previousUnlinkedPayments);
    const fillToday = fillRate(
      todayOrders.map((order) => ({
        status: order.status,
        items: order.items.map((item) => ({ qtyOrdered: item.qtyOrdered, qtyDelivered: item.qtyDelivered })),
      }))
    );
    const fillComparable = fillRate(
      previousOrders.map((order) => ({
        status: order.status,
        items: order.items.map((item) => ({ qtyOrdered: item.qtyOrdered, qtyDelivered: item.qtyDelivered })),
      }))
    );

    const snapshotByVariant = new Map(
      snapshots
        .filter((snapshot) => snapshot.variantId)
        .map((snapshot) => [snapshot.variantId as string, snapshot])
    );
    const approvalOrderIds = new Set(openApprovals.map((row) => row.orderId).filter(Boolean) as string[]);

    let staleInventory = false;
    const blockedInputs = openOrders.map((order) => {
      const lines = order.items.map((item) => {
        const snapshot = snapshotByVariant.get(item.variantId);
        const stale = snapshot
          ? now.getTime() - snapshot.syncedAt.getTime() > INVENTORY_STALE_AFTER_MS
          : false;
        if (stale) staleInventory = true;
        return {
          remaining: remainingQty(item.qtyOrdered, item.qtyDelivered),
          available: snapshot ? Number(snapshot.available) : null,
          snapshotStale: stale || !snapshot,
        };
      });
      const categories = detectBlockers({
        status: order.status,
        sapSyncStatus: order.sapSyncStatus,
        hasOpenApproval: approvalOrderIds.has(order.id),
        lines,
      });
      return { id: order.id, orderTotal: Number(order.orderTotal), categories };
    });

    const blocked = summarizeBlocked(blockedInputs, asOf);
    const openOrderValue = sum(openOrders.map((order) => Number(order.orderTotal)));
    const inventoryUnique = blocked.categories.find((category) => category.id === "INVENTORY")?.uniqueValue ?? 0;
    const inventoryOrders = blocked.categories.find((category) => category.id === "INVENTORY")?.orderCount ?? 0;

    const outstanding = invoiceCount > 0 ? invoiceRollup.outstanding : null;
    const overdue = invoiceCount > 0 ? invoiceRollup.overdue : null;
    const isWorkingDay = calendar ? calendar.isWorkingDay : true;

    const health = [
      salesHealth(ordersToday, ordersComparable, asOf),
      collectionsHealth(collectionsToday, collectionsComparable, asOf),
      inventoryHealth(inventoryUnique, openOrderValue, asOf),
      fulfilmentHealth(fillToday, asOf),
      receivablesHealth(outstanding, overdue, asOf),
      salesTeamHealth(openSessions, expectedSalespeople, isWorkingDay, asOf),
      systemsHealth(failedOutbox, asOf),
    ];
    const summary = composeSummary(health);
    const changes = composeInsights({
      asOf,
      ordersToday,
      ordersComparable,
      collectionsToday,
      collectionsComparable,
      fillRateToday: fillToday,
      fillRateComparable: fillComparable,
      inventoryUniqueBlocked: inventoryUnique,
      inventoryOrderCount: inventoryOrders,
    });
    const oldestFailedOutboxHours = oldestFailed
      ? Math.max(0, Math.round((now.getTime() - oldestFailed.createdAt.getTime()) / 3_600_000))
      : null;
    const issues = composeIssues({
      asOf,
      blocked,
      failedOutbox,
      oldestFailedOutboxHours,
      overdue,
      outstanding,
    });

    const activeRetailers = new Set(todayOrders.map((order) => order.retailerId)).size;
    const activeRetailersComparable = new Set(previousOrders.map((order) => order.retailerId)).size;

    const metrics = [
      metric({
        id: "orders",
        label: "Orders",
        value: ordersToday,
        unit: "inr",
        asOf,
        delta: deltaVsComparable(ordersToday, ordersComparable, "inr"),
      }),
      metric({
        id: "collections",
        label: "Collections",
        value: collectionsToday,
        unit: "inr",
        asOf,
        delta: deltaVsComparable(collectionsToday, collectionsComparable, "inr"),
      }),
      metric({
        id: "fillRate",
        label: "Fill rate",
        value: fillToday,
        unit: "percent",
        asOf,
        delta: deltaVsComparable(fillToday, fillComparable, "points"),
        unavailableReason: "Fill rate is unavailable until fulfilment has started.",
      }),
      metric({
        id: "blocked",
        label: "Blocked",
        value: blocked.totalUniqueValue,
        unit: "inr",
        asOf,
      }),
    ];

    const secondaryMetrics = [
      metric({
        id: "activeRetailers",
        label: "Active retailers",
        value: activeRetailers,
        unit: "count",
        asOf,
        delta: deltaVsComparable(activeRetailers, activeRetailersComparable, "count"),
      }),
      metric({
        id: "activeSalespeople",
        label: "Active salespeople",
        value: openSessions,
        unit: "count",
        asOf,
      }),
      metric({
        id: "outstanding",
        label: "Outstanding",
        value: outstanding,
        unit: "inr",
        asOf,
        unavailableReason: "Outstanding is unavailable until the local invoice ledger has invoices.",
      }),
      metric({
        id: "overdue",
        label: "Overdue",
        value: overdue,
        unit: "inr",
        asOf,
        unavailableReason: "Overdue is unavailable until the local invoice ledger has invoices.",
      }),
      metric({
        id: "dispatched",
        label: "Dispatched",
        value: Number(dispatchedToday._sum.orderTotal ?? 0),
        unit: "inr",
        asOf,
      }),
      metric({
        id: "invoiced",
        label: "Invoiced",
        value: Number(invoicedToday._sum.total ?? 0),
        unit: "inr",
        asOf,
      }),
    ];

    const isStale = staleInventory || invoiceCount === 0;
    const sourceStatus = isStale || fillToday == null ? "partial" : "ok";

    return {
      asOf,
      period: {
        start: period.start.toISOString(),
        end: period.end.toISOString(),
        timeZone: period.timeZone,
        label: period.label,
      },
      sourceStatus,
      isStale,
      viewer: { staffId, name },
      summary: { greeting: greetingFor(now, name), headline: summary.headline, tone: summary.tone },
      metrics,
      secondaryMetrics,
      changes,
      blocked,
      health,
      issues,
      pendingDecisions: {
        count: pendingDecisions,
        label:
          pendingDecisions === 0
            ? "No decisions waiting. Operations are within delegated authority."
            : `${pendingDecisions} ${pendingDecisions === 1 ? "decision needs" : "decisions need"} your attention.`,
      },
    };
  }

  private ordersIn(period: CalendarPeriod) {
    return this.db.order.findMany({
      where: {
        createdAt: { gte: period.start, lt: period.end },
        status: { in: [...VALID_ORDER_STATUSES] },
      },
      select: {
        id: true,
        retailerId: true,
        status: true,
        orderTotal: true,
        items: { select: { qtyOrdered: true, qtyDelivered: true } },
      },
    });
  }

  private async confirmedCollections(period: CalendarPeriod): Promise<number> {
    const result = await this.db.collectionSubmission.aggregate({
      where: { status: "confirmed", confirmedAt: { gte: period.start, lt: period.end } },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  private async unlinkedSucceededPayments(period: CalendarPeriod): Promise<number> {
    const result = await this.db.payment.aggregate({
      where: {
        status: "succeeded",
        settledAt: { gte: period.start, lt: period.end },
        collectionSubmission: { is: null },
      },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  private openOrders() {
    return this.db.order.findMany({
      where: { status: { in: [...OPEN_ORDER_STATUSES] } },
      select: {
        id: true,
        status: true,
        sapSyncStatus: true,
        orderTotal: true,
        items: { select: { variantId: true, qtyOrdered: true, qtyDelivered: true } },
      },
    });
  }

  private openApprovals() {
    return this.db.approvalRequest.findMany({
      where: { status: { in: ["open", "escalated"] }, orderId: { not: null } },
      select: { orderId: true },
    });
  }

  private snapshots() {
    return this.db.inventorySnapshot.findMany({
      select: { variantId: true, available: true, syncedAt: true },
    });
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
