import type { CatalogSku } from "./catalogSelection";

type OrderingInput = Pick<CatalogSku, "price" | "orderable" | "orderingReason" | "availability">;

/** Mirrors the existing cart-increase guards; the API remains authoritative. */
export function catalogOrderingState(variant: OrderingInput) {
  const canIncrease = variant.price != null && variant.orderable !== false
    && variant.availability?.status === "available" && Number(variant.availability.available) > 0;
  return { canIncrease, message: canIncrease ? null : "Not available for ordering" };
}

export function canChangeCatalogQuantity(variant: OrderingInput, current: number, next: number) {
  if (variant.price == null) return false;
  return next <= current || catalogOrderingState(variant).canIncrease;
}
