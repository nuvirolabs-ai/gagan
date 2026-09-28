import { useState, type FormEvent } from "react";
import { ApiError, api } from "../api";
import { discountFromPrice, priceFromDiscount } from "../cataloguePricing";
import { buildDraftPack, caseWeightKg, humanizePackFailure, massPreview, parseStoredPack, type DraftPackFields } from "../draftPackForm";

type Tier = { id: string; name: string };
type Product = { id?: string; name?: string; category?: string; catalogIdentityBrand?: string | null; catalogIdentityGroup?: string | null; imageUrl?: string | null };
type Variant = {
  id: string;
  catalogKey?: string | null;
  catalogStatus?: string;
  unitSize?: string;
  unit?: string;
  unitsPerCase?: number;
  unitWeightKg?: number;
  catalogIdentityMasterPack?: string | null;
  imageUrl?: string | null;
  purchaseRate?: number | null;
  purchaseRateBasis?: string | null;
  listRate?: number | null;
  listRateBasis?: string | null;
  gstPercent?: number | null;
  routingClass?: string | null;
  routingBagEquivalent?: number | null;
  stock?: { available?: number | null };
  prices?: { tierId: string; price: number | null }[];
};

const billingOptions = [
  { value: "LAXMI_TOOR", label: "Laxmi toor" },
  { value: "INSTANT_MIX", label: "Instant mix" },
  { value: "OTHER", label: "Other" },
];

function outerFrom(master?: string | null): "Bag" | "Box" {
  return master?.toUpperCase().endsWith("BOX") ? "Box" : "Bag";
}

export default function CatalogueSkuForm({
  tiers,
  product,
  variant,
  onCancel,
  onSaved,
}: {
  tiers: Tier[];
  product?: Product | null;
  variant?: Variant | null;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const parsed = parseStoredPack(String(variant?.unitSize ?? ""), String(variant?.unit ?? "kg"));
  const locked = Boolean(variant?.catalogKey);
  const addingPack = Boolean(product?.id && !variant);
  const identityLocked = locked || addingPack;
  const [packSize, setPackSize] = useState(parsed.packSize);
  const [unit, setUnit] = useState(parsed.unit || "kg");
  const [unitsPerCase, setUnitsPerCase] = useState(variant?.unitsPerCase != null ? String(variant.unitsPerCase) : "");
  const [measuredWeightKg, setMeasuredWeightKg] = useState(parsed.unit === "pcs" ? String(variant?.unitWeightKg ?? "") : "");
  const [outerPack, setOuterPack] = useState<"Bag" | "Box">(outerFrom(variant?.catalogIdentityMasterPack));
  const [listRate, setListRate] = useState(variant?.listRate != null ? String(variant.listRate) : "");
  const [tierDraft, setTierDraft] = useState<Record<string, { price: string; discount: string }>>(() => {
    const list = Number(variant?.listRate);
    return Object.fromEntries(tiers.map((tier) => {
      const price = variant?.prices?.find((row) => row.tierId === tier.id)?.price;
      const priceText = price == null ? "" : String(price);
      const discount = price != null && list > 0 ? discountFromPrice(list, price) : null;
      return [tier.id, { price: priceText, discount: discount == null ? "" : String(discount) }];
    }));
  });
  const [imageUrl, setImageUrl] = useState(variant?.imageUrl ?? product?.imageUrl ?? "");
  const [purchaseRate, setPurchaseRate] = useState(variant?.purchaseRate != null ? String(variant.purchaseRate) : "");
  const [purchaseRateBasis, setPurchaseRateBasis] = useState(variant?.purchaseRateBasis === "quintal" ? "quintal" : "case");
  const [sellingRateBasis, setSellingRateBasis] = useState(variant?.listRateBasis === "quintal" ? "quintal" : "case");
  const [gstPercent, setGstPercent] = useState(variant?.gstPercent != null ? String(variant.gstPercent) : "");
  const [routingClass, setRoutingClass] = useState(variant?.routingClass ?? "LAXMI_TOOR");
  const [routingBagEquivalent, setRoutingBagEquivalent] = useState(variant?.routingBagEquivalent != null ? String(variant.routingBagEquivalent) : "");
  const [openingStockCases, setOpeningStockCases] = useState(variant?.stock?.available != null ? String(variant.stock.available) : "");
  const [warehouseCode, setWarehouseCode] = useState("WH-001");
  const [active, setActive] = useState(variant ? variant.catalogStatus === "active" : true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<DraftPackFields>({});

  const preview = massPreview(packSize, unit);
  const caseUnits = Number(unitsPerCase);
  const pieceWeight = Number(measuredWeightKg);
  const unitWeight = unit === "pcs" ? (Number.isFinite(pieceWeight) && pieceWeight > 0 ? pieceWeight : null) : preview?.unitWeightKg ?? null;
  const derivedCase = unitWeight != null && Number.isSafeInteger(caseUnits) && caseUnits > 0 ? caseWeightKg(unitWeight, caseUnits) : null;
  const stockCases = Number(openingStockCases);
  const stockUnits = Number.isFinite(stockCases) && Number.isSafeInteger(caseUnits) && caseUnits > 0 ? stockCases * caseUnits : null;
  const stockKg = stockUnits != null && unitWeight != null ? Math.round(stockUnits * unitWeight * 1000) / 1000 : null;

  const setList = (value: string) => {
    setListRate(value);
    const list = Number(value);
    setTierDraft((current) => Object.fromEntries(Object.entries(current).map(([id, row]) => {
      const price = Number(row.price);
      const discount = row.price !== "" && list > 0 && Number.isFinite(price) ? discountFromPrice(list, price) : null;
      return [id, { ...row, discount: discount == null ? "" : String(discount) }];
    })));
  };

  const setTierPrice = (tierId: string, price: string) => {
    const list = Number(listRate);
    const amount = Number(price);
    const discount = price !== "" && list > 0 && Number.isFinite(amount) ? discountFromPrice(list, amount) : null;
    setTierDraft((current) => ({ ...current, [tierId]: { price, discount: discount == null ? "" : String(discount) } }));
  };

  const setTierDiscount = (tierId: string, discount: string) => {
    const list = Number(listRate);
    const percent = Number(discount);
    const price = discount !== "" && list > 0 && Number.isFinite(percent) ? String(priceFromDiscount(list, percent)) : tierDraft[tierId]?.price ?? "";
    setTierDraft((current) => ({ ...current, [tierId]: { price, discount } }));
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const built = buildDraftPack({ packSize, unit, unitsPerCase, measuredWeightKg });
    if (!built.ok) {
      setFieldErrors(built.fields);
      setError(null);
      return;
    }
    const image = imageUrl.trim();
    if (image && !/^https?:\/\//i.test(image)) {
      setFieldErrors({ imageUrl: "Enter a valid Image URL or leave it blank." });
      setError(null);
      return;
    }
    if (tiers.some((tier) => tierDraft[tier.id]?.price === "" || !Number.isFinite(Number(tierDraft[tier.id]?.price)))) {
      setError("Enter a price for every retailer tier.");
      return;
    }
    setSaving(true);
    setError(null);
    setFieldErrors({});
    const body = {
      productName: String(form.get("productName") ?? ""),
      brandName: String(form.get("brandName") ?? ""),
      groupName: String(form.get("groupName") ?? ""),
      category: String(form.get("category") ?? ""),
      imageUrl: image || null,
      packSize,
      unit,
      unitsPerCase: built.pack.unitsPerCase,
      ...(unit === "pcs" ? { measuredWeightKg: built.pack.unitWeightKg } : {}),
      outerPack,
      purchaseRate: Number(purchaseRate),
      purchaseRateBasis,
      listRate: Number(listRate),
      sellingRateBasis,
      tiers: tiers.map((tier) => ({ tierId: tier.id, price: Number(tierDraft[tier.id].price) })),
      gstPercent: Number(gstPercent),
      routingClass,
      ...(routingClass === "OTHER" ? { routingBagEquivalent: Number(routingBagEquivalent) } : {}),
      openingStockCases: openingStockCases === "" ? null : Number(openingStockCases),
      warehouseCode,
      active,
      ...(product?.id ? { productId: product.id } : {}),
    };
    try {
      if (variant) await api.updateCatalogueSku(variant.id, body);
      else await api.saveCatalogueSku(body);
      onSaved("Product saved.");
    } catch (err) {
      if (err instanceof ApiError) {
        const readable = humanizePackFailure(err.body);
        const specific = skuMessage(err.body);
        setFieldErrors(readable.fields);
        setError(specific !== "Could not save this product." ? specific : Object.keys(readable.fields).length ? null : readable.message);
      } else setError("Could not save this product.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-label="Product setup" style={{ marginBottom: 20 }}>
      <h2>{variant ? "Edit product" : addingPack ? "Add pack" : "Add product"}</h2>
      <form noValidate onSubmit={save}>
        <div className="row">
          <label>Product name<input name="productName" required defaultValue={product?.name ?? ""} readOnly={identityLocked} /></label>
          <label>Brand<input name="brandName" list="catalog-brand-options" required defaultValue={product?.catalogIdentityBrand ?? "Gagan"} readOnly={identityLocked} /></label>
          <datalist id="catalog-brand-options"><option value="Gagan" /><option value="Laxmi" /></datalist>
          <label>Product group<input name="groupName" required defaultValue={product?.catalogIdentityGroup ?? ""} readOnly={identityLocked} /></label>
          <label>Category<input name="category" required defaultValue={product?.category ?? ""} readOnly={identityLocked} /></label>
          <label>Image URL<input name="imageUrl" value={imageUrl} aria-invalid={Boolean(fieldErrors.imageUrl)} onChange={(event) => setImageUrl(event.target.value)} /></label>
        </div>
        {fieldErrors.imageUrl && <p role="alert">{fieldErrors.imageUrl}</p>}
        <div className="row">
          <label>Pack size<input inputMode="decimal" aria-invalid={Boolean(fieldErrors.packSize)} value={packSize} readOnly={locked} onChange={(event) => setPackSize(event.target.value)} /></label>
          <label>Unit<select aria-invalid={Boolean(fieldErrors.unit)} value={unit} disabled={locked} onChange={(event) => setUnit(event.target.value)}><option value="kg">kg</option><option value="g">g</option><option value="quintal">quintal</option><option value="pcs">pcs</option></select></label>
          <label>Units per case<input inputMode="numeric" aria-invalid={Boolean(fieldErrors.unitsPerCase)} value={unitsPerCase} readOnly={locked} onChange={(event) => setUnitsPerCase(event.target.value)} /></label>
          <label>Outer pack<select value={outerPack} disabled={locked} onChange={(event) => setOuterPack(event.target.value as "Bag" | "Box")}><option value="Bag">Bag</option><option value="Box">Box</option></select></label>
          {unit === "pcs" && <label>Measured weight per piece (kg)<input inputMode="decimal" aria-invalid={Boolean(fieldErrors.weight)} value={measuredWeightKg} readOnly={locked} onChange={(event) => setMeasuredWeightKg(event.target.value)} /></label>}
        </div>
        {preview && <p>{preview.sentence}</p>}
        {unitWeight != null && <p>Weight per unit: {unitWeight} kg</p>}
        {derivedCase != null && <p>Case weight: {derivedCase} kg</p>}
        {fieldErrors.packSize && <p role="alert">{fieldErrors.packSize}</p>}
        {fieldErrors.unit && <p role="alert">{fieldErrors.unit}</p>}
        {fieldErrors.unitsPerCase && <p role="alert">{fieldErrors.unitsPerCase}</p>}
        {fieldErrors.weight && <p role="alert">{fieldErrors.weight}</p>}
        <div className="row">
          <label>Purchase price<input inputMode="decimal" required value={purchaseRate} onChange={(event) => setPurchaseRate(event.target.value)} /></label>
          <label>Purchase price basis<select value={purchaseRateBasis} onChange={(event) => setPurchaseRateBasis(event.target.value)}><option value="case">₹/case</option><option value="quintal">₹/quintal</option></select></label>
          <label>Base selling price<input inputMode="decimal" required value={listRate} onChange={(event) => setList(event.target.value)} /></label>
          <label>Selling price basis<select value={sellingRateBasis} onChange={(event) => setSellingRateBasis(event.target.value)}><option value="case">₹/case</option><option value="quintal">₹/quintal</option></select></label>
        </div>
        {tiers.map((tier) => (
          <div className="row" key={tier.id}>
            <label>{tier.name} price<input inputMode="decimal" required value={tierDraft[tier.id]?.price ?? ""} onChange={(event) => setTierPrice(tier.id, event.target.value)} /></label>
            <label>{tier.name} discount %<input inputMode="decimal" value={tierDraft[tier.id]?.discount ?? ""} onChange={(event) => setTierDiscount(tier.id, event.target.value)} /></label>
          </div>
        ))}
        <div className="row">
          <label>GST %<input inputMode="decimal" required value={gstPercent} onChange={(event) => setGstPercent(event.target.value)} /></label>
          <label>Billing<select value={routingClass} onChange={(event) => setRoutingClass(event.target.value)}>{billingOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          {routingClass === "OTHER" && <label>Bag equivalent<input inputMode="decimal" required value={routingBagEquivalent} onChange={(event) => setRoutingBagEquivalent(event.target.value)} /></label>}
          <label>Warehouse<input value={warehouseCode} onChange={(event) => setWarehouseCode(event.target.value)} /></label>
          <label>Opening stock (cases)<input inputMode="decimal" value={openingStockCases} onChange={(event) => setOpeningStockCases(event.target.value)} /></label>
          <label>Active<input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /></label>
        </div>
        {stockUnits != null && <p>{stockCases} cases{stockUnits != null ? ` · ${stockUnits} units` : ""}{stockKg != null ? ` · ${stockKg} kg` : ""}</p>}
        {error && <p role="alert">{error}</p>}
        <div className="row">
          <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </section>
  );
}

function skuMessage(body: { error?: string } | null | undefined) {
  if (body?.error === "identity_fields_locked") return "This pack already has catalogue identity. Pack, brand, and product group stay as saved.";
  if (body?.error === "tier_prices_required" || body?.error === "tier_price_required") return "Enter a price for every retailer tier.";
  if (body?.error === "tier_price_discount_conflict") return "A tier price and its discount do not match.";
  if (body?.error === "manual_stock_cannot_override_sap") return "SAP stock is authoritative for this product.";
  if (body?.error === "canonical_pack_exists") return "A current catalogue pack already exists.";
  if (body?.error === "canonical_product_exists") return "This product already has a catalogue identity. Add the pack to that product.";
  return "Could not save this product.";
}

export function billingLabel(routingClass?: string | null) {
  return billingOptions.find((option) => option.value === routingClass)?.label ?? routingClass ?? "Not set";
}
