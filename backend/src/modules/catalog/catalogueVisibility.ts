export const CATALOGUE_VISIBLE_STATUSES = ["active", "published"] as const;

export function catalogueStatusWhere() {
  return { in: [...CATALOGUE_VISIBLE_STATUSES] };
}

export function catalogueOrderingState(catalogStatus: string) {
  return catalogStatus === "active"
    ? { orderable: true, orderingStatus: "ready", orderingReason: null }
    : { orderable: false, orderingStatus: "pending_setup", orderingReason: "Ordering setup pending" };
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
