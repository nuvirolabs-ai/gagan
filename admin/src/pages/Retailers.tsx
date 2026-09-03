import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, inr } from "../api";

export default function Retailers() {
  const [retailers, setRetailers] = useState<any[]>([]);
  const [tiers, setTiers] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", shopAddress: "", tierId: "", creditLimit: "" });
  const [reason, setReason] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [pendingDecision, setPendingDecision] = useState<"approved" | "rejected" | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [r, t, p] = await Promise.all([
        api.retailers().catch(() => ({ retailers: [] })),
        api.tiers().catch(() => ({ tiers: [] })),
        api.retailerProposals().catch(() => ({ proposals: [] })),
      ]);
      setRetailers(r.retailers);
      setTiers(t.tiers);
      setProposals(p.proposals ?? []);
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

  const beginProposal = async (next: "approved" | "rejected") => {
    if (next === "rejected" && reason.trim().length < 5) {
      setError("Add a review reason (at least 5 characters).");
      return;
    }
    try {
      const challenge = await api.requestAdminStepUp();
      setChallengeId(challenge.challengeId);
      setOtp("");
      setPendingDecision(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start verification");
    }
  };

  const verifyProposal = async () => {
    if (!selectedProposal || !pendingDecision || otp.length !== 6) return;
    try {
      await api.completeAdminStepUp(challengeId, otp);
      if (pendingDecision === "approved") {
        await api.approveRetailerProposal(selectedProposal.id, reason.trim() || "Approved");
        setNotice(`${selectedProposal.partyName} is now a retailer.`);
      } else {
        await api.rejectRetailerProposal(selectedProposal.id, reason.trim());
        setNotice(`${selectedProposal.partyName} was rejected.`);
      }
      setSelectedProposal(null);
      setPendingDecision(null);
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not decide proposal");
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

      {proposals.length > 0 && (
        <section className="card" style={{ marginBottom: 18 }}>
          <h3 style={{ marginTop: 0 }}>Pending retailer proposals</h3>
          <div className="approval-layout">
            <div className="approval-list">
              {proposals.map((proposal) => (
                <button
                  key={proposal.id}
                  className={`approval-row ${selectedProposal?.id === proposal.id ? "selected" : ""}`}
                  onClick={() => { setSelectedProposal(proposal); setPendingDecision(null); setReason(""); }}
                >
                  <span>
                    <strong>{proposal.partyName}</strong>
                    <small>{proposal.mobile} · {proposal.deliveryCity} · Grade {proposal.grade}</small>
                  </span>
                </button>
              ))}
            </div>
            <div className="approval-detail">
              {!selectedProposal ? <div className="empty-state">Select a proposal to review the 24 fields.</div> : (
                <>
                  <h2>{selectedProposal.partyName}</h2>
                  <dl className="muted small" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>Group: {selectedProposal.group?.name}</div>
                    <div>Contact: {selectedProposal.contactPerson}</div>
                    <div>Mobile: {selectedProposal.mobile}</div>
                    <div>Telephone: {selectedProposal.telephone || "—"}</div>
                    <div>Transporter: {selectedProposal.transporter?.name}</div>
                    <div>Address: {selectedProposal.address1}</div>
                    <div>PIN: {selectedProposal.pin || "—"}</div>
                    <div>Tehsil: {selectedProposal.tehsil || "—"}</div>
                    <div>District: {selectedProposal.district || "—"}</div>
                    <div>State: {selectedProposal.state || "—"}</div>
                    <div>Delivery city: {selectedProposal.deliveryCity}</div>
                    <div>Salesman: {selectedProposal.salesman?.name}</div>
                    <div>Beat: {selectedProposal.beat?.name || "—"}</div>
                    <div>Tenure: {selectedProposal.shopTenureYears} years</div>
                    <div>GSTIN: {selectedProposal.gstin || "—"}</div>
                    <div>Aadhaar: {selectedProposal.aadhaarNumber}</div>
                    <div>Aadhaar photo: {selectedProposal.aadhaarPhoto ? "Attached" : "Missing"}</div>
                    <div>Payment terms: {selectedProposal.paymentTermDays} days</div>
                    <div>Credit limit: {inr(Number(selectedProposal.creditLimit))}</div>
                    <div>Grade: {selectedProposal.grade}</div>
                    <div>Category: {selectedProposal.buyerCategory?.name}</div>
                    <div>Sub category: {selectedProposal.buyerSubCategory?.name || "—"}</div>
                    <div>UPI: {selectedProposal.upiId || "—"}</div>
                  </dl>
                  <label className="field"><span>Review reason</span><textarea aria-label="Review reason" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
                  {!pendingDecision ? (
                    <div className="approval-actions">
                      <button className="danger-outline" onClick={() => void beginProposal("rejected")}>Reject</button>
                      <button onClick={() => void beginProposal("approved")}>Approve retailer</button>
                    </div>
                  ) : (
                    <div className="step-up-box">
                      <strong>Verify this sensitive action</strong>
                      <label className="field"><span>Six-digit code</span><input aria-label="Six-digit code" inputMode="numeric" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} /></label>
                      <button disabled={otp.length !== 6} onClick={() => void verifyProposal()}>Verify and {pendingDecision === "approved" ? "approve" : "reject"}</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      )}

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
                    <div className="muted small">{r.phone}{r.deliveryCity ? ` · ${r.deliveryCity}` : ""}{r.grade ? ` · Grade ${r.grade}` : ""}{r.group?.name ? ` · ${r.group.name}` : ""}</div>
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
