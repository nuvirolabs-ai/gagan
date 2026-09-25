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
  const [form, setForm] = useState({ name: "", phone: "", shopAddress: "", deliveryCity: "", tierId: "", creditLimit: "" });

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

  const changeInternalSegment = async (r: any, value: string) => {
    try {
      await api.setInternalSegment(r.id, value ? (value as "A" | "B" | "C") : null);
      setNotice(value ? `${r.name} assigned to internal segment ${value}` : `Internal segment cleared for ${r.name}`);
      setError(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update internal segment");
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

  const changeDeliveryCity = async (r: any) => {
    const input = window.prompt(`Verified delivery city for ${r.name}`, r.deliveryCity ?? "");
    if (input == null) return;
    if (input.trim().length < 2) {
      setError("Delivery city is required for routed commercial quotes");
      return;
    }
    try {
      await api.setDeliveryCity(r.id, input.trim());
      setNotice(`Delivery city for ${r.name} updated`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update delivery city");
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createRetailer({
        name: form.name,
        phone: form.phone,
        shopAddress: form.shopAddress,
        ...(form.deliveryCity.trim() ? { deliveryCity: form.deliveryCity.trim() } : {}),
        tierId: form.tierId || tiers[0]?.id,
        creditLimit: Number(form.creditLimit) || 0,
      });
      setNotice(`${form.name} onboarded — they can sign in with ${form.phone}`);
      setCreating(false);
      setForm({ name: "", phone: "", shopAddress: "", deliveryCity: "", tierId: "", creditLimit: "" });
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
            Onboarding, commercial tiers, internal segments and credit limits.
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
              <label>Delivery city (routing input)</label>
              <input
                value={form.deliveryCity}
                placeholder="Use the verified destination city"
                onChange={(e) => setForm({ ...form, deliveryCity: e.target.value })}
              />
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
                <th>Commercial tier</th>
                <th>Internal segment</th>
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
                    <div className="muted small">Delivery: {r.deliveryCity ?? "Not configured"}</div>
                    {r.commercialStatus?.currentLabel ? <div className="muted small internal-status-inline">{r.commercialStatus.currentLabel}</div> : null}
                  </td>
                  <td>
                    <select
                      value={r.tier.id}
                      onChange={(e) => changeTier(r.id, e.target.value)}
                      aria-label={`Commercial pricing tier for ${r.name}`}
                      style={{ width: 120 }}
                    >
                      {tiers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={r.internalSegment ?? ""}
                      onChange={(e) => void changeInternalSegment(r, e.target.value)}
                      aria-label={`Internal segment for ${r.name}`}
                      style={{ width: 120 }}
                    >
                      <option value="">Unassigned</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
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
                      <button className="sm secondary" onClick={() => changeDeliveryCity(r)}>
                        City
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
