import { useEffect, useState } from "react";
import { api, inr } from "../api";

export default function Catalog() {
  const [products, setProducts] = useState<any[]>([]);
  const [tiers, setTiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.products();
      setProducts(res.products);
      setTiers(res.tiers);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load catalog");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const key = (variantId: string, tierId: string) => `${variantId}:${tierId}`;

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
        SKUs and tier pricing. Prices are per case; the invoice rate per kg is derived from case
        weight.
      </p>

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
                      </td>
                      <td className="small">
                        {v.unitSize} × {v.unitsPerCase}
                      </td>
                      <td className="right small muted">{caseWeight} kg</td>
                      {v.prices.map((pr: any) => {
                        const cellKey = key(v.id, pr.tierId);
                        const isEditing = editing === cellKey;
                        return (
                          <td key={pr.tierId} className="right">
                            {isEditing ? (
                              <div className="row" style={{ justifyContent: "flex-end" }}>
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
                                {pr.price == null ? "Set price" : inr(pr.price)}
                                <span className="muted small" style={{ marginLeft: 6 }}>
                                  {pr.price != null && caseWeight > 0
                                    ? `(${inr(pr.price / caseWeight)}/kg)`
                                    : ""}
                                </span>
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
