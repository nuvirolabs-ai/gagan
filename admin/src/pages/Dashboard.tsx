import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../useAuth";
import { explain } from "../errorCopy";
import { AgeDistribution, FlowMap, Icon, SectionLabel, Sparkline } from "../components/OperationalPrimitives";
import { ageHours, ageLabel, inrShort, type FlowStage, type VisualTone } from "../components/operationalUtils";

type Queue = { label: string; count: number; to: string; tone?: VisualTone; value?: number };
type OrderRecord = { id?: string; orderNo?: string; status?: string; orderTotal?: number | string; createdAt?: string; retailer?: { name?: string }; items?: unknown[]; sapSyncStatus?: string; delivery?: { routeId?: string } };

const ORDER_STATES = ["placed", "confirmed", "packed", "out_for_delivery", "delivered"] as const;

function greeting(name: string) {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = name.trim().split(/\s+/)[0] || "Ops";
  return `${part}, ${first}`;
}

async function settle<T>(promise: Promise<T>): Promise<T | null> {
  try { return await promise; } catch { return null; }
}

function rowsFrom(result: any): OrderRecord[] {
  const rows = Array.isArray(result) ? result : result?.orders;
  return Array.isArray(rows) ? rows : [];
}

function orderValue(order: OrderRecord) { return Number(order.orderTotal ?? 0) || 0; }

function stageTone(status: string): VisualTone {
  if (status === "placed") return "bottleneck";
  if (status === "delivered") return "complete";
  if (status === "confirmed" || status === "packed") return "moving";
  return "active";
}

function stageLabel(status: string) {
  return ({ placed: "Awaiting approval", confirmed: "Confirmed", packed: "Packed", out_for_delivery: "Out for delivery", delivered: "Delivered" } as Record<string, string>)[status] ?? status;
}

function buildAgeCounts(orders: OrderRecord[]) {
  return orders.reduce((counts, order) => {
    const hours = ageHours(order.createdAt);
    if (hours === null) return counts;
    if (hours < 2) counts[0] += 1;
    else if (hours < 6) counts[1] += 1;
    else if (hours < 12) counts[2] += 1;
    else counts[3] += 1;
    return counts;
  }, [0, 0, 0, 0]);
}

function buildHourlySeries(orders: OrderRecord[]) {
  const today = new Date();
  const buckets = Array.from({ length: 8 }, (_, index) => {
    const date = new Date(today);
    date.setHours(today.getHours() - (7 - index), 0, 0, 0);
    return { start: date.getTime(), end: date.getTime() + 3600000, count: 0 };
  });
  orders.forEach((order) => {
    const timestamp = order.createdAt ? new Date(order.createdAt).getTime() : NaN;
    const bucket = buckets.find((item) => timestamp >= item.start && timestamp < item.end);
    if (bucket) bucket.count += 1;
  });
  return buckets.map((item) => item.count);
}

function LoadingHome() {
  return <div className="page-shell home-page instrument-loading" aria-label="Loading live operating picture"><div className="page-header"><div><div className="skeleton skeleton-label" /><div className="skeleton skeleton-title" /><div className="skeleton skeleton-copy" /></div><div className="skeleton skeleton-status" /></div><div className="skeleton skeleton-flow" /><div className="instrument-grid-skeleton"><div className="skeleton skeleton-panel" /><div className="skeleton skeleton-panel" /><div className="skeleton skeleton-panel" /></div><div className="skeleton skeleton-queue" /></div>;
}

export default function Dashboard() {
  const { admin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [ordersByStatus, setOrdersByStatus] = useState<Record<string, OrderRecord[]>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [stateResults, approvals, collections, proposals, expenses, issues, leave, sap] = await Promise.all([
        Promise.all(ORDER_STATES.map((status) => settle(api.orders(status)))),
        settle(api.approvals()), settle(api.collections()), settle(api.retailerProposals("pending")),
        settle(api.fieldExpenses({ status: "submitted" })), settle(api.serviceIssues({ status: "open" })),
        settle(api.leaveRequests("pending")), settle(api.sapStatus()),
      ]);
      if (cancelled) return;
      const byStatus: Record<string, OrderRecord[]> = {};
      ORDER_STATES.forEach((status, index) => { byStatus[status] = rowsFrom(stateResults[index]); });
      const valueFor = (status: string) => (byStatus[status] ?? []).reduce((sum, order) => sum + orderValue(order), 0);
      const next = [
        { label: "Orders need credit / confirmation", count: byStatus.placed?.length ?? 0, value: valueFor("placed"), to: "/orders?status=placed", tone: "warning" },
        { label: "Orders ready to pack", count: byStatus.confirmed?.length ?? 0, value: valueFor("confirmed"), to: "/orders?status=confirmed", tone: "info" },
        { label: "Packed — assign dispatch", count: byStatus.packed?.length ?? 0, value: valueFor("packed"), to: "/orders?status=packed", tone: "active" },
        { label: "Out for delivery", count: byStatus.out_for_delivery?.length ?? 0, value: valueFor("out_for_delivery"), to: "/orders?status=out_for_delivery", tone: "active" },
        { label: "Credit holds", count: approvals?.requests?.length ?? 0, to: "/approvals", tone: "critical" },
        { label: "Collections to confirm", count: collections?.submissions?.length ?? collections?.length ?? 0, to: "/collections", tone: "warning" },
        { label: "New retailer proposals", count: proposals?.proposals?.length ?? proposals?.length ?? 0, to: "/retailer-approvals", tone: "active" },
        { label: "Expense claims", count: expenses?.expenses?.length ?? expenses?.length ?? 0, to: "/field-expenses", tone: "active" },
        { label: "Open service issues", count: issues?.issues?.length ?? issues?.length ?? 0, to: "/service-issues", tone: "warning" },
        { label: "Leave requests", count: leave?.requests?.length ?? leave?.length ?? 0, to: "/field-team", tone: "active" },
        { label: "SAP outbox failures", count: sap?.outbox?.failed ?? 0, to: "/sap", tone: "critical" },
      ].filter((row) => Number.isFinite(row.count)) as Queue[];
      setQueues(next);
      setOrdersByStatus(byStatus);
      setError(stateResults.every((item) => item === null) && next.every((item) => item.count === 0) ? "The live operating queues could not be reached." : null);
      setLoading(false);
    })().catch((caught) => {
      if (!cancelled) { setError(explain(caught, "Could not load the live operating picture")); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  const allOrders = useMemo(() => Object.values(ordersByStatus).flat(), [ordersByStatus]);
  const openOrders = useMemo(() => allOrders.filter((order) => order.status !== "delivered"), [allOrders]);
  const attention = useMemo(() => queues.filter((row) => row.count > 0), [queues]);
  const clear = useMemo(() => queues.filter((row) => row.count === 0), [queues]);
  const ageCounts = useMemo(() => buildAgeCounts(openOrders), [openOrders]);
  const trend = useMemo(() => buildHourlySeries(allOrders), [allOrders]);
  const oldest = useMemo(() => openOrders.reduce<OrderRecord | null>((oldestOrder, order) => {
    if (!oldestOrder) return order;
    const current = ageHours(order.createdAt) ?? -1;
    const previous = ageHours(oldestOrder.createdAt) ?? -1;
    return current > previous ? order : oldestOrder;
  }, null), [openOrders]);
  const totalValue = allOrders.reduce((sum, order) => sum + orderValue(order), 0);
  const deliveredValue = (ordersByStatus.delivered ?? []).reduce((sum, order) => sum + orderValue(order), 0);
  const throughFlow = totalValue > 0 ? Math.round((deliveredValue / totalValue) * 100) : null;
  const statusValue = (status: string) => (ordersByStatus[status] ?? []).reduce((sum, order) => sum + orderValue(order), 0);
  const flow: FlowStage[] = [
    { label: "Received", count: allOrders.length, value: totalValue, tone: "neutral", note: "current source population", retention: "source volume" },
    ...ORDER_STATES.map((status, index) => ({ label: stageLabel(status), count: ordersByStatus[status]?.length ?? 0, value: statusValue(status), tone: stageTone(status), note: `${ordersByStatus[status]?.length ?? 0} currently in state`, retention: index === 0 ? "approval boundary" : `${totalValue > 0 ? Math.round((statusValue(status) / totalValue) * 100) : 0}% of source` })),
  ];
  const impacted = [
    { label: "Approval", status: "placed", tone: "warning" as const, to: "/orders?status=placed" },
    { label: "Warehouse", status: "confirmed", tone: "active" as const, to: "/orders?status=confirmed" },
    { label: "Dispatch", status: "packed", tone: "active" as const, to: "/orders?status=packed" },
    { label: "Delivery", status: "out_for_delivery", tone: "critical" as const, to: "/orders?status=out_for_delivery" },
  ];
  const priority = openOrders.slice().sort((a, b) => (ageHours(b.createdAt) ?? -1) - (ageHours(a.createdAt) ?? -1)).slice(0, 4);
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" }).format(new Date());
  const sapFailures = queues.find((row) => row.label === "SAP outbox failures")?.count ?? 0;
  const openValue = openOrders.reduce((sum, order) => sum + orderValue(order), 0);

  if (loading) return <LoadingHome />;

  return (
    <div className="page-shell home-page operational-instrument">
      <header className="page-header operating-header">
        <div><SectionLabel>{today}</SectionLabel><h1 className="page-title">{greeting(admin?.name ?? "Ops")}</h1><p className="page-sub">See what moved, what is constrained, and which decision deserves attention next.</p></div>
        <div className="header-context operating-state"><span><i className="pulse" /> staging · read-only</span><b>{throughFlow === null ? "flow unavailable" : `${throughFlow}% current through-flow`}</b></div>
      </header>
      {error ? <div className="banner error" role="alert">{error}</div> : null}

      <section className="command-strip" aria-label="Operational command strip">
        <Link to="/orders" className="command-cell"><span>needs action</span><strong>{attention.length}</strong><small>{attention.reduce((sum, row) => sum + row.count, 0)} queue items <Icon name="arrow" size={13} /></small></Link>
        <Link to="/orders" className="command-cell"><span>open order value</span><strong>{inrShort(openValue)}</strong><small>{openOrders.length} orders in motion <Icon name="arrow" size={13} /></small></Link>
        <Link to="/orders" className="command-cell"><span>oldest item</span><strong>{ageLabel(oldest?.createdAt)}</strong><small>{oldest?.retailer?.name ?? "No dated order"} <Icon name="arrow" size={13} /></small></Link>
        <Link to="/sap" className="command-cell"><span>critical system state</span><strong className={sapFailures > 0 ? "red-text" : "green-text"}>{sapFailures > 0 ? `${sapFailures} failures` : "SAP clear"}</strong><small>read from SAP outbox <Icon name="arrow" size={13} /></small></Link>
      </section>

      <div className="instrument-section-heading"><SectionLabel>Business flow</SectionLabel><span>{allOrders.length} records across the current order states</span></div>
      <FlowMap stages={flow} onSelect={(stage) => { const status = ORDER_STATES.find((candidate) => stage.label === stageLabel(candidate)); if (status) window.location.href = `/orders?status=${status}`; }} />

      <div className="instrument-triad">
        <section className="instrument-panel trend-panel"><div className="section-head"><div><SectionLabel>Today / intake</SectionLabel><h2>Order pace</h2></div><span className="trend-note">{allOrders.length} current records</span></div><div className="trend-chart"><Sparkline values={trend} label="Order intake by hour from current order createdAt values" large /><div className="chart-axis"><span>earlier</span><span>now</span></div></div><p className="panel-note">The line uses only order timestamps exposed by the current Admin read model.</p></section>
        <section className="instrument-panel impact-panel"><div className="section-head"><div><SectionLabel>Business at risk</SectionLabel><h2>Where value is waiting</h2></div><span className="small-note">current states</span></div><strong className="impact-total-value">{inrShort(openValue)}</strong><span className="impact-total-label">open order value</span><div className="impact-list">{impacted.map((item) => { const records = ordersByStatus[item.status] ?? []; const value = statusValue(item.status); const oldestInState = records.slice().sort((a, b) => (ageHours(b.createdAt) ?? -1) - (ageHours(a.createdAt) ?? -1))[0]; return <Link key={item.status} className={`impact-row ${item.tone}`} to={item.to}><Icon name={item.status === "placed" ? "finance" : item.status === "confirmed" ? "stock" : "order"} /><span className="impact-name"><b>{item.label}</b><small>{records.length} orders · oldest {ageLabel(oldestInState?.createdAt)}</small></span><span className="impact-bar"><i style={{ width: `${openValue ? Math.max((value / openValue) * 100, value ? 4 : 0) : 0}%` }} /></span><strong>{inrShort(value)}</strong><Icon name="arrow" size={13} /></Link>; })}</div></section>
        <section className="instrument-panel age-panel"><div className="section-head"><div><SectionLabel>Queue health</SectionLabel><h2>Age is visible</h2></div><span className="small-note">open items</span></div><AgeDistribution counts={ageCounts} /><p className="panel-note">{ageCounts[3] > 0 ? `${ageCounts[3]} items are older than twelve hours.` : "No open item is older than twelve hours."}</p></section>
      </div>

      <div className="instrument-lower">
        <section className="priority-queue" aria-labelledby="priority-title"><div className="section-head"><div><SectionLabel>Priority work</SectionLabel><h2 id="priority-title">Move these next</h2></div><Link className="text-button" to="/orders">view all <Icon name="arrow" size={14} /></Link></div><div className="queue-head"><span>work item</span><span>value</span><span>age</span><span>owner</span><span>next safe step</span></div>{priority.length === 0 ? <div className="empty-state quiet">Nothing requires an operational decision. The live queue is clear.</div> : priority.map((order) => { const status = order.status ?? "placed"; const next = ({ placed: "Review approval", confirmed: "Start packing", packed: "Assign dispatch", out_for_delivery: "Capture delivery", delivered: "Complete" } as Record<string, string>)[status] ?? "Inspect order"; return <Link key={order.id ?? order.orderNo} className="priority-row" to={`/orders?status=${status}`}><span className="queue-type"><i className={status === "placed" || order.sapSyncStatus === "failed" ? "red" : "gold"} /><b>{stageLabel(status)}</b><small>{order.id ?? order.orderNo ?? "Order"} · {order.retailer?.name ?? "Retailer unavailable"}</small></span><strong>{inrShort(orderValue(order))}</strong><span className="age"><Icon name="clock" size={13} />{ageLabel(order.createdAt)}</span><span className="owner"><span className="owner-avatar">{status.slice(0, 1).toUpperCase()}</span>{order.delivery?.routeId ?? "Operations"}</span><span className="next-step">{next}<Icon name="arrow" size={14} /></span></Link>; })}</section>
        <section className="movement-column"><div className="section-head"><div><SectionLabel>Recent movement</SectionLabel><h2>What changed in the read</h2></div><span className="small-note">createdAt evidence</span></div>{allOrders.filter((order) => order.createdAt).slice().sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()).slice(0, 4).map((order) => <p className="movement-row" key={order.id ?? order.orderNo}><time>{new Date(order.createdAt!).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</time><span><b>{order.id ?? order.orderNo ?? "Order"}</b> entered <strong>{stageLabel(order.status ?? "")}</strong><small>{order.retailer?.name ?? "Retailer unavailable"}</small></span></p>)}{allOrders.every((order) => !order.createdAt) ? <div className="empty-state quiet">Order event timestamps are not exposed in this read model.</div> : null}</section>
      </div>
      <div className="sr-only" aria-label="Canonical work queue names">{queues.map((row) => <span key={row.label}>{row.label}</span>)}</div>
      <section className="healthy-strip"><SectionLabel>Healthy state</SectionLabel><strong>{clear.length} queue definitions are clear.</strong><span>{clear.map((row) => row.label).join(" · ") || "No empty queue signal returned."}</span></section>
    </div>
  );
}
