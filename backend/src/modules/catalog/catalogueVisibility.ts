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
