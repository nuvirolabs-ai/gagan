import { useEffect, useState } from "react";
import { api, inr } from "../api";

const TABS = ["submitted", "approved", "rejected"] as const;

/**
 * Expense claims from the field. Approving one records a decision against the
 * claim; it does not post anything to the ledger — accounting treatment stays
 * outside this module.
 */
export default function FieldExpenses() {
  const [status, setStatus] = useState<(typeof TABS)[number]>("submitted");
  const [expenses, setExpenses] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const result = await api.fieldExpenses({ status });
      setExpenses(result.expenses ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load expenses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const decide = async (id: string, decision: "approved" | "rejected") => {
    try {
      await api.decideExpense(id, decision, note.trim() || undefined);
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the decision");
    }
  };

  return (
    <div>
      <h1 className="page-title">Field expenses</h1>
      <p className="page-sub">
        Claims submitted from the Sales app. A salesperson can never approve their own claim.
      </p>
      {error && <div className="banner error">{error}</div>}

      <div className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`tab ${status === tab ? "active" : ""}`}
            onClick={() => setStatus(tab)}
          >
            {tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {status === "submitted" ? (
        <div className="card">
          <div className="field">
            <label>Decision note (applies to the next decision)</label>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Approved against the Pimpri beat plan"
            />
          </div>
        </div>
      ) : null}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : expenses.length === 0 ? (
          <div className="empty-state">No {status} claims.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Salesperson</th>
                <th>Date</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Description</th>
                <th>Receipt</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense: any) => (
                <tr key={expense.id}>
                  <td>{expense.salesperson?.name ?? expense.salespersonId}</td>
                  <td>{new Date(expense.expenseDate).toLocaleDateString("en-IN")}</td>
                  <td>{expense.category}</td>
                  <td>{inr(expense.amount)}</td>
                  <td className="small">{expense.description}</td>
                  <td>
                    {expense.receiptUrl ? (
                      <a href={expense.receiptUrl} target="_blank" rel="noreferrer">
                        View
                      </a>
                    ) : expense.hasReceipt ? (
                      <span className="small muted">Stored</span>
                    ) : (
                      <span className="small muted">None</span>
                    )}
                  </td>
                  <td>
                    {expense.status === "submitted" ? (
                      <div className="row" style={{ gap: 6 }}>
                        <button className="sm" onClick={() => void decide(expense.id, "approved")}>
                          Approve
                        </button>
                        <button
                          className="sm danger"
                          onClick={() => void decide(expense.id, "rejected")}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="small muted">{expense.decisionNote ?? "—"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
