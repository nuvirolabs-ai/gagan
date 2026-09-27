import { useEffect, useRef, useState } from "react";
import { ApiError, api } from "../api";

type Price = { tierId: string; rate: string; rateBasis: "case" | "quintal" };
type Values = { gstPercent: string | null; sellingEntity: string | null; routingClass: string | null; routingBagEquivalent: string | null; prices: Price[] };
type Setup = {
  revision: string;
  product: { name: string };
  pack: { id: string; label: string; unitWeightKg: number; unitsPerCase: number; caseWeightKg: number; status: string };
  tiers: { id: string; name: string }[];
  inventory: { warehouseCode: string; available: number; status: string; source: string; syncedAt: string } | null;
  values: Values;
  effective: Values;
  hasDraft: boolean;
  gstPendingException: boolean;
  blockers: string[];
};

const rupees = (amount: number) => `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const billingLabel = (values: Values) => values.routingClass ? `Dynamic Jain/Padam · ${values.routingClass === "LAXMI_TOOR" ? "Laxmi Toor" : values.routingClass === "INSTANT_MIX" ? "Instant Mix" : "Other approved product"}` : values.sellingEntity === "jain_traders" ? "Jain Traders" : values.sellingEntity === "padam_international" ? "Padam International" : "Pending";
const messageFor = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.body?.blockers?.length) return error.body.blockers.join(" ");
    if (error.body?.error === "setup_changed") return "This setup changed while you were editing. Close and reopen it to review the latest values.";
    if (error.body?.error === "permission_required") return "You do not have permission to configure ordering.";
  }
  return error instanceof Error ? error.message : "Could not save ordering setup.";
};

export default function OrderingSetupPanel({ variantId, onClose, onSaved }: { variantId: string; onClose: () => void; onSaved: (enabled: boolean, alreadyEnabled: boolean, label: string) => Promise<void> }) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [values, setValues] = useState<Values | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let mounted = true;
    api.orderingSetup(variantId).then((data: Setup) => { if (mounted) { setSetup(data); setValues(data.values); } }).catch((err: unknown) => { if (mounted) setError(messageFor(err)); });
    panel.current?.focus();
    return () => { mounted = false; };
  }, [variantId]);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); return; }
      if (event.key !== "Tab" || !panel.current) return;
      const focusable = [...panel.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), summary")].filter(element => element.getClientRects().length > 0);
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const save = async (enable: boolean) => {
    if (!setup || !values || busy) return;
    setBusy(true); setError("");
    try {
      const result: Setup = enable
        ? await api.enableOrdering(variantId, { revision: setup.revision, values })
        : await api.saveOrderingDraft(variantId, { revision: setup.revision, values });
      setSetup(result); setValues(result.values); setConfirm(false);
      await onSaved(enable, setup.pack.status === "active", `${setup.product.name} — ${setup.pack.label}`);
      if (enable) onClose();
    } catch (err) { setError(messageFor(err)); setConfirm(false); }
    finally { setBusy(false); }
  };
  const priceFor = (tierId: string): Price => values?.prices.find(price => price.tierId === tierId) ?? { tierId, rate: "", rateBasis: "case" };
  const updatePrice = (tierId: string, change: Partial<Price>) => setValues(current => {
    if (!current) return current;
    const existing = current.prices.find(price => price.tierId === tierId);
    return { ...current, prices: [...current.prices.filter(price => price.tierId !== tierId), { tierId, rate: "", rateBasis: "case" as const, ...existing, ...change }] };
  });
  const staticBlockers = setup?.blockers.filter(blocker => !blocker.startsWith("Select an approved GST") && !blocker.startsWith("Select the approved billing") && !blocker.startsWith("Set a positive rate") && !blocker.startsWith("Enter the approved bag") && !blocker.startsWith("Remove the bag") && !blocker.startsWith("Dynamic routing cannot")) ?? [];
  const liveBlockers = [...staticBlockers];
  if (setup && values) {
    if (values.gstPercent === null && !setup.gstPendingException) liveBlockers.push("Select an approved GST rate.");
    if (!values.routingClass && !values.sellingEntity) liveBlockers.push("Select the approved billing rule.");
    if (values.routingClass && values.sellingEntity) liveBlockers.push("Dynamic routing cannot also have a fixed selling company.");
    if (values.routingClass === "OTHER" && (!values.routingBagEquivalent || Number(values.routingBagEquivalent) <= 0)) liveBlockers.push("Enter the approved bag equivalent for Other routing.");
    if (values.routingClass !== "OTHER" && values.routingBagEquivalent !== null) liveBlockers.push("Remove the bag equivalent for this routing rule.");
    if (!setup.tiers.length || setup.tiers.some(tier => !values.prices.some(price => price.tierId === tier.id && Number(price.rate) > 0))) liveBlockers.push("Set a positive rate for each applicable price tier.");
  }
  const missing = liveBlockers.length;
  const focusBlocker = (blocker: string) => {
    const section = blocker.includes("GST") ? "gst" : blocker.includes("rate") || blocker.includes("tier") ? "price" : blocker.includes("stock") || blocker.includes("Stock") || blocker.includes("warehouse") ? "stock" : blocker.includes("pack") || blocker.includes("conversion") || blocker.includes("identity") ? "packing" : "billing";
    const details = panel.current?.querySelector<HTMLDetailsElement>(`#ordering-${section}`);
    if (details) { details.open = true; details.querySelector<HTMLElement>("summary")?.focus(); }
  };

  return <div className="ordering-setup-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="ordering-setup-panel" role="dialog" aria-modal="true" aria-label="Set up ordering" ref={panel} tabIndex={-1}>
      <header className="ordering-setup-head"><div><h2>Set up ordering</h2>{setup && <p>{setup.product.name} — {setup.pack.label} · {setup.pack.caseWeightKg} kg per case</p>}</div><button type="button" className="ghost" aria-label="Close setup" onClick={onClose}>×</button></header>
      {error && <p className="banner error" role="alert">{error}</p>}
      {!setup || !values ? <p>Loading current setup…</p> : <>
        <div className="ordering-setup-scroll">
          <div className="banner">{missing ? `${missing} ${missing === 1 ? "thing" : "things"} to check before ordering can be enabled.` : "Current setup is ready to review."}</div>
          {!!missing && <ul className="ordering-blockers">{liveBlockers.map(blocker => <li key={blocker}><button type="button" className="ghost" onClick={() => focusBlocker(blocker)}>{blocker}</button></li>)}</ul>}
          <details id="ordering-packing" open={setup.pack.caseWeightKg <= 0 || setup.blockers.some(blocker => blocker.includes("catalogue identity"))}><summary>Packing <span>{setup.pack.caseWeightKg} kg / case</span></summary><p>{setup.pack.label} · {setup.pack.unitWeightKg} kg per unit · {setup.pack.unitsPerCase} units per case</p><p className="muted small">Approved pack conversions cannot be changed here.</p>{setup.blockers.some(blocker => blocker.includes("catalogue identity")) && <p role="status">This draft still needs an approved catalogue identity. The current Admin draft editor and product import cannot assign one; ordering must remain blocked until the controlled catalogue publication flow supports it.</p>}</details>
          <details id="ordering-price" open={setup.blockers.some(blocker => blocker.startsWith("Set a positive rate") || blocker.startsWith("Price tier"))}><summary>Selling price <span>{setup.tiers.length} tiers</span></summary>
            {setup.tiers.map(tier => {
              const price = priceFor(tier.id); const amount = Number(price.rate);
              const perKg = price.rate && setup.pack.caseWeightKg > 0 ? price.rateBasis === "quintal" ? amount / 100 : amount / setup.pack.caseWeightKg : null;
              const perCase = perKg === null ? null : perKg * setup.pack.caseWeightKg;
              return <div className="ordering-price-row" key={tier.id}><strong>{tier.name}</strong><label>Rate basis<select value={price.rateBasis} onChange={event => updatePrice(tier.id, { rateBasis: event.target.value as Price["rateBasis"] })}><option value="case">₹/case</option><option value="quintal">₹/quintal</option></select></label><label>Rate ({price.rateBasis === "case" ? "₹/case" : "₹/quintal"})<input type="number" min="0" step="0.01" value={price.rate} onChange={event => updatePrice(tier.id, { rate: event.target.value })} /></label><span className="muted small">{perKg === null ? "Rate pending" : `${rupees(perKg)}/kg · ${rupees(perCase!)}/case`}</span></div>;
            })}
            <p className="muted small">Retailer-specific overrides remain unchanged. Final amounts are calculated by the server.</p>
          </details>
          <details id="ordering-gst" open={setup.blockers.some(blocker => blocker.includes("GST"))}><summary>GST <span>{values.gstPercent === null ? "Pending" : `${values.gstPercent}%`}</span></summary>
            <label>Approved GST rate (%)<input type="number" min="0" max="100" step="0.01" placeholder="Enter approved rate" value={values.gstPercent ?? ""} onChange={event => setValues({ ...values, gstPercent: event.target.value || null })} /></label>
            {setup.gstPendingException && values.gstPercent === null && <p>Orders allowed; invoices blocked until GST is configured.</p>}
          </details>
          <details id="ordering-stock" open={setup.blockers.some(blocker => blocker.includes("stock") || blocker.includes("Stock") || blocker.includes("warehouse"))}><summary>Stock <span>{setup.inventory ? `${setup.inventory.available} available` : "Needs verification"}</span></summary>
            {setup.inventory ? <p>Warehouse {setup.inventory.warehouseCode} · {setup.inventory.available} available · {setup.inventory.status} · {setup.inventory.source}<br />Last verified {new Date(setup.inventory.syncedAt).toLocaleString("en-IN")}</p> : <p>No authorised inventory link is available for this pack.</p>}
            {setup.inventory?.source === "staging_uat" && <p>Test stock — not physical inventory.</p>}
            <p className="muted small">Stock refresh uses the existing authorised inventory flow. This panel does not change physical stock or verification time.</p>
            <a className="ordering-stock-link" href="/imports?type=inventory">Open inventory import</a>
          </details>
          <details id="ordering-billing" open={setup.blockers.some(blocker => blocker.includes("billing") || blocker.includes("routing") || blocker.includes("bag"))}><summary>Billing rule <span>{billingLabel(values)}</span></summary>
            <label>Approved allocation rule<select value={values.routingClass ? `route:${values.routingClass}` : values.sellingEntity ? `company:${values.sellingEntity}` : ""} onChange={event => { const [kind, value] = event.target.value.split(":"); setValues({ ...values, routingClass: kind === "route" ? value : null, sellingEntity: kind === "company" ? value : null, routingBagEquivalent: kind === "route" && value === "OTHER" ? values.routingBagEquivalent : null }); }}><option value="">Select approved rule</option><option value="route:LAXMI_TOOR">Dynamic Jain/Padam — Laxmi Toor</option><option value="route:INSTANT_MIX">Dynamic Jain/Padam — Instant Mix</option><option value="route:OTHER">Dynamic Jain/Padam — Other approved product</option><option value="company:jain_traders">Fixed Jain Traders</option><option value="company:padam_international">Fixed Padam International</option></select></label>
            {values.routingClass === "OTHER" && <label>Approved bag equivalent per case<input type="number" min="0.001" step="0.001" value={values.routingBagEquivalent ?? ""} onChange={event => setValues({ ...values, routingBagEquivalent: event.target.value || null })} /></label>}
            <p className="muted small">Select only a rule already approved for this pack. Dynamic routing chooses the company at order time.</p>
          </details>
        </div>
        <footer className="ordering-setup-actions">{confirm ? <><p>Confirm {setup.pack.status === "active" ? "changes to" : "enable ordering for"} {setup.product.name} — {setup.pack.label}. {values.gstPercent === null ? "Approved GST-pending exception" : `GST ${values.gstPercent}%`}, {billingLabel(values)}. {setup.tiers.map(tier => `${tier.name} ${rupees(Number(priceFor(tier.id).rate))}/${priceFor(tier.id).rateBasis}`).join(" · ")}.</p><button type="button" disabled={busy} onClick={() => void save(true)}>{busy ? "Saving…" : "Confirm"}</button><button type="button" className="secondary" onClick={() => setConfirm(false)}>Back</button></> : <><button type="button" className="secondary" disabled={busy} onClick={() => void save(false)}>Save draft</button><button type="button" disabled={busy} onClick={() => setConfirm(true)}>{setup.pack.status === "active" ? "Save changes" : "Save & enable ordering"}</button></>}</footer>
      </>}
    </div>
  </div>;
}
