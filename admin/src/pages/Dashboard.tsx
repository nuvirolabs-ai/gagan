import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../useAuth";
import { explain } from "../errorCopy";

type Queue = { label: string; count: number; to: string; tone?: "critical" | "warning" | "info" };

function greeting(name: string) {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = name.trim().split(/\s+/)[0] || "there";
  return `${part}, ${first}`;
}

async function settle<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

export default function Dashboard() {
  const { admin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [sapFailed, setSapFailed] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [placed, confirmed, packed, ofd, approvals, collections, proposals, expenses, issues, leave, sap] =
          await Promise.all([
            settle(api.orders("placed")),
            settle(api.orders("confirmed")),
            settle(api.orders("packed")),
            settle(api.orders("out_for_delivery")),
            settle(api.approvals()),
            settle(api.collections()),
            settle(api.retailerProposals("pending")),
            settle(api.fieldExpenses({ status: "submitted" })),
            settle(api.serviceIssues({ status: "open" })),
            settle(api.leaveRequests("pending")),
            settle(api.sapStatus()),
          ]);
        if (cancelled) return;
        const next: Queue[] = [
          { label: "Orders need credit / confirmation", count: placed?.orders?.length ?? placed?.length ?? 0, to: "/orders", tone: "warning" },
          { label: "Orders ready to pack", count: confirmed?.orders?.length ?? confirmed?.length ?? 0, to: "/orders", tone: "info" },
          { label: "Packed — assign dispatch", count: packed?.orders?.length ?? packed?.length ?? 0, to: "/orders" },
          { label: "Out for delivery", count: ofd?.orders?.length ?? ofd?.length ?? 0, to: "/orders" },
          { label: "Credit holds", count: approvals?.requests?.length ?? 0, to: "/approvals", tone: "critical" },
          { label: "Collections to confirm", count: collections?.submissions?.length ?? collections?.length ?? 0, to: "/collections", tone: "warning" },
          { label: "New retailer proposals", count: proposals?.proposals?.length ?? proposals?.length ?? 0, to: "/retailer-approvals" },
          { label: "Expense claims", count: expenses?.expenses?.length ?? expenses?.length ?? 0, to: "/field-expenses" },
          { label: "Open service issues", count: issues?.issues?.length ?? issues?.length ?? 0, to: "/service-issues", tone: "warning" },
          { label: "Leave requests", count: leave?.requests?.length ?? leave?.length ?? 0, to: "/field-team" },
          { label: "SAP outbox failures", count: sap?.outbox?.failed ?? 0, to: "/sap", tone: "critical" },
        ].filter((row) => Number.isFinite(row.count)) as Queue[];
        setQueues(next);
        setSapFailed(sap?.outbox?.failed ?? 0);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(explain(err, "Could not load work queues"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const attention = useMemo(() => queues.filter((row) => row.count > 0), [queues]);
  const clear = useMemo(() => queues.filter((row) => row.count === 0), [queues]);

  return (
    <div>
      <p className="eyebrow">Work</p>
      <h1 className="page-title">{greeting(admin?.name ?? "")}</h1>
      <p className="page-sub">
        What needs an employee action right now. Empty queues are healthy.
      </p>
      {error ? <div className="banner error">{error}</div> : null}

      {loading ? (
        <div className="empty-state">Loading live queues…</div>
      ) : (
        <>
          <section className="work-board">
            <h2 className="section-kicker">Needs action</h2>
            {attention.length === 0 ? (
              <div className="empty-state quiet">Nothing is waiting. That is a good morning.</div>
            ) : (
              <ul className="work-list">
                {attention.map((row) => (
                  <li key={row.label}>
                    <Link className={`work-row ${row.tone ?? ""}`} to={row.to}>
                      <span className="work-count">{row.count}</span>
                      <span className="work-label">{row.label}</span>
                      <span className="work-go">Open</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="work-clear">
            <h2 className="section-kicker">Clear</h2>
            <p className="muted small">
              {sapFailed === 0
                ? `${clear.length} queues are empty · SAP outbox has no failures.`
                : `${clear.length} queues are empty.`}
            </p>
          </section>
        </>
      )}
    </div>
  );
}
