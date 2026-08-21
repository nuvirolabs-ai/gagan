import { useContext, useEffect, useMemo, useState } from "react";
import { api, inr } from "../api";
import { AuthContext } from "../auth-context";

type RecoveryCase = any;

export default function Legal() {
  const [cases, setCases] = useState<RecoveryCase[]>([]);
  const [selected, setSelected] = useState<RecoveryCase | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [referralReason, setReferralReason] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionAmount, setDecisionAmount] = useState("");
  const [decisionType, setDecisionType] = useState<"settlement" | "write_off">("settlement");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const auth = useContext(AuthContext);

  useEffect(() => {
    api.recoveryCases().then((response) => setCases(response.cases)).catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load recovery cases"));
  }, []);

  const choose = async (item: RecoveryCase) => {
    setSelected(item);
    try { setDetail(await api.recoveryTimeline(item.id)); setError(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load recovery case"); }
  };

  const letters = detail?.recoveryCase?.letters ?? [];
  const letter = letters[0];
  const legalCase = detail?.recoveryCase?.legalCase ?? null;
  const canRefer = Boolean(selected && letter && !legalCase && (!auth || auth.permissions.includes("staff.manage")));
  const canDecide = Boolean(!auth || auth.permissions.includes("legal.decide"));
  const outstanding = selected ? Number(selected.invoice.outstandingAmount) : 0;
  const validDecisionAmount = useMemo(() => {
    const amount = Number(decisionAmount);
    return Number.isFinite(amount) && amount > 0 && amount <= outstanding;
  }, [decisionAmount, outstanding]);

  const generateLetter = async () => {
    if (!selected) return;
    try {
      const response = await api.createRecoveryLetter(selected.id, { idempotencyKey: `letter-${crypto.randomUUID()}` });
      setDetail((current: any) => ({ ...current, recoveryCase: { ...current.recoveryCase, letters: [...(current.recoveryCase?.letters ?? []), response.letter] } }));
      setNotice("Recovery letter generated privately."); setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not generate letter"); }
  };

  const deliverLetter = async () => {
    if (!letter) return;
    try { await api.recordRecoveryDelivery(letter.id, { channel: "manual", idempotencyKey: `delivery-${crypto.randomUUID()}` }); setNotice("Delivery recorded."); setError(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not record delivery"); }
  };

  const referToLegal = async () => {
    if (!selected || !letter || referralReason.trim().length < 5) return setError("Add a referral reason.");
    try {
      const response = await api.createLegalCase(selected.id, { letterId: letter.id, reason: referralReason.trim(), idempotencyKey: `legal-${crypto.randomUUID()}` });
      setDetail((current: any) => ({ ...current, recoveryCase: { ...current.recoveryCase, legalCase: response.legalCase } }));
      setReferralReason(""); setNotice("Legal referral created explicitly."); setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create legal referral"); }
  };

  const decide = async () => {
    if (!legalCase || !validDecisionAmount || decisionReason.trim().length < 5) return setError("Add a valid amount and decision reason.");
    try {
      const response = await api.decideLegalCase(legalCase.id, { type: decisionType, amount: Number(decisionAmount), reason: decisionReason.trim(), idempotencyKey: `decision-${crypto.randomUUID()}` });
      setDetail((current: any) => ({ ...current, recoveryCase: { ...current.recoveryCase, legalCase: response.legalCase } }));
      setNotice(`${decisionType === "settlement" ? "Settlement" : "Write-off"} decision recorded; ledger unchanged.`); setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not record decision"); }
  };

  return <div>
    <h1 className="page-title">Legal escalation</h1>
    <p className="page-sub">Letters and referrals require an explicit admin action. Settlement and write-off are Founder/Director decisions.</p>
    {error && <div className="alert error">{error}</div>}
    {notice && <div className="alert success">{notice}</div>}
    <div className="approval-layout">
      <section className="card approval-list">
        {cases.length === 0 ? <div className="empty-state">No open recovery cases.</div> : cases.map((item) => <button className={`approval-row ${selected?.id === item.id ? "selected" : ""}`} key={item.id} onClick={() => void choose(item)}><span><strong>{item.retailer.name}</strong><small>Invoice #{item.invoice.invoiceNumber} · {inr(Number(item.invoice.outstandingAmount))} open</small></span></button>)}
      </section>
      <section className="card approval-detail">
        {!selected ? <div className="empty-state">Select a recovery case.</div> : <>
          <h2>{selected.retailer.name}</h2><p className="muted">Invoice #{selected.invoice.invoiceNumber} · {inr(outstanding)} outstanding</p>
          {!letter ? <button onClick={() => void generateLetter()}>Generate recovery letter</button> : <>
            <div className="reason-card"><strong>Recovery letter</strong><div className="muted small">Private PDF · <a href={letter.signedUrl} target="_blank" rel="noreferrer">Open signed copy</a></div></div>
            <button onClick={() => void deliverLetter()}>Record manual delivery</button>
          </>}
          {canRefer && <><label className="field"><span>Legal referral reason</span><textarea aria-label="Legal referral reason" rows={2} value={referralReason} onChange={(event) => setReferralReason(event.target.value)} placeholder="Why is legal review warranted?" /></label><button onClick={() => void referToLegal()}>Refer to legal</button></>}
          {legalCase && legalCase.status === "open" && canDecide && <div className="reason-card"><strong>Legal case open</strong><div className="metric-grid"><label className="field"><span>Decision type</span><select value={decisionType} onChange={(event) => setDecisionType(event.target.value as "settlement" | "write_off")}><option value="settlement">Settlement</option><option value="write_off">Write-off</option></select></label><label className="field"><span>Amount</span><input type="number" min="0.01" max={outstanding} value={decisionAmount} onChange={(event) => setDecisionAmount(event.target.value)} /></label></div><label className="field"><span>Decision reason</span><textarea rows={2} value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} /></label><button onClick={() => void decide()}>Record decision</button></div>}
          {legalCase && legalCase.status === "open" && !canDecide && <div className="reason-card"><strong>Legal case open</strong><div className="muted small">Founder/Director permission is required for settlement or write-off.</div></div>}
          {legalCase && legalCase.status !== "open" && <div className="reason-card"><strong>Decision: {legalCase.status.replace("_", " ")}</strong><div className="muted small">No ledger mutation was performed.</div></div>}
        </>}
      </section>
    </div>
  </div>;
}
