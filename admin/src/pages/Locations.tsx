import { useEffect, useState } from "react";
import { api } from "../api";

const STATUS_LABEL: Record<string, string> = { NOT_SET: "Not set", CAPTURED: "Captured", VERIFIED: "Verified", NEEDS_REVIEW: "Needs review" };

export default function Locations() {
  const [locations, setLocations] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [form, setForm] = useState({ latitude: "", longitude: "", accuracyMeters: "" });

  const load = async () => {
    try { const result = await api.locations(); setLocations(result.locations ?? []); setError(null); } catch (err) { setError(err instanceof Error ? err.message : "Could not load locations"); }
  };
  useEffect(() => { void load(); }, []);

  const open = async (location: any) => {
    setSelected(location);
    setForm({ latitude: location.latitude == null ? "" : String(location.latitude), longitude: location.longitude == null ? "" : String(location.longitude), accuracyMeters: location.accuracyMeters == null ? "" : String(location.accuracyMeters) });
    try { const result = await api.locationHistory(location.retailerId); setHistory(result.history ?? []); } catch { setHistory([]); }
  };

  const correct = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !reason.trim()) return setError("A reason is required for every admin correction.");
    try {
      await api.correctLocation(selected.retailerId, { latitude: Number(form.latitude), longitude: Number(form.longitude), accuracyMeters: Number(form.accuracyMeters), reason: reason.trim() });
      setReason(""); await load(); const refreshed = (await api.location(selected.retailerId)).location; await open(refreshed);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not correct location"); }
  };

  return <div>
    <h1 className="page-title">Store locations</h1>
    <p className="page-sub">Foreground captures only. Existing retailers remain not set until someone confirms a reading.</p>
    {error && <div className="banner error">{error}</div>}
    <div className="card" style={{ padding: 0 }}>
      {locations.length === 0 ? <div className="empty-state">No location records yet.</div> : <table><thead><tr><th>Retailer</th><th>Status</th><th>Captured by</th><th>Accuracy</th><th>Updated</th><th /></tr></thead><tbody>{locations.map((location) => <tr key={location.id}><td><strong>{location.retailer?.name ?? location.retailerId}</strong><div className="muted small">{location.retailer?.shopAddress}</div></td><td><span className={`pill ${location.status === "VERIFIED" ? "confirmed" : ""}`}>{STATUS_LABEL[location.status] ?? location.status}</span></td><td className="small">{location.capturedByUserId ?? "—"}</td><td>{location.accuracyMeters == null ? "—" : `±${Math.round(Number(location.accuracyMeters))} m`}</td><td className="small">{new Date(location.updatedAt).toLocaleString("en-IN")}</td><td className="right"><button className="sm secondary" onClick={() => void open(location)}>View history</button></td></tr>)}</tbody></table>}
    </div>
    {selected && <div className="card detail-narrow"><div className="between"><div><h2 className="section-title">{selected.retailer?.name ?? selected.retailerId}</h2><p className="section-copy">{STATUS_LABEL[selected.status] ?? selected.status} · version {selected.locationVersion}</p></div><button className="sm secondary" onClick={() => setSelected(null)}>Close</button></div><p className="small muted">Coordinates: {selected.latitude ?? "—"}, {selected.longitude ?? "—"}. Verified by: {selected.verifiedByUserId ?? "—"}.</p><h3 className="section-title">Location history</h3>{history.length === 0 ? <p className="muted">No history yet.</p> : <div className="role-list">{history.map((item) => <div className="role-row" key={item.id}><div><strong>Version {item.version}</strong><div className="small muted">{STATUS_LABEL[item.status] ?? item.status} · {item.source} · {new Date(item.createdAt).toLocaleString("en-IN")}</div><div className="small muted">{item.reasonForChange ?? "No reason recorded"}</div></div><span className="small">{item.latitude == null ? "Status only" : `${item.latitude}, ${item.longitude}`}</span></div>)}</div>}<h3 className="section-title">Admin correction</h3><form onSubmit={correct} className="form-grid"><div className="field"><label>Latitude</label><input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} required /></div><div className="field"><label>Longitude</label><input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} required /></div><div className="field"><label>Accuracy metres</label><input value={form.accuracyMeters} onChange={(e) => setForm({ ...form, accuracyMeters: e.target.value })} required /></div><div className="field"><label>Reason (required)</label><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Store moved" required /></div><button type="submit">Save for review</button></form></div>}
  </div>;
}
