import { useState, type FormEvent } from "react";
import { ApiError, api } from "../api";
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
  sellingEntity?: string | null;
  routingClass?: string | null;
  routingBagEquivalent?: number | null;
  stock?: { available?: number | null };
  prices?: { tierId: string; price: number | null; rateBasis?: string | null }[];
};

export const billingOptions = [
  { value: "LAXMI_TOOR", label: "Laxmi toor" },
  { value: "padam_international", label: "Padam International" },
  { value: "jain_traders", label: "Jain Traders" },
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

  // Product Information
  const [productName, setProductName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [brandName, setBrandName] = useState(product?.catalogIdentityBrand ?? "Gagan");
  const [groupName, setGroupName] = useState(product?.catalogIdentityGroup ?? "");
  const [imageUrl, setImageUrl] = useState(variant?.imageUrl ?? product?.imageUrl ?? "");

  // Pack & Packaging Details
  const [packSize, setPackSize] = useState(parsed.packSize || "1");
  const [unit, setUnit] = useState(parsed.unit || "kg");
  const [unitsPerCase, setUnitsPerCase] = useState(variant?.unitsPerCase != null ? String(variant.unitsPerCase) : "30");
  const [measuredWeightKg, setMeasuredWeightKg] = useState(parsed.unit === "pcs" ? String(variant?.unitWeightKg ?? "") : "");
  const [outerPack, setOuterPack] = useState<"Bag" | "Box">(outerFrom(variant?.catalogIdentityMasterPack));

  // Single Uniform Pricing
  const initialPrice = variant?.prices?.[0]?.price != null
    ? String(variant.prices[0].price)
    : variant?.listRate != null
      ? String(variant.listRate)
      : "";
  const initialBasis: "case" | "quintal" = (variant?.prices?.[0]?.rateBasis ?? variant?.listRateBasis ?? "case") === "quintal" ? "quintal" : "case";

  const [sellingPrice, setSellingPrice] = useState(initialPrice);
  const [rateBasis, setRateBasis] = useState<"case" | "quintal">(initialBasis);
  const [gstPercent, setGstPercent] = useState(variant?.gstPercent != null ? String(variant.gstPercent) : "5");
  const initialBilling = variant?.sellingEntity || variant?.routingClass || "LAXMI_TOOR";
  const [routingClass, setRoutingClass] = useState(initialBilling);
  const [routingBagEquivalent, setRoutingBagEquivalent] = useState(variant?.routingBagEquivalent != null ? String(variant.routingBagEquivalent) : "");

  // Advanced & Inventory Defaults
  const [purchaseRate, setPurchaseRate] = useState(variant?.purchaseRate != null ? String(variant.purchaseRate) : "");
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

  // Real-time Rate per kg calculation
  const numPrice = Number(sellingPrice);
  let ratePerKg: number | null = null;
  if (Number.isFinite(numPrice) && numPrice > 0) {
    if (rateBasis === "quintal") {
      ratePerKg = Math.round((numPrice / 100) * 100) / 100;
    } else if (derivedCase != null && derivedCase > 0) {
      ratePerKg = Math.round((numPrice / derivedCase) * 100) / 100;
    }
  }

  const stockCases = Number(openingStockCases);
  const stockUnits = Number.isFinite(stockCases) && Number.isSafeInteger(caseUnits) && caseUnits > 0 ? stockCases * caseUnits : null;
  const stockKg = stockUnits != null && unitWeight != null ? Math.round(stockUnits * unitWeight * 1000) / 1000 : null;

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

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

    const priceNum = Number(sellingPrice);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setError("Please enter a valid selling price greater than zero.");
      return;
    }

    const pName = productName.trim() || (product?.name ?? "").trim();
    if (!pName) {
      setError("Product name is required.");
      return;
    }
    const cat = category.trim() || (product?.category ?? "").trim();
    if (!cat) {
      setError("Category is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setFieldErrors({});

    const purchaseNum = purchaseRate ? Number(purchaseRate) : priceNum;
    const effectiveTiers = tiers.length > 0
      ? tiers.map((tier) => ({ tierId: tier.id, price: priceNum }))
      : [{ tierId: "default", price: priceNum }];

    const body = {
      productName: pName,
      brandName: brandName.trim() || "Gagan",
      groupName: groupName.trim() || cat || pName || "General",
      category: cat,
      imageUrl: image || null,
      packSize,
      unit,
      unitsPerCase: built.pack.unitsPerCase,
      ...(unit === "pcs" ? { measuredWeightKg: built.pack.unitWeightKg } : {}),
      outerPack,
      purchaseRate: purchaseNum,
      purchaseRateBasis: rateBasis,
      listRate: priceNum,
      sellingRateBasis: rateBasis,
      tiers: effectiveTiers,
      gstPercent: Number(gstPercent),
      routingClass: (routingClass === "padam_international" || routingClass === "jain_traders") ? null : routingClass,
      sellingEntity: (routingClass === "padam_international" || routingClass === "jain_traders") ? routingClass : null,
      ...(routingClass === "OTHER" ? { routingBagEquivalent: Number(routingBagEquivalent) || 1 } : {}),
      openingStockCases: openingStockCases === "" ? null : Number(openingStockCases),
      warehouseCode: warehouseCode.trim() || "WH-001",
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
    <section
      aria-label="Product setup"
      className="card"
      style={{
        maxWidth: 780,
        margin: "0 auto 24px",
        border: "1px solid var(--border, #e2e8f0)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
        borderRadius: 12,
        padding: "24px 28px",
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 20,
          borderBottom: "1px solid var(--border-light, #f1f5f9)",
          paddingBottom: 16,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--ink, #0f172a)" }}>
            {variant ? "Edit Product Pack" : addingPack ? `Add Pack to ${product?.name ?? "Product"}` : "Add New Product"}
          </h2>
          <p className="muted small" style={{ margin: "4px 0 0" }}>
            Single uniform pricing across all retailers. Promotional discounts are applied via coupon codes.
          </p>
        </div>
        <button
          type="button"
          className="ghost sm"
          onClick={onCancel}
          style={{ fontSize: 18, lineHeight: 1, padding: "4px 8px" }}
          title="Close"
        >
          ✕
        </button>
      </div>

      <form noValidate onSubmit={save}>
        {/* Section 1: Product Information */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--primary, #2563eb)",
              marginBottom: 12,
            }}
          >
            1. Product Information
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600 }}>
              <span>
                Product name <span style={{ color: "var(--danger, #ef4444)" }}>*</span>
              </span>
              <input
                name="productName"
                aria-label="Product name"
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Gagan Daily Fresh Toor Dal"
                style={{ padding: "8px 12px", borderRadius: 6 }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600 }}>
              <span>
                Category <span style={{ color: "var(--danger, #ef4444)" }}>*</span>
              </span>
              <input
                name="category"
                aria-label="Category"
                required
                value={category}
                list="category-suggestions"
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Pulses & Grains"
                style={{ padding: "8px 12px", borderRadius: 6 }}
              />
              <datalist id="category-suggestions">
                <option value="Pulses & Grains" />
                <option value="Rice & Grains" />
                <option value="Sugar & Sweeteners" />
                <option value="Spices & Masala" />
                <option value="Instant Mix" />
                <option value="Flour & Sooji" />
                <option value="Oil & Ghee" />
              </datalist>
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "center" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600, flex: 1 }}>
              <span>
                Image URL <span className="muted small" style={{ fontWeight: 400 }}>(optional)</span>
              </span>
              <input
                name="imageUrl"
                aria-label="Image URL"
                value={imageUrl}
                aria-invalid={Boolean(fieldErrors.imageUrl)}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="https://.../product.png"
                style={{ padding: "8px 12px", borderRadius: 6 }}
              />
            </label>
            {imageUrl.trim() && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, paddingTop: 18 }}>
                <img
                  src={imageUrl.trim()}
                  alt="SKU Preview"
                  style={{
                    height: 50,
                    width: 50,
                    objectFit: "contain",
                    borderRadius: 6,
                    border: "1px solid var(--border, #e2e8f0)",
                    background: "#fff",
                  }}
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = "none";
                  }}
                />
              </div>
            )}
          </div>
          {fieldErrors.imageUrl && (
            <p role="alert" style={{ color: "var(--danger, #ef4444)", margin: "4px 0 0", fontSize: 12 }}>
              {fieldErrors.imageUrl}
            </p>
          )}
        </div>

        {/* Section 2: Pack Size & Case Packaging */}
        <div style={{ marginBottom: 20, paddingTop: 16, borderTop: "1px solid var(--border-light, #f1f5f9)" }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--primary, #2563eb)",
              marginBottom: 12,
            }}
          >
            2. Pack Size & Case Packaging
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1.2fr", gap: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600 }}>
              <span>
                Pack size <span style={{ color: "var(--danger, #ef4444)" }}>*</span>
              </span>
              <input
                name="packSize"
                aria-label="Pack size"
                inputMode="decimal"
                aria-invalid={Boolean(fieldErrors.packSize)}
                value={packSize}
                readOnly={locked}
                onChange={(event) => setPackSize(event.target.value)}
                placeholder="e.g. 1, 5, 30"
                style={{ padding: "8px 12px", borderRadius: 6 }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600 }}>
              <span>
                Unit <span style={{ color: "var(--danger, #ef4444)" }}>*</span>
              </span>
              <select
                name="unit"
                aria-label="Unit"
                aria-invalid={Boolean(fieldErrors.unit)}
                value={unit}
                disabled={locked}
                onChange={(event) => setUnit(event.target.value)}
                style={{ padding: "8px 12px", borderRadius: 6 }}
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="quintal">quintal</option>
                <option value="pcs">pcs</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600 }}>
              <span>
                Units per case <span style={{ color: "var(--danger, #ef4444)" }}>*</span>
              </span>
              <input
                name="unitsPerCase"
                aria-label="Units per case"
                inputMode="numeric"
                aria-invalid={Boolean(fieldErrors.unitsPerCase)}
                value={unitsPerCase}
                readOnly={locked}
                onChange={(event) => setUnitsPerCase(event.target.value)}
                placeholder="e.g. 30"
                style={{ padding: "8px 12px", borderRadius: 6 }}
              />
            </label>
          </div>

          {unit === "pcs" && (
            <div style={{ marginTop: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600 }}>
                <span>Measured weight per piece (kg)</span>
                <input
                  name="measuredWeightKg"
                  aria-label="Measured weight per piece (kg)"
                  inputMode="decimal"
                  aria-invalid={Boolean(fieldErrors.weight)}
                  value={measuredWeightKg}
                  readOnly={locked}
                  onChange={(event) => setMeasuredWeightKg(event.target.value)}
                  style={{ padding: "8px 12px", borderRadius: 6 }}
                />
              </label>
            </div>
          )}

          {/* Friendly derived case summary badge */}
          {preview && <p style={{ margin: "10px 0 2px", fontSize: 13 }}>{preview.sentence}</p>}
          {unitWeight != null && <p style={{ margin: "2px 0", fontSize: 13 }}>Weight per unit: {unitWeight} kg</p>}
          {derivedCase != null && (
            <p style={{ margin: "2px 0 10px", fontSize: 13, fontWeight: 600 }}>Case weight: {derivedCase} kg</p>
          )}

          {fieldErrors.packSize && (
            <p role="alert" style={{ color: "var(--danger, #ef4444)", margin: "4px 0 0", fontSize: 12 }}>
              {fieldErrors.packSize}
            </p>
          )}
          {fieldErrors.unit && (
            <p role="alert" style={{ color: "var(--danger, #ef4444)", margin: "4px 0 0", fontSize: 12 }}>
              {fieldErrors.unit}
            </p>
          )}
          {fieldErrors.unitsPerCase && (
            <p role="alert" style={{ color: "var(--danger, #ef4444)", margin: "4px 0 0", fontSize: 12 }}>
              {fieldErrors.unitsPerCase}
            </p>
          )}
          {fieldErrors.weight && (
            <p role="alert" style={{ color: "var(--danger, #ef4444)", margin: "4px 0 0", fontSize: 12 }}>
              {fieldErrors.weight}
            </p>
          )}
        </div>

        {/* Section 3: Single Uniform Pricing & Tax */}
        <div style={{ marginBottom: 20, paddingTop: 16, borderTop: "1px solid var(--border-light, #f1f5f9)" }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--primary, #2563eb)",
              marginBottom: 12,
            }}
          >
            3. Pricing & Tax (Single Pricing)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label htmlFor="sku-selling-price" style={{ fontSize: 13, fontWeight: 600 }}>
                Selling price (₹) <span style={{ color: "var(--danger, #ef4444)" }}>*</span>
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  id="sku-selling-price"
                  name="sellingPrice"
                  aria-label="Selling price"
                  inputMode="decimal"
                  required
                  value={sellingPrice}
                  onChange={(event) => setSellingPrice(event.target.value)}
                  placeholder="e.g. 3120"
                  style={{ padding: "8px 12px", borderRadius: 6, flex: 1, fontWeight: 600, fontSize: 15 }}
                />
                <select
                  aria-label="Rate basis"
                  value={rateBasis}
                  onChange={(event) => {
                    const newBasis = event.target.value as "case" | "quintal";
                    const num = Number(sellingPrice);
                    if (Number.isFinite(num) && num > 0 && derivedCase && derivedCase > 0) {
                      if (rateBasis === "case" && newBasis === "quintal") {
                        const perKg = num / derivedCase;
                        setSellingPrice(String(Math.round(perKg * 100 * 100) / 100));
                      } else if (rateBasis === "quintal" && newBasis === "case") {
                        const perKg = num / 100;
                        setSellingPrice(String(Math.round(perKg * derivedCase * 100) / 100));
                      }
                    }
                    setRateBasis(newBasis);
                  }}
                  style={{ padding: "8px 10px", borderRadius: 6, width: 110 }}
                >
                  <option value="case">/ case</option>
                  <option value="quintal">/ quintal</option>
                </select>
              </div>
              {ratePerKg != null && ratePerKg > 0 && (
                <div
                  style={{
                    marginTop: 4,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--success, #1f5132)",
                    background: "var(--success-soft, #e7f0e9)",
                    padding: "3px 8px",
                    borderRadius: 4,
                    alignSelf: "flex-start",
                  }}
                >
                  <span>₹{ratePerKg.toFixed(2)} / kg</span>
                </div>
              )}
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600 }}>
              <span>
                GST % <span style={{ color: "var(--danger, #ef4444)" }}>*</span>
              </span>
              <select
                name="gstPercent"
                aria-label="GST %"
                required
                value={gstPercent}
                onChange={(event) => setGstPercent(event.target.value)}
                style={{ padding: "8px 12px", borderRadius: 6 }}
              >
                <option value="0">0% (Nil)</option>
                <option value="5">5% (Pulses & Food Essentials)</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600 }}>
              <span>
                Billing rule <span style={{ color: "var(--danger, #ef4444)" }}>*</span>
              </span>
              <select
                name="routingClass"
                aria-label="Billing rule"
                value={routingClass}
                onChange={(event) => setRoutingClass(event.target.value)}
                style={{ padding: "8px 12px", borderRadius: 6 }}
              >
                {billingOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {routingClass === "OTHER" && (
            <div style={{ marginTop: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600 }}>
                <span>Bag equivalent</span>
                <input
                  name="routingBagEquivalent"
                  aria-label="Bag equivalent"
                  inputMode="decimal"
                  required
                  value={routingBagEquivalent}
                  onChange={(event) => setRoutingBagEquivalent(event.target.value)}
                  style={{ padding: "8px 12px", borderRadius: 6 }}
                />
              </label>
            </div>
          )}
        </div>

        {/* Section 4: Advanced Settings (Collapsible / Optional) */}
        <details
          style={{
            marginTop: 16,
            marginBottom: 20,
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            background: "#fafafa",
            padding: "10px 14px",
          }}
        >
          <summary style={{ fontWeight: 600, fontSize: 13, cursor: "pointer", color: "var(--ink-muted, #64748b)" }}>
            ⚙ Advanced / Inventory settings (optional)
          </summary>
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5 }}>
              <span>Brand</span>
              <input
                name="brandName"
                aria-label="Brand"
                list="catalog-brand-options"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: 6 }}
              />
              <datalist id="catalog-brand-options">
                <option value="Gagan" />
                <option value="Laxmi" />
              </datalist>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5 }}>
              <span>Product group</span>
              <input
                name="groupName"
                aria-label="Product group"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: 6 }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5 }}>
              <span>Outer pack</span>
              <select
                name="outerPack"
                aria-label="Outer pack"
                value={outerPack}
                disabled={locked}
                onChange={(event) => setOuterPack(event.target.value as "Bag" | "Box")}
                style={{ padding: "6px 10px", borderRadius: 6 }}
              >
                <option value="Bag">Bag</option>
                <option value="Box">Box</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5 }}>
              <span>Warehouse code</span>
              <input
                name="warehouseCode"
                aria-label="Warehouse"
                value={warehouseCode}
                onChange={(event) => setWarehouseCode(event.target.value)}
                style={{ padding: "6px 10px", borderRadius: 6 }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5 }}>
              <span>Purchase price (₹)</span>
              <input
                name="purchaseRate"
                aria-label="Purchase price"
                inputMode="decimal"
                value={purchaseRate}
                placeholder={sellingPrice ? `Default: ₹${sellingPrice}` : "Optional"}
                onChange={(event) => setPurchaseRate(event.target.value)}
                style={{ padding: "6px 10px", borderRadius: 6 }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5 }}>
              <span>Opening stock (cases)</span>
              <input
                name="openingStockCases"
                aria-label="Opening stock (cases)"
                inputMode="decimal"
                value={openingStockCases}
                onChange={(event) => setOpeningStockCases(event.target.value)}
                style={{ padding: "6px 10px", borderRadius: 6 }}
              />
            </label>
          </div>
          {stockUnits != null && (
            <p className="muted small" style={{ marginTop: 8, marginBottom: 0 }}>
              {stockCases} cases{stockUnits != null ? ` · ${stockUnits} units` : ""}{stockKg != null ? ` · ${stockKg} kg` : ""}
            </p>
          )}
          <div style={{ marginTop: 12 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                name="active"
                aria-label="Active"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
                style={{ width: "auto" }}
              />
              <span>Active in catalogue</span>
            </label>
          </div>
        </details>

        {error && (
          <div
            role="alert"
            style={{
              background: "var(--danger-soft, #f8e6e2)",
              color: "var(--danger, #c4462f)",
              padding: "10px 14px",
              borderRadius: 8,
              marginBottom: 16,
              fontWeight: 500,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "flex-end",
            paddingTop: 16,
            borderTop: "1px solid var(--border-light, #f1f5f9)",
          }}
        >
          <button type="button" className="secondary" onClick={onCancel} style={{ padding: "8px 18px", borderRadius: 6 }}>
            Cancel
          </button>
          <button type="submit" disabled={saving} style={{ padding: "8px 22px", borderRadius: 6, fontWeight: 600 }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </section>
  );
}

function skuMessage(body: { error?: string } | null | undefined) {
  if (body?.error === "identity_fields_locked") return "This pack already has catalogue identity. Pack, brand, and product group stay as saved.";
  if (body?.error === "tier_prices_required" || body?.error === "tier_price_required") return "Enter a valid product price.";
  if (body?.error === "tier_price_discount_conflict") return "Pricing conflict detected.";
  if (body?.error === "manual_stock_cannot_override_sap") return "SAP stock is authoritative for this product.";
  if (body?.error === "canonical_pack_exists") return "A current catalogue pack already exists.";
  if (body?.error === "canonical_product_exists") return "This product already has a catalogue identity. Add the pack to that product.";
  return "Could not save this product.";
}

export function billingLabel(routingClass?: string | null, sellingEntity?: string | null) {
  const value = sellingEntity || routingClass;
  return billingOptions.find((option) => option.value === value)?.label ?? value ?? "Not set";
}
