import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api, inr } from "../api";

const LEDGER_LABELS: Record<string, string> = {
  invoice: "Invoice",
  payment: "Payment",
  credit_note: "Credit note",
  payment_reversal: "Payment reversal",
};

type EntityKey = "jainTraders" | "padamInternational" | "unattributed";
type EntityAmounts = Record<EntityKey, number>;
type AttributionStatus = "complete" | "contains_unattributed" | "review_required";
type EntityBalance = EntityAmounts & { attributionStatus?: AttributionStatus };

const ENTITY_LABELS: Record<EntityKey, string> = {
  jainTraders: "Jain Traders",
  padamInternational: "Padam International",
  unattributed: "Unattributed / legacy",
};

function entityAmountsMatchTotal(value: EntityAmounts | null | undefined, expectedTotal: number) {
  if (!value || !Number.isFinite(expectedTotal) || expectedTotal < 0) return false;
  const keys: EntityKey[] = ["jainTraders", "padamInternational", "unattributed"];
  if (!keys.every((key) => Number.isFinite(value[key]) && value[key] >= 0)) return false;
  const sumCents = keys.reduce((sum, key) => sum + Math.round(value[key] * 100), 0);
  return sumCents === Math.round(expectedTotal * 100);
}

function entityRows(value: EntityBalance | null | undefined, expectedTotal: number, fallbackStatus?: AttributionStatus) {
  if (!value) {
    if (fallbackStatus !== "review_required") return null;
    return {
      rows: Number.isFinite(expectedTotal) && expectedTotal >= 0
        ? [{ key: "unattributed" as const, amount: Math.round(expectedTotal * 100) / 100 }]
        : [],
      status: "review_required" as const,
    };
  }
  const keys: EntityKey[] = ["jainTraders", "padamInternational", "unattributed"];
  const status = value.attributionStatus ?? fallbackStatus;
  const expectedCents = Number.isFinite(expectedTotal) && expectedTotal >= 0
    ? Math.round(expectedTotal * 100)
    : null;
  if (!entityAmountsMatchTotal(value, expectedTotal)) {
    return {
      rows: expectedCents == null ? [] : [{ key: "unattributed" as const, amount: expectedCents / 100 }],
      status: "review_required" as const,
    };
  }
  if (status === "review_required" && (value.jainTraders > 0 || value.padamInternational > 0)) {
    return {
      rows: expectedCents == null ? [] : [{ key: "unattributed" as const, amount: expectedCents / 100 }],
      status: "review_required" as const,
    };
  }

  const sumCents = keys.reduce((sum, key) => sum + Math.round(value[key] * 100), 0);
  if (sumCents === 0 && status !== "review_required") return null;
  const rows: Array<{ key: EntityKey; amount: number }> = [];
  if (value.jainTraders > 0 || value.padamInternational > 0) {
    rows.push({ key: "jainTraders", amount: value.jainTraders });
    rows.push({ key: "padamInternational", amount: value.padamInternational });
  }
  if (value.unattributed > 0 || (status === "review_required" && rows.length === 0)) {
    rows.push({ key: "unattributed", amount: value.unattributed });
  }
  return { rows, status };
}

function EntityAttribution({
  value,
  expectedTotal,
  overdue,
  expectedOverdue,
  status,
  compact = false,
}: {
  value?: EntityBalance | null;
  expectedTotal: number;
  overdue?: EntityAmounts | null;
  expectedOverdue?: number;
  status?: AttributionStatus;
  compact?: boolean;
}) {
  const attribution = entityRows(value, expectedTotal, status);
  const reconciledOverdue = entityAmountsMatchTotal(overdue, expectedOverdue ?? Number.NaN) ? overdue : null;
  if (!attribution || (attribution.rows.length === 0 && attribution.status !== "review_required")) return null;

  return (
    <div className={compact ? "entity-ledger" : "entity-summary"} aria-label="Company-wise balance">
      {!compact ? <h2>Company-wise balance</h2> : null}
      <div className={compact ? "entity-ledger-rows" : "entity-summary-rows"}>
        {attribution.rows.map((row) => (
          <div className="entity-row" key={row.key}>
            <span className="entity-name">{ENTITY_LABELS[row.key]}</span>
            <strong>{inr(row.amount)}</strong>
            {!compact && reconciledOverdue && reconciledOverdue[row.key] > 0 ? (
              <small>{inr(reconciledOverdue[row.key])} overdue</small>
            ) : null}
          </div>
        ))}
      </div>
      {attribution.status === "contains_unattributed" ? (
        <p className="entity-note">Some historical or unallocated amounts are shown separately.</p>
      ) : null}
      {attribution.status === "review_required" ? (
        <p className="entity-warning"><strong>Review required.</strong> This amount has not been assigned to a company.</p>
      ) : null}
    </div>
  );
}

export default function Ledger() {
  const { retailerId } = useParams();
  const [retailers, setRetailers] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | undefined>(retailerId);
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("NEFT / RTGS");
  const [bankAccount, setBankAccount] = useState("Jain Traders - HDFC Bank A/C 50200012345678");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [invoiceScopeId, setInvoiceScopeId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .retailers()
      .then((r) => {
        setRetailers(r.retailers);
        if (!selected && r.retailers[0]) setSelected(r.retailers[0].id);
      })
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    if (!selected) return;
    try {
      setData(await api.ledger(selected));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load ledger");
    }
  }, [selected]);

  useEffect(() => {
    load();
  }, [load]);

  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (data?.financialSummary?.reconciliationRequired) {
      setError("Account balance is under review. Resolve the financial mismatch before recording a payment.");
      return;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a payment amount greater than zero");
      return;
    }
    setBusy(true);
    try {
      await api.recordPayment(selected!, value, crypto.randomUUID(), {
        paymentMode,
        bankAccount,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        invoiceScopeId: invoiceScopeId || undefined,
      });
      setNotice(`Payment of ${inr(value)} recorded via ${paymentMode}${reference ? ` (Ref: ${reference})` : ""}`);
      setAmount("");
      setReference("");
      setNotes("");
      setInvoiceScopeId("");
      setError(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record payment");
    } finally {
      setBusy(false);
    }
  };

  const current = retailers.find((r) => r.id === selected);
  const reconciliationRequired = Boolean(data?.financialSummary?.reconciliationRequired);

  const filteredEntries = useMemo(() => {
    if (!data?.entries) return [];
    return data.entries.filter((e: any) => {
      const entryDate = new Date(e.createdAt);
      if (dateFrom && entryDate < new Date(dateFrom)) return false;
      if (dateTo) {
        const toDateObj = new Date(dateTo);
        toDateObj.setHours(23, 59, 59, 999);
        if (entryDate > toDateObj) return false;
      }
      return true;
    });
  }, [data?.entries, dateFrom, dateTo]);

  const exportLedgerCsv = () => {
    if (!filteredEntries || filteredEntries.length === 0) return;
    const retailerName = current?.name || "Retailer";
    const headers = [
      "Date",
      "Retailer",
      "Type",
      "Reference",
      "Jain Traders (INR)",
      "Padam International (INR)",
      "Debit (+INR)",
      "Credit (-INR)",
      "Balance After (INR)",
    ];
    const rows = filteredEntries.map((e: any) => {
      const isDebit = e.direction ? e.direction === "debit" : e.type === "invoice";
      const amt = Number(e.amount);
      const jainAmt = e.entityBreakdown?.jainTraders ?? "";
      const padamAmt = e.entityBreakdown?.padamInternational ?? "";
      const ref = e.invoice ? `Invoice #${e.invoice.invoiceNumber}` : (e.payment?.id || e.idempotencyKey || "—");
      const d = new Date(e.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      return [
        d,
        retailerName,
        LEDGER_LABELS[e.kind] ?? (isDebit ? "Invoice" : "Payment"),
        ref,
        jainAmt ? Number(jainAmt).toFixed(2) : "0.00",
        padamAmt ? Number(padamAmt).toFixed(2) : "0.00",
        isDebit ? amt.toFixed(2) : "",
        !isDebit ? amt.toFixed(2) : "",
        Number(e.balanceAfter).toFixed(2),
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`);
    });
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r: string[]) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ledger_${retailerName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h1 className="page-title">Ledger</h1>
      <p className="page-sub">Invoices, payments and running balance per retailer.</p>

      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner success">{notice}</div>}

      <div className="card">
        <div className="field" style={{ marginBottom: 0, maxWidth: 320 }}>
          <label>Retailer</label>
          <select value={selected ?? ""} onChange={(e) => setSelected(e.target.value)}>
            {retailers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {data && (
        <>
          {reconciliationRequired ? (
            <div className="banner error" role="alert">
              <strong>Account balance under review</strong>. The invoice projection and historical balance disagree. Do not collect or record a payment until the financial records are reconciled.
            </div>
          ) : null}
          <div className="metrics">
            <div className="metric">
              <div className="metric-label">Outstanding</div>
              <div className="metric-value">{reconciliationRequired ? "—" : inr(data.currentBalance)}</div>
            </div>
            <div className="metric">
              <div className="metric-label">Credit limit</div>
              <div className="metric-value">{inr(data.creditLimit)}</div>
            </div>
            <div className="metric">
              <div className="metric-label">Available</div>
              <div className="metric-value" style={{ color: "var(--green)" }}>
                {reconciliationRequired ? "—" : inr(Math.max(data.creditLimit - data.currentBalance, 0))}
              </div>
            </div>
            <div className="metric">
              <div className="metric-label">Overdue</div>
              <div
                className="metric-value"
                style={{ color: data.overdueAmount > 0 ? "var(--danger)" : undefined }}
              >
                {reconciliationRequired ? "—" : inr(data.overdueAmount)}
              </div>
            </div>
          </div>

          {!reconciliationRequired && <EntityAttribution
            value={data.financialSummary?.entityBalances?.outstanding}
            overdue={data.financialSummary?.entityBalances?.overdue}
            expectedOverdue={Number(data.overdueAmount)}
            status={data.financialSummary?.entityBalances?.attributionStatus}
            expectedTotal={Number(data.currentBalance)}
          />}

          {!reconciliationRequired && (
            <form className="card" onSubmit={recordPayment} style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 8, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, borderBottom: "1px solid #f1f5f9", paddingBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
                  💳 Record Offline Payment / Bank Collection
                </h3>
                <span style={{ fontSize: 11, background: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: 12, fontWeight: 600 }}>
                  Accounts Entry
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 12 }}>
                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Amount Received (₹) *</label>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    placeholder="e.g. 50000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Payment Mode</label>
                  <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                    <option value="NEFT / RTGS">NEFT / RTGS (Bank Transfer)</option>
                    <option value="Cheque / DD">Cheque / Demand Draft</option>
                    <option value="UPI">UPI (QR / VPA)</option>
                    <option value="IMPS">IMPS Immediate Transfer</option>
                    <option value="Cash Counter">Cash Counter Collection</option>
                  </select>
                </div>

                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Deposited To Bank Account</label>
                  <select value={bankAccount} onChange={(e) => setBankAccount(e.target.value)}>
                    <option value="Jain Traders - HDFC Bank A/C 50200012345678">Jain Traders - HDFC Bank (Indore Branch)</option>
                    <option value="Padam International - ICICI Bank A/C 001105001234">Padam International - ICICI Bank (Indore Branch)</option>
                    <option value="Cash Counter">Cash Counter / Petty Cash</option>
                  </select>
                </div>

                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>UTR / Cheque No / Ref</label>
                  <input
                    type="text"
                    placeholder="e.g. UTR12345678 / CHQ-00123"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
                    Bill-by-Bill Allocation (Optional)
                  </label>
                  <select value={invoiceScopeId} onChange={(e) => setInvoiceScopeId(e.target.value)}>
                    <option value="">Auto-allocate across oldest invoices (FIFO)</option>
                    {(data.openInvoices ?? []).map((inv: any) => (
                      <option key={inv.id} value={inv.id}>
                        Invoice #{inv.invoiceNumber} · {inv.billingEntity} · Due: {inr(inv.outstandingAmount)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Remarks / Narration</label>
                  <input
                    type="text"
                    placeholder="e.g. Received against Indore dispatch"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" disabled={busy || !current} className="primary" style={{ padding: "8px 20px" }}>
                  {busy ? "Recording & Settling…" : "✓ Confirm & Post Payment"}
                </button>
              </div>
            </form>
          )}

          {data.openInvoices && data.openInvoices.length > 0 && (
            <div className="card" style={{ padding: 14, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <strong style={{ fontSize: 14, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
                  📑 Open / Unsettled Invoices ({data.openInvoices.length})
                </strong>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Total Outstanding: <strong>{inr(data.openInvoices.reduce((s: number, i: any) => s + i.outstandingAmount, 0))}</strong>
                </span>
              </div>
              <table style={{ width: "100%", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={{ textAlign: "left", padding: "6px 10px" }}>Invoice #</th>
                    <th style={{ textAlign: "left", padding: "6px 10px" }}>Billing Entity</th>
                    <th style={{ textAlign: "left", padding: "6px 10px" }}>Date</th>
                    <th style={{ textAlign: "right", padding: "6px 10px" }}>Total</th>
                    <th style={{ textAlign: "right", padding: "6px 10px" }}>Outstanding</th>
                    <th style={{ textAlign: "center", padding: "6px 10px" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.openInvoices.map((inv: any) => (
                    <tr key={inv.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 600 }}>#{inv.invoiceNumber}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          background: inv.billingEntity === "Padam International" ? "#fef3c7" : "#e0f2fe",
                          color: inv.billingEntity === "Padam International" ? "#92400e" : "#0369a1",
                        }}>
                          {inv.billingEntity}
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px", color: "#64748b", fontSize: 12 }}>
                        {new Date(inv.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>{inr(inv.total)}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#b91c1c" }}>
                        {inr(inv.outstandingAmount)}
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "center" }}>
                        <button
                          type="button"
                          className="button compact ghost"
                          style={{ fontSize: 11, padding: "3px 8px", height: "auto" }}
                          onClick={() => {
                            setInvoiceScopeId(inv.id);
                            setAmount(String(inv.outstandingAmount));
                            if (inv.billingEntity === "Padam International") {
                              setBankAccount("Padam International - ICICI Bank A/C 001105001234");
                            } else {
                              setBankAccount("Jain Traders - HDFC Bank A/C 50200012345678");
                            }
                          }}
                        >
                          Select Bill
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="card" style={{ padding: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <strong style={{ fontSize: 14, color: "#0f172a" }}>Statement Entries</strong>
                <span style={{ fontSize: 12, color: "#64748b" }}>({filteredEntries.length} transactions)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Filter Date:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={{ fontSize: 12, padding: "3px 6px", borderRadius: 4, border: "1px solid #cbd5e1" }}
                  placeholder="From Date"
                  aria-label="From Date"
                />
                <span style={{ fontSize: 12, color: "#94a3b8" }}>to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={{ fontSize: 12, padding: "3px 6px", borderRadius: 4, border: "1px solid #cbd5e1" }}
                  placeholder="To Date"
                  aria-label="To Date"
                />
                {(dateFrom || dateTo) && (
                  <button
                    type="button"
                    className="button compact ghost"
                    style={{ fontSize: 11, padding: "3px 6px", height: "auto" }}
                    onClick={() => { setDateFrom(""); setDateTo(""); }}
                  >
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  onClick={exportLedgerCsv}
                  disabled={filteredEntries.length === 0}
                  className="button compact primary"
                  style={{ fontSize: 12, padding: "5px 12px", height: "auto", display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  📥 Export Statement (CSV)
                </button>
              </div>
            </div>

            {filteredEntries.length === 0 ? (
              <div style={{ padding: 22 }} className="muted">
                No transactions match the selected date range.
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Reference</th>
                    <th className="right">Amount</th>
                    <th className="right">Balance after</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((e: any) => (
                    <tr key={e.id}>
                      <td className="small">
                        {new Date(e.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td>
                        <span className={`pill ${(e.direction ? e.direction === "debit" : e.type === "invoice") ? "placed" : "delivered"}`}>
                          {LEDGER_LABELS[e.kind] ?? "Ledger entry"}
                        </span>
                      </td>
                      <td className="muted small">
                        {e.invoice
                          ? `Invoice #${e.invoice.invoiceNumber}`
                          : e.payment?.id ?? "—"}
                        <EntityAttribution value={e.entityBreakdown} expectedTotal={Number(e.amount)} compact />
                      </td>
                      <td
                        className="right"
                        style={{
                          fontWeight: 700,
                          color: (e.direction ? e.direction === "debit" : e.type === "invoice") ? "var(--danger)" : "var(--green)",
                        }}
                      >
                        {e.direction ? (e.direction === "debit" ? "+" : "−") : e.type === "invoice" ? "+" : "−"}
                        {inr(Number(e.amount))}
                      </td>
                      <td className="right">{inr(Number(e.balanceAfter))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
