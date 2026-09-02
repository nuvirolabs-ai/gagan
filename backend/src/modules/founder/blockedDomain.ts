import { round2 } from "./metricsDomain";
import type { BlockerCategory, FounderBlockedSummary } from "./types";

export const BLOCKER_PRECEDENCE: BlockerCategory[] = ["CREDIT", "INVENTORY", "DISPATCH", "SYSTEM"];

export interface BlockedOrderInput {
  id: string;
  orderTotal: number;
  categories: BlockerCategory[];
}

export function primaryBlocker(categories: BlockerCategory[]): BlockerCategory | null {
  const unique = [...new Set(categories)];
  return BLOCKER_PRECEDENCE.find((category) => unique.includes(category)) ?? null;
}

export function summarizeBlocked(orders: BlockedOrderInput[], asOf: string): FounderBlockedSummary {
  const blocked = orders
    .map((order) => ({
      ...order,
      primary: primaryBlocker(order.categories),
      uniqueCategories: [...new Set(order.categories)],
    }))
    .filter((order) => order.primary != null);

  const uniqueByCategory = new Map<BlockerCategory, { uniqueValue: number; orderCount: number }>();
  for (const category of BLOCKER_PRECEDENCE) {
    uniqueByCategory.set(category, { uniqueValue: 0, orderCount: 0 });
  }

  let totalUniqueValue = 0;
  let grossConstraintImpact = 0;

  for (const order of blocked) {
    totalUniqueValue = round2(totalUniqueValue + order.orderTotal);
    grossConstraintImpact = round2(grossConstraintImpact + order.orderTotal * order.uniqueCategories.length);
    const bucket = uniqueByCategory.get(order.primary!)!;
    bucket.uniqueValue = round2(bucket.uniqueValue + order.orderTotal);
    bucket.orderCount += 1;
  }

  return {
    totalUniqueValue,
    grossConstraintImpact,
    orderCount: blocked.length,
    categories: BLOCKER_PRECEDENCE.map((id) => ({
      id,
      uniqueValue: uniqueByCategory.get(id)!.uniqueValue,
      orderCount: uniqueByCategory.get(id)!.orderCount,
    })).filter((category) => category.orderCount > 0),
    asOf,
  };
}

export function remainingQty(qtyOrdered: number, qtyDelivered: number | null): number {
  return Math.max(qtyOrdered - (qtyDelivered ?? 0), 0);
}

export function detectBlockers(input: {
  status: string;
  sapSyncStatus: string;
  hasOpenApproval: boolean;
  lines: Array<{ remaining: number; available: number | null; snapshotStale: boolean }>;
}): BlockerCategory[] {
  const categories: BlockerCategory[] = [];
  if (input.hasOpenApproval) categories.push("CREDIT");

  const needsStock = input.lines.some((line) => line.remaining > 0);
  const inventoryShort = input.lines.some(
    (line) => line.remaining > 0 && line.available != null && !line.snapshotStale && line.available < line.remaining
  );
  const stockUnknown = input.lines.some(
    (line) => line.remaining > 0 && (line.available == null || line.snapshotStale)
  );
  if (inventoryShort) categories.push("INVENTORY");

  if (input.status === "packed") categories.push("DISPATCH");

  if (
    input.sapSyncStatus === "failed" ||
    input.sapSyncStatus === "reconciliation_required" ||
    (needsStock && stockUnknown && !inventoryShort)
  ) {
    categories.push("SYSTEM");
  }

  return categories;
}
