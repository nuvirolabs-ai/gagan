import { useEffect, useState } from "react";
import { ApiError, api } from "../api";
import { buildDraftPack, canonicalUnit, caseWeightKg, humanizePackFailure, massPreview, parseStoredPack, type DraftPackFields } from "../draftPackForm";
import CatalogueSkuForm, { billingLabel } from "../components/CatalogueSkuForm";

interface RowEditState {
  variantId: string;
  packSize: string;
  unit: string;
  unitsPerCase: string;
  gstPercent: string;
  routingClass: string;
  price: string;
  rateBasis: "case" | "quintal";
  ratePerKg: string;
}

function getCaseWeightKg(packSize: string, unit: string, unitsPerCase: string, measuredWeightKg?: number): number {
  const preview = massPreview(packSize, unit);
  const units = Number(unitsPerCase);
  if (preview && Number.isSafeInteger(units) && units > 0) {
    return caseWeightKg(preview.unitWeightKg, units);
  }
  if (canonicalUnit(unit) === "pcs" && measuredWeightKg && measuredWeightKg > 0 && Number.isSafeInteger(units) && units > 0) {
    return caseWeightKg(measuredWeightKg, units);
  }
  const s = Number(packSize);
  const u = canonicalUnit(unit) ?? "kg";
  const factor = u === "quintal" ? 100 : u === "g" ? 0.001 : 1;
  if (Number.isFinite(s) && s > 0 && Number.isSafeInteger(units) && units > 0) {
    return Math.round(s * factor * units * 1000) / 1000;
  }
  return 0;
}

const inr = (value: number) => `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const visibleStatus = (status?: string) => !status || ["active", "published", "pending_review", "inactive"].includes(status);
type Editor = { kind: "create" | "product" | "variant" | "add" | "sku"; product?: any; variant?: any };

export default function Catalog() {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [tiers, setTiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [rowEdit, setRowEdit] = useState<RowEditState | null>(null);
  const [savingRow, setSavingRow] = useState(false);
  const [productModal, setProductModal] = useState<{ id: string; name: string; category: string; imageUrl: string } | null>(null);
  const [savingProductModal, setSavingProductModal] = useState(false);
  const [publishing, setPublishing] = useState<any>(null);
  const [outerPack, setOuterPack] = useState<"Bag" | "Box">("Bag");
  const [fieldErrors, setFieldErrors] = useState<DraftPackFields>({});

  // Navigation tab
  const [tab, setTab] = useState<"skus" | "hierarchy" | "media">("skus");

  // Gap 9: Hierarchy (Categories & Brands)
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<any | null>(null);
  const [catForm, setCatForm] = useState({ name: "", description: "", bannerUrl: "", sortOrder: "0", isActive: true });
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<any | null>(null);
  const [brandForm, setBrandForm] = useState({ name: "", description: "", logoUrl: "", sortOrder: "0", isActive: true });

  // Gap 10: Media & Assets
  const [mediaStats, setMediaStats] = useState<any | null>(null);
  const [mediaProducts, setMediaProducts] = useState<any[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [filterMissingOnly, setFilterMissingOnly] = useState(false);
  const [mediaSearch, setMediaSearch] = useState("");
  const [showImageModal, setShowImageModal] = useState<{ type: "product" | "variant"; id: string; name: string; currentUrl: string } | null>(null);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [savingImage, setSavingImage] = useState(false);

  const loadHierarchy = async () => {
    setHierarchyLoading(true);
    try {
      const [cats, brs] = await Promise.all([api.categories(), api.brands()]);
      setCategories(cats.categories ?? []);
      setBrands(brs.brands ?? []);
    } catch (err: any) {
      setError(err.message ?? "Failed to load categories and brands");
    } finally {
      setHierarchyLoading(false);
    }
  };

  const loadMedia = async () => {
    setMediaLoading(true);
    try {
      const res = await api.catalogMedia();
      setMediaStats(res.metrics || res.stats);
      setMediaProducts(res.products ?? []);
    } catch (err: any) {
      setError(err.message ?? "Failed to load catalog media");
    } finally {
      setMediaLoading(false);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: catForm.name.trim(),
        description: catForm.description.trim() || undefined,
        bannerUrl: catForm.bannerUrl.trim() || undefined,
        sortOrder: parseInt(catForm.sortOrder, 10) || 0,
        isActive: catForm.isActive,
      };
      if (editingCat) {
        await api.updateCategory(editingCat.id, payload);
        setNotice(`Category "${payload.name}" updated`);
      } else {
        await api.createCategory(payload);
        setNotice(`Category "${payload.name}" created`);
      }
      setShowCatModal(false);
      setEditingCat(null);
      await loadHierarchy();
    } catch (err: any) {
      setError(err.message ?? "Failed to save category");
    }
  };

  const handleDeleteCategory = async (cat: any) => {
    if (!window.confirm(`Delete category "${cat.name}"?`)) return;
    try {
      await api.deleteCategory(cat.id);
      setNotice(`Category "${cat.name}" deleted`);
      await loadHierarchy();
    } catch (err: any) {
      setError(err.message ?? "Cannot delete category");
    }
  };

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: brandForm.name.trim(),
        description: brandForm.description.trim() || undefined,
        logoUrl: brandForm.logoUrl.trim() || undefined,
        sortOrder: parseInt(brandForm.sortOrder, 10) || 0,
        isActive: brandForm.isActive,
      };
      if (editingBrand) {
        await api.updateBrand(editingBrand.id, payload);
        setNotice(`Brand "${payload.name}" updated`);
      } else {
        await api.createBrand(payload);
        setNotice(`Brand "${payload.name}" created`);
      }
      setShowBrandModal(false);
      setEditingBrand(null);
      await loadHierarchy();
    } catch (err: any) {
      setError(err.message ?? "Failed to save brand");
    }
  };

  const handleDeleteBrand = async (brand: any) => {
    if (!window.confirm(`Delete brand "${brand.name}"?`)) return;
    try {
      await api.deleteBrand(brand.id);
      setNotice(`Brand "${brand.name}" deleted`);
      await loadHierarchy();
    } catch (err: any) {
      setError(err.message ?? "Cannot delete brand");
    }
  };

  const handleSaveMediaImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showImageModal) return;
    setSavingImage(true);
    setError(null);
    try {
      if (showImageModal.type === "product") {
        await api.updateProductImage(showImageModal.id, newImageUrl.trim());
      } else {
        await api.updateVariantImage(showImageModal.id, newImageUrl.trim());
      }
      setNotice(`Image for ${showImageModal.name} updated`);
      setShowImageModal(null);
      setNewImageUrl("");
      await loadMedia();
      await load();
    } catch (err: any) {
      setError(err.message ?? "Failed to update image");
    } finally {
      setSavingImage(false);
    }
  };
  const editorKey = editor ? `${editor.kind}:${editor.product?.id ?? ""}:${editor.variant?.id ?? ""}` : "";
  const [packDraft, setPackDraft] = useState({ key: "", packSize: "", unit: "kg", unitsPerCase: "", measuredWeightKg: "" });
  if (editor && packDraft.key !== editorKey) {
    const parsed = parseStoredPack(String(editor.variant?.unitSize ?? ""), String(editor.variant?.unit ?? ""));
    setPackDraft({
      key: editorKey,
      packSize: parsed.packSize,
      unit: parsed.unit,
      unitsPerCase: editor.variant?.unitsPerCase != null ? String(editor.variant.unitsPerCase) : "",
      measuredWeightKg: parsed.unit === "pcs" ? String(editor.variant?.unitWeightKg ?? "") : "",
    });
    setFieldErrors({});
  }
  const preview = massPreview(packDraft.packSize, packDraft.unit);
  const caseUnits = Number(packDraft.unitsPerCase);
  const pieceWeight = Number(packDraft.measuredWeightKg);
  const derivedCase = preview && Number.isSafeInteger(caseUnits) && caseUnits > 0
    ? caseWeightKg(preview.unitWeightKg, caseUnits)
    : packDraft.unit === "pcs" && Number.isFinite(pieceWeight) && pieceWeight > 0 && Number.isSafeInteger(caseUnits) && caseUnits > 0
      ? caseWeightKg(pieceWeight, caseUnits)
      : null;

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.products("all");
      setProducts(res.products.filter((product: any) => visibleStatus(product.catalogStatus)).map((product: any) => ({ ...product, variants: product.variants.filter((variant: any) => visibleStatus(variant.catalogStatus)) })).filter((product: any) => product.variants.length));
      setTiers(res.tiers);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load catalog");
    } finally {
      setLoading(false);
    }
  };

  const productBody = (values: FormData) => {
    const imageUrl = String(values.get("imageUrl") ?? "").trim();
    const brandName = String(values.get("brandName") ?? "").trim();
    const groupName = String(values.get("groupName") ?? "").trim();
    return {
      name: String(values.get("name") ?? "").trim(),
      ...(brandName ? { brandName } : {}),
      ...(groupName ? { groupName } : {}),
      category: String(values.get("category") ?? "").trim(),
      ...(imageUrl ? { imageUrl } : {}),
    };
  };

  const saveDraft = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor || savingDraft) return;
    const values = new FormData(event.currentTarget);
    const built = editor.kind === "product" ? null : buildDraftPack(packDraft);
    if (built && !built.ok) {
      setFieldErrors(built.fields);
      setError(null);
      return;
    }
    const pack = built?.ok ? built.pack : null;
    setSavingDraft(true);
    setError(null);
    setFieldErrors({});
    try {
      if (editor.kind === "create" && pack) await api.createProduct({ ...productBody(values), variants: [pack] });
      if (editor.kind === "product") await api.updateProduct(editor.product.id, productBody(values));
      if (editor.kind === "variant" && pack) await api.updateVariant(editor.variant.id, pack);
      if (editor.kind === "add" && pack) await api.addVariant(editor.product.id, pack);
      setEditor(null);
      setNotice("Draft saved. It is not visible for ordering.");
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        const readable = humanizePackFailure(err.body);
        setFieldErrors(readable.fields);
        setError(readable.message);
      } else {
        setError(err instanceof Error && err.message !== "invalid_pack" ? err.message : "Could not save draft");
      }
    } finally {
      setSavingDraft(false);
    }
  };

  const saveAndPublish = async (event: React.MouseEvent<HTMLButtonElement>) => {
    const form = event.currentTarget.form;
    if (!form || savingDraft) return;
    const values = new FormData(form);
    const built = buildDraftPack(packDraft);
    if (!built.ok) {
      setFieldErrors(built.fields);
      setError(null);
      return;
    }
    setSavingDraft(true);
    setError(null);
    setFieldErrors({});
    try {
      await api.createAndPublishProduct({ product: productBody(values), pack: { ...built.pack, outerPack: String(values.get("outerPack") ?? "Bag") } });
      setEditor(null);
      setNotice("Catalogue published. Ordering setup is still separate.");
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        const readable = humanizePackFailure(err.body);
        setFieldErrors(readable.fields);
        setError(publicationMessage(err.body) === "Could not publish this catalogue pack." ? readable.message : publicationMessage(err.body));
      } else {
        setError("Could not publish this catalogue pack.");
      }
    } finally {
      setSavingDraft(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (tab === "hierarchy") {
      void loadHierarchy();
    } else if (tab === "media") {
      void loadMedia();
    }
  }, [tab]);

  const query = search.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  const rows = products.flatMap((product) => product.variants.map((variant: any) => ({ product, variant })));
  const matchingRows = query ? rows.filter(({ product, variant }) => {
    const fields = [product.name, product.category, product.internalCode, product.catalogKey,
      variant.unitSize, variant.unit,
      variant.unitsPerCase, `${variant.unitSize ?? ""} x ${variant.unitsPerCase ?? ""}`,
      `${variant.unitSize ?? ""} × ${variant.unitsPerCase ?? ""}`,
      variant.internalCode, variant.catalogKey, variant.catalogIdentitySkuName, variant.id, product.id];
    return fields.some((value) => String(value ?? "").toLocaleLowerCase().replace(/\s+/g, " ").includes(query));
  }) : rows;

  const matchingProducts = products
    .map((product) => ({
      ...product,
      matchingVariants: product.variants.filter((variant: any) =>
        matchingRows.some((r) => r.variant.id === variant.id)
      ),
    }))
    .filter((product) => product.matchingVariants.length > 0);

  const publicationMessage = (body: any) => {
    if (body?.error === "canonical_pack_exists") return "A current catalogue pack already exists.";
    if (body?.error === "canonical_product_exists") return "This product already has a catalogue identity. Add the pack to that product.";
    if (body?.error === "catalogue_publication_ambiguous") return "Publication is blocked because the pack match is ambiguous.";
    if (body?.error === "catalogue_semantics_pack_mismatch") return "The catalogue description does not match this pack.";
    if (body?.error === "catalogue_identity_mismatch") return "That product description does not match the existing catalogue identity.";
    if (body?.error === "invalid_outer_pack") return "Choose Bag or Box as the outer pack.";
    if (body?.error === "product_name_exists") return "A product with this name already exists.";
    if (body?.error === "semantic_identity_required") return "Could not derive catalogue identity from this product and pack.";
    return "Could not publish this catalogue pack.";
  };

  const publishCatalogue = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!publishing) return;
    setError(null);
    try {
      await api.publishCatalogueFromBusiness(publishing.variant.id, { outerPack });
      setPublishing(null);
      setNotice("Catalogue published. Ordering setup is still separate.");
      await load();
    } catch (err) {
      if (err instanceof ApiError) setError(publicationMessage(err.body));
      else setError("Could not publish this catalogue pack.");
    }
  };

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setNotice("ID copied.");
    } catch {
      setError("Clipboard unavailable. Select the ID to copy it.");
    }
  };

  const startEditingRow = (_p: any, v: any) => {
    const parsed = parseStoredPack(String(v.unitSize ?? ""), String(v.unit ?? "kg"));
    const packSize = parsed.packSize || String(v.packSize ?? "1");
    const unit = parsed.unit || v.unit || "kg";
    const unitsPerCase = v.unitsPerCase != null ? String(v.unitsPerCase) : "1";
    const primaryPrice = v.prices?.[0];
    const currentPrice = primaryPrice?.price != null ? primaryPrice.price : v.listRate != null ? v.listRate : "";
    const currentBasis: "case" | "quintal" = (v.listRateBasis === "quintal" || primaryPrice?.rateBasis === "quintal") ? "quintal" : "case";

    const initialWeight = getCaseWeightKg(packSize, unit, unitsPerCase, v.unitWeightKg);
    let initialRatePerKg = "";
    if (currentPrice !== "" && Number(currentPrice) > 0) {
      const numPrice = Number(currentPrice);
      if (currentBasis === "quintal") {
        initialRatePerKg = String(Math.round((numPrice / 100) * 100) / 100);
      } else if (initialWeight > 0) {
        initialRatePerKg = String(Math.round((numPrice / initialWeight) * 100) / 100);
      }
    }

    setRowEdit({
      variantId: v.id,
      packSize,
      unit,
      unitsPerCase,
      gstPercent: v.gstPercent != null ? String(v.gstPercent) : "5",
      routingClass: v.routingClass ?? "LAXMI_TOOR",
      price: currentPrice !== "" ? String(currentPrice) : "",
      rateBasis: currentBasis,
      ratePerKg: initialRatePerKg,
    });
  };

  const updatePackOrUnits = (partial: { packSize?: string; unit?: string; unitsPerCase?: string }) => {
    setRowEdit((curr) => {
      if (!curr) return null;
      const newPackSize = partial.packSize !== undefined ? partial.packSize : curr.packSize;
      const newUnit = partial.unit !== undefined ? partial.unit : curr.unit;
      const newUnitsPerCase = partial.unitsPerCase !== undefined ? partial.unitsPerCase : curr.unitsPerCase;

      const newWeight = getCaseWeightKg(newPackSize, newUnit, newUnitsPerCase);

      let newPrice = curr.price;
      const numRate = Number(curr.ratePerKg);
      // If we have a ratePerKg and newWeight > 0, simultaneously update the case price!
      if (Number.isFinite(numRate) && numRate > 0 && newWeight > 0) {
        if (curr.rateBasis === "case") {
          const calcPrice = Math.round(numRate * newWeight * 100) / 100;
          newPrice = String(calcPrice);
        } else if (curr.rateBasis === "quintal") {
          newPrice = String(Math.round(numRate * 100 * 100) / 100);
        }
      }

      return {
        ...curr,
        ...partial,
        price: newPrice,
      };
    });
  };

  const handlePriceChange = (newPriceStr: string) => {
    setRowEdit((curr) => {
      if (!curr) return null;
      const numPrice = Number(newPriceStr);
      let newRatePerKg = curr.ratePerKg;
      const currentWeight = getCaseWeightKg(curr.packSize, curr.unit, curr.unitsPerCase);
      if (newPriceStr.trim() !== "" && Number.isFinite(numPrice) && numPrice >= 0) {
        if (curr.rateBasis === "quintal") {
          newRatePerKg = String(Math.round((numPrice / 100) * 100) / 100);
        } else if (currentWeight > 0) {
          newRatePerKg = String(Math.round((numPrice / currentWeight) * 100) / 100);
        }
      }
      return {
        ...curr,
        price: newPriceStr,
        ratePerKg: newRatePerKg,
      };
    });
  };

  const handleRatePerKgChange = (newRateStr: string) => {
    setRowEdit((curr) => {
      if (!curr) return null;
      const numRate = Number(newRateStr);
      const currentWeight = getCaseWeightKg(curr.packSize, curr.unit, curr.unitsPerCase);
      let newPrice = curr.price;
      if (newRateStr.trim() !== "" && Number.isFinite(numRate) && numRate >= 0) {
        if (curr.rateBasis === "quintal") {
          newPrice = String(Math.round(numRate * 100 * 100) / 100);
        } else if (currentWeight > 0) {
          newPrice = String(Math.round(numRate * currentWeight * 100) / 100);
        }
      }
      return {
        ...curr,
        price: newPrice,
        ratePerKg: newRateStr,
      };
    });
  };

  const handleRateBasisChange = (newBasis: "case" | "quintal") => {
    setRowEdit((curr) => {
      if (!curr) return null;
      const currentWeight = getCaseWeightKg(curr.packSize, curr.unit, curr.unitsPerCase);
      const numRate = Number(curr.ratePerKg);
      let newPrice = curr.price;
      if (Number.isFinite(numRate) && numRate > 0) {
        if (newBasis === "quintal") {
          newPrice = String(Math.round(numRate * 100 * 100) / 100);
        } else if (currentWeight > 0) {
          newPrice = String(Math.round(numRate * currentWeight * 100) / 100);
        }
      } else {
        const numPrice = Number(curr.price);
        if (Number.isFinite(numPrice) && numPrice > 0) {
          const derivedRate = curr.rateBasis === "quintal" ? numPrice / 100 : (currentWeight > 0 ? numPrice / currentWeight : 0);
          if (derivedRate > 0) {
            if (newBasis === "quintal") {
              newPrice = String(Math.round(derivedRate * 100 * 100) / 100);
            } else if (currentWeight > 0) {
              newPrice = String(Math.round(derivedRate * currentWeight * 100) / 100);
            }
          }
        }
      }
      return {
        ...curr,
        rateBasis: newBasis,
        price: newPrice,
      };
    });
  };

  const saveRow = async (variantId: string) => {
    if (!rowEdit || rowEdit.variantId !== variantId || savingRow) return;
    const priceVal = Number(rowEdit.price);
    if (!Number.isFinite(priceVal) || priceVal < 0) {
      setError("Price must be a positive number");
      return;
    }
    const packSizeVal = Number(rowEdit.packSize);
    if (!Number.isFinite(packSizeVal) || packSizeVal <= 0) {
      setError("Pack size must be greater than zero");
      return;
    }
    const unitsPerCaseVal = Number(rowEdit.unitsPerCase);
    if (!Number.isSafeInteger(unitsPerCaseVal) || unitsPerCaseVal <= 0) {
      setError("Units per case must be a positive whole number");
      return;
    }

    setSavingRow(true);
    setError(null);
    try {
      await api.quickEditVariant(variantId, {
        price: priceVal,
        rateBasis: rowEdit.rateBasis,
        packSize: rowEdit.packSize,
        unit: rowEdit.unit,
        unitsPerCase: unitsPerCaseVal,
        gstPercent: Number(rowEdit.gstPercent),
        routingClass: rowEdit.routingClass,
      });
      setRowEdit(null);
      setNotice("Product SKU, price, GST and billing rule updated");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes");
    } finally {
      setSavingRow(false);
    }
  };

  const updateRowEdit = (partial: Partial<RowEditState>) => {
    setRowEdit((curr) => (curr ? { ...curr, ...partial } : null));
  };

  return (
    <div>
      <h1 className="page-title">Catalog</h1>
      <p className="page-sub">
        Rates show their stored basis. Kilogram and case equivalents are derived from the configured pack weight. GST and freight are calculated in the commercial quote.
      </p>

      <div className="tab-row" style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <button
          className={tab === "skus" ? "primary" : "secondary"}
          onClick={() => setTab("skus")}
        >
          SKUs & Packs ({products.length})
        </button>
        <button
          className={tab === "hierarchy" ? "primary" : "secondary"}
          onClick={() => setTab("hierarchy")}
        >
          Categories & Brands (Gap 9)
        </button>
        <button
          className={tab === "media" ? "primary" : "secondary"}
          onClick={() => setTab("media")}
        >
          Media & Assets (Gap 10)
        </button>
      </div>

      {tab === "skus" && (
        <>
          <div className="row" style={{ marginBottom: 16 }}>
        <button onClick={() => setEditor({ kind: "sku" })}>Add product</button>
        <a href="/imports">Bulk import</a>
      </div>

      <div className="row" style={{ marginBottom: 16, alignItems: "end" }}>
        <label style={{ flex: 1 }}>Search catalogue
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product, pack or code…" />
        </label>
        {search && <button type="button" className="secondary" onClick={() => setSearch("")}>Clear search</button>}
        <span role="status" className="muted small">{matchingRows.length} of {rows.length} SKUs</span>
      </div>

      {publishing && <section aria-label="Publish catalogue" style={{ marginBottom: 20 }}>
        <h2>Publish catalogue</h2>
        <p>Publish {publishing.product.name} · {publishing.variant.unitSize} × {publishing.variant.unitsPerCase}?</p>
        <p className="muted small">Publication will assign catalogue identity and make this pack available for commercial setup. It will not enable ordering.</p>
        <form onSubmit={publishCatalogue}>
          <div className="row">
            <label>Outer pack<select value={outerPack} onChange={(event) => setOuterPack(event.target.value as "Bag" | "Box")}><option value="Bag">Bag</option><option value="Box">Box</option></select></label>
          </div>
          <div className="row"><button type="submit">Publish catalogue</button><button type="button" className="secondary" onClick={() => setPublishing(null)}>Cancel</button></div>
        </form>
      </section>}

      {editor?.kind === "sku" && <CatalogueSkuForm tiers={tiers} product={editor.product} variant={editor.variant} onCancel={() => setEditor(null)} onSaved={async (message) => { setEditor(null); setNotice(message); await load(); }} />}

      {editor && editor.kind !== "sku" && <section aria-label="Draft editor" style={{ marginBottom: 20 }}>
        <h2>{editor.kind === "create" ? "New product draft" : editor.kind === "product" ? "Edit product draft" : editor.kind === "add" ? "Add draft pack" : "Edit draft pack"}</h2>
        <form key={editorKey} noValidate onSubmit={saveDraft}>
          {(editor.kind === "create" || editor.kind === "product") && <div className="row">
            <label>Product name<input name="name" required defaultValue={editor.product?.name ?? ""} /></label>
            <label>Brand<input name="brandName" list="catalog-brand-options" required defaultValue={editor.product?.catalogIdentityBrand ?? "Gagan"} /></label>
            <datalist id="catalog-brand-options"><option value="Gagan" /><option value="Laxmi" /></datalist>
            <label>Product group<input name="groupName" required defaultValue={editor.product?.catalogIdentityGroup ?? ""} /></label>
            <label>Category<input name="category" required defaultValue={editor.product?.category ?? ""} /></label>
            <label>Image URL<input name="imageUrl" type="url" aria-invalid={Boolean(fieldErrors.imageUrl)} defaultValue={editor.product?.imageUrl ?? ""} /></label>
          </div>}
          {editor.kind !== "product" && <div className="row">
            <label>Pack size<input name="packSize" inputMode="decimal" aria-invalid={Boolean(fieldErrors.packSize)} value={packDraft.packSize} onChange={(event) => setPackDraft((current) => ({ ...current, packSize: event.target.value }))} /></label>
            <label>Unit<select name="unit" aria-invalid={Boolean(fieldErrors.unit)} value={packDraft.unit} onChange={(event) => setPackDraft((current) => ({ ...current, unit: event.target.value }))}><option value="kg">kg</option><option value="g">g</option><option value="quintal">quintal</option><option value="pcs">pcs</option></select></label>
            <label>Units per case<input name="unitsPerCase" inputMode="numeric" aria-invalid={Boolean(fieldErrors.unitsPerCase)} value={packDraft.unitsPerCase} onChange={(event) => setPackDraft((current) => ({ ...current, unitsPerCase: event.target.value }))} /></label>
            {editor.kind === "create" && <label>Outer pack<select name="outerPack" defaultValue="Bag"><option value="Bag">Bag</option><option value="Box">Box</option></select></label>}
            {packDraft.unit === "pcs" && <label>Measured weight per piece (kg)<input name="measuredWeightKg" inputMode="decimal" aria-invalid={Boolean(fieldErrors.weight)} value={packDraft.measuredWeightKg} onChange={(event) => setPackDraft((current) => ({ ...current, measuredWeightKg: event.target.value }))} /></label>}
          </div>}
          {editor.kind !== "product" && preview && <p>{preview.sentence}</p>}
          {editor.kind !== "product" && derivedCase != null && <p>Case weight: {derivedCase} kg</p>}
          {editor.kind !== "product" && fieldErrors.packSize && <p role="alert">{fieldErrors.packSize}</p>}
          {editor.kind !== "product" && fieldErrors.unit && <p role="alert">{fieldErrors.unit}</p>}
          {editor.kind !== "product" && fieldErrors.unitsPerCase && <p role="alert">{fieldErrors.unitsPerCase}</p>}
          {editor.kind !== "product" && fieldErrors.weight && <p role="alert">{fieldErrors.weight}</p>}
          {(editor.kind === "create" || editor.kind === "product") && fieldErrors.imageUrl && <p role="alert">{fieldErrors.imageUrl}</p>}
          {editor.kind !== "product" && <p className="muted small">Mass packs derive weight from the pack size. Pieces need a measured weight. A saved draft is not ready for ordering until catalogue identity is published.</p>}
          <div className="row">
            <button type="submit" disabled={savingDraft}>{editor.kind === "variant" || editor.kind === "add" ? "Save pack" : "Save draft"}</button>
            {editor.kind === "create" && <button type="button" disabled={savingDraft} onClick={saveAndPublish}>Save & publish</button>}
            <button type="button" className="secondary" onClick={() => setEditor(null)}>Cancel</button>
          </div>
        </form>
      </section>}

      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner success">{notice}</div>}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 22 }} className="muted">
            Loading…
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 200 }}>Product</th>
                <th style={{ minWidth: 170 }}>SKU / Pack</th>
                <th style={{ minWidth: 80 }}>GST %</th>
                <th style={{ minWidth: 130 }}>Billing Rule</th>
                <th className="right" style={{ minWidth: 160 }}>Price (₹)</th>
                <th className="right" style={{ width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {matchingProducts.length === 0 && <tr><td colSpan={6}>No products match ‘{search.trim()}’</td></tr>}
              {matchingProducts.map((p) => {
                const variants = p.matchingVariants;
                const variantCount = variants.length;
                return variants.map((v: any, index: number) => {
                  const caseWeight = v.unitWeightKg * v.unitsPerCase;
                  const activeEdit = rowEdit?.variantId === v.id ? rowEdit : null;
                  const primaryPrice = v.prices?.[0] ?? { price: v.listRate, rateBasis: v.listRateBasis ?? "case", tierId: tiers[0]?.id ?? "default" };
                  const basis: "case" | "quintal" = (v.listRateBasis === "quintal" || primaryPrice.rateBasis === "quintal") ? "quintal" : "case";
                  const displayPrice = primaryPrice.price ?? v.listRate;
                  const perKg = displayPrice == null ? null : basis === "quintal" ? displayPrice / 100 : caseWeight > 0 ? displayPrice / caseWeight : null;
                  const equivalent = displayPrice != null && caseWeight > 0 && basis === "quintal" ? Math.round(displayPrice * caseWeight) / 100 : null;
                  const isFirst = index === 0;

                  return (
                    <tr
                      key={v.id}
                      style={{
                        borderTop: isFirst ? "2px solid var(--border, #cbd5e1)" : "1px solid var(--border-light, #f1f5f9)",
                        background: activeEdit ? "var(--bg-subtle, #f8fafc)" : undefined,
                      }}
                    >
                      {isFirst && (
                        <td
                          rowSpan={variantCount}
                          style={{
                            verticalAlign: "top",
                            borderRight: "1px solid var(--border, #e2e8f0)",
                            background: "var(--card, #fff)",
                            padding: "16px 14px",
                          }}
                        >
                          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                            {(p.imageUrl || v.imageUrl) ? (
                              <img
                                src={p.imageUrl || v.imageUrl}
                                alt={p.name}
                                style={{
                                  width: 44,
                                  height: 44,
                                  objectFit: "cover",
                                  borderRadius: 6,
                                  border: "1px solid var(--border, #e2e8f0)",
                                  background: "#fff",
                                  flexShrink: 0,
                                }}
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 6,
                                  background: "var(--bg-subtle, #f1f5f9)",
                                  border: "1px dashed var(--border, #cbd5e1)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "var(--muted, #94a3b8)",
                                  fontSize: 10,
                                  flexShrink: 0,
                                }}
                              >
                                No img
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600 }}>{p.name}</div>
                              <div className="muted small" style={{ marginTop: 2 }}>
                                <span>{p.category}</span>
                                {" · "}
                                <span style={{ fontWeight: 600 }}>{p.variants.length} {p.variants.length === 1 ? "SKU" : "SKUs"}</span>
                              </div>
                              <div className="muted small" style={{ marginTop: 4 }}>
                                Product ID: <code>{p.id}</code>{" "}
                                <button type="button" className="ghost sm" onClick={() => copyId(p.id)}>
                                  Copy product ID
                                </button>
                              </div>
                              <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                                <button
                                  type="button"
                                  className="ghost sm"
                                  style={{ color: "var(--primary, #2563eb)", fontWeight: 500, padding: "2px 6px" }}
                                  onClick={() => setProductModal({
                                    id: p.id,
                                    name: p.name,
                                    category: p.category,
                                    imageUrl: p.imageUrl || "",
                                  })}
                                >
                                  ✎ Edit product
                                </button>
                                {["pending_review", "published", "active", "inactive"].includes(p.catalogStatus) && (
                                  <button
                                    type="button"
                                    className="ghost sm"
                                    style={{ padding: "2px 6px" }}
                                    onClick={() => setEditor({ kind: "sku", product: p })}
                                  >
                                    Add pack
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      )}
                      <td className="small" style={{ verticalAlign: "middle" }}>
                        {activeEdit ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                              <input
                                aria-label="Pack size"
                                type="number"
                                role="textbox"
                                step="any"
                                min="0.01"
                                value={activeEdit.packSize}
                                onChange={(e) => updatePackOrUnits({ packSize: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveRow(v.id);
                                  if (e.key === "Escape") setRowEdit(null);
                                }}
                                style={{ width: 65, padding: "4px 6px" }}
                                placeholder="Size"
                              />
                              <select
                                aria-label="Unit"
                                value={activeEdit.unit}
                                onChange={(e) => updatePackOrUnits({ unit: e.target.value })}
                                style={{ padding: "4px 6px" }}
                              >
                                <option value="kg">kg</option>
                                <option value="g">g</option>
                                <option value="quintal">quintal</option>
                                <option value="pcs">pcs</option>
                              </select>
                              <span style={{ fontWeight: 600 }}>×</span>
                              <input
                                aria-label="Units per case"
                                type="number"
                                role="textbox"
                                min="1"
                                step="1"
                                value={activeEdit.unitsPerCase}
                                onChange={(e) => updatePackOrUnits({ unitsPerCase: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveRow(v.id);
                                  if (e.key === "Escape") setRowEdit(null);
                                }}
                                style={{ width: 55, padding: "4px 6px" }}
                                placeholder="Units"
                              />
                            </div>
                            {(() => {
                              const w = getCaseWeightKg(activeEdit.packSize, activeEdit.unit, activeEdit.unitsPerCase);
                              return w > 0 ? (
                                <span className="muted small" style={{ fontWeight: 500 }}>
                                  Case: ~{w} kg
                                </span>
                              ) : null;
                            })()}
                          </div>
                        ) : (
                          <>
                            <div>
                              <button
                                type="button"
                                className="ghost"
                                style={{
                                  fontWeight: 600,
                                  fontSize: 14,
                                  padding: "2px 4px",
                                  marginLeft: "-4px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  color: "var(--ink, #0f172a)",
                                  cursor: "pointer",
                                }}
                                title="Click to edit pack and price"
                                onClick={() => startEditingRow(p, v)}
                              >
                                <span>{v.unitSize} × {v.unitsPerCase}</span>
                                <span style={{ fontSize: 11, color: "var(--primary, #2563eb)", fontWeight: 500 }}>✎ Edit</span>
                              </button>
                            </div>
                            <div className="muted small">{caseWeight} kg case</div>
                            <div className="muted small">{v.catalogStatus === "active" ? "Active" : v.catalogStatus === "pending_review" ? "Draft" : "Setup needed"}</div>
                            <div className="muted small">Variant ID: <code>{v.id}</code> <button type="button" className="ghost sm" onClick={() => copyId(v.id)}>Copy variant ID</button></div>
                            {v.catalogStatus === "pending_review" && <div><button className="ghost sm" onClick={() => setEditor({ kind: "variant", product: p, variant: v })}>Edit draft</button></div>}
                            {v.catalogStatus === "pending_review" && !v.catalogKey && (
                              <div><button type="button" className="sm" onClick={() => { setPublishing({ product: p, variant: v }); setOuterPack("Bag"); }}>Publish catalogue</button></div>
                            )}
                          </>
                        )}
                      </td>
                      <td style={{ verticalAlign: "middle" }}>
                        {activeEdit ? (
                          <select
                            aria-label="GST %"
                            value={activeEdit.gstPercent}
                            onChange={(e) => updateRowEdit({ gstPercent: e.target.value })}
                            style={{ padding: "4px 6px", width: 75 }}
                          >
                            <option value="0">0%</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18%</option>
                            <option value="28">28%</option>
                          </select>
                        ) : (
                          <span style={{ fontWeight: 500 }}>GST: {v.gstPercent ?? 5}%</span>
                        )}
                      </td>
                      <td style={{ verticalAlign: "middle" }}>
                        {activeEdit ? (
                          <select
                            aria-label="Billing rule"
                            value={activeEdit.routingClass}
                            onChange={(e) => updateRowEdit({ routingClass: e.target.value })}
                            style={{ padding: "4px 6px" }}
                          >
                            <option value="LAXMI_TOOR">Laxmi toor</option>
                            <option value="INSTANT_MIX">Instant mix</option>
                            <option value="OTHER">Other</option>
                          </select>
                        ) : (
                          <span>Billing: {billingLabel(v.routingClass)}</span>
                        )}
                      </td>
                      <td className="right" style={{ verticalAlign: "middle" }}>
                        {activeEdit ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                              <span className="small">INR / {activeEdit.rateBasis}</span>
                              <input
                                aria-label="Selling price"
                                type="number"
                                role="spinbutton"
                                min="0"
                                step="any"
                                value={activeEdit.price}
                                onChange={(e) => handlePriceChange(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveRow(v.id);
                                  if (e.key === "Escape") setRowEdit(null);
                                }}
                                style={{ width: 85, padding: "4px 6px", textAlign: "right" }}
                                placeholder="Price"
                              />
                            </div>
                            <div style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 12 }}>
                              <span className="muted">Rate: ₹</span>
                              <input
                                aria-label="Rate per kg"
                                type="text"
                                inputMode="decimal"
                                value={activeEdit.ratePerKg}
                                onChange={(e) => handleRatePerKgChange(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveRow(v.id);
                                  if (e.key === "Escape") setRowEdit(null);
                                }}
                                style={{ width: 65, padding: "2px 4px", fontSize: 12, textAlign: "right" }}
                                placeholder="kg rate"
                              />
                              <span className="muted">/ kg</span>
                            </div>
                            <select
                              aria-label="Rate basis"
                              value={activeEdit.rateBasis}
                              onChange={(e) => handleRateBasisChange(e.target.value as "case" | "quintal")}
                              style={{ padding: "2px 6px", fontSize: 11 }}
                            >
                              <option value="case">per case</option>
                              <option value="quintal">per quintal</option>
                            </select>
                          </div>
                        ) : p.catalogStatus === "pending_review" || v.catalogStatus === "pending_review" ? (
                          <span className="small">
                            {displayPrice == null ? "Not configured" : `${inr(displayPrice)} / ${basis}`}
                            {perKg != null && <span className="muted small" style={{ display: "block" }}>{inr(perKg)} / kg</span>}
                            {equivalent != null && <span className="muted small" style={{ display: "block" }}>{inr(equivalent)} / {caseWeight} KG case</span>}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="ghost sm"
                            style={{ color: "var(--ink)", fontWeight: 600, textAlign: "right", cursor: "pointer" }}
                            title="Click to edit pack and price"
                            onClick={() => startEditingRow(p, v)}
                          >
                            <span>{displayPrice == null ? "Set price" : `${inr(displayPrice)} / ${basis}`}</span>
                            {perKg != null && <span className="muted small" style={{ display: "block" }}>{inr(perKg)} / kg</span>}
                            {equivalent != null && <span className="muted small" style={{ display: "block" }}>{inr(equivalent)} / {caseWeight} KG case</span>}
                          </button>
                        )}
                      </td>
                      <td className="right" style={{ verticalAlign: "middle" }}>
                        {activeEdit ? (
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              className="sm primary"
                              disabled={savingRow}
                              onClick={() => saveRow(v.id)}
                            >
                              {savingRow ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              className="sm secondary"
                              disabled={savingRow}
                              onClick={() => setRowEdit(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              className="sm"
                              onClick={() => startEditingRow(p, v)}
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        )}
      </div>

      {productModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => !savingProductModal && setProductModal(null)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 520,
              background: "#fff",
              borderRadius: 12,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Edit Product Details</h3>
              <button
                type="button"
                className="ghost sm"
                disabled={savingProductModal}
                onClick={() => setProductModal(null)}
                style={{ fontSize: 16, padding: "2px 8px" }}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!productModal.name.trim()) {
                  setError("Product name is required");
                  return;
                }
                if (!productModal.category.trim()) {
                  setError("Category is required");
                  return;
                }
                setSavingProductModal(true);
                setError(null);
                try {
                  await api.quickEditProduct(productModal.id, {
                    name: productModal.name.trim(),
                    category: productModal.category.trim(),
                    imageUrl: productModal.imageUrl.trim() || null,
                  });
                  setNotice("Product details updated successfully");
                  setProductModal(null);
                  await load();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to update product");
                } finally {
                  setSavingProductModal(false);
                }
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600 }}>
                  <span>Product name <span style={{ color: "var(--danger, #ef4444)" }}>*</span></span>
                  <input
                    required
                    aria-label="Edit product name"
                    value={productModal.name}
                    onChange={(e) => setProductModal({ ...productModal, name: e.target.value })}
                    placeholder="e.g. Gagan Daily Fresh Toor Dal"
                    style={{ padding: "8px 12px", borderRadius: 6 }}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600 }}>
                  <span>Category <span style={{ color: "var(--danger, #ef4444)" }}>*</span></span>
                  <input
                    required
                    aria-label="Edit category"
                    value={productModal.category}
                    list="category-suggestions-modal"
                    onChange={(e) => setProductModal({ ...productModal, category: e.target.value })}
                    placeholder="e.g. Pulses & Grains"
                    style={{ padding: "8px 12px", borderRadius: 6 }}
                  />
                  <datalist id="category-suggestions-modal">
                    <option value="Pulses & Grains" />
                    <option value="Rice & Grains" />
                    <option value="Sugar & Sweeteners" />
                    <option value="Spices & Masala" />
                    <option value="Instant Mix" />
                    <option value="Flour & Sooji" />
                    <option value="Oil & Ghee" />
                  </datalist>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600 }}>
                  <span>Image URL (optional)</span>
                  <input
                    type="url"
                    aria-label="Edit image URL"
                    value={productModal.imageUrl}
                    onChange={(e) => setProductModal({ ...productModal, imageUrl: e.target.value })}
                    placeholder="http://localhost:4000/catalog-images/..."
                    style={{ padding: "8px 12px", borderRadius: 6 }}
                  />
                </label>

                {productModal.imageUrl && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, background: "var(--bg-subtle, #f8fafc)", borderRadius: 6 }}>
                    <img
                      src={productModal.imageUrl}
                      alt="Preview"
                      style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 4, border: "1px solid #e2e8f0" }}
                      onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }}
                    />
                    <span className="muted small">Image Preview</span>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
                <button
                  type="button"
                  className="secondary"
                  disabled={savingProductModal}
                  onClick={() => setProductModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary"
                  disabled={savingProductModal}
                >
                  {savingProductModal ? "Saving…" : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}

      {/* TAB 2: Gap 9 - Categories & Brands Hierarchy Master */}
      {tab === "hierarchy" && (
        <div>
          <div className="between" style={{ marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0 }}>Category & Brand Hierarchy Master</h2>
              <p className="page-sub">Central taxonomy, brand logos, banners, and store catalog display ordering.</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => {
                setEditingCat(null);
                setCatForm({ name: "", description: "", bannerUrl: "", sortOrder: "0", isActive: true });
                setShowCatModal(true);
              }}>
                + Add Category
              </button>
              <button onClick={() => {
                setEditingBrand(null);
                setBrandForm({ name: "", description: "", logoUrl: "", sortOrder: "0", isActive: true });
                setShowBrandModal(true);
              }}>
                + Add Brand
              </button>
            </div>
          </div>

          {hierarchyLoading ? (
            <div className="card muted">Loading taxonomy and brands…</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {/* Category Master Card */}
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div className="between" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border, #eee)", background: "var(--surface-muted, #f8f9fa)" }}>
                  <h3 style={{ margin: 0, fontSize: 16 }}>Categories ({categories.length})</h3>
                  <button className="sm" onClick={() => {
                    setEditingCat(null);
                    setCatForm({ name: "", description: "", bannerUrl: "", sortOrder: "0", isActive: true });
                    setShowCatModal(true);
                  }}>
                    + Add
                  </button>
                </div>
                {categories.length === 0 ? (
                  <div className="empty-state" style={{ padding: 20 }}>No categories found.</div>
                ) : (
                  <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left", borderBottom: "1px solid #f0f0f0" }}>
                        <th style={{ padding: "8px 14px" }}>Category Name</th>
                        <th style={{ padding: "8px 14px" }}>Description</th>
                        <th style={{ padding: "8px 14px" }}>Status</th>
                        <th style={{ padding: "8px 14px", textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((c) => (
                        <tr key={c.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                          <td style={{ padding: "8px 14px", fontWeight: 600 }}>{c.name}</td>
                          <td style={{ padding: "8px 14px", color: "var(--text-muted)" }}>{c.description || "—"}</td>
                          <td style={{ padding: "8px 14px" }}>
                            {c.isActive ? (
                              <span className="pill status-confirmed">Active</span>
                            ) : (
                              <span className="pill">Inactive</span>
                            )}
                          </td>
                          <td style={{ padding: "8px 14px", textAlign: "right" }}>
                            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                              <button className="sm secondary" onClick={() => {
                                setEditingCat(c);
                                setCatForm({
                                  name: c.name,
                                  description: c.description ?? "",
                                  bannerUrl: c.bannerUrl ?? "",
                                  sortOrder: String(c.sortOrder ?? 0),
                                  isActive: Boolean(c.isActive),
                                });
                                setShowCatModal(true);
                              }}>
                                Edit
                              </button>
                              <button className="sm secondary" style={{ color: "var(--danger)" }} onClick={() => handleDeleteCategory(c)}>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Brand Master Card */}
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div className="between" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border, #eee)", background: "var(--surface-muted, #f8f9fa)" }}>
                  <h3 style={{ margin: 0, fontSize: 16 }}>Brands ({brands.length})</h3>
                  <button className="sm" onClick={() => {
                    setEditingBrand(null);
                    setBrandForm({ name: "", description: "", logoUrl: "", sortOrder: "0", isActive: true });
                    setShowBrandModal(true);
                  }}>
                    + Add
                  </button>
                </div>
                {brands.length === 0 ? (
                  <div className="empty-state" style={{ padding: 20 }}>No brands configured.</div>
                ) : (
                  <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left", borderBottom: "1px solid #f0f0f0" }}>
                        <th style={{ padding: "8px 14px" }}>Brand</th>
                        <th style={{ padding: "8px 14px" }}>Description</th>
                        <th style={{ padding: "8px 14px" }}>Status</th>
                        <th style={{ padding: "8px 14px", textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {brands.map((b) => (
                        <tr key={b.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                          <td style={{ padding: "8px 14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              {b.logoUrl && (
                                <img
                                  src={b.logoUrl}
                                  alt=""
                                  style={{ width: 24, height: 24, objectFit: "contain", borderRadius: 3 }}
                                  onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }}
                                />
                              )}
                              <strong>{b.name}</strong>
                            </div>
                          </td>
                          <td style={{ padding: "8px 14px", color: "var(--text-muted)" }}>{b.description || "—"}</td>
                          <td style={{ padding: "8px 14px" }}>
                            {b.isActive ? (
                              <span className="pill status-confirmed">Active</span>
                            ) : (
                              <span className="pill">Inactive</span>
                            )}
                          </td>
                          <td style={{ padding: "8px 14px", textAlign: "right" }}>
                            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                              <button className="sm secondary" onClick={() => {
                                setEditingBrand(b);
                                setBrandForm({
                                  name: b.name,
                                  description: b.description ?? "",
                                  logoUrl: b.logoUrl ?? "",
                                  sortOrder: String(b.sortOrder ?? 0),
                                  isActive: Boolean(b.isActive),
                                });
                                setShowBrandModal(true);
                              }}>
                                Edit
                              </button>
                              <button className="sm secondary" style={{ color: "var(--danger)" }} onClick={() => handleDeleteBrand(b)}>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Modal: Add/Edit Category */}
          {showCatModal && (
            <div className="modal-backdrop" style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
            }}>
              <div className="card" style={{ width: 480, maxWidth: "90vw" }}>
                <h3 style={{ marginTop: 0 }}>{editingCat ? `Edit Category: ${editingCat.name}` : "Create Catalog Category"}</h3>
                <form onSubmit={handleSaveCategory}>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Category Name</label>
                    <input
                      value={catForm.name}
                      onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Description</label>
                    <input
                      value={catForm.description}
                      onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                      placeholder="e.g. Premium pulses, toor dal, and lentils"
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Banner Image URL</label>
                    <input
                      type="url"
                      value={catForm.bannerUrl}
                      onChange={(e) => setCatForm({ ...catForm, bannerUrl: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <div className="field">
                      <label>Sort Order Index</label>
                      <input
                        type="number"
                        value={catForm.sortOrder}
                        onChange={(e) => setCatForm({ ...catForm, sortOrder: e.target.value })}
                      />
                    </div>
                    <div className="field" style={{ display: "flex", alignItems: "center", paddingTop: 20 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={catForm.isActive}
                          onChange={(e) => setCatForm({ ...catForm, isActive: e.target.checked })}
                        />
                        <span>Active</span>
                      </label>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button type="button" className="secondary" onClick={() => setShowCatModal(false)}>Cancel</button>
                    <button type="submit">Save Category</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal: Add/Edit Brand */}
          {showBrandModal && (
            <div className="modal-backdrop" style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
            }}>
              <div className="card" style={{ width: 480, maxWidth: "90vw" }}>
                <h3 style={{ marginTop: 0 }}>{editingBrand ? `Edit Brand: ${editingBrand.name}` : "Create Catalog Brand"}</h3>
                <form onSubmit={handleSaveBrand}>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Brand Name</label>
                    <input
                      value={brandForm.name}
                      onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Description / Positioning</label>
                    <input
                      value={brandForm.description}
                      onChange={(e) => setBrandForm({ ...brandForm, description: e.target.value })}
                      placeholder="e.g. Flagship premium consumer staples"
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Logo URL</label>
                    <input
                      type="url"
                      value={brandForm.logoUrl}
                      onChange={(e) => setBrandForm({ ...brandForm, logoUrl: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <div className="field">
                      <label>Sort Order Index</label>
                      <input
                        type="number"
                        value={brandForm.sortOrder}
                        onChange={(e) => setBrandForm({ ...brandForm, sortOrder: e.target.value })}
                      />
                    </div>
                    <div className="field" style={{ display: "flex", alignItems: "center", paddingTop: 20 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={brandForm.isActive}
                          onChange={(e) => setBrandForm({ ...brandForm, isActive: e.target.checked })}
                        />
                        <span>Active</span>
                      </label>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button type="button" className="secondary" onClick={() => setShowBrandModal(false)}>Cancel</button>
                    <button type="submit">Save Brand</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Gap 10 - Product Media & Asset Manager */}
      {tab === "media" && (
        <div>
          <div className="between" style={{ marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0 }}>Product Media & Asset Manager</h2>
              <p className="page-sub">Catalog asset health monitor, missing image audit, and direct SKU pack image URL updater.</p>
            </div>
            <button className="secondary" onClick={() => void loadMedia()}>
              Refresh Assets
            </button>
          </div>

          {/* Media Health Metrics */}
          {mediaStats && (
            <div className="metrics" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
              <div className="metric card">
                <div className="metric-label">Total Catalog Products</div>
                <div className="metric-value">{mediaStats.totalProducts ?? 0}</div>
              </div>
              <div className="metric card">
                <div className="metric-label">Total SKU Variants</div>
                <div className="metric-value">{mediaStats.totalVariants ?? 0}</div>
              </div>
              <div className="metric card">
                <div className="metric-label">Missing Product Images</div>
                <div className="metric-value" style={{ color: (mediaStats.productsMissingImage ?? mediaStats.productsWithoutImage ?? 0) > 0 ? "var(--danger)" : "var(--green)" }}>
                  {mediaStats.productsMissingImage ?? mediaStats.productsWithoutImage ?? 0}
                </div>
              </div>
              <div className="metric card">
                <div className="metric-label">Missing SKU Images</div>
                <div className="metric-value" style={{ color: (mediaStats.variantsMissingImage ?? mediaStats.variantsWithoutImage ?? 0) > 0 ? "#d97706" : "var(--green)" }}>
                  {mediaStats.variantsMissingImage ?? mediaStats.variantsWithoutImage ?? 0}
                </div>
              </div>
            </div>
          )}

          {/* Search & Missing Image Filter */}
          <div className="between" style={{ marginBottom: 16, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1, maxWidth: 450 }}>
              <input
                type="search"
                placeholder="Search products or SKUs by name or brand…"
                value={mediaSearch}
                onChange={(e) => setMediaSearch(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={filterMissingOnly}
                onChange={(e) => setFilterMissingOnly(e.target.checked)}
              />
              <span>Show Only Items With Missing Images</span>
            </label>
          </div>

          {mediaLoading ? (
            <div className="card muted">Loading product media assets…</div>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-muted, #f8f9fa)", textAlign: "left" }}>
                    <th style={{ padding: "10px 14px", width: 70 }}>Preview</th>
                    <th style={{ padding: "10px 14px" }}>Product & Brand</th>
                    <th style={{ padding: "10px 14px" }}>Category</th>
                    <th style={{ padding: "10px 14px" }}>Asset Status</th>
                    <th style={{ padding: "10px 14px" }}>Image Asset URL</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {mediaProducts
                    .filter((p) => {
                      if (filterMissingOnly && p.hasImage && p.missingVariantsCount === 0) return false;
                      if (!mediaSearch) return true;
                      const s = mediaSearch.toLowerCase();
                      return p.name.toLowerCase().includes(s) || (p.brand ?? "").toLowerCase().includes(s) || p.category.toLowerCase().includes(s);
                    })
                    .map((item) => {
                      const displayImgUrl = item.imageUrl ? (item.imageUrl.startsWith("http") ? item.imageUrl : `http://localhost:4000${item.imageUrl}`) : "";
                      return (
                      <tr key={item.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                        <td style={{ padding: "10px 14px" }}>
                          {displayImgUrl ? (
                            <img
                              src={displayImgUrl}
                              alt=""
                              style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 4, border: "1px solid #e2e8f0" }}
                              onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }}
                            />
                          ) : (
                            <div style={{ width: 44, height: 44, background: "#f1f5f9", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#94a3b8" }}>
                              No Pic
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ fontWeight: 600 }}>{item.name}</div>
                          <div className="muted small">Brand: {item.brand || "Gagan"} · {item.totalVariants} SKU pack(s)</div>
                        </td>
                        <td style={{ padding: "10px 14px", color: "var(--text-muted)" }}>
                          {item.category}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          {item.hasImage ? (
                            <span className="pill status-confirmed">✓ Image Configured</span>
                          ) : (
                            <span className="pill" style={{ background: "#fee2e2", color: "#991b1b" }}>⚠ Missing Image</span>
                          )}
                          {item.missingVariantsCount > 0 && (
                            <div className="small" style={{ color: "#d97706", marginTop: 2 }}>
                              {item.missingVariantsCount} pack(s) missing photo
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.imageUrl ? (
                            <a href={item.imageUrl} target="_blank" rel="noreferrer" style={{ color: "var(--primary)" }}>
                              {item.imageUrl}
                            </a>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right" }}>
                          <button
                            className="sm secondary"
                            onClick={() => {
                              setShowImageModal({
                                type: "product",
                                id: item.id,
                                name: item.name,
                                currentUrl: item.imageUrl ?? "",
                              });
                              setNewImageUrl(item.imageUrl ?? "");
                            }}
                          >
                            Update Image
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal: Update Image URL */}
          {showImageModal && (
            <div className="modal-backdrop" style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
            }}>
              <div className="card" style={{ width: 500, maxWidth: "90vw" }}>
                <h3 style={{ marginTop: 0 }}>Update Image for {showImageModal.name}</h3>
                <form onSubmit={handleSaveMediaImage}>
                  <div className="field" style={{ marginBottom: 14 }}>
                    <label>New Image Asset URL</label>
                    <input
                      type="url"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder="http://localhost:4000/catalog-images/... or https://..."
                      required
                    />
                  </div>

                  {newImageUrl && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: "#f8fafc", borderRadius: 6, marginBottom: 16 }}>
                      <img
                        src={newImageUrl}
                        alt="Preview"
                        style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 4, border: "1px solid #cbd5e1" }}
                        onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }}
                      />
                      <span className="muted small">Live Image Preview</span>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button type="button" className="secondary" onClick={() => setShowImageModal(null)}>Cancel</button>
                    <button type="submit" disabled={savingImage}>
                      {savingImage ? "Saving…" : "Save Image"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
