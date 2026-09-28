export const CATALOGUE_VISIBLE_STATUSES = ["active", "published"] as const;

export function catalogueStatusWhere() {
  return { in: [...CATALOGUE_VISIBLE_STATUSES] };
}

export function catalogueOrderingState(
  catalogStatus: string,
  gstPercent?: string | number | null,
  gstPendingOrderAllowed = false,
) {
  if (catalogStatus !== "active") {
    return { orderable: false, orderingStatus: "pending_setup", orderingReason: "Ordering setup pending", gstPending: false, taxStatus: "NOT_READY" as const };
  }
  const gstPending = (gstPercent === null || gstPercent === undefined) && gstPendingOrderAllowed;
  return gstPending
    ? { orderable: true, orderingStatus: "ready", orderingReason: "GST pending — final tax will be applied before invoicing", gstPending: true, taxStatus: "PENDING" as const }
    : { orderable: true, orderingStatus: "ready", orderingReason: null, gstPending: false, taxStatus: "READY" as const };
}

export type CatalogueStockView = { available: number | null; status: string };

/** Active is commercial readiness. Stock decides whether that active SKU can be ordered. */
export function withInventoryOrderability<T extends { orderable: boolean; orderingStatus: string; orderingReason: string | null }>(state: T, stock: CatalogueStockView): T {
  if (!state.orderable) return state;
  if (stock.status === "stale" || stock.status === "unknown" || stock.available == null) {
    return { ...state, orderable: false, orderingStatus: "stock_unavailable", orderingReason: "Stock unavailable" };
  }
  if (stock.available <= 0 || stock.status === "unavailable" || stock.status === "out_of_stock") {
    return { ...state, orderable: false, orderingStatus: "out_of_stock", orderingReason: "Out of stock" };
  }
  return state;
}

/** Commercial fields safe for retailer and salesperson apps. Purchase cost stays in Admin. */
export function retailerCommercialFields(variant: { gstPercent?: unknown; sellingEntity?: string | null }) {
  return { sellingEntity: variant.sellingEntity ?? null, gstPercent: variant.gstPercent ?? null };
}

export function approvedCatalogueImage(variant: { catalogImageStatus?: string | null; imageUrl?: string | null }) {
  if (variant.catalogImageStatus === "placeholder") return "placeholder" as const;
  if (variant.catalogImageStatus === "exact" && variant.imageUrl) return "exact" as const;
  return "missing" as const;
}

export function catalogueImageState(variant: {
  catalogImageStatus?: string | null;
  catalogImageLabel?: string | null;
}) {
  if (variant.catalogImageStatus === "placeholder") {
    return { imageStatus: "placeholder", imageLabel: variant.catalogImageLabel ?? "Image coming soon" };
  }
  if (variant.catalogImageStatus === "pending") {
    return { imageStatus: "pending", imageLabel: variant.catalogImageLabel ?? "Image pending confirmation" };
  }
  return { imageStatus: "exact", imageLabel: null };
}
