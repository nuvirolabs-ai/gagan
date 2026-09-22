type CatalogSkuLike = {
  price: number | null;
  orderable?: boolean;
  gstPending?: boolean;
  availability?: { status?: string; available?: number | null } | null;
};

/** Keep catalogue add/remove guards in one place without changing their policy. */
export function canChangeCatalogQuantity(
  sku: CatalogSkuLike,
  current: number,
  next: number
): boolean {
  if (sku.price == null || next < 0) return false;
  if (next <= current) return true;
  if (sku.orderable === false) return false;

  const availability = sku.availability;
  if (!availability || availability.status == null || availability.status === "unknown") return true;
  return availability.status === "available" && Number(availability.available ?? 0) > 0;
}

export function resolveCatalogCategory(requested: string, categories: readonly string[]): string {
  return requested === "All" || categories.includes(requested) ? requested : "All";
}
