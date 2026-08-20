import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, inr } from "../api";

export default function Retailers() {
  const [retailers, setRetailers] = useState<any[]>([]);
  const [tiers, setTiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", shopAddress: "", tierId: "", creditLimit: "" });

  const load = async () => {
    setLoading(true);
    try {
      const [r, t] = await Promise.all([api.retailers(), api.tiers()]);
      setRetailers(r.retailers);
      setTiers(t.tiers);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load retailers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const changeTier = async (id: string, tierId: string) => {
    try {
      await api.setTier(id, tierId);
      setNotice("Tier updated — pricing changes on the retailer's next catalog load");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update tier");
    }
  };

  const changeLimit = async (r: any) => {
    const input = window.prompt(`Credit limit for ${r.name}`, String(r.creditLimit));
    if (input == null) return;
    const value = Number(input);
    if (!Number.isFinite(value) || value < 0) {
      setError("Credit limit must be a positive number");
      return;
    }
    try {
      await api.setCreditLimit(r.id, value);
      setNotice(`Credit limit for ${r.name} set to ${inr(value)}`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update credit limit");
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createRetailer({
        name: form.name,
        phone: form.phone,
        shopAddress: form.shopAddress,
        tierId: form.tierId || tiers[0]?.id,
        creditLimit: Number(form.creditLimit) || 0,
      });
      setNotice(`${form.name} onboarded — they can sign in with ${form.phone}`);
      setCreating(false);
      setForm({ name: "", phone: "", shopAddress: "", tierId: "", creditLimit: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create retailer");
    }
  };

  return (
    <div>
      <div className="between" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="page-title">Retailers</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Onboarding, tier assignment and credit limits.
          </p>
        </div>
        <button onClick={() => setCreating((v) => !v)}>
          {creating ? "Cancel" : "Onboard retailer"}
        </button>
      </div>

      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner success">{notice}</div>}

      {creating && (
        <form className="card" onSubmit={create}>
          <h3 style={{ marginTop: 0 }}>New retailer</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field">
              <label>Shop name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Phone (used to sign in)</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                minLength={10}
                maxLength={15}
                required
              />
            </div>
            <div className="field">
              <label>Address</label>
              <input
                value={form.shopAddress}
                onChange={(e) => setForm({ ...form, shopAddress: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Tier</label>
              <select
                value={form.tierId}
                onChange={(e) => setForm({ ...form, tierId: e.target.value })}
              >
                {tiers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Credit limit</label>
              <input
                type="number"
                min={0}
                value={form.creditLimit}
                onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
              />
            </div>
          </div>
          <button type="submit">Create retailer</button>
        </form>
      )}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 22 }} className="muted">
            Loading…
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Retailer</th>
                <th>Tier</th>
                <th className="right">Credit limit</th>
                <th className="right">Outstanding</th>
                <th className="right">Available</th>
                <th className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {retailers.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div className="muted small">{r.phone}</div>
                  </td>
                  <td>
                    <select
                      value={r.tier.id}
                      onChange={(e) => changeTier(r.id, e.target.value)}
                      style={{ width: 120 }}
                    >
                      {tiers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="right">{inr(r.creditLimit)}</td>
                  <td className="right">
                    <div>{inr(r.currentBalance)}</div>
                    {r.overdueAmount > 0 && (
                      <div className="small" style={{ color: "var(--danger)" }}>
                        {inr(r.overdueAmount)} overdue
                      </div>
                    )}
                  </td>
                  <td className="right" style={{ fontWeight: 700, color: "var(--green)" }}>
                    {inr(r.available)}
                  </td>
                  <td className="right">
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button className="sm secondary" onClick={() => changeLimit(r)}>
                        Limit
                      </button>
                      <Link to={`/ledger/${r.id}`}>
                        <button className="sm secondary">Ledger</button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
