import { useEffect, useState, useRef } from "react";
import { api } from "../api";
import { useAuth } from "../useAuth";

type Row = Record<string, any>;
const entityName=(id:string)=>id==="jain_traders"?"Jain Traders":"Padam International";
export function Breakdown({value}:{value:Row}) {
  return <div>{value.lines.map((l:Row)=><p key={l.variantId}>{l.productName} · {l.pack} · {entityName(l.entity)} · {l.cases} cases / {l.weightKg} kg · ₹{l.rate}/{l.rateBasis} · Base ₹{l.base} · GST {l.gstPercent}% ₹{l.gst} · Discount ₹{l.discount} · Total ₹{l.total}</p>)}
    {value.freight && <p>Freight {entityName(value.freight.entity)} ₹{value.freight.amount} + GST ₹{value.freight.gst} · {value.freight.recordedQuintals} quintals / {value.freight.recordedKilometres} km</p>}
    <strong>Grand total ₹{value.total}</strong></div>;
}
function Freight({quote,reload}:{quote:Row;reload:()=>Promise<void>}) {
  const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  return <details><summary>{quote.retailer?.name ?? "Retailer"} · Quote {quote.id}</summary><p>{quote.freightConfirmedByStaffId ? "Freight confirmed" : "Freight confirmation required"} · Expires {new Date(quote.expiresAt).toLocaleString()}</p><Breakdown value={quote.snapshot}/>
    <form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError("");const data=Object.fromEntries(new FormData(e.currentTarget));try{await api.saveCommercialFreight(quote.id,{revision:quote.revision,freight:data});await reload();}catch(err){setError(String(err));}finally{setBusy(false);}}}>
      <label>Freight owner<select name="entity" defaultValue="" required><option value="">Select freight company</option>{quote.snapshot.entities.map((e:Row)=><option key={e.entity} value={e.entity}>{entityName(e.entity)}</option>)}</select></label>
      <label>Final freight before GST<input name="amount" type="number" min="0" step="0.01" required/></label>
      <label>Freight GST %<input name="gstPercent" type="number" min="0" max="100" step="0.01" required/></label>
      <label>Recorded quintals<input name="recordedQuintals" type="number" min="0" step="0.01" required/></label>
      <label>Recorded kilometres<input name="recordedKilometres" type="number" min="0" step="0.01" required/></label>
      <button disabled={busy}>Confirm freight</button><p role="alert">{error}</p>
    </form></details>;
}
function Invoice({invoice,reload}:{invoice:Row;reload:()=>Promise<void>}) {
  const [confirmed,setConfirmed]=useState(false);
  const [challenge,setChallenge]=useState("");const [otp,setOtp]=useState("");
  const [balances,setBalances]=useState<Row|null>(null);const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  const key=useRef(crypto.randomUUID());
  const [jain,setJain]=useState("");const [padam,setPadam]=useState("");const [amount,setAmount]=useState("");
  return <details><summary>Invoice #{invoice.invoiceNumber} · {invoice.retailer?.name ?? "Retailer"} · ₹{invoice.total} · Outstanding ₹{invoice.outstandingAmount}</summary>
    <Breakdown value={invoice.commercialSnapshot}/>
    <button onClick={()=>api.requestAdminStepUp().then(r=>setChallenge(r.challengeId)).catch(e=>setError(String(e)))}>Verify payment permission</button>
    {challenge && <div><label>Verification code<input value={otp} onChange={e=>setOtp(e.target.value)} inputMode="numeric" maxLength={6}/></label><button onClick={()=>api.completeAdminStepUp(challenge,otp).then(()=>{setChallenge("");setOtp("");setError("");}).catch(e=>setError(String(e)))}>Verify</button></div>}
    <button onClick={()=>api.commercialBalances(invoice.id).then(setBalances).catch(e=>setError(String(e)))}>Load this invoice’s balances</button>
    {balances && <><p>Jain ₹{balances.jain} · Padam ₹{balances.padam}</p>
    <button disabled={busy} onClick={()=>{setJain(balances.jain);setPadam(balances.padam);setAmount(balances.total);setConfirmed(false);}}>Prefill full payment (confirmation still required)</button>
    <form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError("");const data=Object.fromEntries(new FormData(e.currentTarget));try{await api.commercialPayment(invoice.id,key.current,{...data,amount,jainAmount:jain,padamAmount:padam,confirmed:true});key.current=crypto.randomUUID();setBalances(await api.commercialBalances(invoice.id));setAmount("");setJain("");setPadam("");await reload();}catch(err){setError(String(err));}finally{setBusy(false);}}}>
      <label>Payment received<input type="number" min="0.01" step="0.01" value={amount} onChange={e=>{setAmount(e.target.value);setConfirmed(false);}} required/></label>
      <label>Jain allocation<input type="number" min="0" step="0.01" value={jain} onChange={e=>{setJain(e.target.value);setConfirmed(false);}} required/></label>
      <label>Padam allocation<input type="number" min="0" step="0.01" value={padam} onChange={e=>{setPadam(e.target.value);setConfirmed(false);}} required/></label>
      <label>Method<select name="method"><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="upi">UPI</option><option value="cheque">Cheque</option></select></label>
      <label>Reference<input name="reference" required/></label>
      <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} required/> I confirm receipt and this invoice’s company allocations.</label>
      <button disabled={busy || !confirmed}>Confirm payment</button>
    </form></>}
    <p role="alert">{error}</p>{invoice.allocations.map((a:Row)=><p key={a.id}>Payment {a.paymentId} · Jain ₹{a.jainAmount} · Padam ₹{a.padamAmount} · {a.payment.confirmedMethod} · {a.payment.confirmedReference} · {a.createdAt}</p>)}
  </details>;
}
export default function Commercial() {
  const {permissions}=useAuth();
  const canConfigure=permissions.includes("staff.manage");
  const [data,setData]=useState<Row|null>(null);const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  const reload=async()=>{setData(await api.commercial());};
  useEffect(()=>{void reload().catch(e=>setError(String(e)));},[]);
  return <main><h1>Commercial configuration & invoices</h1><p>One combined invoice. Company ownership and GST remain attached to each line.</p><p role="alert">{error}</p><button onClick={()=>void reload().catch(e=>setError(String(e)))}>Refresh</button>
    {data && <>{canConfigure && <><h2>Configure SKU</h2><form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError("");const body=Object.fromEntries(new FormData(e.currentTarget));try{await api.saveCommercialSku(String(body.variantId),body);await reload();}catch(err){setError(String(err));}finally{setBusy(false);}}}>
      <label>SKU<select name="variantId">{data.variants.map((v:Row)=><option key={v.id} value={v.id}>{v.product.name} · {v.unitSize} × {v.unitsPerCase} · {v.sellingEntity?entityName(v.sellingEntity):"Not configured"}</option>)}</select></label>
      <label>Company<select name="sellingEntity" required><option value="">Select company</option><option value="jain_traders">Jain Traders</option><option value="padam_international">Padam International</option></select></label>
      <label>Tier<select name="tierId">{data.tiers.map((t:Row)=><option value={t.id} key={t.id}>{t.name}</option>)}</select></label>
      <label>Quoted rate (GST excluded)<input name="rate" type="number" min="0" step="0.01" required/></label>
      <label>Rate basis<select name="rateBasis"><option value="case">Per case</option><option value="quintal">Per quintal</option></select></label>
      <label>SKU GST %<input name="gstPercent" type="number" min="0" max="100" step="0.01" required/></label>
      <button disabled={busy}>Save configuration</button>
    </form><h2>Checkout freight awaiting confirmation</h2>{data.quotes.map((q:Row)=><Freight key={q.id} quote={q} reload={reload}/>)}</>}<h2>Combined invoices & payments</h2>{data.invoices.map((i:Row)=><Invoice key={i.id} invoice={i} reload={reload}/>)}</>}
  </main>;
}
