import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, inr } from "../api";
import { formatOrderRef } from "../orderRef";
import PodModal from "../components/PodModal";
import AssignModal from "../components/AssignModal";
import { AgeDistribution, Icon, SectionLabel } from "../components/OperationalPrimitives";
import { ageHours, ageLabel, type VisualTone } from "../components/operationalUtils";

const TABS = [
  { key: "placed", label: "Awaiting approval" },
  { key: "confirmed", label: "Confirmed" },
  { key: "packed", label: "Packed" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
  { key: "rejected", label: "Rejected" },
] as const;

const STATUS_LABEL: Record<string, string> = { placed: "Placed", confirmed: "Confirmed", packed: "Packed", out_for_delivery: "Out for delivery", delivered: "Delivered", rejected: "Rejected" };
const NEXT_ACTION: Record<string, string> = { placed: "Approve or reject this order.", confirmed: "Mark packed when the warehouse has picked it.", packed: "Assign a dispatch route.", out_for_delivery: "Capture proof of delivery.", delivered: "Complete. Invoice is on the ledger.", rejected: "Closed. No further fulfilment." };

function sapLabel(order: any) {
  const status = order.sapSyncStatus ?? "pending";
  return status === "synced" || status === "sent" ? "Synced" : status === "failed" ? "Failed" : "Pending";
}

function isSapSynced(order: any) {
  return order.sapSyncStatus === "synced" || order.sapSyncStatus === "sent";
}

function toneFor(order: any): VisualTone {
  if (order.status === "rejected" || order.sapSyncStatus === "failed") return "critical";
  if (order.status === "placed") return "bottleneck";
  if (order.status === "delivered") return "complete";
  return "moving";
}

function ageCounts(orders: any[]) {
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

function HealthMatrix({ order }: { order: any }) {
  const commercial = order.status === "placed" ? ["Needs action", "bottleneck"] : ["Ready", "complete"];
  const fulfilment = order.status === "confirmed" ? ["Ready to pack", "moving"] : order.status === "packed" ? ["Packed", "moving"] : order.status === "out_for_delivery" ? ["Out for delivery", "moving"] : order.status === "delivered" ? ["Delivered", "complete"] : ["Waiting", "neutral"];
  const sap = order.sapSyncStatus === "failed" ? ["Sync failed", "critical"] : isSapSynced(order) ? ["Synced", "complete"] : ["Pending", "neutral"];
  const cells: Array<{ label: string; value: string; tone: string; icon: "finance" | "stock" | "order" | "sap" }> = [
    { label: "Commercial", value: commercial[0], tone: commercial[1], icon: "finance" },
    { label: "Credit", value: order.status === "placed" ? "Review required" : "Clear", tone: order.status === "placed" ? "warning" : "complete", icon: "finance" },
    { label: "Inventory", value: "Not exposed", tone: "neutral", icon: "stock" },
    { label: "Fulfilment", value: fulfilment[0], tone: fulfilment[1], icon: "order" },
    { label: "Delivery", value: order.delivery?.routeId ? `Route ${order.delivery.routeId}` : "Not assigned", tone: order.delivery?.routeId ? "moving" : "neutral", icon: "order" },
    { label: "SAP", value: sap[0], tone: sap[1], icon: "sap" },
  ];
  return <div className="health-matrix">{cells.map((cell, index) => <div className={`health-cell ${cell.tone}`} key={cell.label}><span className="health-number">0{index + 1}</span><Icon name={cell.icon} /><span><b>{cell.label}</b><small>{cell.value}</small></span><span className="health-status">{cell.tone === "complete" ? <Icon name="check" size={14} /> : cell.tone === "critical" || cell.tone === "warning" || cell.tone === "bottleneck" ? <Icon name="alert" size={14} /> : "·"}</span></div>)}</div>;
}

function Journey({ order }: { order: any }) {
  const state = order.status;
  const steps = [
    ["Placed", ["placed", "confirmed", "packed", "out_for_delivery", "delivered"].includes(state) ? "done" : "future"],
    ["Approval", state === "placed" ? "blocked" : state === "rejected" ? "blocked" : "done"],
    ["Pack", state === "confirmed" ? "active" : ["packed", "out_for_delivery", "delivered"].includes(state) ? "done" : "future"],
    ["Dispatch", state === "packed" ? "active" : ["out_for_delivery", "delivered"].includes(state) ? "done" : "future"],
    ["Delivery", state === "out_for_delivery" ? "active" : state === "delivered" ? "done" : "future"],
    ["SAP", order.sapSyncStatus === "failed" ? "blocked" : isSapSynced(order) ? "done" : "future"],
  ];
  return <div className="journey" aria-label="Order journey">{steps.map(([label, status], index) => <div className={`journey-step ${status}`} key={label}><span>{status === "done" ? <Icon name="check" size={13} /> : status === "blocked" ? <Icon name="alert" size={13} /> : index + 1}</span><b>{label}</b>{index < steps.length - 1 ? <i /> : null}</div>)}</div>;
}

export default function Orders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("status");
  const [tab, setTab] = useState(TABS.some((item) => item.key === requestedTab) ? requestedTab! : "placed");
  const [orders, setOrders] = useState<any[]>([]);
  const [queueData, setQueueData] = useState<Record<string, any[]>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [podOrder, setPodOrder] = useState<any | null>(null);
  const [assignOrder, setAssignOrder] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const responses = await Promise.all(TABS.map(async (item) => ({ key: item.key, result: await api.orders(item.key) })));
      const next: Record<string, any[]> = {};
      responses.forEach(({ key, result }) => { next[key] = Array.isArray(result?.orders) ? result.orders : []; });
      setQueueData(next);
      const current = next[tab] ?? [];
      setOrders(current);
      setSelectedId((selected) => current.some((order: any) => order.id === selected) ? selected : current[0]?.id ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load orders");
    } finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (requestedTab && TABS.some((item) => item.key === requestedTab) && requestedTab !== tab) setTab(requestedTab); }, [requestedTab, tab]);

  const selected = orders.find((order) => order.id === selectedId) ?? null;
  const selectedTab = TABS.find((item) => item.key === tab)?.label ?? "Orders";
  const queueValue = orders.reduce((sum, order) => sum + Number(order.orderTotal ?? 0), 0);
  const ages = useMemo(() => ageCounts(orders), [orders]);
  const oldest = useMemo(() => orders.slice().sort((a, b) => (ageHours(b.createdAt) ?? -1) - (ageHours(a.createdAt) ?? -1))[0], [orders]);
  const outsideSla = ages[3];

  const act = async (id: string, fn: () => Promise<unknown>, message: string) => {
    setBusyId(id); setError(null); setNotice(null);
    try { await fn(); setNotice(message); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Action failed"); }
    finally { setBusyId(null); }
  };

  const setStage = (key: string) => { setTab(key); setSearchParams({ status: key }); };
  const actions = (o: any, dock = false) => <div className={`row inspector-action-row ${dock ? "dock-actions" : ""}`}>
    {o.status === "placed" && <><button className="button primary compact" disabled={busyId === o.id} onClick={() => void act(o.id, () => api.approve(o.id), "Order approved")}>Approve <Icon name="arrow" size={13} /></button><button className="button danger compact secondary-action" disabled={busyId === o.id} onClick={() => void act(o.id, () => api.reject(o.id), "Order rejected")}>Reject</button></>}
    {o.status === "confirmed" && <button className="button primary compact" disabled={busyId === o.id} onClick={() => void act(o.id, () => api.pack(o.id), "Order marked packed")}>Mark packed <Icon name="arrow" size={13} /></button>}
    {o.status === "packed" && <button className="button primary compact" disabled={busyId === o.id} onClick={() => setAssignOrder(o)}>Assign route <Icon name="arrow" size={13} /></button>}
    {o.status === "out_for_delivery" && <button className="button primary compact" disabled={busyId === o.id} onClick={() => setPodOrder(o)}>Capture delivery <Icon name="arrow" size={13} /></button>}
    {(o.status === "delivered" || o.status === "rejected") && <span className="muted small">No further action</span>}
  </div>;

  return <div className="page-shell orders-page operational-instrument">
    <header className="page-header operating-header compact"><div><SectionLabel>Sales / Work queue</SectionLabel><h1 className="page-title">Orders</h1><p className="page-sub">Move each order through its next safe step. Select a row to inspect the work.</p></div><div className="header-context"><span className="live-indicator"><span className="live-dot" /> Live queue</span><button className="button secondary compact">Filters</button></div></header>
    <section className="stage-rail" aria-label="Order lifecycle stages">{TABS.map((stage) => { const stageOrders = queueData[stage.key] ?? []; const stageValue = stageOrders.reduce((sum, order) => sum + Number(order.orderTotal ?? 0), 0); return <button key={stage.key} className={tab === stage.key ? "active" : ""} onClick={() => setStage(stage.key)}><span className="stage-count">{loading && !queueData[stage.key] ? "—" : stageOrders.length}</span><span>{stage.label}</span><small>{inr(stageValue)}</small></button>; })}</section>
    <section className="queue-summary" aria-label="Queue health"><div><span>active queue</span><strong>{selectedTab}</strong></div><div><span>oldest order</span><strong>{ageLabel(oldest?.createdAt)}</strong></div><div><span>outside SLA</span><strong className={outsideSla > 0 ? "red-text" : "green-text"}>{outsideSla} orders</strong></div><div><span>queue value</span><strong>{loading ? "—" : inr(queueValue)}</strong></div><AgeDistribution counts={ages} /></section>
    {error && <div className="banner error" role="alert">{error}</div>}{notice && <div className="banner success" role="status">{notice}</div>}
    <div className="orders-layout"><section className="order-table-zone"><div className="table-toolbar"><div><SectionLabel>Operational queue</SectionLabel><h2>{selectedTab} <em>{orders.length} orders</em></h2></div><label className="search"><span>⌕</span><input aria-label="Search order or retailer" placeholder="Search order or retailer" /></label></div><div className="order-table"><div className="order-table-header"><span>order / retailer</span><span>age</span><span>items</span><span>value</span><span>state</span><span>owner / next</span><span /></div>{loading ? <div className="table-loading"><div className="skeleton skeleton-row" /><div className="skeleton skeleton-row" /><div className="skeleton skeleton-row" /></div> : orders.length === 0 ? <div className="empty-state quiet">No orders are waiting in this state. The queue is clear.</div> : orders.map((o) => <div key={o.id} className={`order-table-row ${selectedId === o.id ? "selected" : ""}`} role="button" tabIndex={0} aria-pressed={selectedId === o.id} onClick={() => setSelectedId(o.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(o.id); } }}><span className="table-order"><i className={`status-rail ${toneFor(o)}`} /><b>{formatOrderRef(o)}</b><small>{o.retailer?.name ?? "Retailer unavailable"}</small></span><span className={`table-age ${(ageHours(o.createdAt) ?? 0) > 12 ? "critical" : ""}`}><Icon name="clock" size={13} />{ageLabel(o.createdAt)}</span><span className="tabular">{o.items?.length ?? 0} lines</span><strong className="tabular">{inr(Number(o.orderTotal ?? 0))}</strong><span className={`constraint ${toneFor(o)}`}>{o.sapSyncStatus === "failed" ? "SAP failed" : STATUS_LABEL[o.status] ?? o.status}</span><span className="table-next"><b>{o.delivery?.routeId ?? "Operations"}</b><small>{NEXT_ACTION[o.status] ?? "Inspect order"} <Icon name="arrow" size={13} /></small></span><Icon name="chevron" size={15} /></div>)}</div></section>
      <aside className="order-side-note"><SectionLabel>Queue read</SectionLabel><strong>{outsideSla > 0 ? `${outsideSla} orders have crossed the twelve-hour band.` : "No order has crossed the twelve-hour band."}</strong><p>{selected ? `Selected ${formatOrderRef(selected)} is ${ageLabel(selected.createdAt)} old. The inspector keeps its next safe action in view.` : "Select an order to see ownership, dependency, and the next safe action."}</p>{selected ? <button className="text-button" onClick={() => setSelectedId(null)}>clear selection <Icon name="arrow" size={14} /></button> : null}</aside>
    </div>
    {selected ? <section className="order-workspace" aria-label="Selected order workspace"><div className="workspace-heading"><div><SectionLabel>Order workspace / selected object</SectionLabel><h2>{formatOrderRef(selected)}</h2><p>{selected.retailer?.name ?? "Retailer unavailable"} · placed {ageLabel(selected.createdAt)} ago{selected.retailer?.phone ? ` · ${selected.retailer.phone}` : ""}</p></div><div className={`workspace-status ${toneFor(selected)}`}><span className="status-dot" />{STATUS_LABEL[selected.status] ?? selected.status}<strong>{inr(Number(selected.orderTotal ?? 0))}</strong></div></div><div className="workspace-hero"><div className="hero-value"><span>order value</span><strong>{inr(Number(selected.orderTotal ?? 0))}</strong><small>{selected.items?.length ?? 0} lines · {selected.delivery?.routeId ? `route ${selected.delivery.routeId}` : "route not assigned"}</small></div><div className={`hero-decision ${selected.status === "placed" || selected.sapSyncStatus === "failed" ? "critical" : ""}`}><span className="decision-kicker"><i className="status-dot" /> next safe action</span><strong>{NEXT_ACTION[selected.status] ?? "Inspect order"}</strong><p>{selected.status === "placed" ? "Commercial approval is the current dependency." : selected.sapSyncStatus === "failed" ? "SAP synchronization needs a retry." : "The next operational state is clear."}</p>{actions(selected, true)}</div></div><div className="workspace-columns"><main><section className="diagnostic-section"><div className="section-head"><div><SectionLabel>Diagnostic instrument</SectionLabel><h2>Order health</h2></div><span className="small-note">canonical fields only</span></div><HealthMatrix order={selected} /><Journey order={selected} /></section><section className="items-section"><div className="section-head"><div><SectionLabel>Commercial lines</SectionLabel><h2>Items <em>{selected.items?.length ?? 0} lines</em></h2></div><span className="small-note">unit prices from order</span></div><div className="item-ledger"><div><span>item</span><span>ordered</span><span>unit price</span><span>line value</span></div>{(selected.items ?? []).map((item: any) => <div key={item.id}><b>{item.variant?.product?.name ?? "Product unavailable"}</b><span>{item.qtyOrdered ?? 0}</span><span>{inr(Number(item.unitPrice ?? 0))}</span><strong>{inr(Number(item.unitPrice ?? 0) * Number(item.qtyOrdered ?? 0))}</strong></div>)}</div></section></main><aside className="inspector-context"><div className="context-block"><SectionLabel>Dependency</SectionLabel><h3>{selected.status === "placed" ? "This order cannot move yet." : selected.sapSyncStatus === "failed" ? "The ERP hand-off is blocked." : "This order has a clear next step."}</h3><p>{selected.status === "placed" ? "Approval is required before warehouse work can begin." : selected.sapSyncStatus === "failed" ? "The order remains in its current state until synchronization succeeds." : NEXT_ACTION[selected.status]}</p><dl><div><dt>owner</dt><dd>{selected.delivery?.routeId ?? "Operations"}</dd></div><div><dt>waiting</dt><dd>{ageLabel(selected.createdAt)}</dd></div><div><dt>state</dt><dd className={toneFor(selected) === "critical" ? "red-text" : "green-text"}>{STATUS_LABEL[selected.status] ?? selected.status}</dd></div></dl></div><div className="context-block related"><SectionLabel>Related context</SectionLabel><a href="/retailers">Retailer account <Icon name="arrow" size={13} /></a><a href="/ledger">Financial ledger <Icon name="arrow" size={13} /></a><a href="/sap">SAP state · {sapLabel(selected)} <Icon name="arrow" size={13} /></a></div><div className="context-block activity"><SectionLabel>Activity ledger</SectionLabel><p><time>{selected.createdAt ? new Date(selected.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}</time> order received <small>{selected.retailer?.name ?? "Retailer unavailable"}</small></p><p><time>now</time> current state evaluated <small>Admin read model</small></p></div></aside></div><div className="action-dock"><span><i className="pulse" /> next safe action</span><strong>{NEXT_ACTION[selected.status] ?? "Inspect order"}</strong>{actions(selected, true)}</div></section> : null}
    {assignOrder && <AssignModal order={assignOrder} onClose={() => setAssignOrder(null)} onDone={(msg) => { setAssignOrder(null); setNotice(msg); void load(); }} />}{podOrder && <PodModal order={podOrder} onClose={() => setPodOrder(null)} onDone={(msg) => { setPodOrder(null); setNotice(msg); void load(); }} />}
  </div>;
}
