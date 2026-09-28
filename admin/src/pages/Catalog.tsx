import { useEffect, useState } from "react";
import { ApiError, api } from "../api";
import { buildDraftPack, caseWeightKg, humanizePackFailure, massPreview, parseStoredPack, type DraftPackFields } from "../draftPackForm";
import OrderingSetupPanel from "./OrderingSetupPanel";

const inr = (value: number) => `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const visibleStatus = (status?: string) => !status || ["active", "published", "pending_review"].includes(status);
type Editor = { kind: "create" | "product" | "variant" | "add"; product?: any; variant?: any };

export default function Catalog() {
  const [products, setProducts] = useState<any[]>([]);
  const [tiers, setTiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [setupVariantId, setSetupVariantId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<any>(null);
  const [outerPack, setOuterPack] = useState<"Bag" | "Box">("Bag");
  const [fieldErrors, setFieldErrors] = useState<DraftPackFields>({});
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

  const key = (variantId: string, tierId: string) => `${variantId}:${tierId}`;

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

  const save = async (variantId: string, tierId: string) => {
    const value = Number(draft);
    if (!Number.isFinite(value) || value < 0) {
      setError("Price must be a positive number");
      return;
    }
    try {
      await api.setPrice(tierId, variantId, value);
      setNotice("Price updated — retailers on this tier see it on next catalog load");
      setEditing(null);
      setError(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update price");
    }
  };

  return (
    <div>
      <h1 className="page-title">Catalog</h1>
      <p className="page-sub">
        Rates show their stored basis. Kilogram and case equivalents are derived from the configured pack weight. GST and freight are calculated in the commercial quote.
      </p>

      <div className="row" style={{ marginBottom: 16 }}>
        <button onClick={() => setEditor({ kind: "create" })}>Add product</button>
        <a href="/imports">Bulk import</a>
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

      {editor && <section aria-label="Draft editor" style={{ marginBottom: 20 }}>
        <h2>{editor.kind === "create" ? "New product draft" : editor.kind === "product" ? "Edit product draft" : editor.kind === "add" ? "Add draft pack" : "Edit draft pack"}</h2>
        <form key={editorKey} noValidate onSubmit={saveDraft}>
          {(editor.kind === "create" || editor.kind === "product") && <div className="row">
            <label>Product name<input name="name" required defaultValue={editor.product?.name ?? ""} /></label>
            <label>Brand<input name="brandName" list="catalog-brand-options" required defaultValue={editor.product?.catalogIdentityBrand ?? "Gagan"} /></label>
            <datalist id="catalog-brand-options"><option value="Gagan" /><option value="Laxmi" /></datalist>
            <label>Product group<input name="groupName" required defaultValue={editor.product?.catalogIdentityGroup ?? ""} /></label>
            <label>Category<input name="category" required defaultValue={editor.product?.category ?? ""} /></label>
            <label>Image URL<input name="imageUrl" type="url" defaultValue={editor.product?.imageUrl ?? ""} /></label>
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
                <th>Product</th>
                <th>Case</th>
                <th className="right">Case weight</th>
                {tiers.map((t) => (
                  <th key={t.id} className="right">
                    {t.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.flatMap((p) =>
                p.variants.map((v: any) => {
                  const caseWeight = v.unitWeightKg * v.unitsPerCase;
                  return (
                    <tr key={v.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        <div className="muted small">{p.category}</div>
                        <div className="muted small">Product ID: <code>{p.id}</code> <button type="button" className="ghost sm" onClick={() => copyId(p.id)}>Copy product ID</button></div>
                        {p.catalogStatus === "pending_review" && <><div className="muted small">Draft</div><button className="ghost sm" onClick={() => setEditor({ kind: "product", product: p })}>Edit product</button></>}
                        {["pending_review", "published", "active"].includes(p.catalogStatus) && <button className="ghost sm" onClick={() => setEditor({ kind: "add", product: p })}>Add pack</button>}
                      </td>
                      <td className="small">
                        {v.unitSize} × {v.unitsPerCase}
                        <div className="muted small">{v.catalogStatus === "active" ? "Ordering enabled" : v.catalogStatus === "pending_review" ? "Draft" : v.catalogStatus === "published" ? "Published" : "Setup needed"}</div>
                        {v.catalogStatus === "published" && <div className="muted small">Ordering setup pending</div>}
                        <div className="muted small">{v.stock?.status === "in_stock" ? `In stock · ${v.stock.available} available` : v.stock?.status === "out_of_stock" ? "Out of stock" : "Stock needs verification"}</div>
                        <div className="muted small">{v.gstPercent != null ? `GST ${v.gstPercent}% configured` : v.gstPending ? "GST pending exception" : "GST pending"}</div>
                        {v.catalogStatus === "pending_review" && !v.catalogKey
                          ? <button type="button" className="sm" onClick={() => { setPublishing({ product: p, variant: v }); setOuterPack("Bag"); }}>Publish catalogue</button>
                          : <button type="button" className="sm" onClick={() => setSetupVariantId(v.id)}>{v.catalogStatus === "active" ? "Manage setup" : "Set up ordering"}</button>}
                        <div className="muted small">Variant ID: <code>{v.id}</code> <button type="button" className="ghost sm" onClick={() => copyId(v.id)}>Copy variant ID</button></div>
                        {v.catalogStatus === "pending_review" && <div><button className="ghost sm" onClick={() => setEditor({ kind: "variant", product: p, variant: v })}>Edit draft</button></div>}
                      </td>
                      <td className="right small muted">{caseWeight} kg</td>
                      {v.prices.map((pr: any) => {
                        const basis = pr.rateBasis ?? "case";
                        const perKg = pr.price == null ? null : basis === "quintal" ? pr.price / 100 : caseWeight > 0 ? pr.price / caseWeight : null;
                        const equivalent = pr.price != null && caseWeight > 0 && basis === "quintal" ? Math.round(pr.price * caseWeight) / 100 : null;
                        const cellKey = key(v.id, pr.tierId);
                        const isEditing = editing === cellKey;
                        return (
                          <td key={pr.tierId} className="right">
                            {p.catalogStatus === "pending_review" || v.catalogStatus === "pending_review" || v.catalogKey ? (
                              <span className="small">{pr.price == null ? "Not configured" : `${inr(pr.price)} / ${basis}`}{perKg != null && <span className="muted small" style={{ display: "block" }}>{inr(perKg)} / kg</span>}{equivalent != null && <span className="muted small" style={{ display: "block" }}>{inr(equivalent)} / {caseWeight} KG case</span>}</span>
                            ) : isEditing ? (
                              <div className="row" style={{ justifyContent: "flex-end" }}>
                                <span className="small">INR / {basis}</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={draft}
                                  autoFocus
                                  style={{ width: 96 }}
                                  onChange={(e) => setDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") save(v.id, pr.tierId);
                                    if (e.key === "Escape") setEditing(null);
                                  }}
                                />
                                <button className="sm" onClick={() => save(v.id, pr.tierId)}>
                                  Save
                                </button>
                              </div>
                            ) : (
                              <button
                                className="ghost sm"
                                style={{ color: "var(--ink)", fontWeight: 600 }}
                                onClick={() => {
                                  setEditing(cellKey);
                                  setDraft(pr.price == null ? "" : String(pr.price));
                                }}
                              >
                                <span>{pr.price == null ? "Set price" : `${inr(pr.price)} / ${basis}`}</span>
                                {perKg != null && <span className="muted small" style={{ display: "block" }}>{inr(perKg)} / kg</span>}
                                {equivalent != null && <span className="muted small" style={{ display: "block" }}>{inr(equivalent)} / {caseWeight} KG case</span>}
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
      {setupVariantId && <OrderingSetupPanel variantId={setupVariantId} onClose={() => setSetupVariantId(null)} onSaved={async (enabled, alreadyEnabled, label) => { await load(); setNotice(enabled ? `${alreadyEnabled ? "Changes saved" : "Ordering enabled"} for ${label}. Retailer eligibility, applicable price and current stock still apply.` : `Setup draft saved for ${label}. Ordering remains unchanged.`); }} />}
    </div>
  );
}
