import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, inr } from "../api";

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
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a payment amount greater than zero");
      return;
    }
    setBusy(true);
    try {
      await api.recordPayment(selected!, value);
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
          <div className="metrics">
            <div className="metric">
              <div className="metric-label">Outstanding</div>
              <div className="metric-value">{inr(data.currentBalance)}</div>
            </div>
            <div className="metric">
              <div className="metric-label">Credit limit</div>
              <div className="metric-value">{inr(data.creditLimit)}</div>
            </div>
            <div className="metric">
              <div className="metric-label">Available</div>
              <div className="metric-value" style={{ color: "var(--green)" }}>
                {inr(Math.max(data.creditLimit - data.currentBalance, 0))}
              </div>
            </div>
            <div className="metric">
              <div className="metric-label">Overdue</div>
              <div
                className="metric-value"
                style={{ color: data.overdueAmount > 0 ? "var(--danger)" : undefined }}
              >
                {inr(data.overdueAmount)}
              </div>
            </div>
          </div>

          <form className="card" onSubmit={recordPayment}>
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
          </form>

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
                        <span className={`pill ${e.type === "invoice" ? "placed" : "delivered"}`}>
                          {e.type === "invoice" ? "Invoice" : "Payment"}
                        </span>
                      </td>
                      <td className="muted small">
                        {e.order ? `GGN-${String(e.order.orderNo).padStart(5, "0")}` : "—"}
                      </td>
                      <td
                        className="right"
                        style={{
                          fontWeight: 700,
                          color: e.type === "invoice" ? "var(--danger)" : "var(--green)",
                        }}
                      >
                        {e.type === "invoice" ? "+" : "−"}
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
