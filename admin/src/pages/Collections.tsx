import { useEffect, useState } from "react";
import { api, inr } from "../api";

type Submission = {
  id: string;
  amount: number | string;
  method: string;
  reference?: string | null;
  submittedAt: string;
  retailer: { name: string; phone: string };
  evidence?: Array<{ signedUrl: string | null; contentType: string }>;
};

export default function Collections() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [reason, setReason] = useState("");
  const [pendingAction, setPendingAction] = useState<"confirm" | "reject" | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    try { setSubmissions((await api.collections()).submissions); setError(""); }
    catch (err: any) { setError(err.message); }
  };
  useEffect(() => { void load(); }, []);

  const begin = async (action: "confirm" | "reject") => {
    if (!selected || (action === "reject" && reason.trim().length < 3)) {
      setError(action === "reject" ? "Add a rejection reason." : "Select a collection.");
      return;
    }
    try {
      const challenge = await api.requestAdminStepUp();
      setChallengeId(challenge.challengeId); setOtp(""); setPendingAction(action); setError("");
    } catch (err: any) { setError(err.message); }
  };

  const verify = async () => {
    if (!selected || !pendingAction || otp.length !== 6) return;
    try {
      await api.completeAdminStepUp(challengeId, otp);
      if (pendingAction === "confirm") await api.confirmCollection(selected.id);
      else await api.rejectCollection(selected.id, reason.trim());
      setSelected(null); setPendingAction(null); setChallengeId(""); setReason(""); await load();
    } catch (err: any) { setError(err.message); }
  };

  return <div>
    <h1 className="page-title">Collections</h1>
    <p className="page-sub">Verify field evidence before anything reaches the financial ledger.</p>
    {error && <div className="alert error">{error}</div>}
    <div className="approval-layout">
      <section className="card approval-list">
        {submissions.length === 0 ? <div className="empty-state">No collections waiting for Accounts.</div> : submissions.map((item) => <button className={`approval-row ${selected?.id === item.id ? "selected" : ""}`} key={item.id} onClick={() => { setSelected(item); setPendingAction(null); setReason(""); }}><span><strong>{item.retailer.name}</strong><small>{item.method.toUpperCase()} · {new Date(item.submittedAt).toLocaleString("en-IN")}</small></span><strong>{inr(Number(item.amount))}</strong></button>)}
      </section>
      <section className="card approval-detail">
        {!selected ? <div className="empty-state">Select a collection to review its evidence.</div> : <>
          <div className="muted small">{selected.retailer.name} · {selected.retailer.phone}</div>
          <h2>{inr(Number(selected.amount))} · {selected.method.toUpperCase()}</h2>
          <p className="muted">Reference: {selected.reference || "Not supplied"}</p>
          {selected.evidence?.length ? <div className="reason-list">{selected.evidence.map((e, index) => <div className="reason-card" key={`${e.contentType}-${index}`}>{e.signedUrl ? <a href={e.signedUrl} target="_blank" rel="noreferrer">Open receipt evidence</a> : <span>Receipt evidence unavailable</span>}<span className="muted small"> · {e.contentType}</span></div>)}</div> : <div className="reason-card">No uploaded evidence. Request a receipt before confirming.</div>}
          <label className="field"><span>Rejection reason (only for reject)</span><textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          {!pendingAction ? <div className="approval-actions"><button className="danger-outline" onClick={() => void begin("reject")}>Reject</button><button onClick={() => void begin("confirm")}>Confirm collection</button></div> : <div className="step-up-box"><strong>Verify this sensitive action</strong><p>Enter the six-digit code sent to your registered phone.</p><label className="field"><span>Verification code</span><input inputMode="numeric" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} /></label><button disabled={otp.length !== 6} onClick={() => void verify()}>Verify and {pendingAction}</button></div>}
        </>}
      </section>
    </div>
  </div>;
}
