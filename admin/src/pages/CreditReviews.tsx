import { useEffect, useState } from "react";
import { api } from "../api";

export default function CreditReviews() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const load = async () => {
    try { setProposals((await api.ratingProposals()).proposals); }
    catch (err: any) { setError(err.message); }
  };
  useEffect(() => { void load(); }, []);

  const begin = async (id: string) => {
    if (reason.trim().length < 5) return setError("Add a confirmation reason.");
    try {
      const challenge = await api.requestAdminStepUp();
      setSelected(id); setChallengeId(challenge.challengeId); setError("");
    } catch (err: any) { setError(err.message); }
  };
  const confirm = async () => {
    if (!selected || otp.length !== 6) return;
    try {
      await api.completeAdminStepUp(challengeId, otp);
      await api.confirmRatingProposal(selected, reason.trim());
      setSelected(null); setOtp(""); setReason(""); await load();
    } catch (err: any) { setError(err.message); }
  };

  return <div className="detail-narrow">
    <h1 className="page-title">Credit reviews</h1>
    <p className="page-sub">Evidence-backed rating changes awaiting Credit Team Lead confirmation.</p>
    {error && <div className="alert error">{error}</div>}
    {proposals.length === 0 ? <div className="card empty-state">No rating changes need review.</div> : proposals.map((proposal) =>
      <section className="card" key={proposal.id}>
        <div className="between"><div><strong>{proposal.creditProfile.retailer.name}</strong><p className="muted small">{proposal.trigger.replaceAll("_", " ")}</p></div><h2>{proposal.previousRating} → {proposal.proposedRating}</h2></div>
        <div className="metric-grid"><div className="metric"><div className="metric-label">Average DSO</div><div className="metric-value">{proposal.evidence.averageDso ?? "—"} days</div></div><div className="metric"><div className="metric-label">Clean invoices</div><div className="metric-value">{proposal.evidence.cleanInvoiceCount ?? 0}</div></div></div>
        <label className="field"><span>Confirmation reason</span><input aria-label="Confirmation reason" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        {selected === proposal.id ? <div className="step-up-box"><label className="field"><span>Verification code</span><input aria-label="Verification code" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} /></label><button disabled={otp.length !== 6} onClick={() => void confirm()}>Verify and confirm</button></div> : <button onClick={() => void begin(proposal.id)}>Confirm rating</button>}
      </section>
    )}
  </div>;
}
