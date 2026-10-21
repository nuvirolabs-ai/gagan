import { useEffect, useRef, useState } from "react";
import { ApiError, api } from "../api";
import { buildDraftPack, canonicalUnit, caseWeightKg, humanizePackFailure, massPreview, parseStoredPack, type DraftPackFields } from "../draftPackForm";
import CatalogueSkuForm, { billingLabel, billingOptions } from "../components/CatalogueSkuForm";

interface RowEditState {
  variantId: string;
  packSize: string;
  unit: string;
  unitsPerCase: string;
  gstPercent: string;
  routingClass: string;
  price: string;
  discount: string;
  discountType: "flat" | "percent";
  rateBasis: "case" | "quintal";
  outerPack: "Bag" | "Box";
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

function getPackagingType(v: any, category?: string): "Bag" | "Box" {
  if (v?.outerPack === "Box" || v?.outerPack === "Bag") return v.outerPack;
  if (v?.catalogIdentityMasterPack) {
    const upper = String(v.catalogIdentityMasterPack).toUpperCase();
    if (upper.includes("BOX")) return "Box";
    if (upper.includes("BAG")) return "Bag";
  }
  const cat = String(category || "").toLowerCase();
  if (cat.includes("rice") || cat.includes("daal") || cat.includes("dal") || cat.includes("sugar") || cat.includes("pulse") || cat.includes("grain")) {
    return "Bag";
  }
  if (cat.includes("breakfast") || cat.includes("mix") || cat.includes("instant")) {
    return "Box";
  }
  const caseWeight = (Number(v?.unitWeightKg) || 1) * (Number(v?.unitsPerCase) || 1);
  if (caseWeight >= 10 || Number(v?.unitsPerCase) === 1) {
    return "Bag";
  }
  return "Bag";
}

const inr = (value: number) => {
  const parts = Number(value).toFixed(2).split(".");
  const intPart = Number(parts[0]).toLocaleString("en-IN");
  return parts[1] === "00" ? `₹${intPart}` : `₹${intPart}.${parts[1]}`;
};
const visibleStatus = (status?: string) => !status || ["active", "published", "pending_review", "inactive"].includes(status);
type Editor = { kind: "create" | "product" | "variant" | "add" | "sku"; product?: any; variant?: any };

async function compressImageFile(file: File, maxWidth = 1000, maxHeight = 1000, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to process image"));
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const format = file.type === "image/png" && file.size < 400 * 1024 ? "image/png" : "image/jpeg";
        resolve(canvas.toDataURL(format, quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

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
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleInlineImageUpload = async (productId: string, file?: File) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setError("Image must be smaller than 15MB");
      return;
    }
    setNotice("Optimizing and uploading image…");
    try {
      const compressedDataUrl = await compressImageFile(file);
      await api.updateProductImage(productId, compressedDataUrl);
      setNotice("Product image uploaded successfully!");
      await load();
    } catch (err: any) {
      setError(err.message ?? "Failed to upload product image");
    }
  };
  const [productModal, setProductModal] = useState<{ id: string; name: string; category: string; imageUrl: string; status: "active" | "inactive" } | null>(null);
  const [savingProductModal, setSavingProductModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [deletingProduct, setDeletingProduct] = useState<any | null>(null);
  const [deletingVariant, setDeletingVariant] = useState<{ product: any; variant: any } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
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

  const activeRowsCount = rows.filter(({ product, variant }) =>
    product.catalogStatus !== "inactive" && variant.catalogStatus !== "inactive"
  ).length;
  const inactiveRowsCount = rows.filter(({ product, variant }) =>
    product.catalogStatus === "inactive" || variant.catalogStatus === "inactive"
  ).length;

  const filteredRows = statusFilter === "all"
    ? rows
    : statusFilter === "active"
      ? rows.filter(({ product, variant }) => product.catalogStatus !== "inactive" && variant.catalogStatus !== "inactive")
      : rows.filter(({ product, variant }) => product.catalogStatus === "inactive" || variant.catalogStatus === "inactive");

  const matchingRows = query ? filteredRows.filter(({ product, variant }) => {
    const fields = [product.name, product.category, product.internalCode, product.catalogKey,
      variant.unitSize, variant.unit,
      variant.unitsPerCase, `${variant.unitSize ?? ""} x ${variant.unitsPerCase ?? ""}`,
      `${variant.unitSize ?? ""} × ${variant.unitsPerCase ?? ""}`,
      variant.internalCode, variant.catalogKey, variant.catalogIdentitySkuName, variant.id, product.id];
    return fields.some((value) => String(value ?? "").toLocaleLowerCase().replace(/\s+/g, " ").includes(query));
  }) : filteredRows;

  const matchingProducts = products
    .map((product) => ({
      ...product,
      matchingVariants: product.variants.filter((variant: any) =>
        matchingRows.some((r) => r.variant.id === variant.id)
      ),
    }))
    .filter((product) => product.matchingVariants.length > 0);

  const handleToggleProductStatus = async (p: any) => {
    const nextStatus = p.catalogStatus === "inactive" ? "active" : "inactive";
    setActionLoadingId(p.id);
    setError(null);
    try {
      await api.updateProductStatus(p.id, nextStatus);
      setNotice(`Product "${p.name}" marked as ${nextStatus}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update product status");
    } finally {
      setActionLoadingId(null);
    }
  };

  const confirmDeleteProduct = async () => {
    if (!deletingProduct) return;
    setActionLoadingId(deletingProduct.id);
    setError(null);
    try {
      await api.deleteProduct(deletingProduct.id);
      setNotice(`Product "${deletingProduct.name}" deleted from catalog`);
      setDeletingProduct(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete product");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleVariantStatus = async (v: any) => {
    const nextStatus = v.catalogStatus === "inactive" ? "active" : "inactive";
    setActionLoadingId(v.id);
    setError(null);
    try {
      await api.updateVariantStatus(v.id, nextStatus);
      setNotice(`Pack ${v.unitSize} × ${v.unitsPerCase} marked as ${nextStatus}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update pack status");
    } finally {
      setActionLoadingId(null);
    }
  };

  const confirmDeleteVariant = async () => {
    if (!deletingVariant) return;
    setActionLoadingId(deletingVariant.variant.id);
    setError(null);
    try {
      await api.deleteVariant(deletingVariant.variant.id);
      setNotice(`Pack ${deletingVariant.variant.unitSize} × ${deletingVariant.variant.unitsPerCase} deleted`);
      setDeletingVariant(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete pack");
    } finally {
      setActionLoadingId(null);
    }
  };

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
      routingClass: v.sellingEntity || v.routingClass || "LAXMI_TOOR",
      price: currentPrice !== "" ? String(currentPrice) : "",
      discount: v.discount != null && v.discount > 0 ? String(v.discount) : "",
      discountType: v.discountType === "percent" ? "percent" : "flat",
      rateBasis: currentBasis,
      outerPack: getPackagingType(v, _p?.category),
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
      const isFixedEntity = rowEdit.routingClass === "padam_international" || rowEdit.routingClass === "jain_traders";
      await api.quickEditVariant(variantId, {
        price: priceVal,
        discount: Number(rowEdit.discount) || 0,
        discountType: rowEdit.discountType,
        rateBasis: rowEdit.rateBasis,
        outerPack: rowEdit.outerPack,
        packSize: rowEdit.packSize,
        unit: rowEdit.unit,
        unitsPerCase: unitsPerCaseVal,
        gstPercent: Number(rowEdit.gstPercent),
        routingClass: isFixedEntity ? null : rowEdit.routingClass,
        sellingEntity: isFixedEntity ? rowEdit.routingClass : null,
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
          <div className="row" style={{ marginBottom: 16, justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button onClick={() => setEditor({ kind: "sku" })}>Add product</button>
          <a href="/imports">Bulk import</a>
        </div>
        <div style={{ display: "flex", gap: 6, background: "var(--bg-subtle, #f1f5f9)", padding: "3px 4px", borderRadius: 8 }}>
          <button
            type="button"
            className={statusFilter === "all" ? "primary sm" : "ghost sm"}
            style={{ borderRadius: 6, fontWeight: statusFilter === "all" ? 600 : 500 }}
            onClick={() => setStatusFilter("all")}
          >
            All ({rows.length})
          </button>
          <button
            type="button"
            className={statusFilter === "active" ? "primary sm" : "ghost sm"}
            style={{ borderRadius: 6, fontWeight: statusFilter === "active" ? 600 : 500, color: statusFilter === "active" ? undefined : "#15803d" }}
            onClick={() => setStatusFilter("active")}
          >
            Active ({activeRowsCount})
          </button>
          <button
            type="button"
            className={statusFilter === "inactive" ? "primary sm" : "ghost sm"}
            style={{ borderRadius: 6, fontWeight: statusFilter === "inactive" ? 600 : 500, color: statusFilter === "inactive" ? undefined : "#b45309" }}
            onClick={() => setStatusFilter("inactive")}
          >
            Inactive ({inactiveRowsCount})
          </button>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 16, alignItems: "end" }}>
        <label style={{ flex: 1 }}>Search catalogue
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product, pack or code…" />
        </label>
        {search && <button type="button" className="secondary" onClick={() => setSearch("")}>Clear search</button>}
        <span role="status" className="muted small">{matchingRows.length} of {filteredRows.length} SKUs</span>
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
                  const pkgType = getPackagingType(v, p.category);

                  const discountVal = Number(v.discount) || 0;
                  const isPct = v.discountType === "percent";
                  const deduction = isPct ? (displayPrice != null ? (displayPrice * discountVal) / 100 : 0) : discountVal;
                  const effectivePrice = displayPrice != null ? (discountVal > 0 ? Math.max(0, displayPrice - deduction) : displayPrice) : null;

                  const perKg = effectivePrice == null ? null : basis === "quintal" ? effectivePrice / 100 : caseWeight > 0 ? effectivePrice / caseWeight : null;
                  const equivalent = effectivePrice != null && caseWeight > 0 && basis === "quintal" ? Math.round(effectivePrice * caseWeight * 100) / 10000 : null;
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
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
                              <div
                                style={{ position: "relative", cursor: "pointer", width: 48, height: 48 }}
                                title="Click to upload or change product image"
                                onClick={() => fileInputRefs.current[p.id]?.click()}
                              >
                                {(p.imageUrl || v.imageUrl) ? (
                                  <img
                                    src={p.imageUrl || v.imageUrl}
                                    alt={p.name}
                                    style={{
                                      width: 48,
                                      height: 48,
                                      objectFit: "cover",
                                      borderRadius: 6,
                                      border: "1px solid var(--border, #e2e8f0)",
                                      background: "#fff",
                                    }}
                                    onError={(e) => {
                                      (e.currentTarget as HTMLElement).style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: 48,
                                      height: 48,
                                      borderRadius: 6,
                                      background: "var(--bg-subtle, #f1f5f9)",
                                      border: "1px dashed var(--border, #cbd5e1)",
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      color: "var(--muted, #94a3b8)",
                                      fontSize: 9,
                                      textAlign: "center",
                                    }}
                                  >
                                    📷 Upload
                                  </div>
                                )}
                                <input
                                  type="file"
                                  accept="image/*"
                                  ref={(el) => { if (el) fileInputRefs.current[p.id] = el; }}
                                  style={{ display: "none" }}
                                  onChange={(e) => void handleInlineImageUpload(p.id, e.target.files?.[0])}
                                />
                              </div>
                              <button
                                type="button"
                                className="ghost sm"
                                style={{ fontSize: 10, padding: "2px 4px", color: "#2563eb", fontWeight: 600 }}
                                onClick={() => fileInputRefs.current[p.id]?.click()}
                              >
                                {p.imageUrl ? "Change" : "Upload"}
                              </button>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontWeight: 600 }}>{p.name}</span>
                                {p.catalogStatus === "inactive" ? (
                                  <span style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", padding: "1px 6px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                                    Inactive
                                  </span>
                                ) : (
                                  <span style={{ background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", padding: "1px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                                    Active
                                  </span>
                                )}
                              </div>
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
                                    status: p.catalogStatus === "inactive" ? "inactive" : "active",
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
                                <button
                                  type="button"
                                  className="ghost sm"
                                  disabled={actionLoadingId === p.id}
                                  style={{ color: p.catalogStatus === "inactive" ? "#16a34a" : "#d97706", fontWeight: 500, padding: "2px 6px" }}
                                  title={p.catalogStatus === "inactive" ? "Make product active" : "Make product inactive"}
                                  onClick={() => handleToggleProductStatus(p)}
                                >
                                  {p.catalogStatus === "inactive" ? "▶ Activate" : "⏸ Inactive"}
                                </button>
                                <button
                                  type="button"
                                  className="ghost sm"
                                  disabled={actionLoadingId === p.id}
                                  style={{ color: "#dc2626", fontWeight: 500, padding: "2px 6px" }}
                                  title="Delete product from catalog"
                                  onClick={() => setDeletingProduct(p)}
                                >
                                  🗑 Delete
                                </button>
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
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                                  <span className="muted small" style={{ fontWeight: 500 }}>
                                    Weight: ~{w} kg
                                  </span>
                                  <select
                                    aria-label="Packaging"
                                    value={activeEdit.outerPack || "Bag"}
                                    onChange={(e) => updateRowEdit({ outerPack: e.target.value as "Bag" | "Box" })}
                                    style={{ padding: "2px 6px", fontSize: 11, borderRadius: 4, border: "1px solid #cbd5e1", background: "#fff" }}
                                  >
                                    <option value="Bag">Bag</option>
                                    <option value="Box">Box</option>
                                  </select>
                                </div>
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
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span className="muted small">{caseWeight} kg {pkgType.toLowerCase()}</span>
                              {v.catalogStatus === "inactive" ? (
                                <span style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", padding: "1px 5px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                                  Inactive
                                </span>
                              ) : v.catalogStatus === "active" ? (
                                <span style={{ background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", padding: "1px 5px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
                                  Active
                                </span>
                              ) : (
                                <span className="muted small">{v.catalogStatus === "pending_review" ? "Draft" : "Setup needed"}</span>
                              )}
                            </div>
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
                            {billingOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span>Billing: {billingLabel(v.routingClass, v.sellingEntity)}</span>
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
                            <div style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 12 }}>
                              <span style={{ color: "#16a34a", fontWeight: 700 }}>Discount:</span>
                              <select
                                aria-label="Discount type"
                                value={activeEdit.discountType || "flat"}
                                onChange={(e) => updateRowEdit({ discountType: e.target.value as "flat" | "percent" })}
                                style={{ padding: "2px 4px", fontSize: 11, borderRadius: 4, border: "1px solid #cbd5e1", background: "#fff", color: "#16a34a", fontWeight: 700 }}
                              >
                                <option value="flat">₹ (Flat)</option>
                                <option value="percent">% (Percentage)</option>
                              </select>
                              <input
                                aria-label="Discount amount"
                                type="number"
                                min="0"
                                max={activeEdit.discountType === "percent" ? "100" : undefined}
                                step="any"
                                value={activeEdit.discount}
                                onChange={(e) => updateRowEdit({ discount: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveRow(v.id);
                                  if (e.key === "Escape") setRowEdit(null);
                                }}
                                style={{ width: 60, padding: "2px 4px", fontSize: 12, textAlign: "right" }}
                                placeholder="0"
                              />
                              <span style={{ color: "#16a34a", fontSize: 10, fontWeight: 700 }}>
                                {activeEdit.discountType === "percent" ? "% OFF" : "OFF"}
                              </span>
                            </div>
                            <select
                              aria-label="Rate basis"
                              value={activeEdit.rateBasis}
                              onChange={(e) => handleRateBasisChange(e.target.value as "case" | "quintal")}
                              style={{ padding: "2px 6px", fontSize: 11 }}
                            >
                              <option value="case">per {activeEdit.outerPack?.toLowerCase() || "bag"}</option>
                              <option value="quintal">per quintal</option>
                            </select>
                            {(() => {
                              const pVal = Number(activeEdit.price);
                              const dVal = Number(activeEdit.discount) || 0;
                              const isP = activeEdit.discountType === "percent";
                              const w = getCaseWeightKg(activeEdit.packSize, activeEdit.unit, activeEdit.unitsPerCase);
                              if (pVal > 0 && dVal > 0) {
                                const ded = isP ? (pVal * dVal) / 100 : dVal;
                                const eff = Math.max(0, pVal - ded);
                                const effPerKg = activeEdit.rateBasis === "quintal" ? eff / 100 : (w > 0 ? eff / w : null);
                                const effEq = activeEdit.rateBasis === "quintal" && w > 0 ? (eff * w) / 100 : null;
                                return (
                                  <div style={{ fontSize: 10, color: "#16a34a", fontWeight: 600, marginTop: 4, textAlign: "right" }}>
                                    After discount: {inr(eff)} / {activeEdit.rateBasis === "quintal" ? "quintal" : (activeEdit.outerPack || "bag").toLowerCase()}
                                    {effPerKg != null ? ` · ${inr(effPerKg)}/kg` : ""}
                                    {effEq != null ? ` · ${inr(effEq)}/${w} KG ${activeEdit.outerPack || "Bag"}` : ""}
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        ) : p.catalogStatus === "pending_review" || v.catalogStatus === "pending_review" ? (
                          <span className="small">
                            {displayPrice == null ? "Not configured" : `${inr(displayPrice)} / ${basis === "quintal" ? "quintal" : pkgType.toLowerCase()}`}
                            {v.discount > 0 && (
                              <span style={{ display: "inline-block", background: "#dcfce7", color: "#16a34a", padding: "1px 5px", borderRadius: 4, fontSize: 10, fontWeight: 700, marginLeft: 4 }}>
                                {v.discountType === "percent" ? `${v.discount}% OFF` : `₹${v.discount} OFF`}
                              </span>
                            )}
                            {perKg != null && (
                              <span style={{ display: "block", fontSize: 11, color: "#1e293b", marginTop: 2 }}>
                                <strong style={{ fontWeight: 800 }}>{inr(perKg)}</strong> / kg
                              </span>
                            )}
                            {equivalent != null && (
                              <span style={{ display: "block", fontSize: 11, color: "#1e293b", marginTop: 1 }}>
                                <strong style={{ fontWeight: 800 }}>{inr(equivalent)}</strong> / {caseWeight} KG {pkgType}
                              </span>
                            )}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="ghost sm"
                            style={{ color: "var(--ink)", fontWeight: 600, textAlign: "right", cursor: "pointer" }}
                            title="Click to edit pack, price, and discount"
                            onClick={() => startEditingRow(p, v)}
                          >
                            <div>
                              {v.discount > 0 && displayPrice != null ? (
                                (() => {
                                  const isPct = v.discountType === "percent";
                                  const deduction = isPct ? (displayPrice * Math.min(100, v.discount)) / 100 : v.discount;
                                  const finalPrice = Math.max(0, displayPrice - deduction);
                                  const badgeText = isPct ? `${v.discount}% OFF` : `₹${v.discount} OFF`;
                                  const basisLabel = basis === "quintal" ? "quintal" : pkgType.toLowerCase();
                                  return (
                                    <>
                                      <div style={{ color: "#0f172a", fontSize: 13, fontWeight: 700 }}>
                                        {inr(finalPrice)} / {basisLabel}
                                      </div>
                                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", alignItems: "center", marginTop: 2 }}>
                                        <span style={{ textDecoration: "line-through", color: "#64748b", fontSize: 11 }}>
                                          {inr(displayPrice)}
                                        </span>
                                        <span style={{ background: "#dcfce7", color: "#16a34a", padding: "1px 4px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                                          {badgeText}
                                        </span>
                                      </div>
                                    </>
                                  );
                                })()
                              ) : (
                                <span>{displayPrice == null ? "Set price" : `${inr(displayPrice)} / ${basis === "quintal" ? "quintal" : pkgType.toLowerCase()}`}</span>
                              )}
                            </div>
                            {perKg != null && (
                              <span style={{ display: "block", fontSize: 11, color: "#1e293b", marginTop: 2 }}>
                                <strong style={{ fontWeight: 800 }}>{inr(perKg)}</strong> / kg
                              </span>
                            )}
                            {equivalent != null && (
                              <span style={{ display: "block", fontSize: 11, color: "#1e293b", marginTop: 1 }}>
                                <strong style={{ fontWeight: 800 }}>{inr(equivalent)}</strong> / {caseWeight} KG {pkgType}
                              </span>
                            )}
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
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                            <button
                              type="button"
                              className="sm"
                              onClick={() => startEditingRow(p, v)}
                            >
                              Edit
                            </button>
                            {v.catalogStatus === "inactive" ? (
                              <button
                                type="button"
                                className="sm secondary"
                                disabled={actionLoadingId === v.id}
                                style={{ color: "#16a34a", borderColor: "#86efac", fontWeight: 600, padding: "3px 8px" }}
                                title="Mark pack active"
                                onClick={() => handleToggleVariantStatus(v)}
                              >
                                Activate
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="sm secondary"
                                disabled={actionLoadingId === v.id}
                                style={{ color: "#d97706", borderColor: "#fde68a", padding: "3px 8px" }}
                                title="Mark pack inactive"
                                onClick={() => handleToggleVariantStatus(v)}
                              >
                                Inactive
                              </button>
                            )}
                            <button
                              type="button"
                              className="sm ghost"
                              disabled={actionLoadingId === v.id}
                              style={{ color: "#dc2626", padding: "3px 6px", fontSize: 14 }}
                              title="Delete pack"
                              onClick={() => setDeletingVariant({ product: p, variant: v })}
                            >
                              🗑
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
                    status: productModal.status,
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
                  <span>Status</span>
                  <select
                    value={productModal.status}
                    onChange={(e) => setProductModal({ ...productModal, status: e.target.value as "active" | "inactive" })}
                    style={{ padding: "8px 12px", borderRadius: 6 }}
                  >
                    <option value="active">Active (Visible in Retailer & Sales apps)</option>
                    <option value="inactive">Inactive (Hidden from apps)</option>
                  </select>
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

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
                <button
                  type="button"
                  className="ghost sm"
                  style={{ color: "#dc2626", fontWeight: 600, padding: "4px 8px" }}
                  onClick={() => {
                    const toDelete = { id: productModal.id, name: productModal.name };
                    setProductModal(null);
                    setDeletingProduct(toDelete);
                  }}
                >
                  🗑 Delete product
                </button>
                <div style={{ display: "flex", gap: 8 }}>
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
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingProduct && (
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
          onClick={() => !actionLoadingId && setDeletingProduct(null)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 460,
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 12px 0", fontSize: 18, color: "#dc2626" }}>Delete Product?</h3>
            <p style={{ margin: "0 0 12px 0", fontSize: 14 }}>
              Are you sure you want to delete <strong>{deletingProduct.name}</strong>?
            </p>
            <p className="muted small" style={{ margin: "0 0 20px 0" }}>
              This will remove this product and all its packs from the catalog. Retailer and Salesperson apps will no longer see this product.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="secondary"
                disabled={Boolean(actionLoadingId)}
                onClick={() => setDeletingProduct(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                style={{ background: "#dc2626", color: "#fff", borderColor: "#dc2626" }}
                disabled={Boolean(actionLoadingId)}
                onClick={confirmDeleteProduct}
              >
                {actionLoadingId === deletingProduct.id ? "Deleting…" : "Delete Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingVariant && (
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
          onClick={() => !actionLoadingId && setDeletingVariant(null)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 460,
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 12px 0", fontSize: 18, color: "#dc2626" }}>Delete Pack / SKU?</h3>
            <p style={{ margin: "0 0 12px 0", fontSize: 14 }}>
              Are you sure you want to delete pack <strong>{deletingVariant.variant.unitSize} × {deletingVariant.variant.unitsPerCase}</strong> from <strong>{deletingVariant.product.name}</strong>?
            </p>
            <p className="muted small" style={{ margin: "0 0 20px 0" }}>
              This pack will be removed from the catalog. Retailers and Sales reps will not be able to order this pack size.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="secondary"
                disabled={Boolean(actionLoadingId)}
                onClick={() => setDeletingVariant(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                style={{ background: "#dc2626", color: "#fff", borderColor: "#dc2626" }}
                disabled={Boolean(actionLoadingId)}
                onClick={confirmDeleteVariant}
              >
                {actionLoadingId === deletingVariant.variant.id ? "Deleting…" : "Delete Pack"}
              </button>
            </div>
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
