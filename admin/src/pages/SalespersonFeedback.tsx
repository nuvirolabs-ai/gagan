import { useEffect, useState } from "react";
import { api } from "../api";
import { explain } from "../errorCopy";

interface FeedbackRow {
  id: string;
  retailerId: string;
  retailer: { name: string };
  salesRepId: string;
  salesRep: { name: string };
  description: string;
  createdAt: string;
}

export default function SalespersonFeedback() {
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async (cursor?: string) => {
    setLoading(true);
    try {
      const result = await api.salespersonFeedback(cursor);
      setFeedback(current => cursor
        ? [...current, ...(result.feedback ?? []).filter((row: FeedbackRow) => !current.some(existing => existing.id === row.id))]
        : result.feedback ?? []);
      setNextCursor(result.nextCursor ?? null);
      setError(null);
    } catch (reason) {
      setError(explain(reason, "Could not load salesperson feedback"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return <div>
    <div className="row" style={{ justifyContent: "space-between" }}>
      <h1 className="page-title">Salesperson feedback</h1>
      <button className="secondary" onClick={() => void load()} disabled={loading}>Refresh</button>
    </div>
    {error && <div className="banner error" role="alert">{error}</div>}
    <div className="card" style={{ padding: 0 }}>
      {loading && feedback.length === 0 ? <div className="empty-state">Loading feedback…</div> :
        !loading && !error && feedback.length === 0 ? <div className="empty-state">No feedback in your review scope.</div> :
        feedback.length === 0 ? null :
        <table>
          <thead><tr><th>Submitted</th><th>Submitted by retailer</th><th>About salesperson</th><th>Feedback</th></tr></thead>
          <tbody>{feedback.map(row => <tr key={row.id}>
            <td>{new Date(row.createdAt).toLocaleString("en-IN")}</td>
            <td>{row.retailer.name}</td>
            <td>{row.salesRep.name}</td>
            <td>{row.description}</td>
          </tr>)}</tbody>
        </table>}
    </div>
    {nextCursor && <button className="secondary" onClick={() => void load(nextCursor)} disabled={loading}>{loading ? "Loading…" : "Load more"}</button>}
  </div>;
}
