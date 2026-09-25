import type { Prisma, PrismaClient } from "@prisma/client";
import { INVENTORY_STALE_AFTER_MS } from "../inventory/inventoryService";
import { detectBlockers, remainingQty, summarizeBlocked, type BlockedOrderInput } from "./blockedDomain";
import { composeIssues } from "./issuesDomain";
import { OPEN_ORDER_STATUSES, round2 } from "./metricsDomain";
import type { BlockerCategory, FounderIssue, FounderIssueDetail } from "./types";

type Db = PrismaClient | Prisma.TransactionClient;

const CACHE_MS = 15_000;
const cache = new Map<string, { expiresAt: number; payload: FounderIssue[] }>();

interface BlockedRow {
  id: string;
  orderNo: number;
  orderTotal: number;
  status: string;
  createdAt: Date;
  retailerId: string;
  retailerName: string;
  primary: BlockerCategory | null;
}

export class IssuesService {
  constructor(private readonly db: Db) {}

  async list(input: { status?: string; now?: Date } = {}): Promise<FounderIssue[]> {
    if (input.status === "resolved") return [];
    const now = input.now ?? new Date();
    const key = now.toISOString().slice(0, 13);
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.payload;
    const { issues } = await this.compute(now);
    cache.set(key, { expiresAt: Date.now() + CACHE_MS, payload: issues });
    return issues;
  }

  async detail(id: string, now = new Date()): Promise<FounderIssueDetail | null> {
    const { issues, blockedRows, overdueRetailers } = await this.compute(now);
    const issue = issues.find((row) => row.id === id);
    if (!issue) return null;
    const category = categoryFor(issue.id);
    const matching = category
      ? blockedRows.filter((row) => row.primary === category)
      : issue.id === "overdue-receivables"
        ? []
        : [];
    const retailers =
      issue.id === "overdue-receivables"
        ? overdueRetailers
        : uniqueRetailers(matching);
    return {
      ...issue,
      affected: {
        orders: matching.map((row) => ({
          id: row.id,
          ref: formatOrderRef(row.orderNo),
          total: row.orderTotal,
          retailerName: row.retailerName,
          status: row.status,
        })),
        retailers,
      },
    };
  }

  static clearCache() {
    cache.clear();
  }

  private async compute(now: Date): Promise<{
    issues: FounderIssue[];
    blockedRows: BlockedRow[];
    overdueRetailers: Array<{ id: string; name: string }>;
  }> {
    const asOf = now.toISOString();
    const [openOrders, openApprovals, snapshots, failedOutbox, oldestFailed, invoices] = await Promise.all([
      this.db.order.findMany({
        where: { status: { in: [...OPEN_ORDER_STATUSES] } },
        select: {
          id: true,
          orderNo: true,
          status: true,
          sapSyncStatus: true,
          orderTotal: true,
          createdAt: true,
          retailerId: true,
          retailer: { select: { name: true } },
          items: { select: { variantId: true, qtyOrdered: true, qtyDelivered: true } },
        },
      }),
      this.db.approvalRequest.findMany({
        where: { status: { in: ["open", "escalated"] }, orderId: { not: null } },
        select: { orderId: true, createdAt: true },
      }),
      this.db.inventorySnapshot.findMany({
        select: { variantId: true, available: true, syncedAt: true },
      }),
      this.db.sapOutbox.count({ where: { status: "failed" } }),
      this.db.sapOutbox.findFirst({
        where: { status: "failed" },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      this.db.invoice.findMany({
        where: { status: { in: ["open", "partially_paid"] }, outstandingAmount: { gt: 0 } },
        select: {
          outstandingAmount: true,
          dueDate: true,
          retailerId: true,
          retailer: { select: { name: true } },
        },
      }),
    ]);

    const snapshotByVariant = new Map(
      snapshots.filter((snapshot) => snapshot.variantId).map((snapshot) => [snapshot.variantId as string, snapshot])
    );
    const approvalOrderIds = new Set(openApprovals.map((row) => row.orderId).filter(Boolean) as string[]);
    const approvalAge = oldestHours(
      now,
      openApprovals.map((row) => row.createdAt)
    );

    const blockedInputs: BlockedOrderInput[] = [];
    const blockedRows: BlockedRow[] = [];
    const ageByCategory: Partial<Record<BlockerCategory, Date[]>> = {};

    for (const order of openOrders) {
      const lines = order.items.map((item) => {
        const snapshot = snapshotByVariant.get(item.variantId);
        const stale = snapshot ? now.getTime() - snapshot.syncedAt.getTime() > INVENTORY_STALE_AFTER_MS : false;
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
      blockedInputs.push({ id: order.id, orderTotal: Number(order.orderTotal), categories });
      const primary = summarizeBlocked([{ id: order.id, orderTotal: Number(order.orderTotal), categories }], asOf)
        .categories[0]?.id;
      const resolvedPrimary = categories.includes("CREDIT")
        ? "CREDIT"
        : categories.includes("INVENTORY")
          ? "INVENTORY"
          : categories.includes("DISPATCH")
            ? "DISPATCH"
            : categories.includes("SYSTEM")
              ? "SYSTEM"
              : null;
      if (resolvedPrimary) {
        blockedRows.push({
          id: order.id,
          orderNo: order.orderNo,
          orderTotal: Number(order.orderTotal),
          status: order.status,
          createdAt: order.createdAt,
          retailerId: order.retailerId,
          retailerName: order.retailer.name,
          primary: resolvedPrimary,
        });
        (ageByCategory[resolvedPrimary] ??= []).push(order.createdAt);
      }
      void primary;
    }

    const blocked = summarizeBlocked(blockedInputs, asOf);
    let outstanding = 0;
    let overdue = 0;
    let overdueCount = 0;
    const overdueRetailerMap = new Map<string, string>();
    const overdueDates: Date[] = [];
    for (const invoice of invoices) {
      const amount = Number(invoice.outstandingAmount);
      outstanding += amount;
      if (invoice.dueDate < now) {
        overdue += amount;
        overdueCount += 1;
        overdueDates.push(invoice.dueDate);
        overdueRetailerMap.set(invoice.retailerId, invoice.retailer.name);
      }
    }

    const issues = composeIssues({
      asOf,
      blocked,
      failedOutbox,
      oldestFailedOutboxHours: oldestFailed
        ? Math.max(0, Math.round((now.getTime() - oldestFailed.createdAt.getTime()) / 3_600_000))
        : null,
      overdue: invoices.length > 0 ? round2(overdue) : null,
      outstanding: invoices.length > 0 ? round2(outstanding) : null,
      overdueInvoiceCount: overdueCount,
      inventoryAgeHours: oldestHours(now, ageByCategory.INVENTORY ?? []),
      creditAgeHours: approvalAge ?? oldestHours(now, ageByCategory.CREDIT ?? []),
      dispatchAgeHours: oldestHours(now, ageByCategory.DISPATCH ?? []),
      overdueAgeHours: oldestHours(now, overdueDates),
    });

    return {
      issues,
      blockedRows,
      overdueRetailers: [...overdueRetailerMap.entries()].map(([id, name]) => ({ id, name })),
    };
  }
}

function categoryFor(id: string): BlockerCategory | null {
  if (id === "blocked-credit") return "CREDIT";
  if (id === "blocked-inventory") return "INVENTORY";
  if (id === "blocked-dispatch") return "DISPATCH";
  return null;
}

function uniqueRetailers(rows: BlockedRow[]): Array<{ id: string; name: string }> {
  const map = new Map<string, string>();
  for (const row of rows) map.set(row.retailerId, row.retailerName);
  return [...map.entries()].map(([id, name]) => ({ id, name }));
}

function oldestHours(now: Date, dates: Date[]): number | null {
  if (dates.length === 0) return null;
  const oldest = dates.reduce((min, date) => (date < min ? date : min));
  return Math.max(0, Math.round((now.getTime() - oldest.getTime()) / 3_600_000));
}

function formatOrderRef(orderNo: number): string {
  return `GGN-${String(orderNo).padStart(8, "0")}`;
}
