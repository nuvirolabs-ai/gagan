import { useEffect, useState } from "react";
import { api } from "../api";

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

  const saveDraft = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor || savingDraft) return;
    const values = new FormData(event.currentTarget);
    const pack = {
      unitSize: String(values.get("unitSize") ?? "").trim(),
      unit: String(values.get("unit") ?? "").trim(),
      unitsPerCase: Number(values.get("unitsPerCase")),
      unitWeightKg: Number(values.get("unitWeightKg")),
    };
    setSavingDraft(true);
    setError(null);
    try {
      if (editor.kind === "create") await api.createProduct({ name: String(values.get("name") ?? "").trim(), category: String(values.get("category") ?? "").trim(), variants: [pack] });
      if (editor.kind === "product") await api.updateProduct(editor.product.id, { name: String(values.get("name") ?? "").trim(), category: String(values.get("category") ?? "").trim() });
      if (editor.kind === "variant") await api.updateVariant(editor.variant.id, pack);
      if (editor.kind === "add") await api.addVariant(editor.product.id, pack);
      setEditor(null);
      setNotice("Draft saved. It is not visible for ordering.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save draft");
    } finally {
      setSavingDraft(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const key = (variantId: string, tierId: string) => `${variantId}:${tierId}`;

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
        <button onClick={() => setEditor({ kind: "create" })}>Create draft</button>
        <a href="/imports">Bulk import</a>
      </div>

      {editor && <section aria-label="Draft editor" style={{ marginBottom: 20 }}>
        <h2>{editor.kind === "create" ? "New product draft" : editor.kind === "product" ? "Edit product draft" : editor.kind === "add" ? "Add draft pack" : "Edit draft pack"}</h2>
        <form key={`${editor.kind}:${editor.product?.id ?? ""}:${editor.variant?.id ?? ""}`} onSubmit={saveDraft}>
          {(editor.kind === "create" || editor.kind === "product") && <div className="row">
            <label>Product name<input name="name" required defaultValue={editor.product?.name ?? ""} /></label>
            <label>Category<input name="category" required defaultValue={editor.product?.category ?? ""} /></label>
          </div>}
          {editor.kind !== "product" && <div className="row">
            <label>Pack size<input name="unitSize" required placeholder="1 kg" defaultValue={editor.variant?.unitSize ?? ""} /></label>
            <label>Unit<select name="unit" defaultValue={editor.variant?.unit ?? "kg"}><option value="kg">kg</option><option value="g">g</option><option value="quintal">quintal</option><option value="pcs">pcs</option></select></label>
            <label>Units per case<input name="unitsPerCase" type="number" min="1" step="1" required defaultValue={editor.variant?.unitsPerCase ?? ""} /></label>
            <label>Weight per unit (kg)<input name="unitWeightKg" type="number" min="0.001" step="0.001" required defaultValue={editor.variant?.unitWeightKg ?? ""} /></label>
          </div>}
          {editor.kind !== "product" && <p className="muted small">Pieces require an explicit measured weight and remain draft-only. Rates, GST, routing and stock are configured separately.</p>}
          <div className="row"><button type="submit" disabled={savingDraft}>{editor.kind === "variant" || editor.kind === "add" ? "Save pack" : "Save draft"}</button><button type="button" className="secondary" onClick={() => setEditor(null)}>Cancel</button></div>
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
                        {p.catalogStatus === "pending_review" && <><div className="muted small">Draft</div><button className="ghost sm" onClick={() => setEditor({ kind: "product", product: p })}>Edit product</button><button className="ghost sm" onClick={() => setEditor({ kind: "add", product: p })}>Add pack</button></>}
                      </td>
                      <td className="small">
                        {v.unitSize} × {v.unitsPerCase}
                        <div className="muted small">Variant ID: <code>{v.id}</code> <button type="button" className="ghost sm" onClick={() => copyId(v.id)}>Copy variant ID</button></div>
                        {v.catalogStatus === "pending_review" && <div><button className="ghost sm" onClick={() => setEditor({ kind: "variant", product: p, variant: v })}>Edit draft</button></div>}
                        {v.sellingEntity && <div><a href="/commercial">Edit company, rate basis & GST</a></div>}
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
                            {p.catalogStatus === "pending_review" || v.catalogStatus === "pending_review" ? (
                              <span className="muted small">{pr.price == null ? "Not configured" : `${inr(pr.price)} / ${basis}`}</span>
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
    </div>
  );
}
