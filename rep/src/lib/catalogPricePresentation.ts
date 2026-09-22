type PriceInput = {
  price: number | null;
  commercialRate?: number | null;
  rateBasis?: string;
  caseWeightKg?: number;
  pricePerKg?: number | null;
};
const money = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Display only: never substitutes a derived value for the stored rate or cart price. */
export function catalogPricePresentation(sku: PriceInput | null | undefined) {
  if (!sku) return { primary: "Price on request", perKg: null, caseEquivalent: null };
  const weight = sku.caseWeightKg;
  if (sku.rateBasis === "quintal" && sku.commercialRate != null) {
    const rate = sku.commercialRate;
    return {
      primary: `${money(rate)} / quintal`,
      perKg: `${money(rate / 100)} / kg`,
      caseEquivalent: weight != null && Number.isFinite(weight) && weight > 0
        ? `${money(Math.round(rate * weight) / 100)} / ${weight} KG case` : null,
    };
  }
  const perKg = sku.pricePerKg ?? (sku.price != null && weight != null && weight > 0 ? sku.price / weight : null);
  return {
    primary: sku.price == null ? "Price on request" : `${money(sku.price)} / case`,
    perKg: perKg == null ? null : `${money(perKg)} / kg`,
    caseEquivalent: null,
  };
}
