import { useEffect, useState, useRef } from "react";
import { api, inr } from "../api";
import { useAuth } from "../useAuth";

type Row = Record<string, any>;
const entityName = (id: string) => id === "jain_traders" ? "Jain Traders" : "Padam International";

export function Breakdown({ value }: { value: Row }) {
  return (
    <div>
      {value.taxStatus === "PENDING" || value.gstPending ? (
        <p><strong>GST pending:</strong> final tax will be applied before invoicing. This order is not tax-final.</p>
      ) : null}
      {value.routing && <p><strong>Routing:</strong> {value.routing.explanation} · {value.routing.eligibleContributionBags} eligible bags</p>}
      {value.lines.map((l: Row) => (
        <p key={l.variantId}>
          {l.productName} · {l.pack} · {entityName(l.entity)} · {l.cases} cases / {l.weightKg} kg · ₹{l.rate}/{l.rateBasis} · Base ₹{l.base} · {l.gstPending || l.gstPercent == null ? "GST pending — final tax will be applied before invoicing" : `GST ${l.gstPercent}% ₹${l.gst}`} · Discount ₹{l.discount} · Total ₹{l.total}
        </p>
      ))}
      {value.freight && (
        <p>Freight {entityName(value.freight.entity)} ₹{value.freight.amount} + GST ₹{value.freight.gst} · {value.freight.recordedQuintals} quintals / {value.freight.recordedKilometres} km</p>
      )}
      <strong>Grand total ₹{value.total}</strong>
    </div>
  );
}

function Freight({ quote, reload }: { quote: Row; reload: () => Promise<void> }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <details>
      <summary>{quote.retailer?.name ?? "Retailer"} · Quote {quote.id}</summary>
      <p>{quote.freightConfirmedByStaffId ? "Freight confirmed" : "Freight confirmation required"} · Expires {new Date(quote.expiresAt).toLocaleString()}</p>
      <Breakdown value={quote.snapshot} />
      {quote.commercialStatus?.currentLabel ? (
        <div className="internal-status-detail">
          <strong>{quote.commercialStatus.currentLabel}</strong>
          {(quote.commercialStatus.timeline ?? []).slice(-3).map((event: Row) => (
            <span key={event.id}>
              {event.label} · {new Date(event.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              {event.actor?.name ? ` · ${event.actor.name}` : ""}
            </span>
          ))}
        </div>
      ) : null}
      <form onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        const data = Object.fromEntries(new FormData(e.currentTarget));
        try {
          await api.saveCommercialFreight(quote.id, { revision: quote.revision, freight: data });
          await reload();
        } catch (err) {
          setError(String(err));
        } finally {
          setBusy(false);
        }
      }}>
        <label>Freight owner
          <select name="entity" defaultValue="" required>
            <option value="">Select freight company</option>
            {quote.snapshot.entities.map((e: Row) => (
              <option key={e.entity} value={e.entity}>{entityName(e.entity)}</option>
            ))}
          </select>
        </label>
        <label>Final freight before GST<input name="amount" type="number" min="0" step="0.01" required /></label>
        <label>Freight GST %<input name="gstPercent" type="number" min="0" max="100" step="0.01" required /></label>
        <label>Recorded quintals<input name="recordedQuintals" type="number" min="0" step="0.01" required /></label>
        <label>Recorded kilometres<input name="recordedKilometres" type="number" min="0" step="0.01" required /></label>
        <button disabled={busy}>Confirm freight</button>
        <p role="alert">{error}</p>
      </form>
    </details>
  );
}

function Invoice({ invoice, reload }: { invoice: Row; reload: () => Promise<void> }) {
  const [confirmed, setConfirmed] = useState(false);
  const [challenge, setChallenge] = useState("");
  const [otp, setOtp] = useState("");
  const [balances, setBalances] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());
  const [jain, setJain] = useState("");
  const [padam, setPadam] = useState("");
  const [amount, setAmount] = useState("");

  return (
    <details>
      <summary>Invoice #{invoice.invoiceNumber} · {invoice.retailer?.name ?? "Retailer"} · ₹{invoice.total} · Outstanding ₹{invoice.outstandingAmount}</summary>
      <Breakdown value={invoice.commercialSnapshot} />
      <button onClick={() => api.requestAdminStepUp().then((r: any) => setChallenge(r.challengeId)).catch((e: any) => setError(String(e)))}>
        Verify payment permission
      </button>
      {challenge && (
        <div>
          <label>Verification code<input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" maxLength={6} /></label>
          <button onClick={() => api.completeAdminStepUp(challenge, otp).then(() => { setChallenge(""); setOtp(""); setError(""); }).catch((e: any) => setError(String(e)))}>
            Verify
          </button>
        </div>
      )}
      <button onClick={() => api.commercialBalances(invoice.id).then(setBalances).catch((e: any) => setError(String(e)))}>
        Load this invoice’s balances
      </button>
      {balances && (
        <>
          <p>Jain ₹{balances.jain} · Padam ₹{balances.padam}</p>
          <button disabled={busy} onClick={() => { setJain(balances.jain); setPadam(balances.padam); setAmount(balances.total); setConfirmed(false); }}>
            Prefill full payment (confirmation still required)
          </button>
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            const data = Object.fromEntries(new FormData(e.currentTarget));
            try {
              await api.commercialPayment(invoice.id, key.current, { ...data, amount, jainAmount: jain, padamAmount: padam, confirmed: true });
              key.current = crypto.randomUUID();
              setBalances(await api.commercialBalances(invoice.id));
              setAmount("");
              setJain("");
              setPadam("");
              await reload();
            } catch (err) {
              setError(String(err));
            } finally {
              setBusy(false);
            }
          }}>
            <label>Payment received<input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => { setAmount(e.target.value); setConfirmed(false); }} required /></label>
            <label>Jain allocation<input type="number" min="0.01" step="0.01" value={jain} onChange={(e) => { setJain(e.target.value); setConfirmed(false); }} required /></label>
            <label>Padam allocation<input type="number" min="0.01" step="0.01" value={padam} onChange={(e) => { setPadam(e.target.value); setConfirmed(false); }} required /></label>
            <label>Method
              <select name="method">
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="upi">UPI</option>
                <option value="cheque">Cheque</option>
              </select>
            </label>
            <label>Reference<input name="reference" required /></label>
            <label>
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} required /> I confirm receipt and this invoice’s company allocations.
            </label>
            <button disabled={busy || !confirmed}>Confirm payment</button>
          </form>
        </>
      )}
      <p role="alert">{error}</p>
      {invoice.allocations.map((a: Row) => (
        <p key={a.id}>
          Payment {a.paymentId} · Jain ₹{a.jainAmount} · Padam ₹{a.padamAmount} · {a.payment.confirmedMethod} · {a.payment.confirmedReference} · {a.createdAt}
        </p>
      ))}
    </details>
  );
}

export default function Commercial() {
  const { permissions } = useAuth();
  const canConfigure = permissions.includes("staff.manage");
  const [tab, setTab] = useState<"invoices" | "tiers" | "tax" | "schemes">("invoices");

  // Invoices & SKUs data
  const [data, setData] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // Gap 6: Tiers & Slabs state
  const [tiers, setTiers] = useState<any[]>([]);
  const [tiersLoading, setTiersLoading] = useState(false);
  const [showTierModal, setShowTierModal] = useState(false);
  const [editingTier, setEditingTier] = useState<any | null>(null);
  const [tierForm, setTierForm] = useState({
    name: "",
    discountPct: "0",
    minMonthlySpend: "0",
    creditLimitMultiplier: "1.0",
    description: "",
  });
  const [showSlabModal, setShowSlabModal] = useState<{ tierId: string; slab?: any } | null>(null);
  const [slabForm, setSlabForm] = useState({
    minQuantity: "10",
    maxQuantity: "",
    discountPct: "2.0",
    discountFlat: "0",
    notes: "",
  });

  // Gap 11: Tax / GST & HSN state
  const [hsnData, setHsnData] = useState<{ hsnCodes: any[]; summary: any } | null>(null);
  const [hsnLoading, setHsnLoading] = useState(false);
  const [showHsnModal, setShowHsnModal] = useState(false);
  const [editingHsn, setEditingHsn] = useState<any | null>(null);
  const [hsnForm, setHsnForm] = useState({
    code: "",
    description: "",
    chapter: "Chapter 10 - Cereals",
    gstPercent: "5",
    isExempt: false,
    exemptionNotes: "",
  });
  const [showApplyHsnModal, setShowApplyHsnModal] = useState(false);
  const [selectedHsnCode, setSelectedHsnCode] = useState("");
  const [selectedVariants, setSelectedVariants] = useState<string[]>([]);

  // Gap 14: Customer Schemes & Trade Promotions state
  const [schemes, setSchemes] = useState<any[]>([]);
  const [schemeTiers, setSchemeTiers] = useState<any[]>([]);
  const [schemeVariants, setSchemeVariants] = useState<any[]>([]);
  const [schemesLoading, setSchemesLoading] = useState(false);
  const [showSchemeModal, setShowSchemeModal] = useState(false);
  const [editingScheme, setEditingScheme] = useState<any | null>(null);
  const [schemeForm, setSchemeForm] = useState({
    name: "",
    headline: "",
    description: "",
    ruleType: "order_value" as "order_value" | "product_qty" | "volume_slab",
    targetAmount: "20000",
    minQuantity: "10",
    qualifyingVariantId: "",
    rewardType: "flat_discount" as "flat_discount" | "percentage_discount" | "free_goods",
    rewardValue: "750",
    freeVariantId: "",
    targetAudience: "all_retailers" as "all_retailers" | "tier" | "territory",
    targetTierId: "",
    targetTerritory: "",
    active: true,
    startsAt: new Date().toISOString().split("T")[0],
    endsAt: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
  });

  const reloadCommercial = async () => {
    setData(await api.commercial());
  };

  const loadTiers = async () => {
    setTiersLoading(true);
    try {
      const res = await api.tiersWithSlabs();
      setTiers(res.tiers ?? []);
    } catch (err: any) {
      setError(err.message ?? "Failed to load pricing tiers");
    } finally {
      setTiersLoading(false);
    }
  };

  const loadHsn = async () => {
    setHsnLoading(true);
    try {
      const res = await api.taxHsnCodes();
      setHsnData(res);
      if (res.hsnCodes?.[0] && !selectedHsnCode) {
        setSelectedHsnCode(res.hsnCodes[0].code);
      }
    } catch (err: any) {
      setError(err.message ?? "Failed to load HSN codes");
    } finally {
      setHsnLoading(false);
    }
  };

  const loadSchemes = async () => {
    setSchemesLoading(true);
    try {
      const res = await api.promotionalSchemes();
      setSchemes(res.schemes ?? []);
      setSchemeTiers(res.tiers ?? []);
      setSchemeVariants(res.variants ?? []);
    } catch (err: any) {
      setError(err.message ?? "Failed to load promotional schemes");
    } finally {
      setSchemesLoading(false);
    }
  };

  useEffect(() => {
    void reloadCommercial().catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (tab === "tiers") {
      void loadTiers();
    } else if (tab === "tax") {
      void loadHsn();
    } else if (tab === "schemes") {
      void loadSchemes();
    }
  }, [tab]);

  // Handlers for Tiers (Gap 6)
  const handleSaveTier = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        name: tierForm.name.trim(),
        discountPct: parseFloat(tierForm.discountPct) || 0,
        minMonthlySpend: parseFloat(tierForm.minMonthlySpend) || 0,
        creditLimitMultiplier: parseFloat(tierForm.creditLimitMultiplier) || 1.0,
        description: tierForm.description.trim() || undefined,
      };
      if (editingTier) {
        await api.updateTier(editingTier.id, payload);
        setNotice(`Pricing tier "${payload.name}" updated successfully`);
      } else {
        await api.createTier(payload);
        setNotice(`Pricing tier "${payload.name}" created successfully`);
      }
      setShowTierModal(false);
      setEditingTier(null);
      await loadTiers();
    } catch (err: any) {
      setError(err.message ?? "Failed to save tier");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTier = async (tier: any) => {
    if (!window.confirm(`Delete tier "${tier.name}"? Retailers assigned will retain their account but tier discounts will be removed.`)) return;
    try {
      await api.deleteTier(tier.id);
      setNotice(`Tier "${tier.name}" deleted.`);
      await loadTiers();
    } catch (err: any) {
      setError(err.message ?? "Cannot delete tier");
    }
  };

  const handleSaveSlab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showSlabModal) return;
    setBusy(true);
    setError("");
    try {
      const payload = {
        minQuantity: parseInt(slabForm.minQuantity, 10),
        maxQuantity: slabForm.maxQuantity ? parseInt(slabForm.maxQuantity, 10) : null,
        discountPct: parseFloat(slabForm.discountPct) || 0,
        discountFlat: parseFloat(slabForm.discountFlat) || 0,
        notes: slabForm.notes.trim() || undefined,
      };
      if (showSlabModal.slab) {
        await api.updateSlab(showSlabModal.tierId, showSlabModal.slab.id, payload);
        setNotice("Quantity slab rule updated");
      } else {
        await api.createSlab(showSlabModal.tierId, payload);
        setNotice("Quantity slab rule added");
      }
      setShowSlabModal(null);
      await loadTiers();
    } catch (err: any) {
      setError(err.message ?? "Failed to save slab rule");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSlab = async (tierId: string, slabId: string) => {
    if (!window.confirm("Remove this quantity slab rule?")) return;
    try {
      await api.deleteSlab(tierId, slabId);
      setNotice("Quantity slab rule removed");
      await loadTiers();
    } catch (err: any) {
      setError(err.message ?? "Failed to delete slab rule");
    }
  };

  // Handlers for HSN (Gap 11)
  const handleSaveHsn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        code: hsnForm.code.trim(),
        description: hsnForm.description.trim(),
        chapter: hsnForm.chapter.trim() || undefined,
        gstPercent: parseFloat(hsnForm.gstPercent) || 0,
        isExempt: hsnForm.isExempt,
        exemptionNotes: hsnForm.exemptionNotes.trim() || undefined,
      };
      if (editingHsn) {
        await api.updateHsnCode(editingHsn.id, payload);
        setNotice(`HSN Code ${payload.code} updated.`);
      } else {
        await api.createHsnCode(payload);
        setNotice(`HSN Code ${payload.code} created.`);
      }
      setShowHsnModal(false);
      setEditingHsn(null);
      await loadHsn();
    } catch (err: any) {
      setError(err.message ?? "Failed to save HSN code");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteHsn = async (hsn: any) => {
    if (!window.confirm(`Delete HSN code ${hsn.code}?`)) return;
    try {
      await api.deleteHsnCode(hsn.id);
      setNotice(`HSN Code ${hsn.code} deleted.`);
      await loadHsn();
    } catch (err: any) {
      setError(err.message ?? "Failed to delete HSN code");
    }
  };

  const handleApplyHsnToVariants = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHsnCode || selectedVariants.length === 0) {
      setError("Please select an HSN code and at least one product SKU variant.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api.applyHsnToVariants(selectedHsnCode, selectedVariants);
      setNotice(res.message ?? `Applied HSN ${selectedHsnCode} to ${res.updatedCount} variants.`);
      setShowApplyHsnModal(false);
      setSelectedVariants([]);
      await reloadCommercial();
      await loadHsn();
    } catch (err: any) {
      setError(err.message ?? "Failed to apply HSN to variants");
    } finally {
      setBusy(false);
    }
  };

  // Handlers for Schemes (Gap 14)
  const handleSaveScheme = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        name: schemeForm.name.trim(),
        headline: schemeForm.headline.trim(),
        description: schemeForm.description.trim() || undefined,
        ruleType: schemeForm.ruleType,
        targetAmount: parseFloat(schemeForm.targetAmount) || 0,
        discountAmount: schemeForm.rewardType === "flat_discount" ? (parseFloat(schemeForm.rewardValue) || 0) : 0,
        minQuantity: schemeForm.ruleType === "product_qty" ? (parseInt(schemeForm.minQuantity) || 1) : undefined,
        qualifyingVariantId: schemeForm.ruleType === "product_qty" ? (schemeForm.qualifyingVariantId || undefined) : undefined,
        rewardType: schemeForm.rewardType,
        rewardValue: parseFloat(schemeForm.rewardValue) || 0,
        freeVariantId: schemeForm.rewardType === "free_goods" ? (schemeForm.freeVariantId || undefined) : undefined,
        targetAudience: schemeForm.targetAudience,
        targetTierId: schemeForm.targetAudience === "tier" ? (schemeForm.targetTierId || undefined) : undefined,
        targetTerritory: schemeForm.targetAudience === "territory" ? (schemeForm.targetTerritory.trim() || undefined) : undefined,
        active: schemeForm.active,
        startsAt: new Date(schemeForm.startsAt).toISOString(),
        endsAt: new Date(schemeForm.endsAt).toISOString(),
      };

      if (editingScheme) {
        await api.updateScheme(editingScheme.id, payload);
        setNotice(`Scheme "${payload.name}" updated successfully.`);
      } else {
        await api.createScheme(payload);
        setNotice(`Scheme "${payload.name}" launched successfully.`);
      }
      setShowSchemeModal(false);
      setEditingScheme(null);
      await loadSchemes();
    } catch (err: any) {
      setError(err.message ?? "Failed to save trade scheme");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleSchemeActive = async (schemeId: string) => {
    try {
      const res = await api.toggleSchemeActive(schemeId);
      setNotice(res.message ?? "Scheme status toggled.");
      await loadSchemes();
    } catch (err: any) {
      setError(err.message ?? "Failed to toggle scheme status");
    }
  };

  const handleDeleteScheme = async (schemeId: string, name: string) => {
    if (!window.confirm(`Delete promotional scheme "${name}"?`)) return;
    try {
      await api.deleteScheme(schemeId);
      setNotice(`Scheme "${name}" deleted.`);
      await loadSchemes();
    } catch (err: any) {
      setError(err.message ?? "Failed to delete scheme");
    }
  };

  return (
    <main>
      <div className="between" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title">Commercial & Pricing Hub</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Configure commercial pricing tiers, volume quantity slabs, GST / HSN tax masters, and order invoices.
          </p>
        </div>
        <button className="secondary" onClick={() => {
          if (tab === "invoices") void reloadCommercial();
          else if (tab === "tiers") void loadTiers();
          else if (tab === "tax") void loadHsn();
          else void loadSchemes();
        }}>
          Refresh
        </button>
      </div>

      {error && <div className="banner error" style={{ marginBottom: 14 }}>{error}</div>}
      {notice && <div className="banner success" style={{ marginBottom: 14 }}>{notice}</div>}

      {/* Navigation Tabs */}
      <div className="tab-row" style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          className={tab === "invoices" ? "primary" : "secondary"}
          onClick={() => setTab("invoices")}
        >
          SKU Pricing & Invoices
        </button>
        <button
          className={tab === "tiers" ? "primary" : "secondary"}
          onClick={() => setTab("tiers")}
        >
          Pricing Tiers & Quantity Slabs (Gap 6)
        </button>
        <button
          className={tab === "tax" ? "primary" : "secondary"}
          onClick={() => setTab("tax")}
        >
          Tax / GST & HSN Codes (Gap 11)
        </button>
        <button
          className={tab === "schemes" ? "primary" : "secondary"}
          onClick={() => setTab("schemes")}
        >
          Trade Schemes & Promotions (Gap 14)
        </button>
      </div>

      {/* TAB 1: Invoices & SKU Configuration */}
      {tab === "invoices" && data && (
        <>
          {canConfigure && (
            <>
              <h2>Configure SKU</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (busy) return;
                setBusy(true);
                setError("");
                const body = Object.fromEntries(new FormData(e.currentTarget));
                try {
                  await api.saveCommercialSku(String(body.variantId), body);
                  setNotice("SKU commercial configuration saved");
                  await reloadCommercial();
                } catch (err) {
                  setError(String(err));
                } finally {
                  setBusy(false);
                }
              }}>
                <label>SKU
                  <select name="variantId">
                    {data.variants.map((v: Row) => (
                      <option key={v.id} value={v.id}>
                        {v.product.name} · {v.unitSize} × {v.unitsPerCase} · {v.sellingEntity ? entityName(v.sellingEntity) : "Not configured"}
                      </option>
                    ))}
                  </select>
                </label>
                <label>Legacy company (used only when routing is not configured)
                  <select name="sellingEntity">
                    <option value="">Dynamic routing chooses company</option>
                    <option value="jain_traders">Jain Traders</option>
                    <option value="padam_international">Padam International</option>
                  </select>
                </label>
                <label>Routing class
                  <select name="routingClass">
                    <option value="">Not configured</option>
                    <option value="LAXMI_TOOR">Laxmi Toor Dal</option>
                    <option value="INSTANT_MIX">Instant Mix</option>
                    <option value="OTHER">Other eligible product</option>
                  </select>
                </label>
                <label>Approved routing-bag equivalent per ordered case
                  <input name="routingBagEquivalent" type="number" min="0" step="0.001" placeholder="Use 1 for BAG; required for OTHER; leave blank for Instant Mix" />
                </label>
                <p className="small muted">Instant Mix uses the approved fixed conversion of ordered KG ÷ 5; it does not use a manually entered bag equivalent.</p>
                <label>Tier
                  <select name="tierId">
                    {data.tiers.map((t: Row) => <option value={t.id} key={t.id}>{t.name}</option>)}
                  </select>
                </label>
                <label>Quoted rate (GST excluded)<input name="rate" type="number" min="0" step="0.01" required /></label>
                <label>Rate basis
                  <select name="rateBasis">
                    <option value="case">Per case</option>
                    <option value="quintal">Per quintal</option>
                  </select>
                </label>
                <label>SKU GST %<input name="gstPercent" type="number" min="0" max="100" step="0.01" required /></label>
                <button disabled={busy}>Save configuration</button>
              </form>
              <h2>Checkout freight awaiting confirmation</h2>
              {data.quotes.map((q: Row) => <Freight key={q.id} quote={q} reload={reloadCommercial} />)}
            </>
          )}
          <h2>Combined invoices & payments</h2>
          {data.invoices.map((i: Row) => <Invoice key={i.id} invoice={i} reload={reloadCommercial} />)}
        </>
      )}

      {/* TAB 2: Gap 6 - Pricing Tier & Quantity Slab Rule Editor */}
      {tab === "tiers" && (
        <div>
          <div className="between" style={{ marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0 }}>Commercial Pricing Tiers & Volume Slabs</h2>
              <p className="page-sub">Define trade discounts, minimum monthly spend, and quantity slab rules applied dynamically at checkout.</p>
            </div>
            <button onClick={() => {
              setEditingTier(null);
              setTierForm({
                name: "",
                discountPct: "0",
                minMonthlySpend: "0",
                creditLimitMultiplier: "1.0",
                description: "",
              });
              setShowTierModal(true);
            }}>
              + Add Pricing Tier
            </button>
          </div>

          {tiersLoading ? (
            <div className="card muted">Loading pricing tiers…</div>
          ) : tiers.length === 0 ? (
            <div className="card empty-state">No commercial tiers found.</div>
          ) : (
            <div style={{ display: "grid", gap: 20 }}>
              {tiers.map((t) => (
                <div key={t.id} className="card" style={{ border: "1px solid var(--border, #dfe3e3)" }}>
                  <div className="between" style={{ borderBottom: "1px solid var(--border, #eee)", paddingBottom: 12, marginBottom: 14 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <h3 style={{ margin: 0, fontSize: 18 }}>{t.name} Tier</h3>
                        <span className="pill status-confirmed" style={{ fontSize: 12 }}>
                          {t.discountPct > 0 ? `${t.discountPct}% Base Discount` : "Standard Pricing"}
                        </span>
                        <span className="pill" style={{ background: "#f0f4f8", color: "#334155", fontSize: 12 }}>
                          {t.creditLimitMultiplier || 1.0}x Credit Multiplier
                        </span>
                      </div>
                      <div className="muted small" style={{ marginTop: 4 }}>
                        {t.description || "No description configured"} · Min Monthly Spend: {inr(t.minMonthlySpend || 0)} · Retailers assigned: {t._count?.retailers ?? 0}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="sm secondary" onClick={() => {
                        setEditingTier(t);
                        setTierForm({
                          name: t.name,
                          discountPct: String(t.discountPct ?? 0),
                          minMonthlySpend: String(t.minMonthlySpend ?? 0),
                          creditLimitMultiplier: String(t.creditLimitMultiplier ?? 1.0),
                          description: t.description ?? "",
                        });
                        setShowTierModal(true);
                      }}>
                        Edit Tier
                      </button>
                      <button className="sm secondary" style={{ color: "var(--danger)" }} onClick={() => handleDeleteTier(t)}>
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Quantity Slabs Table */}
                  <div style={{ marginTop: 8 }}>
                    <div className="between" style={{ marginBottom: 8 }}>
                      <h4 style={{ margin: 0, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)" }}>
                        Volume Quantity Slabs ({t.slabs?.length ?? 0} rules)
                      </h4>
                      <button className="sm" onClick={() => {
                        setSlabForm({
                          minQuantity: "10",
                          maxQuantity: "",
                          discountPct: "2.5",
                          discountFlat: "0",
                          notes: "",
                        });
                        setShowSlabModal({ tierId: t.id });
                      }}>
                        + Add Slab Rule
                      </button>
                    </div>

                    {(!t.slabs || t.slabs.length === 0) ? (
                      <p className="muted small" style={{ fontStyle: "italic", margin: "8px 0" }}>
                        No volume slab discounts configured for {t.name}. Retailers get the base {t.discountPct}% discount regardless of order bag volume.
                      </p>
                    ) : (
                      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "var(--surface-muted, #f8f9fa)", textAlign: "left" }}>
                            <th style={{ padding: "8px 12px" }}>Order Volume Range</th>
                            <th style={{ padding: "8px 12px" }}>Percentage Discount</th>
                            <th style={{ padding: "8px 12px" }}>Flat Discount</th>
                            <th style={{ padding: "8px 12px" }}>Rule Notes</th>
                            <th style={{ padding: "8px 12px", textAlign: "right" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {t.slabs.map((slab: any) => (
                            <tr key={slab.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                              <td style={{ padding: "8px 12px", fontWeight: 600 }}>
                                {slab.minQuantity} {slab.maxQuantity ? `– ${slab.maxQuantity} cases/bags` : "+ cases/bags"}
                              </td>
                              <td style={{ padding: "8px 12px" }}>
                                {slab.discountPct > 0 ? (
                                  <span style={{ color: "var(--green, #16a34a)", fontWeight: 600 }}>+{slab.discountPct}% off</span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td style={{ padding: "8px 12px" }}>
                                {slab.discountFlat > 0 ? (
                                  <span style={{ color: "var(--green, #16a34a)", fontWeight: 600 }}>₹{slab.discountFlat} flat</span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td style={{ padding: "8px 12px", color: "var(--text-muted)" }}>
                                {slab.notes || "—"}
                              </td>
                              <td style={{ padding: "8px 12px", textAlign: "right" }}>
                                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                  <button className="sm secondary" onClick={() => {
                                    setSlabForm({
                                      minQuantity: String(slab.minQuantity),
                                      maxQuantity: slab.maxQuantity != null ? String(slab.maxQuantity) : "",
                                      discountPct: String(slab.discountPct ?? 0),
                                      discountFlat: String(slab.discountFlat ?? 0),
                                      notes: slab.notes ?? "",
                                    });
                                    setShowSlabModal({ tierId: t.id, slab });
                                  }}>
                                    Edit
                                  </button>
                                  <button className="sm secondary" style={{ color: "var(--danger)" }} onClick={() => handleDeleteSlab(t.id, slab.id)}>
                                    Remove
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal: Add/Edit Tier */}
          {showTierModal && (
            <div className="modal-backdrop" style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
            }}>
              <div className="card" style={{ width: 500, maxWidth: "90vw", maxHeight: "90vh", overflowY: "auto" }}>
                <h3 style={{ marginTop: 0 }}>{editingTier ? `Edit Tier: ${editingTier.name}` : "Create New Pricing Tier"}</h3>
                <form onSubmit={handleSaveTier}>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Tier Name (e.g. Silver, Gold, Platinum)</label>
                    <input
                      value={tierForm.name}
                      onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div className="field">
                      <label>Base Discount (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={tierForm.discountPct}
                        onChange={(e) => setTierForm({ ...tierForm, discountPct: e.target.value })}
                        required
                      />
                    </div>
                    <div className="field">
                      <label>Min Monthly Spend (₹)</label>
                      <input
                        type="number"
                        step="100"
                        min="0"
                        value={tierForm.minMonthlySpend}
                        onChange={(e) => setTierForm({ ...tierForm, minMonthlySpend: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Credit Limit Multiplier (e.g. 1.0, 1.5, 2.0)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={tierForm.creditLimitMultiplier}
                      onChange={(e) => setTierForm({ ...tierForm, creditLimitMultiplier: e.target.value })}
                      required
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 16 }}>
                    <label>Description / Policy Notes</label>
                    <textarea
                      rows={3}
                      value={tierForm.description}
                      onChange={(e) => setTierForm({ ...tierForm, description: e.target.value })}
                      placeholder="Eligibility criteria, terms of credit, and special volume rules…"
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button type="button" className="secondary" onClick={() => setShowTierModal(false)}>Cancel</button>
                    <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save Tier"}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal: Add/Edit Slab Rule */}
          {showSlabModal && (
            <div className="modal-backdrop" style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
            }}>
              <div className="card" style={{ width: 460, maxWidth: "90vw" }}>
                <h3 style={{ marginTop: 0 }}>
                  {showSlabModal.slab ? "Edit Quantity Slab Rule" : "Add Quantity Slab Rule"}
                </h3>
                <form onSubmit={handleSaveSlab}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div className="field">
                      <label>Min Quantity (cases/bags)</label>
                      <input
                        type="number"
                        min="1"
                        value={slabForm.minQuantity}
                        onChange={(e) => setSlabForm({ ...slabForm, minQuantity: e.target.value })}
                        required
                      />
                    </div>
                    <div className="field">
                      <label>Max Quantity (leave empty for +)</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="Unlimited (+)"
                        value={slabForm.maxQuantity}
                        onChange={(e) => setSlabForm({ ...slabForm, maxQuantity: e.target.value })}
                      />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div className="field">
                      <label>Discount Percentage (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={slabForm.discountPct}
                        onChange={(e) => setSlabForm({ ...slabForm, discountPct: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label>Flat Discount (₹ / order)</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={slabForm.discountFlat}
                        onChange={(e) => setSlabForm({ ...slabForm, discountFlat: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="field" style={{ marginBottom: 16 }}>
                    <label>Rule Notes (optional)</label>
                    <input
                      value={slabForm.notes}
                      onChange={(e) => setSlabForm({ ...slabForm, notes: e.target.value })}
                      placeholder="e.g. Bulk dispatch rebate for full truckload"
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button type="button" className="secondary" onClick={() => setShowSlabModal(null)}>Cancel</button>
                    <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save Slab Rule"}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Gap 11 - Tax / GST Rates & HSN Code Master */}
      {tab === "tax" && (
        <div>
          <div className="between" style={{ marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0 }}>Tax / GST Rates & HSN Code Master</h2>
              <p className="page-sub">Harmonized System of Nomenclature (HSN) tariff directory with Indian GST rates, exemptions, and SKU mapping.</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="secondary" onClick={() => setShowApplyHsnModal(true)}>
                Map HSN to SKUs
              </button>
              <button onClick={() => {
                setEditingHsn(null);
                setHsnForm({
                  code: "",
                  description: "",
                  chapter: "Chapter 10 - Cereals",
                  gstPercent: "5",
                  isExempt: false,
                  exemptionNotes: "",
                });
                setShowHsnModal(true);
              }}>
                + Add HSN Code
              </button>
            </div>
          </div>

          {/* Metric cards */}
          {hsnData?.summary && (
            <div className="metrics" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
              <div className="metric card">
                <div className="metric-label">HSN Codes</div>
                <div className="metric-value">{hsnData.summary.totalHsnCodes}</div>
              </div>
              <div className="metric card">
                <div className="metric-label">Tax Exempt Codes</div>
                <div className="metric-value" style={{ color: "var(--green, #16a34a)" }}>{hsnData.summary.exemptCodes}</div>
              </div>
              <div className="metric card">
                <div className="metric-label">Standard GST Rates</div>
                <div className="metric-value" style={{ fontSize: 18 }}>
                  {(hsnData.summary.distinctRates ?? []).map((r: number) => `${r}%`).join(", ")}
                </div>
              </div>
              <div className="metric card">
                <div className="metric-label">Mapped Catalog Variants</div>
                <div className="metric-value">{hsnData.summary.totalVariantsMapped ?? 0}</div>
              </div>
            </div>
          )}

          {hsnLoading ? (
            <div className="card muted">Loading HSN codes…</div>
          ) : !hsnData || hsnData.hsnCodes.length === 0 ? (
            <div className="card empty-state">No HSN codes found.</div>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-muted, #f8f9fa)", textAlign: "left" }}>
                    <th style={{ padding: "12px 16px" }}>HSN Code</th>
                    <th style={{ padding: "12px 16px" }}>Description</th>
                    <th style={{ padding: "12px 16px" }}>Tariff Chapter</th>
                    <th style={{ padding: "12px 16px" }}>GST Rate</th>
                    <th style={{ padding: "12px 16px" }}>Exemption Status</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hsnData.hsnCodes.map((item: any) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid var(--border, #eee)" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 700, fontFamily: "monospace", fontSize: 14 }}>
                        {item.code}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 600 }}>{item.description}</div>
                        {item.exemptionNotes && (
                          <div className="muted small" style={{ color: "#d97706" }}>
                            Note: {item.exemptionNotes}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>
                        {item.chapter || "—"}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                        {item.isExempt ? (
                          <span style={{ color: "var(--green, #16a34a)" }}>0% (Exempt)</span>
                        ) : (
                          <span>{item.gstPercent}%</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {item.isExempt ? (
                          <span className="pill status-confirmed">Exempt</span>
                        ) : (
                          <span className="pill" style={{ background: "#e0f2fe", color: "#0369a1" }}>Taxable</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button className="sm secondary" onClick={() => {
                            setEditingHsn(item);
                            setHsnForm({
                              code: item.code,
                              description: item.description,
                              chapter: item.chapter ?? "",
                              gstPercent: String(item.gstPercent),
                              isExempt: Boolean(item.isExempt),
                              exemptionNotes: item.exemptionNotes ?? "",
                            });
                            setShowHsnModal(true);
                          }}>
                            Edit
                          </button>
                          <button className="sm secondary" style={{ color: "var(--danger)" }} onClick={() => handleDeleteHsn(item)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal: Add/Edit HSN */}
          {showHsnModal && (
            <div className="modal-backdrop" style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
            }}>
              <div className="card" style={{ width: 500, maxWidth: "90vw", maxHeight: "90vh", overflowY: "auto" }}>
                <h3 style={{ marginTop: 0 }}>{editingHsn ? `Edit HSN Code: ${editingHsn.code}` : "Add HSN / GST Tariff Code"}</h3>
                <form onSubmit={handleSaveHsn}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div className="field">
                      <label>HSN Tariff Code (4 to 8 digits)</label>
                      <input
                        value={hsnForm.code}
                        onChange={(e) => setHsnForm({ ...hsnForm, code: e.target.value })}
                        placeholder="e.g. 1006"
                        required
                      />
                    </div>
                    <div className="field">
                      <label>GST Rate (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="28"
                        value={hsnForm.gstPercent}
                        onChange={(e) => setHsnForm({ ...hsnForm, gstPercent: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Tariff Chapter / Section</label>
                    <input
                      value={hsnForm.chapter}
                      onChange={(e) => setHsnForm({ ...hsnForm, chapter: e.target.value })}
                      placeholder="e.g. Chapter 10 - Cereals"
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Tariff Description</label>
                    <textarea
                      rows={2}
                      value={hsnForm.description}
                      onChange={(e) => setHsnForm({ ...hsnForm, description: e.target.value })}
                      placeholder="e.g. Rice, broken rice, husk paddy"
                      required
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={hsnForm.isExempt}
                        onChange={(e) => setHsnForm({ ...hsnForm, isExempt: e.target.checked, gstPercent: e.target.checked ? "0" : hsnForm.gstPercent })}
                      />
                      <span>Is this item GST exempt by notification / law?</span>
                    </label>
                  </div>
                  {hsnForm.isExempt && (
                    <div className="field" style={{ marginBottom: 16 }}>
                      <label>Exemption Notification Notes</label>
                      <input
                        value={hsnForm.exemptionNotes}
                        onChange={(e) => setHsnForm({ ...hsnForm, exemptionNotes: e.target.value })}
                        placeholder="e.g. Notification 2/2017-CT - Unbranded food grains"
                      />
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button type="button" className="secondary" onClick={() => setShowHsnModal(false)}>Cancel</button>
                    <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save HSN Code"}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal: Bulk Apply HSN to Product Variants */}
          {showApplyHsnModal && data && (
            <div className="modal-backdrop" style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
            }}>
              <div className="card" style={{ width: 600, maxWidth: "90vw", maxHeight: "85vh", overflowY: "auto" }}>
                <h3 style={{ marginTop: 0 }}>Map HSN Code to Product SKUs</h3>
                <p className="page-sub">Selected SKU variants will be updated with this HSN code and its statutory GST rate.</p>
                <form onSubmit={handleApplyHsnToVariants}>
                  <div className="field" style={{ marginBottom: 14 }}>
                    <label>Select Target HSN Code</label>
                    <select
                      value={selectedHsnCode}
                      onChange={(e) => setSelectedHsnCode(e.target.value)}
                      required
                    >
                      {(hsnData?.hsnCodes ?? []).map((h: any) => (
                        <option key={h.code} value={h.code}>
                          HSN {h.code} — {h.description.slice(0, 45)} ({h.isExempt ? "Exempt 0%" : `${h.gstPercent}% GST`})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field" style={{ marginBottom: 14 }}>
                    <div className="between" style={{ marginBottom: 6 }}>
                      <label style={{ margin: 0 }}>Select Product Variants to Update ({selectedVariants.length} selected)</label>
                      <button
                        type="button"
                        className="sm secondary"
                        onClick={() => {
                          if (selectedVariants.length === data.variants.length) {
                            setSelectedVariants([]);
                          } else {
                            setSelectedVariants(data.variants.map((v: any) => v.id));
                          }
                        }}
                      >
                        {selectedVariants.length === data.variants.length ? "Deselect All" : "Select All"}
                      </button>
                    </div>

                    <div style={{ maxHeight: 250, overflowY: "auto", border: "1px solid var(--border, #dfe3e3)", borderRadius: 6, padding: 8 }}>
                      {data.variants.map((v: any) => (
                        <label key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", borderBottom: "1px solid #f5f5f5", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={selectedVariants.includes(v.id)}
                            onChange={() => {
                              setSelectedVariants((prev) =>
                                prev.includes(v.id) ? prev.filter((id) => id !== v.id) : [...prev, v.id]
                              );
                            }}
                          />
                          <span style={{ fontSize: 13 }}>
                            <strong>{v.product.name}</strong> · {v.unitSize} × {v.unitsPerCase} (Current GST: {v.gstPercent ?? "—"}%)
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button type="button" className="secondary" onClick={() => setShowApplyHsnModal(false)}>Cancel</button>
                    <button type="submit" disabled={busy || selectedVariants.length === 0}>
                      {busy ? "Applying…" : `Apply to ${selectedVariants.length} Variants`}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Trade Schemes & Promotion Engine (Gap 14) */}
      {tab === "schemes" && (
        <div>
          {/* KPI Cards */}
          <div className="grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 600 }}>TOTAL TRADE SCHEMES</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{schemes.length}</div>
              <div style={{ fontSize: 12, color: "#16a34a", marginTop: 2 }}>Configured in catalog</div>
            </div>

            <div className="card" style={{ padding: 14 }}>
              <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 600 }}>ACTIVE PROMOTIONS</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: "#165a31" }}>
                {schemes.filter((s) => s.active).length}
              </div>
              <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>Enabled for salesperson punching</div>
            </div>

            <div className="card" style={{ padding: 14 }}>
              <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 600 }}>LIVE PROMOTIONS NOW</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: "#2563eb" }}>
                {schemes.filter((s) => s.isLiveNow).length}
              </div>
              <div style={{ fontSize: 12, color: "#2563eb", marginTop: 2 }}>Within calendar date validity</div>
            </div>

            <div className="card" style={{ padding: 14 }}>
              <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 600 }}>FREE GOODS (FOC) SCHEMES</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: "#d97706" }}>
                {schemes.filter((s) => s.rewardType === "free_goods").length}
              </div>
              <div style={{ fontSize: 12, color: "#b45309", marginTop: 2 }}>Buy X, Get Y Free</div>
            </div>
          </div>

          {/* Action Row */}
          <div className="between" style={{ marginBottom: 14 }}>
            <div>
              <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Customer Schemes & Trade Promotions</h2>
              <p className="page-sub" style={{ margin: 0 }}>
                Configure wholesale quantity discounts, seasonal cash rebates, and free goods (FOC) incentives.
              </p>
            </div>
            <button
              className="primary"
              style={{ background: "#165a31", borderColor: "#165a31", fontWeight: 700 }}
              onClick={() => {
                setEditingScheme(null);
                setSchemeForm({
                  name: "",
                  headline: "",
                  description: "",
                  ruleType: "order_value",
                  targetAmount: "20000",
                  minQuantity: "10",
                  qualifyingVariantId: schemeVariants[0]?.id || "",
                  rewardType: "flat_discount",
                  rewardValue: "750",
                  freeVariantId: schemeVariants[0]?.id || "",
                  targetAudience: "all_retailers",
                  targetTierId: schemeTiers[0]?.id || "",
                  targetTerritory: "Indore Central",
                  active: true,
                  startsAt: new Date().toISOString().split("T")[0],
                  endsAt: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
                });
                setShowSchemeModal(true);
              }}
            >
              ➕ Create Promotional Scheme
            </button>
          </div>

          {schemesLoading ? (
            <p>Loading promotional schemes…</p>
          ) : schemes.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
              No trade schemes found. Click <strong>Create Promotional Scheme</strong> to set up promotional rules.
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", textAlign: "left", color: "#4b5563" }}>
                      <th style={{ padding: "10px 14px" }}>Scheme / Offer Title</th>
                      <th style={{ padding: "10px 14px" }}>Trigger Condition</th>
                      <th style={{ padding: "10px 14px" }}>Commercial Reward</th>
                      <th style={{ padding: "10px 14px" }}>Target Audience</th>
                      <th style={{ padding: "10px 14px" }}>Validity Period</th>
                      <th style={{ padding: "10px 14px" }}>Status</th>
                      <th style={{ padding: "10px 14px", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schemes.map((s) => {
                      let conditionLabel = `Min Order ${inr(s.targetAmount)}`;
                      if (s.ruleType === "product_qty") {
                        conditionLabel = `Order min ${s.minQuantity} cases of ${s.qualifyingVariantName || "Product"}`;
                      } else if (s.ruleType === "volume_slab") {
                        conditionLabel = `Volume threshold: ${inr(s.targetAmount)}`;
                      }

                      let rewardBadge = s.rewardValue != null ? `₹${s.rewardValue} Flat Off` : (s.headline || "Promotional Discount");
                      let rewardColor = "#065f46";
                      let rewardBg = "#ecfdf5";
                      if (s.rewardType === "percentage_discount") {
                        rewardBadge = s.rewardValue != null ? `${s.rewardValue}% Discount` : "Special Discount";
                        rewardColor = "#1e40af";
                        rewardBg = "#dbeafe";
                      } else if (s.rewardType === "free_goods") {
                        rewardBadge = `Free: ${s.freeVariantName || "Goods FOC"}`;
                        rewardColor = "#92400e";
                        rewardBg = "#fef3c7";
                      }

                      return (
                        <tr key={s.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ fontWeight: 700, color: "#111827", fontSize: 14 }}>{s.name}</div>
                            {s.headline && (
                              <div style={{ color: "#d97706", fontSize: 12, fontWeight: 600, marginTop: 2 }}>
                                ⭐ {s.headline}
                              </div>
                            )}
                            {s.description && (
                              <div style={{ color: "#6b7280", fontSize: 11, marginTop: 2, maxWidth: 320 }}>
                                {s.description}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "12px 14px", color: "#374151" }}>
                            <strong>{conditionLabel}</strong>
                            <div style={{ fontSize: 11, color: "#6b7280", textTransform: "capitalize" }}>
                              Rule: {s.ruleType.replace("_", " ")}
                            </div>
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 700,
                                background: rewardBg,
                                color: rewardColor,
                              }}
                            >
                              {rewardBadge}
                            </span>
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ fontWeight: 600, color: "#374151" }}>
                              {s.targetAudience === "all_retailers"
                                ? "🌐 All Retailers"
                                : s.targetAudience === "tier"
                                ? `🏅 Tier: ${s.targetTierName || "Target Tier"}`
                                : `📍 Territory: ${s.targetTerritory}`}
                            </div>
                          </td>
                          <td style={{ padding: "12px 14px", fontSize: 12, color: "#4b5563" }}>
                            <div>From: {new Date(s.startsAt).toLocaleDateString("en-IN")}</div>
                            <div>Until: {new Date(s.endsAt).toLocaleDateString("en-IN")}</div>
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 12,
                                fontSize: 11,
                                fontWeight: 700,
                                background: s.active ? (s.isLiveNow ? "#dcfce7" : "#fef3c7") : "#fee2e2",
                                color: s.active ? (s.isLiveNow ? "#15803d" : "#b45309") : "#b91c1c",
                              }}
                            >
                              {s.active ? (s.isLiveNow ? "● Live Now" : "● Scheduled") : "○ Paused"}
                            </span>
                          </td>
                          <td style={{ padding: "12px 14px", textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: 6 }}>
                              <button
                                type="button"
                                className="sm secondary"
                                style={{ fontSize: 11 }}
                                onClick={() => void handleToggleSchemeActive(s.id)}
                              >
                                {s.active ? "Pause" : "Activate"}
                              </button>
                              <button
                                type="button"
                                className="sm secondary"
                                style={{ fontSize: 11 }}
                                onClick={() => {
                                  setEditingScheme(s);
                                  setSchemeForm({
                                    name: s.name,
                                    headline: s.headline || "",
                                    description: s.description || "",
                                    ruleType: s.ruleType || "order_value",
                                    targetAmount: String(s.targetAmount || 0),
                                    minQuantity: String(s.minQuantity || 1),
                                    qualifyingVariantId: s.qualifyingVariantId || "",
                                    rewardType: s.rewardType || "flat_discount",
                                    rewardValue: String(s.rewardValue || s.discountAmount || 0),
                                    freeVariantId: s.freeVariantId || "",
                                    targetAudience: s.targetAudience || "all_retailers",
                                    targetTierId: s.targetTierId || "",
                                    targetTerritory: s.targetTerritory || "",
                                    active: s.active,
                                    startsAt: new Date(s.startsAt).toISOString().split("T")[0],
                                    endsAt: new Date(s.endsAt).toISOString().split("T")[0],
                                  });
                                  setShowSchemeModal(true);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="sm ghost"
                                style={{ fontSize: 11, color: "#dc2626" }}
                                onClick={() => void handleDeleteScheme(s.id, s.name)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Modal: Create / Edit Scheme */}
          {showSchemeModal && (
            <div className="modal-backdrop" style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
            }}>
              <div className="card" style={{ width: 620, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
                <h3 style={{ marginTop: 0 }}>
                  {editingScheme ? `Edit Scheme: ${editingScheme.name}` : "Create Promotional Trade Scheme"}
                </h3>
                <form onSubmit={handleSaveScheme}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div className="field">
                      <label>Scheme Name *</label>
                      <input
                        value={schemeForm.name}
                        onChange={(e) => setSchemeForm({ ...schemeForm, name: e.target.value })}
                        placeholder="e.g. Diwali Dhamaka Special"
                        required
                      />
                    </div>
                    <div className="field">
                      <label>Catchy Headline / Badge</label>
                      <input
                        value={schemeForm.headline}
                        onChange={(e) => setSchemeForm({ ...schemeForm, headline: e.target.value })}
                        placeholder="e.g. Flat ₹750 Off on ₹20k Order"
                        required
                      />
                    </div>
                  </div>

                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Description & Terms</label>
                    <textarea
                      rows={2}
                      value={schemeForm.description}
                      onChange={(e) => setSchemeForm({ ...schemeForm, description: e.target.value })}
                      placeholder="e.g. Applicable on all dry staples orders punched before Diwali"
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div className="field">
                      <label>Rule Condition Type</label>
                      <select
                        value={schemeForm.ruleType}
                        onChange={(e) => setSchemeForm({ ...schemeForm, ruleType: e.target.value as any })}
                      >
                        <option value="order_value">Total Order Value (₹ threshold)</option>
                        <option value="product_qty">Product Quantity (Buy X cases)</option>
                        <option value="volume_slab">Volume Slab Rebate</option>
                      </select>
                    </div>

                    {schemeForm.ruleType === "product_qty" ? (
                      <div className="field">
                        <label>Minimum Cases Required *</label>
                        <input
                          type="number"
                          min="1"
                          value={schemeForm.minQuantity}
                          onChange={(e) => setSchemeForm({ ...schemeForm, minQuantity: e.target.value })}
                          required
                        />
                      </div>
                    ) : (
                      <div className="field">
                        <label>Target Order Amount (₹) *</label>
                        <input
                          type="number"
                          min="0"
                          value={schemeForm.targetAmount}
                          onChange={(e) => setSchemeForm({ ...schemeForm, targetAmount: e.target.value })}
                          required
                        />
                      </div>
                    )}
                  </div>

                  {schemeForm.ruleType === "product_qty" && (
                    <div className="field" style={{ marginBottom: 12 }}>
                      <label>Qualifying Product SKU Variant</label>
                      <select
                        value={schemeForm.qualifyingVariantId}
                        onChange={(e) => setSchemeForm({ ...schemeForm, qualifyingVariantId: e.target.value })}
                      >
                        <option value="">-- Any / All Product Variants --</option>
                        {schemeVariants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.product.name} ({v.unitSize})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div className="field">
                      <label>Reward / Benefit Type</label>
                      <select
                        value={schemeForm.rewardType}
                        onChange={(e) => setSchemeForm({ ...schemeForm, rewardType: e.target.value as any })}
                      >
                        <option value="flat_discount">Flat Cash Discount (₹)</option>
                        <option value="percentage_discount">Percentage Discount (%)</option>
                        <option value="free_goods">Free Goods (FOC Item)</option>
                      </select>
                    </div>

                    <div className="field">
                      <label>
                        {schemeForm.rewardType === "percentage_discount"
                          ? "Discount Percentage (%)"
                          : schemeForm.rewardType === "flat_discount"
                          ? "Discount Amount (₹)"
                          : "Free Quantity (Cases/Units)"}
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={schemeForm.rewardValue}
                        onChange={(e) => setSchemeForm({ ...schemeForm, rewardValue: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  {schemeForm.rewardType === "free_goods" && (
                    <div className="field" style={{ marginBottom: 12 }}>
                      <label>Free Goods (FOC) SKU Variant *</label>
                      <select
                        value={schemeForm.freeVariantId}
                        onChange={(e) => setSchemeForm({ ...schemeForm, freeVariantId: e.target.value })}
                        required
                      >
                        <option value="">-- Choose Free Goods SKU --</option>
                        {schemeVariants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.product.name} ({v.unitSize})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div className="field">
                      <label>Target Audience</label>
                      <select
                        value={schemeForm.targetAudience}
                        onChange={(e) => setSchemeForm({ ...schemeForm, targetAudience: e.target.value as any })}
                      >
                        <option value="all_retailers">All Retailers</option>
                        <option value="tier">Specific Pricing Tier</option>
                        <option value="territory">Specific Delivery Territory</option>
                      </select>
                    </div>

                    {schemeForm.targetAudience === "tier" ? (
                      <div className="field">
                        <label>Eligible Tier</label>
                        <select
                          value={schemeForm.targetTierId}
                          onChange={(e) => setSchemeForm({ ...schemeForm, targetTierId: e.target.value })}
                        >
                          {schemeTiers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : schemeForm.targetAudience === "territory" ? (
                      <div className="field">
                        <label>Target Territory / Route</label>
                        <input
                          value={schemeForm.targetTerritory}
                          onChange={(e) => setSchemeForm({ ...schemeForm, targetTerritory: e.target.value })}
                          placeholder="e.g. Indore Central"
                          required
                        />
                      </div>
                    ) : (
                      <div className="field">
                        <label>Scope</label>
                        <input value="Universal Wholesale Promotion" disabled style={{ background: "#f3f4f6" }} />
                      </div>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <div className="field">
                      <label>Starts At *</label>
                      <input
                        type="date"
                        value={schemeForm.startsAt}
                        onChange={(e) => setSchemeForm({ ...schemeForm, startsAt: e.target.value })}
                        required
                      />
                    </div>
                    <div className="field">
                      <label>Ends At *</label>
                      <input
                        type="date"
                        value={schemeForm.endsAt}
                        onChange={(e) => setSchemeForm({ ...schemeForm, endsAt: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button type="button" className="secondary" onClick={() => setShowSchemeModal(false)}>
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={busy}
                      style={{ background: "#165a31", borderColor: "#165a31", fontWeight: 700 }}
                    >
                      {busy ? "Saving…" : editingScheme ? "Update Scheme" : "Launch Scheme"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
