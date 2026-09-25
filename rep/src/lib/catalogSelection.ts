export interface CatalogSku {
  id: string; unitSize: string; unitsPerCase: number; price: number | null;
  commercialRate?: number | null; rateBasis?: string; rateLabel?: string | null;
  caseWeightKg?: number | null;
  catalogStatus?: string; orderable?: boolean; orderingStatus?: string; orderingReason?: string | null;
  gstPending?: boolean; taxStatus?: "PENDING" | "READY" | "NOT_READY";
  pricePerKg?: number | null; isOverride?: boolean;
  availability?: { status?: string; available?: number | null };
  imageUrl?: string | null;
  imageStatus?: "exact" | "placeholder" | "pending"; imageLabel?: string | null;
}
export interface CatalogGroup {
  id: string; name: string; category: string; imageUrl?: string | null; skus: CatalogSku[];
}

/** Older APIs remain usable as one card per product. Only the server decides
 * which separate ERP products belong in the same logical product group. */
export function catalogGroups(payload: { groups?: CatalogGroup[]; catalog?: any[] }): CatalogGroup[] {
  const groups = payload.groups ?? (payload.catalog ?? []).map(product => ({ ...product, skus: product.variants ?? [] }));
  return groups.filter(group => Array.isArray(group.skus) && group.skus.length > 0);
}

export function selectedCatalogSku(group: CatalogGroup, selectedId: string | undefined, qtyFor: (id: string) => number) {
  return group.skus.find(sku => sku.id === selectedId)
    ?? group.skus.find(sku => qtyFor(sku.id) > 0)
    ?? group.skus.find(sku => sku.price != null && sku.availability?.status === "available" && Number(sku.availability.available) > 0)
    ?? group.skus[0];
}
