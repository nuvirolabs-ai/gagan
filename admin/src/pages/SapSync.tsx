import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { explain } from "../errorCopy";

export default function SapSync() {
  const [status, setStatus] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextStatus, outbox] = await Promise.all([
        api.sapStatus(),
        api.sapOutbox(filter || undefined),
      ]);
      setStatus(nextStatus);
      setItems(outbox.items ?? []);
      setError(null);
    } catch (err) {
      setError(explain(err, "Could not load SAP status"));
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(explain(err, "SAP action failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="eyebrow">System</p>
      <h1 className="page-title">SAP sync</h1>
      <p className="page-sub">
        Mock or live connector health, pull watermarks, and the outbox that still owes SAP a document.
        Real Business One credentials are a separate workstream.
      </p>
      {error ? <div className="banner error">{error}</div> : null}

      <div className="metric-strip">
        <div>
          <div className="metric-label">Connector</div>
          <div className="metric-value">{status?.connector?.name ?? "—"}</div>
          <div className="muted small">{status?.connector?.enabled ? "Enabled" : "Disabled"}</div>
        </div>
        <div>
          <div className="metric-label">Pending</div>
          <div className="metric-value">{status?.outbox?.pending ?? "—"}</div>
        </div>
        <div>
          <div className="metric-label">Failed</div>
          <div className="metric-value">{status?.outbox?.failed ?? "—"}</div>
        </div>
        <div>
          <div className="metric-label">Unlinked retailers</div>
          <div className="metric-value">{status?.unlinked?.retailers ?? "—"}</div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 16, gap: 8 }}>
        <button disabled={busy} onClick={() => void run(() => api.sapSync("all"))}>
          Pull master data
        </button>
        <button className="secondary" disabled={busy} onClick={() => void run(() => api.sapDrain())}>
          Drain outbox
        </button>
      </div>

      <div className="tabs">
        {["", "pending", "failed", "sent"].map((tab) => (
          <button
            key={tab || "all"}
            className={`tab ${filter === tab ? "active" : ""}`}
            onClick={() => setFilter(tab)}
          >
            {tab || "All"}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        {items.length === 0 ? (
          <div className="empty-state">No outbox rows in this filter.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Kind</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Updated</th>
                <th>Error</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.kind}</td>
                  <td>
                    <span className={`pill ${item.status}`}>{item.status}</span>
                  </td>
                  <td>{item.attempts}</td>
                  <td className="small muted">
                    {item.updatedAt ? new Date(item.updatedAt).toLocaleString("en-IN") : "—"}
                  </td>
                  <td className="small">{item.lastError ?? "—"}</td>
                  <td>
                    {item.status !== "sent" ? (
                      <button className="sm secondary" disabled={busy} onClick={() => void run(() => api.sapRetry(item.id))}>
                        Retry
                      </button>
                    ) : null}
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
