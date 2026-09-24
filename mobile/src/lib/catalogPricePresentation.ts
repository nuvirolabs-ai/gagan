type PriceInput = {
  price: number | null;
  commercialRate?: number | null;
  rateBasis?: string;
  caseWeightKg?: number | null;
  pricePerKg?: number | null;
};

const money = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Display-only derived amounts. The stored/backend rate and cart price are unchanged. */
export function catalogPricePresentation(sku: PriceInput | null | undefined) {
  if (!sku) return { primary: "Price on request", perKg: null, caseEquivalent: null };
  const weight = sku.caseWeightKg;
  if (sku.rateBasis?.toLowerCase() === "quintal" && sku.commercialRate != null) {
    const rate = Number(sku.commercialRate);
    if (!Number.isFinite(rate)) return { primary: "Price on request", perKg: null, caseEquivalent: null };
    return {
      primary: `${money(rate)} / quintal`,
      perKg: `${money(rate / 100)} / kg`,
      caseEquivalent: weight != null && Number.isFinite(Number(weight)) && Number(weight) > 0
        ? `${money(Math.round(rate * Number(weight)) / 100)} / ${weight} KG case`
        : null,
    };
  }
  const existingPerKg = sku.pricePerKg == null ? null : Number(sku.pricePerKg);
  const weightPerKg = sku.price != null && weight != null && Number(weight) > 0
    ? Number(sku.price) / Number(weight)
    : null;
  const perKg = existingPerKg != null && Number.isFinite(existingPerKg) ? existingPerKg : weightPerKg;
  return {
    primary: sku.price == null ? "Price on request" : `${money(Number(sku.price))} / case`,
    perKg: perKg == null || !Number.isFinite(perKg) ? null : `${money(perKg)} / kg`,
    caseEquivalent: null,
  };
}
