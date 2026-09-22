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
    return { orderable: false, orderingStatus: "pending_setup", orderingReason: "Ordering setup pending", gstPending: false };
  }
  const gstPending = (gstPercent === null || gstPercent === undefined) && gstPendingOrderAllowed;
  return gstPending
    ? { orderable: true, orderingStatus: "gst_pending", orderingReason: "GST pending — invoice blocked until configured", gstPending: true }
    : { orderable: true, orderingStatus: "ready", orderingReason: null, gstPending: false };
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
