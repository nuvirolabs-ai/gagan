import { useCallback, useEffect, useState } from "react";
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
      await api.recordPayment(selected!, value, crypto.randomUUID());
      setNotice(`Payment of ${inr(value)} recorded`);
      setAmount("");
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

          {!reconciliationRequired && <form className="card" onSubmit={recordPayment}>
            <h3 style={{ marginTop: 0, fontSize: 15 }}>Record a payment</h3>
            <div className="row">
              <div className="grow" style={{ maxWidth: 220 }}>
                <input
                  type="number"
                  min={1}
                  placeholder="Amount received"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <button type="submit" disabled={busy || !current}>
                {busy ? "Recording…" : "Record payment"}
              </button>
            </div>
          </form>}

          <div className="card" style={{ padding: 0 }}>
            {data.entries.length === 0 ? (
              <div style={{ padding: 22 }} className="muted">
                No transactions yet. Invoices post automatically when an order is delivered.
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
                  {data.entries.map((e: any) => (
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
