export function priceFromDiscount(listRate: number, discountPercent: number) {
  return Math.round(listRate * (100 - discountPercent)) / 100;
}

export function discountFromPrice(listRate: number, tierPrice: number) {
  if (!(listRate > 0)) return null;
  return Math.round((1 - tierPrice / listRate) * 10000) / 100;
}

export function resolveTierPrice(listRate: number, price: number | null | undefined, discountPercent: number | null | undefined) {
  const hasPrice = price != null && Number.isFinite(price);
  const hasDiscount = discountPercent != null && Number.isFinite(discountPercent);
  if (!hasPrice && !hasDiscount) return { ok: false as const, code: "tier_price_required" };
  if (hasPrice && hasDiscount) {
    const derived = priceFromDiscount(listRate, discountPercent);
    if (Math.abs(derived - Number(price)) > 0.01) return { ok: false as const, code: "tier_price_discount_conflict" };
    return { ok: true as const, price: Number(price) };
  }
  if (hasPrice) return { ok: true as const, price: Number(price) };
  return { ok: true as const, price: priceFromDiscount(listRate, Number(discountPercent)) };
}
