import { useEffect, useState } from "react";
import { api } from "../api";

export default function CreditReviews() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [comparisons, setComparisons] = useState<any[]>([]);
  const [kycPending, setKycPending] = useState<any[]>([]);
  const [kycSelected, setKycSelected] = useState<string | null>(null);
  const [kycEvidence, setKycEvidence] = useState("");
  const [kycReason, setKycReason] = useState("");
  const [kycChallengeId, setKycChallengeId] = useState("");
  const [kycOtp, setKycOtp] = useState("");
  const load = async () => {
    try {
      const [ratingResult, shadowResult, kycResult] = await Promise.all([
        api.ratingProposals(), api.shadowComparisons(), api.kycPending(),
      ]);
      setProposals(ratingResult.proposals);
      setComparisons(shadowResult.comparisons);
      setKycPending(kycResult.profiles);
    }
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

  const beginKyc = async (retailerId: string) => {
    if (kycEvidence.trim().length < 3 || kycReason.trim().length < 5) {
      return setError("Add the KYC evidence reference and confirmation reason.");
    }
    try {
      const challenge = await api.requestAdminStepUp();
      setKycSelected(retailerId); setKycChallengeId(challenge.challengeId); setError("");
    } catch (err: any) { setError(err.message); }
  };
  const confirmKyc = async () => {
    if (!kycSelected || kycOtp.length !== 6) return;
    try {
      await api.completeAdminStepUp(kycChallengeId, kycOtp);
      await api.confirmKyc(kycSelected, kycEvidence.trim(), kycReason.trim());
      setKycSelected(null); setKycChallengeId(""); setKycOtp(""); setKycEvidence(""); setKycReason(""); await load();
    } catch (err: any) { setError(err.message); }
  };

  return <div className="detail-narrow">
    <h1 className="page-title">Credit reviews</h1>
    <p className="page-sub">Evidence-backed rating changes awaiting Credit Team Lead confirmation.</p>
    {error && <div className="alert error">{error}</div>}
    {kycPending.length > 0 ? <section className="card">
      <h2>KYC confirmation</h2>
      <p className="muted small">Confirm submitted evidence before the retailer's first dispatch.</p>
      <select value={kycSelected ?? ""} onChange={(event) => setKycSelected(event.target.value || null)}>
        <option value="">Select retailer</option>
        {kycPending.map((profile) => <option key={profile.retailerId} value={profile.retailerId}>{profile.retailer.name} · {profile.retailer.phone}</option>)}
      </select>
      <label className="field"><span>Evidence reference</span><input value={kycEvidence} onChange={(event) => setKycEvidence(event.target.value)} placeholder="Document or case reference" /></label>
      <label className="field"><span>Confirmation reason</span><input value={kycReason} onChange={(event) => setKycReason(event.target.value)} /></label>
      {kycChallengeId && kycSelected ? <div className="step-up-box"><label className="field"><span>Verification code</span><input maxLength={6} value={kycOtp} onChange={(event) => setKycOtp(event.target.value.replace(/\D/g, ""))} /></label><button disabled={kycOtp.length !== 6} onClick={() => void confirmKyc()}>Verify KYC</button></div> : <button disabled={!kycSelected} onClick={() => kycSelected && void beginKyc(kycSelected)}>Confirm KYC evidence</button>}
    </section> : null}
    {proposals.length === 0 ? <div className="card empty-state">No rating changes need review.</div> : proposals.map((proposal) =>
      <section className="card" key={proposal.id}>
        <div className="between"><div><strong>{proposal.creditProfile.retailer.name}</strong><p className="muted small">{proposal.trigger.replaceAll("_", " ")}</p></div><h2>{proposal.previousRating} → {proposal.proposedRating}</h2></div>
        <div className="metric-grid"><div className="metric"><div className="metric-label">Average DSO</div><div className="metric-value">{proposal.evidence.averageDso ?? "—"} days</div></div><div className="metric"><div className="metric-label">Clean invoices</div><div className="metric-value">{proposal.evidence.cleanInvoiceCount ?? 0}</div></div></div>
        <label className="field"><span>Confirmation reason</span><input aria-label="Confirmation reason" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        {selected === proposal.id ? <div className="step-up-box"><label className="field"><span>Verification code</span><input aria-label="Verification code" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} /></label><button disabled={otp.length !== 6} onClick={() => void confirm()}>Verify and confirm</button></div> : <button onClick={() => void begin(proposal.id)}>Confirm rating</button>}
      </section>
    )}
    {comparisons.length > 0 ? <><h2>Shadow-mode mismatches</h2><p className="page-sub">Legacy and policy decisions differed. Export is available from the CSV endpoint.</p>{comparisons.map((item) => <div className="card between" key={item.id}><div><strong>{item.retailer.name}</strong><div className="muted small">Legacy {item.legacyResult} · Engine {item.engineResult}</div></div><span className="pill status-suspended">Review</span></div>)}</> : null}
  </div>;
}
