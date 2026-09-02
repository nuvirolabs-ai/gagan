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
  const topAttention = useMemo(
    () => attention.reduce<Queue | null>((top, row) => (!top || row.count > top.count ? row : top), null),
    [attention]
  );
  const queueCount = (label: string) => queues.find((row) => row.label === label)?.count ?? 0;
  const pulse = [
    { label: "Awaiting approval", count: queueCount("Orders need credit / confirmation"), tone: "warning" },
    { label: "Ready to pack", count: queueCount("Orders ready to pack"), tone: "info" },
    { label: "Out for delivery", count: queueCount("Out for delivery"), tone: "success" },
    { label: "SAP failures", count: queueCount("SAP outbox failures"), tone: "critical" },
  ];
  const pulseMax = Math.max(...pulse.map((item) => item.count), 1);
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short" }).format(new Date());

  return (
    <div className="page-shell home-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Work / Today</p>
          <h1 className="page-title">{greeting(admin?.name ?? "")}</h1>
          <p className="page-sub">The live operating picture for Gagan. Empty queues are healthy.</p>
        </div>
        <div className="header-context">
          <span className="live-indicator"><span className="live-dot" /> Live</span>
          <span>{today}</span>
        </div>
      </header>
      {error ? <div className="banner error">{error}</div> : null}

      {loading ? (
        <div className="home-loading" aria-label="Loading live queues">
          <div className="skeleton skeleton-heading" />
          <div className="skeleton skeleton-row" />
          <div className="skeleton skeleton-row" />
          <div className="skeleton skeleton-row" />
        </div>
      ) : (
        <>
          <section className="attention-brief" aria-labelledby="attention-title">
            <div>
              <p className="eyebrow">Attention brief</p>
              <h2 id="attention-title">
                {attention.length === 0 ? "Operations are clear" : `${attention.length} areas need action today`}
              </h2>
              <p>
                {attention.length === 0
                  ? "Nothing is waiting across the live work queues."
                  : `${topAttention?.label} is the largest active queue with ${topAttention?.count} ${topAttention?.count === 1 ? "item" : "items"}.`}
              </p>
            </div>
            {attention.length > 0 ? (
              <Link className="button primary" to={topAttention?.to ?? "/"}>Open next queue <span aria-hidden="true">→</span></Link>
            ) : (
              <span className="brief-status">All clear</span>
            )}
          </section>

          <div className="home-grid">
            <section className="work-board home-section" aria-labelledby="needs-action-title">
              <div className="section-heading-row">
                <div>
                  <p className="eyebrow">Work queue</p>
                  <h2 id="needs-action-title">Needs action</h2>
                </div>
                <span className="section-count">{attention.length} active</span>
              </div>
              {attention.length === 0 ? (
                <div className="empty-state quiet">Nothing is waiting. The queue is clear.</div>
              ) : (
                <ul className="work-list">
                  {attention.map((row) => (
                    <li key={row.label}>
                      <Link className={`work-row ${row.tone ?? ""}`} to={row.to}>
                        <span className="work-count">{row.count}</span>
                        <span className="work-label">{row.label}</span>
                        <span className="work-go">Open <span aria-hidden="true">→</span></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="pulse-panel home-section" aria-labelledby="pulse-title">
              <div className="section-heading-row">
                <div>
                  <p className="eyebrow">Live queue mix</p>
                  <h2 id="pulse-title">Operational pulse</h2>
                </div>
              </div>
              <div className="pulse-list">
                {pulse.map((item) => (
                  <div className="pulse-row" key={item.label}>
                    <div className="between small"><span>{item.label}</span><strong>{item.count}</strong></div>
                    <div className="pulse-track" aria-hidden="true"><span className={`pulse-bar ${item.tone}`} style={{ width: `${Math.max(item.count / pulseMax * 100, item.count ? 10 : 0)}%` }} /></div>
                  </div>
                ))}
              </div>
              <p className="pulse-note">Derived from the same live work queues above.</p>
            </section>
          </div>

          <section className="work-clear home-section clear-section">
            <div className="section-heading-row">
              <div>
                <p className="eyebrow">Healthy state</p>
                <h2>Clear queues</h2>
              </div>
              <span className="section-count">{clear.length} clear</span>
            </div>
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
