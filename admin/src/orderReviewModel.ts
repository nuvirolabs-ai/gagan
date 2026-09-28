import type { VisualTone } from "./components/operationalUtils";

export const ORDER_DEPARTURE_MS = 700;

export const STATUS_LABEL: Record<string, string> = {
  placed: "Placed",
  confirmed: "Confirmed",
  packed: "Packed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  rejected: "Rejected",
};

export const NEXT_ACTION: Record<string, string> = {
  placed: "Approve or reject this order.",
  confirmed: "Mark packed when the warehouse has picked it.",
  packed: "Assign a dispatch route.",
  out_for_delivery: "Capture proof of delivery.",
  delivered: "Complete. Invoice is on the ledger.",
  rejected: "Closed. No further fulfilment.",
};

export type RowSurface = "awaiting" | "approved" | "hold" | "rejected" | "progress" | "complete";

export function isSapSynced(order: { sapSyncStatus?: string | null }) {
  return order.sapSyncStatus === "synced" || order.sapSyncStatus === "sent";
}

export function toneFor(order: { status?: string; sapSyncStatus?: string | null }): VisualTone {
  if (order.status === "rejected" || order.sapSyncStatus === "failed") return "critical";
  if (order.status === "placed") return "bottleneck";
  if (order.status === "delivered") return "complete";
  return "moving";
}

/** Queue wash comes from the canonical order/hold state, never from which button was pressed. */
export function rowSurface(order: {
  status?: string;
  internalStatus?: { isOnHold?: boolean } | null;
}): RowSurface {
  if (order.internalStatus?.isOnHold) return "hold";
  if (order.status === "rejected") return "rejected";
  if (order.status === "placed") return "awaiting";
  if (order.status === "confirmed") return "approved";
  if (order.status === "delivered") return "complete";
  return "progress";
}

export function queueStatusLabel(order: {
  status?: string;
  sapSyncStatus?: string | null;
  internalStatus?: { currentLabel?: string | null } | null;
}) {
  return order.internalStatus?.currentLabel
    ?? (order.sapSyncStatus === "failed" ? "SAP failed" : STATUS_LABEL[order.status ?? ""] ?? order.status ?? "Unknown");
}

export function dependencyCopy(order: {
  status?: string;
  sapSyncStatus?: string | null;
  internalStatus?: { isOnHold?: boolean; holdReason?: string | null } | null;
}) {
  if (order.internalStatus?.isOnHold) {
    return order.internalStatus.holdReason
      ? `On hold: ${order.internalStatus.holdReason}`
      : "This order is on hold.";
  }
  if (order.status === "placed") return "Commercial approval is the current dependency.";
  if (order.sapSyncStatus === "failed") return "SAP synchronization needs a retry.";
  return "The next operational state is clear.";
}

export function orderHealth(order: {
  status?: string;
  sapSyncStatus?: string | null;
  delivery?: { routeId?: string | null } | null;
}) {
  const commercial = order.status === "placed" ? ["Needs action", "bottleneck"] : ["Ready", "complete"];
  const fulfilment = order.status === "confirmed"
    ? ["Ready to pack", "moving"]
    : order.status === "packed"
      ? ["Packed", "moving"]
      : order.status === "out_for_delivery"
        ? ["Out for delivery", "moving"]
        : order.status === "delivered"
          ? ["Delivered", "complete"]
          : ["Waiting", "neutral"];
  const sap = order.sapSyncStatus === "failed"
    ? ["Sync failed", "critical"]
    : isSapSynced(order)
      ? ["Synced", "complete"]
      : ["Pending", "neutral"];
  return [
    { label: "Commercial", value: commercial[0], tone: commercial[1], icon: "finance" as const },
    { label: "Credit", value: order.status === "placed" ? "Review required" : "Clear", tone: order.status === "placed" ? "warning" : "complete", icon: "finance" as const },
    { label: "Inventory", value: "Not exposed", tone: "neutral", icon: "stock" as const },
    { label: "Fulfilment", value: fulfilment[0], tone: fulfilment[1], icon: "order" as const },
    { label: "Delivery", value: order.delivery?.routeId ? `Route ${order.delivery.routeId}` : "Not assigned", tone: order.delivery?.routeId ? "moving" : "neutral", icon: "order" as const },
    { label: "SAP", value: sap[0], tone: sap[1], icon: "sap" as const },
  ];
}

function snapshotLines(order: { commercialSnapshot?: { lines?: unknown } | null }) {
  const lines = order.commercialSnapshot?.lines;
  return Array.isArray(lines) ? lines : [];
}

export function matchingSnapshotLine(order: { commercialSnapshot?: { lines?: unknown } | null }, item: { variantId?: string | null }) {
  if (!item.variantId) return null;
  return snapshotLines(order).find((line) => line && typeof line === "object" && (line as { variantId?: string }).variantId === item.variantId) as {
    variantId?: string;
    pack?: string;
    total?: string | number | null;
    productName?: string;
  } | undefined ?? null;
}

/**
 * Prefer the stored commercial snapshot line total. Pre-snapshot orders have no
 * line total column, so the existing stored unit price × ordered quantity is
 * the only canonical pair available.
 */
export function storedLineValue(order: { commercialSnapshot?: { lines?: unknown } | null }, item: { variantId?: string | null; unitPrice?: string | number | null; qtyOrdered?: string | number | null }) {
  const snapshotLine = matchingSnapshotLine(order, item);
  if (snapshotLine && snapshotLine.total != null && snapshotLine.total !== "") return Number(snapshotLine.total);
  return Number(item.unitPrice ?? 0) * Number(item.qtyOrdered ?? 0);
}

export function packLabel(order: { commercialSnapshot?: { lines?: unknown } | null }, item: { variantId?: string | null; variant?: { unitSize?: string | null; unitsPerCase?: number | null } | null }) {
  const snapshotLine = matchingSnapshotLine(order, item);
  if (snapshotLine?.pack) return snapshotLine.pack;
  const variant = item.variant;
  if (variant?.unitsPerCase && variant.unitSize) return `${variant.unitsPerCase} × ${variant.unitSize}`;
  return variant?.unitSize || "Pack unavailable";
}

export function productLabel(item: { variant?: { product?: { name?: string | null } | null } | null }) {
  return item.variant?.product?.name || "Product unavailable";
}

/** Apply only fields the backend returned. Missing fields stay as they were. */
export function mergeCanonicalOrder(previous: any, result: any) {
  if (result?.order) {
    return {
      ...previous,
      ...result.order,
      internalStatus: previous?.internalStatus ?? null,
    };
  }
  const status = result?.status;
  if (status && (typeof status.isOnHold === "boolean" || status.currentCode)) {
    return {
      ...previous,
      internalStatus: { ...previous?.internalStatus, ...status },
    };
  }
  return previous;
}
