import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { explain } from "../errorCopy";
import { openExpenseReceipt } from "./expenseReceipt";

type ClaimStatus = "submitted" | "approved" | "rejected";
type Total = { count: number; amount: string };
type Expense = {
  id: string;
  expenseDate: string;
  category: string;
  amount: string;
  description: string;
  status: ClaimStatus;
  decisionNote: string | null;
  decidedAt: string | null;
  hasReceipt: boolean;
  receiptUrl: string | null;
};
type History = {
  salesperson: { id: string; name: string };
  totals: { claimed: Total } & Record<ClaimStatus, Total>;
  expenses: Expense[];
  nextCursor: string | null;
};

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const statusTone: Record<ClaimStatus, string> = {
  submitted: "pending",
  approved: "confirmed",
  rejected: "rejected",
};

function amount(value: string) {
  return currency.format(Number(value));
}

export default function ExpenseClaims({ salespersonId }: { salespersonId: string }) {
  const selectionRef = useRef({ salespersonId });
  if (selectionRef.current.salespersonId !== salespersonId) selectionRef.current = { salespersonId };
  const selection = selectionRef.current;
  const mountedRef = useRef(true);
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const visibleHistory = history?.salesperson.id === salespersonId ? history : null;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setHistory(null);
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    void api.expenseHistory(salespersonId).then((result: History) => {
      if (!cancelled) setHistory(result);
    }).catch((err: unknown) => {
      if (!cancelled) setError(explain(err, "Could not load expense claims"));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [salespersonId]);

  const loadOlder = async () => {
    if (!visibleHistory?.nextCursor) return;
    const currentHistory = visibleHistory;
    setLoadingMore(true);
    try {
      const older: History = await api.expenseHistory(salespersonId, currentHistory.nextCursor!);
      if (!mountedRef.current || selectionRef.current !== selection) return;
      setHistory({ ...older, expenses: [...currentHistory.expenses, ...older.expenses] });
      setError(null);
    } catch (err) {
      if (mountedRef.current && selectionRef.current === selection) setError(explain(err, "Could not load older claims"));
    } finally {
      if (mountedRef.current && selectionRef.current === selection) setLoadingMore(false);
    }
  };

  const viewReceipt = async (expenseId: string) => {
    try {
      await openExpenseReceipt(salespersonId, expenseId, () => mountedRef.current && selectionRef.current === selection);
    } catch (err) {
      if (mountedRef.current && selectionRef.current === selection) setError(explain(err, "Could not open receipt"));
    }
  };

  return (
    <section className="card">
      <h2 className="section-title">Expense claims</h2>
      {loading ? <p className="muted small">Loading claims…</p> : null}
      {error ? <p className="banner error">{error}</p> : null}
      {visibleHistory ? <>
        <p className="section-copy">{visibleHistory.salesperson.name} · <span>Includes submitted, approved, and rejected claims.</span></p>
        <div className="role-list">
          {([
            ["Cumulative claimed", visibleHistory.totals.claimed],
            ["Submitted claims", visibleHistory.totals.submitted],
            ["Approved claims", visibleHistory.totals.approved],
            ["Rejected claims", visibleHistory.totals.rejected],
          ] as const).map(([label, total]) => (
            <div className="role-row" key={label}>
              <span>{label} <span className="small muted">({total.count})</span></span>
              <strong>{amount(total.amount)}</strong>
            </div>
          ))}
        </div>
        {visibleHistory.expenses.length === 0 ? <p className="muted small">No expense claims recorded.</p> : <div className="expense-history-table">
          <table>
            <thead><tr><th>Date</th><th>Category</th><th>Amount</th><th>Description</th><th>Status</th><th>Decision</th><th>Receipt</th></tr></thead>
            <tbody>{visibleHistory.expenses.map((expense) => (
              <tr key={expense.id}>
                <td>{new Date(expense.expenseDate).toLocaleDateString("en-IN")}</td>
                <td>{expense.category}</td>
                <td>{amount(expense.amount)}</td>
                <td>{expense.description}</td>
                <td><span className={`pill ${statusTone[expense.status]}`}>{expense.status}</span></td>
                <td className="small">{[
                  expense.decidedAt ? new Date(expense.decidedAt).toLocaleDateString("en-IN") : null,
                  expense.decisionNote,
                ].filter(Boolean).join(" · ") || "—"}</td>
                <td>{expense.hasReceipt ? <button className="expense-person-button" onClick={() => void viewReceipt(expense.id)} aria-label="View receipt">View</button> : "None"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>}
        {visibleHistory.nextCursor ? <button className="secondary sm" disabled={loadingMore} onClick={() => void loadOlder()}>{loadingMore ? "Loading…" : "Load older claims"}</button> : null}
      </> : null}
    </section>
  );
}
