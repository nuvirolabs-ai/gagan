import { useEffect, useState } from "react";
import { api, inr } from "../api";

export default function Recovery() {
  const [cases, setCases] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [callNotes, setCallNotes] = useState("");
  const [promiseAmount, setPromiseAmount] = useState("");
  const [promiseDueAt, setPromiseDueAt] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try { setCases((await api.recoveryCases()).cases); setError(""); }
    catch (err: any) { setError(err.message); }
  };
  useEffect(() => { void load(); }, []);

  const choose = async (item: any) => {
    setSelected(item);
    try { setTimeline((await api.recoveryTimeline(item.id)).events); }
    catch (err: any) { setError(err.message); }
  };

  const logCall = async () => {
    if (!selected || callNotes.trim().length < 3) return setError("Add call notes.");
    try { await api.logRecoveryCall(selected.id, { outcome: "spoke_with_customer", notes: callNotes.trim(), idempotencyKey: `admin-call-${Date.now()}` }); setCallNotes(""); await choose(selected); }
    catch (err: any) { setError(err.message); }
  };

  const createPromise = async () => {
    if (!selected || Number(promiseAmount) <= 0 || !promiseDueAt) return setError("Add a promise amount and due date.");
    try { await api.createRecoveryPromise(selected.id, { amount: Number(promiseAmount), dueAt: new Date(promiseDueAt).toISOString(), idempotencyKey: `admin-promise-${Date.now()}` }); setPromiseAmount(""); setPromiseDueAt(""); await choose(selected); }
    catch (err: any) { setError(err.message); }
  };

  return <div>
    <h1 className="page-title">Recovery</h1>
    <p className="page-sub">One chronological case timeline for calls and payment commitments.</p>
    {error && <div className="alert error">{error}</div>}
    <div className="approval-layout">
      <section className="card approval-list">
        {cases.length === 0 ? <div className="empty-state">No open recovery cases.</div> : cases.map((item) => <button className={`approval-row ${selected?.id === item.id ? "selected" : ""}`} key={item.id} onClick={() => void choose(item)}><span><strong>{item.retailer.name}</strong><small>Invoice #{item.invoice.invoiceNumber} · {inr(Number(item.invoice.outstandingAmount))} open</small></span><span className="pill status-pending">{item.actions[0]?.type?.replaceAll("_", " ") ?? "Review"}</span></button>)}
      </section>
      <section className="card approval-detail">
        {!selected ? <div className="empty-state">Select a recovery case.</div> : <>
          <h2>{selected.retailer.name}</h2><p className="muted">Invoice #{selected.invoice.invoiceNumber} · {inr(Number(selected.invoice.outstandingAmount))} outstanding</p>
          <div className="reason-list">{timeline.map((event: any) => <div className="reason-card" key={`${event.kind}-${event.id}`}><strong>{event.kind === "call" ? "Call" : event.kind === "promise" ? "Promise to pay" : event.kind === "letter" ? "Recovery letter" : event.kind === "legal" ? "Legal case" : event.type?.replaceAll("_", " ") ?? "Recovery event"}</strong><div className="muted small">{new Date(event.at).toLocaleString("en-IN")}{event.notes ? ` · ${event.notes}` : ""}{event.amount ? ` · ${inr(Number(event.amount))} · ${event.status}` : ""}</div></div>)}</div>
          <label className="field"><span>Log customer call</span><textarea rows={2} value={callNotes} onChange={(event) => setCallNotes(event.target.value)} placeholder="What was agreed?" /></label><button onClick={() => void logCall()}>Log call</button>
          <div className="metric-grid"><label className="field"><span>Promise amount</span><input value={promiseAmount} onChange={(event) => setPromiseAmount(event.target.value)} inputMode="decimal" /></label><label className="field"><span>Promise due</span><input type="datetime-local" value={promiseDueAt} onChange={(event) => setPromiseDueAt(event.target.value)} /></label></div><button onClick={() => void createPromise()}>Record promise</button>
        </>}
      </section>
    </div>
  </div>;
}
