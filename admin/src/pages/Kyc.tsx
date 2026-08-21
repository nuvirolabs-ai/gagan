import { useEffect, useState } from "react";
import { api } from "../api";

const DOCUMENTS = [
  ["business_registration", "Business registration"],
  ["identity_proof", "Identity proof"],
  ["address_proof", "Address proof"],
] as const;

function readAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.readAsDataURL(file);
  });
}

export default function Kyc() {
  const [cases, setCases] = useState<any[]>([]);
  const [retailers, setRetailers] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [retailerId, setRetailerId] = useState("");
  const [reason, setReason] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [pending, retailerResult] = await Promise.all([api.kycCases(), api.retailers()]);
      setCases(pending.cases);
      setRetailers(retailerResult.retailers);
      setError("");
    } catch (err: any) { setError(err.message); }
  };
  useEffect(() => { void load(); }, []);

  const start = async () => {
    if (!retailerId) return;
    setBusy(true);
    try {
      const result = await api.startKyc(retailerId);
      setSelected(result.kycCase); setRetailerId(""); setError("");
    } catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };

  const upload = async (type: string, file: File | undefined) => {
    if (!selected || !file) return;
    setBusy(true);
    try {
      const bodyBase64 = await readAsBase64(file);
      const result = await api.uploadKycDocument(selected.id, { type, contentType: file.type, bodyBase64 });
      setSelected(result.document ? await api.kycCase(selected.id).then((r) => r.kycCase) : selected);
      setError("");
    } catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };

  const submit = async () => {
    if (!selected) return;
    setBusy(true);
    try { const result = await api.submitKyc(selected.id); setSelected(result.kycCase); await load(); }
    catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };

  const beginReview = async (next: "approve" | "reject") => {
    if (!selected || reason.trim().length < 5) return setError("Add a review reason (at least 5 characters).");
    try { const challenge = await api.requestAdminStepUp(); setChallengeId(challenge.challengeId); setOtp(""); setAction(next); setError(""); }
    catch (err: any) { setError(err.message); }
  };

  const review = async () => {
    if (!selected || !action || otp.length !== 6) return;
    setBusy(true);
    try {
      await api.completeAdminStepUp(challengeId, otp);
      const result = action === "approve" ? await api.approveKycCase(selected.id, reason.trim()) : await api.rejectKycCase(selected.id, reason.trim());
      setSelected(result.kycCase); setAction(null); setOtp(""); setReason(""); await load();
    } catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };

  return <div>
    <h1 className="page-title">KYC</h1>
    <p className="page-sub">Collect protected retailer evidence, then approve it with step-up verification.</p>
    {error && <div className="alert error">{error}</div>}
    <section className="card">
      <h2>Start a case</h2>
      <div className="inline-form"><select value={retailerId} onChange={(event) => setRetailerId(event.target.value)}><option value="">Select retailer</option>{retailers.map((retailer) => <option value={retailer.id} key={retailer.id}>{retailer.name} · {retailer.phone}</option>)}</select><button disabled={busy || !retailerId} onClick={() => void start()}>Start KYC</button></div>
    </section>
    <div className="approval-layout">
      <section className="card approval-list">
        {cases.length === 0 ? <div className="empty-state">No submitted cases waiting for review.</div> : cases.map((item) => <button className={`approval-row ${selected?.id === item.id ? "selected" : ""}`} key={item.id} onClick={() => { setSelected(item); setAction(null); }}><span><strong>{item.retailer.name}</strong><small>{item.retailer.phone} · {item.status}</small></span><span className="pill status-pending">{item.documents.length}/3 docs</span></button>)}
      </section>
      <section className="card approval-detail">
        {!selected ? <div className="empty-state">Select a submitted case or start a new one.</div> : <>
          <div className="between"><div><h2>{selected.retailer?.name ?? "KYC case"}</h2><p className="muted small">Status: {selected.status}</p></div><span className="pill status-pending">{selected.documents?.length ?? 0}/3 documents</span></div>
          {DOCUMENTS.map(([type, label]) => <div className="reason-card" key={type}><div className="between"><strong>{label}</strong><span className="muted small">{selected.documents?.some((document: any) => document.type === type) ? "Uploaded" : "Required"}</span></div>{selected.status === "draft" || selected.status === "rejected" ? <label className="file-field"><span>Choose PDF or image</span><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => void upload(type, event.target.files?.[0])} /></label> : null}</div>)}
          {selected.status === "draft" || selected.status === "rejected" ? <button disabled={busy} onClick={() => void submit()}>Submit for review</button> : null}
          {selected.status === "submitted" || selected.status === "in_review" ? <><label className="field"><span>Review reason</span><textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label>{!action ? <div className="approval-actions"><button className="danger-outline" onClick={() => void beginReview("reject")}>Reject</button><button onClick={() => void beginReview("approve")}>Approve KYC</button></div> : <div className="step-up-box"><strong>Verify this sensitive action</strong><label className="field"><span>Six-digit code</span><input inputMode="numeric" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} /></label><button disabled={busy || otp.length !== 6} onClick={() => void review()}>Verify and {action}</button></div>}</> : null}
        </>}
      </section>
    </div>
  </div>;
}
