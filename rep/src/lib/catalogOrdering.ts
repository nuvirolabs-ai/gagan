type CatalogOrderabilityInput = {
  price: number | null;
  orderable?: boolean;
  gstPending?: boolean;
  availability?: { status?: string; available?: number | null } | null;
};

/** Preserve the Salesperson stock policy; GST status does not grant stock or orderability. */
export function canChangeRepCatalogQuantity(variant: CatalogOrderabilityInput, current: number, next: number) {
  if (variant.price == null || next < 0) return false;
  if (next <= current) return true;
  if (variant.orderable === false && (variant as any).orderingReason !== "Stock unavailable") return false;
  if (!variant.availability || variant.availability.status == null || variant.availability.status === "unknown") return true;
  return variant.availability?.status === "available" && Number(variant.availability.available ?? 0) > 0;
}
