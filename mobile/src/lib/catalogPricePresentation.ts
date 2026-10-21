type PriceInput = {
  price: number | null;
  originalPrice?: number | null;
  commercialRate?: number | null;
  rateBasis?: string;
  caseWeightKg?: number | null;
  pricePerKg?: number | null;
  gstPercent?: number | null;
  discount?: number | null;
  discountType?: "flat" | "percent" | string | null;
};

const money = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Display-only derived amounts. The stored/backend rate and cart price are unchanged. */
export function catalogPricePresentation(sku: PriceInput | null | undefined) {
  if (!sku) return { primary: "Price on request", originalPrice: null, discountBadge: null, perKg: null, caseEquivalent: null, gstLabel: null };
  const weight = sku.caseWeightKg;
  const gst = sku.gstPercent == null || !Number.isFinite(Number(sku.gstPercent)) ? null : Number(sku.gstPercent);
  const gstMultiplier = gst != null && gst > 0 ? 1 + gst / 100 : 1;
  const gstLabel = gst != null
    ? (gst === 0 ? "Including 0% GST (Nil)" : `Including ${gst}% GST`)
    : "Excluding GST";
  const discountVal = sku.discount != null && Number.isFinite(Number(sku.discount)) && Number(sku.discount) > 0 ? Number(sku.discount) : 0;
  const isPercent = sku.discountType === "percent";
  const discountBadge = discountVal > 0 ? (isPercent ? `${discountVal}% OFF` : `${money(discountVal)} OFF`) : null;

  if (sku.rateBasis?.toLowerCase() === "quintal" && sku.commercialRate != null) {
    const rate = Number(sku.commercialRate);
    if (!Number.isFinite(rate)) return { primary: "Price on request", originalPrice: null, discountBadge: null, perKg: null, caseEquivalent: null, gstLabel: null };
    const originalRateWithGst = Math.round(rate * gstMultiplier * 100) / 100;
    const deduction = isPercent ? (rate * Math.min(100, discountVal)) / 100 : discountVal;
    const finalRate = discountVal > 0 ? Math.max(0, rate - deduction) : rate;
    const effectiveRate = Math.round(finalRate * gstMultiplier * 100) / 100;
    const effectivePerKg = Math.round((effectiveRate / 100) * 100) / 100;
    const effectiveCase = weight != null && Number.isFinite(Number(weight)) && Number(weight) > 0
      ? Math.round(effectiveRate * Number(weight)) / 100
      : null;
    return {
      primary: `${money(effectiveRate)} / quintal`,
      originalPrice: discountVal > 0 ? money(originalRateWithGst) : null,
      discountBadge,
      perKg: `${money(effectivePerKg)} / kg`,
      caseEquivalent: effectiveCase != null
        ? `${money(effectiveCase)} / ${weight} KG case`
        : null,
      gstLabel,
    };
  }

  const rawBase = sku.originalPrice != null ? Number(sku.originalPrice) : (sku.price == null ? null : Number(sku.price));
  if (rawBase == null || !Number.isFinite(rawBase)) {
    return { primary: "Price on request", originalPrice: null, discountBadge: null, perKg: null, caseEquivalent: null, gstLabel: null };
  }
  const originalPriceWithGst = Math.round(rawBase * gstMultiplier * 100) / 100;
  const deduction = isPercent ? (rawBase * Math.min(100, discountVal)) / 100 : discountVal;
  const finalPrice = discountVal > 0 ? Math.max(0, rawBase - deduction) : rawBase;
  const effectivePrice = Math.round(finalPrice * gstMultiplier * 100) / 100;
  const existingPerKg = sku.pricePerKg == null ? null : Number(sku.pricePerKg);
  const weightPerKg = weight != null && Number(weight) > 0
    ? effectivePrice / Number(weight)
    : null;
  const rawPerKg = weightPerKg != null && Number.isFinite(weightPerKg)
    ? weightPerKg
    : existingPerKg != null && Number.isFinite(existingPerKg)
    ? existingPerKg * gstMultiplier
    : null;
  const perKg = rawPerKg != null && Number.isFinite(rawPerKg) ? Math.round(rawPerKg * 100) / 100 : null;

  return {
    primary: `${money(effectivePrice)} / case`,
    originalPrice: discountVal > 0 ? money(originalPriceWithGst) : null,
    discountBadge,
    perKg: perKg == null || !Number.isFinite(perKg) ? null : `${money(perKg)} / kg`,
    caseEquivalent: null,
    gstLabel,
  };
}
