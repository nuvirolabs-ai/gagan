import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, inr } from "../api";
import { useAuth } from "../useAuth";

export default function Retailers() {
  const { permissions } = useAuth();
  const canViewFieldHistory = permissions.includes("route.manage");
  const [retailers, setRetailers] = useState<any[]>([]);
  const [tiers, setTiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [expandedHistoryRetailerId, setExpandedHistoryRetailerId] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedExecutionId, setExpandedExecutionId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", shopAddress: "", deliveryCity: "", tierId: "", creditLimit: "" });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [salesReps, setSalesReps] = useState<{ salesRepId: string; name: string; phone: string; territory?: string }[]>([]);
  const [targetRepId, setTargetRepId] = useState("");
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassigning, setReassigning] = useState(false);

  // Gap 8: Full Retailer Profile & KYC Master Editor state
  const [profileModalRetailerId, setProfileModalRetailerId] = useState<string | null>(null);
  const [fullProfileData, setFullProfileData] = useState<any | null>(null);
  const [fullProfileLoading, setFullProfileLoading] = useState(false);
  const [savingFullProfile, setSavingFullProfile] = useState(false);
  const [fullProfileTab, setFullProfileTab] = useState<"details" | "location" | "kyc" | "orders">("details");

  const [profileForm, setProfileForm] = useState({
    storeName: "",
    ownerName: "",
    phone: "",
    address: "",
    pincode: "",
    deliveryCity: "",
    gstin: "",
    pan: "",
    paymentTermsDays: "30",
    creditLimit: "50000",
    tierId: "",
    salesRepId: "",
  });

  const [coordsForm, setCoordsForm] = useState({
    lat: "",
    lng: "",
    reason: "",
  });
  const [savingCoords, setSavingCoords] = useState(false);
  const [kycRejectionReason, setKycRejectionReason] = useState("");
  const [decidingKyc, setDecidingKyc] = useState(false);

  const openFullProfile = async (retailerId: string) => {
    setProfileModalRetailerId(retailerId);
    setFullProfileLoading(true);
    setFullProfileTab("details");
    setError(null);
    try {
      const res = await api.retailerFullProfile(retailerId);
      setFullProfileData(res);
      const r = res.retailer;
      setProfileForm({
        storeName: r.name ?? "",
        ownerName: r.ownerName ?? "",
        phone: r.phone ?? "",
        address: r.shopAddress ?? "",
        pincode: r.pincode ?? "",
        deliveryCity: r.deliveryCity ?? "",
        gstin: r.gstin ?? "",
        pan: r.pan ?? "",
        paymentTermsDays: String(r.paymentTermsDays ?? 30),
        creditLimit: String(r.creditLimit ?? 0),
        tierId: r.tierId ?? tiers[0]?.id ?? "",
        salesRepId: r.salesRepId ?? "",
      });
      setCoordsForm({
        lat: r.lat != null ? String(r.lat) : "",
        lng: r.lng != null ? String(r.lng) : "",
        reason: "",
      });
    } catch (err: any) {
      setError(err.message ?? "Failed to load full retailer profile");
    } finally {
      setFullProfileLoading(false);
    }
  };

  const saveFullProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileModalRetailerId) return;
    setSavingFullProfile(true);
    setError(null);
    try {
      const res = await api.updateRetailerFullProfile(profileModalRetailerId, {
        storeName: profileForm.storeName.trim(),
        ownerName: profileForm.ownerName.trim() || undefined,
        phone: profileForm.phone.trim(),
        address: profileForm.address.trim(),
        pincode: profileForm.pincode.trim() || undefined,
        city: profileForm.deliveryCity.trim() || undefined,
        gstin: profileForm.gstin.trim() || undefined,
        pan: profileForm.pan.trim() || undefined,
        paymentTermsDays: parseInt(profileForm.paymentTermsDays, 10) || 30,
        creditLimit: parseFloat(profileForm.creditLimit) || 0,
        tierId: profileForm.tierId || undefined,
        salesRepId: profileForm.salesRepId || undefined,
      });
      setNotice(res.message ?? "Retailer master profile updated");
      await load();
      await openFullProfile(profileModalRetailerId);
    } catch (err: any) {
      setError(err.message ?? "Failed to update retailer profile");
    } finally {
      setSavingFullProfile(false);
    }
  };

  const saveCoordinates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileModalRetailerId) return;
    setSavingCoords(true);
    setError(null);
    try {
      const res = await api.updateRetailerCoordinates(profileModalRetailerId, {
        lat: parseFloat(coordsForm.lat),
        lng: parseFloat(coordsForm.lng),
        reason: coordsForm.reason.trim() || "Admin pinpoint correction",
      });
      setNotice(res.message ?? "GPS coordinates updated and verified");
      await openFullProfile(profileModalRetailerId);
      await load();
    } catch (err: any) {
      setError(err.message ?? "Failed to update GPS coordinates");
    } finally {
      setSavingCoords(false);
    }
  };

  const handleKycDecision = async (decision: "APPROVE" | "REJECT") => {
    if (!profileModalRetailerId) return;
    if (decision === "REJECT" && !kycRejectionReason.trim()) {
      setError("Please specify a reason for KYC rejection.");
      return;
    }
    setDecidingKyc(true);
    setError(null);
    try {
      const res = await api.decideRetailerKyc(profileModalRetailerId, {
        decision,
        reason: decision === "APPROVE" ? "Approved by Admin" : undefined,
        rejectionReason: decision === "REJECT" ? kycRejectionReason.trim() : undefined,
      });
      setNotice(res.message ?? `KYC status updated to ${decision}D`);
      setKycRejectionReason("");
      await openFullProfile(profileModalRetailerId);
      await load();
    } catch (err: any) {
      setError(err.message ?? "Failed to submit KYC decision");
    } finally {
      setDecidingKyc(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [r, t] = await Promise.all([api.retailers(), api.tiers()]);
      setRetailers(r.retailers);
      setTiers(t.tiers);
      try {
        const s = await api.staff();
        const reps = (s.staff ?? [])
          .filter((member: any) => member.status === "active" && member.salesRepId)
          .map((member: any) => ({
            salesRepId: member.salesRepId,
            name: member.name,
            phone: member.phone,
            territory: member.salesRep?.territory,
          }));
        setSalesReps(reps);
        if (reps.length > 0 && !targetRepId) setTargetRepId(reps[0].salesRepId);
      } catch {
        // Staff listing optional or mocked
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load retailers");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRepId || selectedIds.length === 0) return;
    setReassigning(true);
    setError(null);
    try {
      const result = await api.bulkReassignRetailers(selectedIds, targetRepId);
      setNotice(result.message ?? `Successfully reassigned ${selectedIds.length} retailers.`);
      setSelectedIds([]);
      setShowReassignModal(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to bulk reassign retailers");
    } finally {
      setReassigning(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === retailers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(retailers.map((r) => r.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!canViewFieldHistory) setExpandedHistoryRetailerId(null);
  }, [canViewFieldHistory]);

  useEffect(() => {
    if (!expandedHistoryRetailerId) {
      setHistory([]);
      setExpandedExecutionId(null);
      return;
    }
    let active = true;
    setHistory([]);
    setHistoryLoading(true);
    api.fieldRetailerMarketingHistory(expandedHistoryRetailerId)
      .then((result) => {
        if (active) setHistory(result.executions ?? []);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load retailer activity history");
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => { active = false; };
  }, [expandedHistoryRetailerId]);

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

      {selectedIds.length > 0 && (
        <div
          className="card"
          style={{
            background: "var(--accent-subtle, #f0f7ff)",
            border: "1px solid var(--accent, #0066cc)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
            padding: "12px 18px",
          }}
        >
          <div style={{ fontWeight: 600 }}>
            ✓ {selectedIds.length} of {retailers.length} store(s) selected
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="secondary" onClick={() => setSelectedIds([])}>
              Deselect All
            </button>
            <button type="button" onClick={() => setShowReassignModal(true)}>
              Transfer to Salesperson…
            </button>
          </div>
        </div>
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
                <th style={{ width: 36, textAlign: "center" }}>
                  <input
                    type="checkbox"
                    aria-label="Select all retailers"
                    checked={retailers.length > 0 && selectedIds.length === retailers.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Retailer</th>
                <th>Assigned Rep</th>
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
                <Fragment key={r.id}>
                <tr key={r.id}>
                  <td style={{ width: 36, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.name}`}
                      checked={selectedIds.includes(r.id)}
                      onChange={() => toggleSelectOne(r.id)}
                    />
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div className="muted small">{r.phone}</div>
                    <div className="muted small">Delivery: {r.deliveryCity ?? "Not configured"}</div>
                    {r.commercialStatus?.currentLabel ? <div className="muted small internal-status-inline">{r.commercialStatus.currentLabel}</div> : null}
                  </td>
                  <td>
                    {r.salesRep ? (
                      <div>
                        <span className="pill status-confirmed">{r.salesRep.name}</span>
                      </div>
                    ) : (
                      <span className="small muted">Unassigned</span>
                    )}
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
                      <button className="sm primary" onClick={() => openFullProfile(r.id)}>
                        Profile & KYC
                      </button>
                      <button className="sm secondary" onClick={() => changeLimit(r)}>
                        Limit
                      </button>
                      <button className="sm secondary" onClick={() => changeDeliveryCity(r)}>
                        City
                      </button>
                      {canViewFieldHistory ? (
                        <button
                          className="sm secondary"
                          aria-expanded={expandedHistoryRetailerId === r.id}
                          onClick={() => setExpandedHistoryRetailerId((current) => current === r.id ? null : r.id)}
                        >
                          {expandedHistoryRetailerId === r.id ? "Hide history" : "History"}
                        </button>
                      ) : null}
                      <Link to={`/ledger/${r.id}`}>
                        <button className="sm secondary">Ledger</button>
                      </Link>
                    </div>
                  </td>
                </tr>
                {expandedHistoryRetailerId === r.id ? (
                  <tr key={`${r.id}-history`}>
                    <td colSpan={7} style={{ padding: 16, background: "var(--surface-muted, #f7f8f8)" }}>
                      <div style={{ fontWeight: 650, marginBottom: 10 }}>In-store execution history</div>
                      {historyLoading ? <div className="muted small">Loading activity history…</div> : null}
                      {!historyLoading && history.length === 0 ? <div className="muted small">No task executions with photos recorded.</div> : null}
                      {!historyLoading ? history.map((execution) => {
                        const photosExpanded = expandedExecutionId === execution.task.id;
                        const recordedAt = execution.task.completedAt ?? execution.evidence[0]?.createdAt;
                        return (
                          <div key={execution.task.id} style={{ borderTop: "1px solid var(--border, #dfe3e3)", padding: "10px 0" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                              <div>
                                <div style={{ fontWeight: 600 }}>{execution.task.title}</div>
                                <div className="muted small">
                                  {execution.salesperson?.name ?? "Salesperson"}
                                  {recordedAt ? ` · ${new Date(recordedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                                  {` · ${execution.task.status.replace(/_/g, " ")}`}
                                </div>
                              </div>
                              <button
                                className="sm secondary"
                                aria-expanded={photosExpanded}
                                onClick={() => setExpandedExecutionId(photosExpanded ? null : execution.task.id)}
                              >
                                {photosExpanded ? "Hide photos" : `View photos (${execution.evidence.length})`}
                              </button>
                            </div>
                            {photosExpanded ? (
                              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                                {execution.evidence.map((item: any) => item.signedUrl ? (
                                  <a key={item.id} href={item.signedUrl} target="_blank" rel="noreferrer">
                                    <img
                                      src={item.signedUrl}
                                      alt={`${execution.task.title} evidence`}
                                      loading="lazy"
                                      style={{ display: "block", width: 144, height: 108, objectFit: "contain", borderRadius: 4, background: "var(--surface, white)" }}
                                    />
                                  </a>
                                ) : null)}
                              </div>
                            ) : null}
                          </div>
                        );
                      }) : null}
                    </td>
                  </tr>
                ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showReassignModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div className="card" style={{ width: 480, maxWidth: "90%", background: "#fff", padding: 24, boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
            <h3 style={{ marginTop: 0 }}>Reassign Selected Retailers</h3>
            <p className="page-sub">
              You are reassigning <strong>{selectedIds.length}</strong> store(s) to a new salesperson beat / territory.
            </p>
            <form onSubmit={handleBulkReassign}>
              <div className="field" style={{ marginBottom: 16 }}>
                <label>Target Sales Representative</label>
                <select
                  value={targetRepId}
                  onChange={(e) => setTargetRepId(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px" }}
                  required
                >
                  <option value="" disabled>-- Select Salesperson --</option>
                  {salesReps.map((rep) => (
                    <option key={rep.salesRepId} value={rep.salesRepId}>
                      {rep.name} ({rep.phone}){rep.territory ? ` — ${rep.territory}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  className="secondary"
                  disabled={reassigning}
                  onClick={() => setShowReassignModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" disabled={reassigning || !targetRepId}>
                  {reassigning ? "Reassigning…" : `Confirm Transfer (${selectedIds.length})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Gap 8: Full Retailer Profile & KYC Master Modal Drawer */}
      {profileModalRetailerId && (
        <div
          className="modal-backdrop"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            className="card"
            style={{
              width: 780,
              maxWidth: "94%",
              maxHeight: "92vh",
              overflowY: "auto",
              background: "#fff",
              padding: 24,
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            }}
          >
            {fullProfileLoading ? (
              <div className="muted" style={{ padding: 40, textAlign: "center" }}>
                Loading retailer master profile…
              </div>
            ) : fullProfileData ? (
              <div>
                {/* Header */}
                <div className="between" style={{ borderBottom: "1px solid var(--border, #eee)", paddingBottom: 14, marginBottom: 16 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <h2 style={{ margin: 0, fontSize: 20 }}>{fullProfileData.retailer.name}</h2>
                      {fullProfileData.retailer.kycStatus === "APPROVED" ? (
                        <span className="pill status-confirmed" style={{ fontSize: 12 }}>KYC Approved</span>
                      ) : fullProfileData.retailer.kycStatus === "REJECTED" ? (
                        <span className="pill" style={{ background: "#fee2e2", color: "#991b1b", fontSize: 12 }}>KYC Rejected</span>
                      ) : (
                        <span className="pill" style={{ background: "#fef3c7", color: "#92400e", fontSize: 12 }}>KYC Pending</span>
                      )}
                      <span className="pill" style={{ background: "#f1f5f9", color: "#475569", fontSize: 12 }}>
                        {fullProfileData.retailer.tier?.name ?? "Standard Tier"}
                      </span>
                    </div>
                    <p className="muted small" style={{ margin: "4px 0 0 0" }}>
                      ID: {fullProfileData.retailer.id} · Phone: {fullProfileData.retailer.phone} · City: {fullProfileData.retailer.deliveryCity ?? "Not configured"}
                    </p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => {
                      setProfileModalRetailerId(null);
                      setFullProfileData(null);
                    }}
                    style={{ fontSize: 16, padding: "4px 10px", lineHeight: 1 }}
                  >
                    ✕
                  </button>
                </div>

                {/* Sub-tabs inside modal */}
                <div className="tab-row" style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                  <button
                    type="button"
                    className={fullProfileTab === "details" ? "primary" : "secondary"}
                    onClick={() => setFullProfileTab("details")}
                  >
                    Store Master & Commercials
                  </button>
                  <button
                    type="button"
                    className={fullProfileTab === "location" ? "primary" : "secondary"}
                    onClick={() => setFullProfileTab("location")}
                  >
                    GPS Pinpoint ({fullProfileData.retailer.locationStatus ?? "NOT_SET"})
                  </button>
                  <button
                    type="button"
                    className={fullProfileTab === "kyc" ? "primary" : "secondary"}
                    onClick={() => setFullProfileTab("kyc")}
                  >
                    KYC Documents ({fullProfileData.documents?.length ?? 0})
                  </button>
                  <button
                    type="button"
                    className={fullProfileTab === "orders" ? "primary" : "secondary"}
                    onClick={() => setFullProfileTab("orders")}
                  >
                    Recent Orders ({fullProfileData.recentOrders?.length ?? 0})
                  </button>
                </div>

                {/* SUB-TAB 1: Store Master & Commercials */}
                {fullProfileTab === "details" && (
                  <form onSubmit={saveFullProfile}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                      <div className="field">
                        <label>Store / Firm Name</label>
                        <input
                          value={profileForm.storeName}
                          onChange={(e) => setProfileForm({ ...profileForm, storeName: e.target.value })}
                          required
                        />
                      </div>
                      <div className="field">
                        <label>Owner / Contact Person</label>
                        <input
                          value={profileForm.ownerName}
                          onChange={(e) => setProfileForm({ ...profileForm, ownerName: e.target.value })}
                          placeholder="Proprietor / Managing Partner"
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                      <div className="field">
                        <label>Mobile Number (Login Handle)</label>
                        <input
                          value={profileForm.phone}
                          onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                          required
                        />
                      </div>
                      <div className="field">
                        <label>Verified Delivery City</label>
                        <input
                          value={profileForm.deliveryCity}
                          onChange={(e) => setProfileForm({ ...profileForm, deliveryCity: e.target.value })}
                          placeholder="e.g. Indore"
                        />
                      </div>
                    </div>

                    <div className="field" style={{ marginBottom: 12 }}>
                      <label>Physical Shop / Warehouse Address</label>
                      <input
                        value={profileForm.address}
                        onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                        required
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                      <div className="field">
                        <label>PIN Code</label>
                        <input
                          value={profileForm.pincode}
                          onChange={(e) => setProfileForm({ ...profileForm, pincode: e.target.value })}
                          placeholder="6-digit PIN"
                        />
                      </div>
                      <div className="field">
                        <label>GSTIN (15 chars)</label>
                        <input
                          value={profileForm.gstin}
                          onChange={(e) => setProfileForm({ ...profileForm, gstin: e.target.value.toUpperCase() })}
                          placeholder="23AAAAA0000A1Z5"
                        />
                      </div>
                      <div className="field">
                        <label>PAN (10 chars)</label>
                        <input
                          value={profileForm.pan}
                          onChange={(e) => setProfileForm({ ...profileForm, pan: e.target.value.toUpperCase() })}
                          placeholder="ABCDE1234F"
                        />
                      </div>
                    </div>

                    <h4 style={{ margin: "16px 0 10px 0", borderTop: "1px solid #eee", paddingTop: 14 }}>
                      Commercial & Credit Parameters
                    </h4>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                      <div className="field">
                        <label>Commercial Pricing Tier</label>
                        <select
                          value={profileForm.tierId}
                          onChange={(e) => setProfileForm({ ...profileForm, tierId: e.target.value })}
                        >
                          {tiers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.discountPct > 0 ? `${t.discountPct}% off` : "Standard"})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label>Credit Limit (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={profileForm.creditLimit}
                          onChange={(e) => setProfileForm({ ...profileForm, creditLimit: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                      <div className="field">
                        <label>Payment Terms (Grace Days)</label>
                        <select
                          value={profileForm.paymentTermsDays}
                          onChange={(e) => setProfileForm({ ...profileForm, paymentTermsDays: e.target.value })}
                        >
                          <option value="0">Cash On Delivery (0 Days)</option>
                          <option value="7">7 Days Credit</option>
                          <option value="14">14 Days Credit</option>
                          <option value="21">21 Days Credit</option>
                          <option value="30">30 Days Standard Credit</option>
                          <option value="45">45 Days Extended Credit</option>
                          <option value="60">60 Days Credit</option>
                        </select>
                      </div>
                      <div className="field">
                        <label>Assigned Sales Representative</label>
                        <select
                          value={profileForm.salesRepId}
                          onChange={(e) => setProfileForm({ ...profileForm, salesRepId: e.target.value })}
                        >
                          <option value="">Unassigned</option>
                          {salesReps.map((rep) => (
                            <option key={rep.salesRepId} value={rep.salesRepId}>
                              {rep.name} ({rep.phone}){rep.territory ? ` — ${rep.territory}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setProfileModalRetailerId(null)}
                      >
                        Close
                      </button>
                      <button type="submit" disabled={savingFullProfile}>
                        {savingFullProfile ? "Saving…" : "Save Master Profile"}
                      </button>
                    </div>
                  </form>
                )}

                {/* SUB-TAB 2: Location & GPS Pinpoint */}
                {fullProfileTab === "location" && (
                  <div>
                    <div className="card" style={{ background: "#f8fafc", marginBottom: 16 }}>
                      <div className="between">
                        <div>
                          <strong>Current Coordinates:</strong>{" "}
                          {fullProfileData.retailer.lat != null && fullProfileData.retailer.lng != null ? (
                            <span>{fullProfileData.retailer.lat.toFixed(6)}, {fullProfileData.retailer.lng.toFixed(6)}</span>
                          ) : (
                            <span className="muted">Not set</span>
                          )}
                        </div>
                        <span className={`pill ${fullProfileData.retailer.locationStatus === "VERIFIED" ? "status-confirmed" : ""}`}>
                          {fullProfileData.retailer.locationStatus ?? "NOT_SET"}
                        </span>
                      </div>
                      {fullProfileData.retailer.lat != null && fullProfileData.retailer.lng != null && (
                        <div style={{ marginTop: 8 }}>
                          <a
                            href={`https://maps.google.com/?q=${fullProfileData.retailer.lat},${fullProfileData.retailer.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="small"
                          >
                            Open in Google Maps ↗
                          </a>
                        </div>
                      )}
                    </div>

                    <form onSubmit={saveCoordinates} style={{ borderTop: "1px solid #eee", paddingTop: 14 }}>
                      <h4 style={{ margin: "0 0 10px 0" }}>Update & Verify Pinpoint Coordinates</h4>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                        <div className="field">
                          <label>Latitude</label>
                          <input
                            type="number"
                            step="0.000001"
                            value={coordsForm.lat}
                            onChange={(e) => setCoordsForm({ ...coordsForm, lat: e.target.value })}
                            placeholder="e.g. 22.719568"
                            required
                          />
                        </div>
                        <div className="field">
                          <label>Longitude</label>
                          <input
                            type="number"
                            step="0.000001"
                            value={coordsForm.lng}
                            onChange={(e) => setCoordsForm({ ...coordsForm, lng: e.target.value })}
                            placeholder="e.g. 75.857727"
                            required
                          />
                        </div>
                      </div>
                      <div className="field" style={{ marginBottom: 16 }}>
                        <label>Reason / Verification Reference</label>
                        <input
                          value={coordsForm.reason}
                          onChange={(e) => setCoordsForm({ ...coordsForm, reason: e.target.value })}
                          placeholder="e.g. Field rep store visit verified via storefront photo"
                          required
                        />
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button type="submit" disabled={savingCoords}>
                          {savingCoords ? "Verifying…" : "Save & Verify Coordinates"}
                        </button>
                      </div>
                    </form>

                    {/* Location Audit Trail */}
                    {fullProfileData.locationAudit && fullProfileData.locationAudit.length > 0 && (
                      <div style={{ marginTop: 20 }}>
                        <h4 style={{ margin: "0 0 8px 0" }}>Coordinate Change Audit Log</h4>
                        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                              <th style={{ padding: "6px 8px" }}>Timestamp</th>
                              <th style={{ padding: "6px 8px" }}>Coordinates</th>
                              <th style={{ padding: "6px 8px" }}>Source / Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fullProfileData.locationAudit.map((log: any) => (
                              <tr key={log.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                                <td style={{ padding: "6px 8px" }}>{new Date(log.createdAt).toLocaleString()}</td>
                                <td style={{ padding: "6px 8px", fontFamily: "monospace" }}>{log.lat?.toFixed(5)}, {log.lng?.toFixed(5)}</td>
                                <td style={{ padding: "6px 8px" }}>{log.source}: {log.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* SUB-TAB 3: KYC Documents & Approval */}
                {fullProfileTab === "kyc" && (
                  <div>
                    <div className="card" style={{ background: "#f8fafc", marginBottom: 16 }}>
                      <div className="between">
                        <div>
                          <strong>KYC Status:</strong>{" "}
                          <span className={fullProfileData.retailer.kycStatus === "APPROVED" ? "pill status-confirmed" : "pill"}>
                            {fullProfileData.retailer.kycStatus ?? "NOT_SUBMITTED"}
                          </span>
                        </div>
                        {fullProfileData.retailer.kycRejectionReason && (
                          <div className="small" style={{ color: "var(--danger)" }}>
                            Rejection Note: {fullProfileData.retailer.kycRejectionReason}
                          </div>
                        )}
                      </div>
                    </div>

                    <h4 style={{ margin: "16px 0 8px 0" }}>Submitted Documents & Proofs</h4>
                    {(!fullProfileData.documents || fullProfileData.documents.length === 0) ? (
                      <div className="empty-state" style={{ padding: 16 }}>
                        No KYC document proofs uploaded for this retailer.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
                        {fullProfileData.documents.map((doc: any) => (
                          <div key={doc.id} className="between card" style={{ padding: 10 }}>
                            <div>
                              <strong>{doc.type}</strong>
                              <div className="muted small">Uploaded {new Date(doc.createdAt).toLocaleDateString()}</div>
                            </div>
                            {doc.fileUrl ? (
                              <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="sm button secondary">
                                View Document ↗
                              </a>
                            ) : (
                              <span className="muted small">Reference: {doc.referenceNumber || doc.id}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* KYC Decision Controls */}
                    <div style={{ borderTop: "1px solid #eee", paddingTop: 16 }}>
                      <h4 style={{ margin: "0 0 10px 0" }}>KYC Administrative Decision</h4>
                      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="primary"
                          disabled={decidingKyc || fullProfileData.retailer.kycStatus === "APPROVED"}
                          onClick={() => handleKycDecision("APPROVE")}
                          style={{ background: "var(--green, #16a34a)" }}
                        >
                          {fullProfileData.retailer.kycStatus === "APPROVED" ? "✓ KYC Already Approved" : "Approve KYC & Activate Dispatches"}
                        </button>

                        <div style={{ display: "flex", gap: 8, flex: 1, minWidth: 260 }}>
                          <input
                            placeholder="Reason if rejecting (e.g. invalid GSTIN)"
                            value={kycRejectionReason}
                            onChange={(e) => setKycRejectionReason(e.target.value)}
                            style={{ flex: 1 }}
                          />
                          <button
                            type="button"
                            className="secondary"
                            style={{ color: "var(--danger)" }}
                            disabled={decidingKyc}
                            onClick={() => handleKycDecision("REJECT")}
                          >
                            Reject KYC
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SUB-TAB 4: Recent Orders */}
                {fullProfileTab === "orders" && (
                  <div>
                    {(!fullProfileData.recentOrders || fullProfileData.recentOrders.length === 0) ? (
                      <div className="empty-state" style={{ padding: 20 }}>No orders placed yet.</div>
                    ) : (
                      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
                            <th style={{ padding: "8px 10px" }}>Order ID</th>
                            <th style={{ padding: "8px 10px" }}>Date</th>
                            <th style={{ padding: "8px 10px" }}>Status</th>
                            <th style={{ padding: "8px 10px", textAlign: "right" }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fullProfileData.recentOrders.map((ord: any) => (
                            <tr key={ord.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                              <td style={{ padding: "8px 10px", fontWeight: 600 }}>{ord.orderNumber || ord.id.slice(0, 8)}</td>
                              <td style={{ padding: "8px 10px" }}>{new Date(ord.createdAt).toLocaleDateString()}</td>
                              <td style={{ padding: "8px 10px" }}>
                                <span className="pill status-confirmed">{ord.status}</span>
                              </td>
                              <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>{inr(ord.totalAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

