import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, inr } from "../api";
import { Breakdown } from "./Commercial";
import { formatOrderRef } from "../orderRef";
import PodModal from "../components/PodModal";
import AssignModal from "../components/AssignModal";
import OrderReviewModal, { OrderActionControls } from "../components/OrderReviewModal";
import { AgeDistribution, Icon, SectionLabel } from "../components/OperationalPrimitives";
import { ageHours, ageLabel } from "../components/operationalUtils";
import { orderCreatedAtLabel, orderSourceLabel } from "../orderAttribution";
import WarehouseOrdersPage from "./WarehouseOrders";
import {
  NEXT_ACTION,
  ORDER_DEPARTURE_MS,
  STATUS_LABEL,
  dependencyCopy,
  isSapSynced,
  mergeCanonicalOrder,
  orderHealth,
  queueStatusLabel,
  rowSurface,
  storedLineValue,
  toneFor,
} from "../orderReviewModel";

const TABS = [
  { key: "placed", label: "Awaiting approval" },
  { key: "confirmed", label: "Confirmed" },
  { key: "packed", label: "Packed" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "🧾 Invoices" },
  { key: "rejected", label: "Rejected" },
] as const;

const INTERNAL_STATUS_FILTERS = [
  { key: "", label: "All internal status" },
  { key: "ACCOUNT_OPENED", label: "#️⃣ New Account" },
  { key: "RATE_APPROVAL_SENT", label: "🍓 Rate Approval" },
  { key: "SALES_ORDER_APPROVAL_SENT", label: "❤️ Order Approval" },
  { key: "SALES_ORDER_PUNCHED", label: "📝 Order Punched" },
  { key: "SALES_ORDER_CREATED", label: "👍 Order Created" },
  { key: "SALES_ORDER_ON_HOLD", label: "❌ On Hold" },
  { key: "ADVANCE_PAYMENT_RECEIVED", label: "✍️ Advance Received" },
] as const;

type PendingAction = "approve" | "reject" | "hold" | "release" | "pack" | null;

function sapLabel(order: any) {
  const status = order.sapSyncStatus ?? "pending";
  return status === "synced" || status === "sent" ? "Synced" : status === "failed" ? "Failed" : "Pending";
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

function withInternalStatus(orders: any[], statusByOrderId: Map<string, any>) {
  return orders.map((order) => ({ ...order, internalStatus: statusByOrderId.get(order.id) ?? order.internalStatus ?? null }));
}

function HealthMatrix({ order }: { order: any }) {
  return <div className="health-matrix">{orderHealth(order).map((cell, index) => <div className={`health-cell ${cell.tone}`} key={cell.label}><span className="health-number">0{index + 1}</span><Icon name={cell.icon} /><span><b>{cell.label}</b><small>{cell.value}</small></span><span className="health-status">{cell.tone === "complete" ? <Icon name="check" size={14} /> : cell.tone === "critical" || cell.tone === "warning" || cell.tone === "bottleneck" ? <Icon name="alert" size={14} /> : "·"}</span></div>)}</div>;
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

function focusQueueElement(orderId: string | null) {
  if (orderId) {
    const row = document.querySelector<HTMLElement>(`[data-order-id="${CSS.escape(orderId)}"]`);
    if (row) {
      row.focus();
      return;
    }
  }
  document.querySelector<HTMLElement>('input[aria-label="Search order or retailer"]')?.focus();
}

function AdminOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("status");
  const [tab, setTab] = useState(TABS.some((item) => item.key === requestedTab) ? requestedTab! : "placed");
  const [orders, setOrders] = useState<any[]>([]);
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [warehouses, setWarehouses] = useState<Array<{ code: string; name: string; city: string }>>([
    { code: "WH-001", name: "Indore Central Fulfillment Hub", city: "Indore" },
    { code: "WH-002", name: "Bhopal Regional Hub", city: "Bhopal" },
  ]);
  const [queueData, setQueueData] = useState<Record<string, any[]>>({});
  const [statusByOrderId, setStatusByOrderId] = useState<Map<string, any>>(new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [podOrder, setPodOrder] = useState<any | null>(null);
  const [assignOrder, setAssignOrder] = useState<any | null>(null);
  const [internalFilter, setInternalFilter] = useState("");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "value_desc" | "value_asc">("date_desc");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [holdFor, setHoldFor] = useState<string | null>(null);
  const [holdReason, setHoldReason] = useState("");
  const [holdError, setHoldError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const departureTimer = useRef<number | null>(null);

  const clearDeparture = () => {
    if (departureTimer.current != null) {
      window.clearTimeout(departureTimer.current);
      departureTimer.current = null;
    }
  };

  const filterTab = useCallback((queues: Record<string, any[]>, statuses: Map<string, any>, stage = tab) => {
    const current = withInternalStatus(queues[stage] ?? [], statuses);
    return internalFilter ? current.filter((order) => order.internalStatus?.currentCode === internalFilter) : current;
  }, [internalFilter, tab]);

  const publishQueues = useCallback((queues: Record<string, any[]>, statuses: Map<string, any>, preserve?: any) => {
    setQueueData(queues);
    setStatusByOrderId(statuses);
    const filtered = filterTab(queues, statuses);
    const visible = !preserve
      ? filtered
      : filtered.some((order) => order.id === preserve.id)
        ? filtered.map((order) => order.id === preserve.id
          ? { ...order, ...preserve, internalStatus: preserve.internalStatus ?? order.internalStatus }
          : order)
        : [preserve, ...filtered];
    setOrders(visible);
    setSelectedId((current) => current && visible.some((order) => order.id === current) ? current : visible[0]?.id ?? null);
    return filtered;
  }, [filterTab]);

  const fetchQueues = useCallback(async (targetWarehouse = warehouseFilter) => {
    const [responses, commercial] = await Promise.all([
      Promise.all(TABS.map(async (item) => ({ key: item.key, result: await api.orders(item.key, targetWarehouse) }))),
      api.commercialStatuses(),
    ]);
    const queues: Record<string, any[]> = {};
    let fetchedWarehouses: any[] = [];
    responses.forEach(({ key, result }) => {
      queues[key] = Array.isArray(result?.orders) ? result.orders : [];
      if (Array.isArray(result?.warehouses) && result.warehouses.length > 0) {
        fetchedWarehouses = result.warehouses;
      }
    });
    if (fetchedWarehouses.length > 0) {
      setWarehouses(fetchedWarehouses);
    }
    const statuses = new Map<string, any>(((commercial?.orders ?? []) as any[]).map((order) => [order.id, order.internalStatus]));
    return { queues, statuses };
  }, [warehouseFilter]);

  const load = useCallback(async (targetWarehouse = warehouseFilter) => {
    setLoading(true);
    try {
      const { queues, statuses } = await fetchQueues(targetWarehouse);
      publishQueues(queues, statuses);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load orders");
    } finally { setLoading(false); }
  }, [fetchQueues, publishQueues, warehouseFilter]);

  useEffect(() => { void load(warehouseFilter); }, [load, warehouseFilter]);
  useEffect(() => () => clearDeparture(), []);
  useEffect(() => { if (requestedTab && TABS.some((item) => item.key === requestedTab) && requestedTab !== tab) setTab(requestedTab); }, [requestedTab, tab]);

  const reviewOrder = orders.find((order) => order.id === reviewId) ?? null;
  const detailOrder = orders.find((order) => order.id === detailId) ?? null;
  const selected = orders.find((order) => order.id === selectedId) ?? reviewOrder ?? detailOrder;
  const selectedTab = TABS.find((item) => item.key === tab)?.label ?? "Orders";
  const metricOrders = useMemo(() => filterTab(queueData, statusByOrderId), [filterTab, queueData, statusByOrderId]);

  const displayedOrders = useMemo(() => {
    let result = orders;

    if (dateFilter === "today") {
      const todayStr = new Date().toDateString();
      result = result.filter((o) => new Date(o.createdAt).toDateString() === todayStr);
    } else if (dateFilter === "week") {
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      result = result.filter((o) => new Date(o.createdAt).getTime() >= oneWeekAgo);
    } else if (dateFilter === "month") {
      const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      result = result.filter((o) => new Date(o.createdAt).getTime() >= oneMonthAgo);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (o) =>
          formatOrderRef(o).toLowerCase().includes(q) ||
          (o.retailer?.name ?? "").toLowerCase().includes(q) ||
          (o.salespersonName ?? "").toLowerCase().includes(q)
      );
    }

    return [...result].sort((a, b) => {
      const valA = Number(a.orderTotal ?? 0);
      const valB = Number(b.orderTotal ?? 0);
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();

      if (sortBy === "value_desc") return valB - valA;
      if (sortBy === "value_asc") return valA - valB;
      if (sortBy === "date_asc") return dateA - dateB;
      return dateB - dateA;
    });
  }, [orders, dateFilter, searchTerm, sortBy]);

  const queueValue = metricOrders.reduce((sum, order) => sum + Number(order.orderTotal ?? 0), 0);
  const ages = useMemo(() => ageCounts(metricOrders), [metricOrders]);
  const oldest = useMemo(() => metricOrders.slice().sort((a, b) => (ageHours(b.createdAt) ?? -1) - (ageHours(a.createdAt) ?? -1))[0], [metricOrders]);
  const outsideSla = ages[3];

  const closeReview = (focusId = reviewId) => {
    setReviewId(null);
    setHoldFor(null);
    setHoldError(null);
    window.requestAnimationFrame(() => focusQueueElement(focusId));
  };

  const openReview = (id: string) => {
    clearDeparture();
    setSelectedId(id);
    setReviewId(id);
    setHoldFor(null);
    setHoldReason("");
    setHoldError(null);
    setError(null);
  };

  const openDetails = (order: any) => {
    setDetailId(order.id);
    setSelectedId(order.id);
    setReviewId(null);
    window.requestAnimationFrame(() => document.getElementById("order-workspace")?.scrollIntoView?.({ block: "start" }));
  };

  const scheduleDeparture = (orderId: string, remaining: any[]) => {
    clearDeparture();
    const index = orders.findIndex((order) => order.id === orderId);
    const nextId = remaining[index]?.id ?? remaining[index - 1]?.id ?? remaining[0]?.id ?? null;
    departureTimer.current = window.setTimeout(() => {
      departureTimer.current = null;
      setOrders(remaining);
      setSelectedId((current) => current === orderId ? nextId : current);
      setDetailId((current) => current === orderId ? null : current);
      focusQueueElement(nextId);
    }, ORDER_DEPARTURE_MS);
  };

  const act = async (id: string, action: Exclude<PendingAction, null>, fn: () => Promise<unknown>, message: string) => {
    if (inFlight.current) return;
    const previous = orders.find((order) => order.id === id);
    if (!previous) return;
    inFlight.current = true;
    setBusyId(id);
    setPendingAction(action);
    setError(null);
    setNotice(null);
    try {
      const result = await fn();
      const updated = mergeCanonicalOrder(previous, result);
      let remaining = metricOrders.filter((order) => order.id !== id);
      try {
        const { queues, statuses } = await fetchQueues();
        const returnedStatus = statuses.get(id);
        const overlaid = returnedStatus ? { ...updated, internalStatus: { ...(updated.internalStatus ?? {}), ...returnedStatus } } : updated;
        const serverRows = filterTab(queues, statuses);
        remaining = serverRows.filter((order) => order.id !== id);
        const stillQueued = serverRows.some((order) => order.id === id);
        publishQueues(queues, statuses, overlaid);
        if (!stillQueued) scheduleDeparture(id, remaining);
      } catch (refreshErr) {
        setOrders((current) => current.map((order) => order.id === id ? updated : order));
        setError(refreshErr instanceof Error ? refreshErr.message : "Order updated, but the queue could not refresh.");
      }
      setNotice(message);
      setReviewId(null);
      setHoldFor(null);
      window.requestAnimationFrame(() => focusQueueElement(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      inFlight.current = false;
      setBusyId(null);
      setPendingAction(null);
    }
  };

  const confirmHold = (order: any) => {
    const reason = holdReason.trim();
    if (reason.length < 3) {
      setHoldError("Reason must be at least 3 characters.");
      return;
    }
    setHoldError(null);
    void act(order.id, "hold", () => api.holdOrder(order.id, reason), "Order placed on hold");
  };

  const actionControls = (order: any, idSuffix: string) => <OrderActionControls
    order={order}
    idSuffix={idSuffix}
    busy={busyId === order.id}
    pendingAction={busyId === order.id ? pendingAction : null}
    holdOpen={holdFor === order.id}
    holdReason={holdReason}
    holdError={holdFor === order.id ? holdError : null}
    onHoldReason={(value) => { setHoldReason(value); setHoldError(null); }}
    onStartHold={() => { setHoldFor(order.id); setHoldReason(""); setHoldError(null); }}
    onCancelHold={() => { setHoldFor(null); setHoldError(null); }}
    onConfirmHold={() => confirmHold(order)}
    onApprove={() => void act(order.id, "approve", () => api.approve(order.id), "Order approved")}
    onReject={() => void act(order.id, "reject", () => api.reject(order.id), "Order rejected")}
    onRelease={() => void act(order.id, "release", () => api.releaseOrderHold(order.id), "Order hold released")}
    onPack={() => void act(order.id, "pack", () => api.pack(order.id), "Order marked packed")}
    onAssign={() => { setReviewId(null); setAssignOrder(order); }}
    onCapture={() => { setReviewId(null); setPodOrder(order); }}
  />;

  const setStage = (key: string) => {
    clearDeparture();
    setReviewId(null);
    setTab(key);
    setSearchParams({ status: key });
  };

  return <div className="page-shell orders-page operational-instrument">
    <header className="page-header operating-header compact">
      <div>
        <SectionLabel>Sales / Work queue</SectionLabel>
        <h1 className="page-title">Orders</h1>
        <p className="page-sub">Open an order to review it here, then approve, reject, or hold without leaving the queue.</p>
      </div>
      <div className="header-context" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 6, padding: "4px 10px" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>🏢 Warehouse:</span>
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            style={{ fontSize: 13, border: "none", background: "transparent", fontWeight: 600, color: "#0f172a", cursor: "pointer", outline: "none" }}
            aria-label="Filter by warehouse"
          >
            <option value="all">All Warehouses (All Hubs)</option>
            {warehouses.map((wh) => (
              <option key={wh.code} value={wh.code}>
                {wh.code} · {wh.name}
              </option>
            ))}
          </select>
        </div>
        <span className="live-indicator"><span className="live-dot" /> Live queue</span>
      </div>
    </header>

    {selected ? (
      <div className="small muted" aria-label="Selected order attribution" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "6px 0 12px" }}>
        <strong>{formatOrderRef(selected)}</strong> · {orderSourceLabel(selected)}
        <span style={{ padding: "1px 6px", background: "#e0f2fe", borderRadius: 4, color: "#0369a1", fontWeight: 600, fontSize: 11 }}>
          👤 {selected.punchedByLabel ?? selected.salespersonName ?? "Direct"}
        </span>
        <span style={{ padding: "1px 6px", background: "#f3e8ff", borderRadius: 4, color: "#6b21a8", fontWeight: 600, fontSize: 11 }}>
          🏢 {selected.warehouseName ?? "Indore Central Fulfillment Hub"} ({selected.warehouseCode ?? "WH-001"})
        </span>
        · {orderCreatedAtLabel(selected)} · {selected.retailer?.name ?? "Retailer unavailable"}
      </div>
    ) : null}

    <section className="stage-rail" aria-label="Order lifecycle stages">{TABS.map((stage) => { const stageOrders = queueData[stage.key] ?? []; const stageValue = stageOrders.reduce((sum, order) => sum + Number(order.orderTotal ?? 0), 0); return <button key={stage.key} className={tab === stage.key ? "active" : ""} onClick={() => setStage(stage.key)}><span className="stage-count">{loading && !queueData[stage.key] ? "—" : stageOrders.length}</span><span>{stage.label}</span><small>{inr(stageValue)}</small></button>; })}</section>
    <div className="internal-status-rail" aria-label="Internal commercial status filters">{INTERNAL_STATUS_FILTERS.map((filter) => <button key={filter.key} className={internalFilter === filter.key ? "selected" : ""} onClick={() => setInternalFilter(filter.key)}>{filter.label}</button>)}</div>
    <section className="queue-summary" aria-label="Queue health"><div><span>active queue</span><strong>{selectedTab}</strong></div><div><span>oldest order</span><strong>{ageLabel(oldest?.createdAt)}</strong></div><div><span>outside SLA</span><strong className={outsideSla > 0 ? "red-text" : "green-text"}>{outsideSla} orders</strong></div><div><span>queue value</span><strong>{loading ? "—" : inr(queueValue)}</strong></div><AgeDistribution counts={ages} /></section>
    {error && !reviewOrder && <div className="banner error" role="alert">{error}</div>}{notice && <div className="banner success" role="status">{notice}</div>}
    <div className="orders-layout"><section className="order-table-zone"><div className="table-toolbar"><div><SectionLabel>Operational queue</SectionLabel><h2>{selectedTab} <em>{displayedOrders.length} orders</em></h2></div><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as any)} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)" }} aria-label="Filter by date"><option value="all">📅 All Dates</option><option value="today">Today</option><option value="week">Last 7 Days</option><option value="month">This Month</option></select><select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)" }} aria-label="Sort orders"><option value="date_desc">⚡ Date: Newest First</option><option value="date_asc">Date: Oldest First</option><option value="value_desc">Value: High to Low</option><option value="value_asc">Value: Low to High</option></select><label className="search" style={{ margin: 0 }}><span>⌕</span><input aria-label="Search order, retailer, or rep" placeholder="Search order, retailer, rep…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></label></div></div><div className="order-table"><div className="order-table-header"><span>order / retailer</span><span>salesperson</span><span>warehouse</span><span>age</span><span>items</span><span>value</span><span>state</span><span>owner / next</span><span /></div>{loading ? <div className="table-loading"><div className="skeleton skeleton-row" /><div className="skeleton skeleton-row" /><div className="skeleton skeleton-row" /></div> : displayedOrders.length === 0 ? <div className="empty-state quiet">No orders match the selected filters or state.</div> : displayedOrders.map((order) => <button type="button" key={order.id} data-order-id={order.id} className={`order-table-row row-${rowSurface(order)} ${selectedId === order.id ? "selected" : ""}`} aria-pressed={selectedId === order.id} aria-haspopup="dialog" onClick={(event) => { event.currentTarget.focus(); openReview(order.id); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.focus(); openReview(order.id); } }}><span className="table-order"><i className={`status-rail ${toneFor(order)}`} /><b>{formatOrderRef(order)}</b><small>{order.retailer?.name ?? "Retailer unavailable"}</small></span><span className="table-salesperson" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}><strong style={{ fontSize: 12, color: "#0284c7", display: "inline-flex", alignItems: "center", gap: 3 }}>👤 {order.salespersonName || "Direct"}</strong><small style={{ fontSize: 10, color: "#64748b" }}>{order.punchedByRole === "Salesperson" ? (order.salespersonPhone ? `Rep · ${order.salespersonPhone}` : "Sales Rep") : "Retailer Direct"}</small></span><span className="table-warehouse" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}><span style={{ fontSize: 11, fontWeight: 700, padding: "2px 6px", background: order.warehouseCode === "WH-002" ? "#fef3c7" : "#f1f5f9", color: order.warehouseCode === "WH-002" ? "#92400e" : "#334155", borderRadius: 4, width: "fit-content" }}>🏢 {order.warehouseCode || "WH-001"}</span><small style={{ fontSize: 10, color: "#64748b" }}>{order.warehouseCity || "Indore"}</small></span><span className={`table-age ${(ageHours(order.createdAt) ?? 0) > 12 ? "critical" : ""}`}><Icon name="clock" size={13} />{ageLabel(order.createdAt)}</span><span className="tabular">{order.items?.length ?? 0} lines</span><strong className="tabular">{inr(Number(order.orderTotal ?? 0))}</strong><span className={`constraint ${toneFor(order)}`}>{queueStatusLabel(order)}</span><span className="table-next"><b>{order.delivery?.routeId ?? "Operations"}</b><small>{NEXT_ACTION[order.status] ?? "Inspect order"} <Icon name="arrow" size={13} /></small></span><Icon name="chevron" size={15} /></button>)}</div></section>
      <aside className="order-side-note"><SectionLabel>Queue read</SectionLabel><strong>{outsideSla > 0 ? `${outsideSla} orders have crossed the twelve-hour band.` : "No order has crossed the twelve-hour band."}</strong><p>{selected ? `${formatOrderRef(selected)} is ${ageLabel(selected.createdAt)} old. Review and act from the queue. Open the full workspace only for ledger, retailer, or SAP detail.` : "Open an order to review the next safe action without leaving this list."}</p>{selected ? <button className="text-button" onClick={() => { setSelectedId(null); setReviewId(null); setDetailId(null); }}>clear selection <Icon name="arrow" size={14} /></button> : null}</aside>
    </div>
    {detailOrder ? <section className="order-workspace" id="order-workspace" aria-label="Selected order workspace"><div className="workspace-heading"><div><SectionLabel>Order workspace / selected object</SectionLabel><h2>{formatOrderRef(detailOrder)}</h2><p>{detailOrder.retailer?.name ?? "Retailer unavailable"} · placed {ageLabel(detailOrder.createdAt)} ago{detailOrder.retailer?.phone ? ` · ${detailOrder.retailer.phone}` : ""}</p></div><div className={`workspace-status ${toneFor(detailOrder)}`}><span className="status-dot" />{STATUS_LABEL[detailOrder.status] ?? detailOrder.status}<strong>{inr(Number(detailOrder.orderTotal ?? 0))}</strong></div></div><div className="workspace-hero"><div className="hero-value"><span>order value</span><strong>{inr(Number(detailOrder.orderTotal ?? 0))}</strong><small>{detailOrder.items?.length ?? 0} lines · {detailOrder.delivery?.routeId ? `route ${detailOrder.delivery.routeId}` : "route not assigned"}</small><div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}><span style={{ padding: "2px 8px", background: "#e0f2fe", borderRadius: 4, fontSize: 12, color: "#0369a1", fontWeight: 600 }}>👤 Salesperson: {detailOrder.salespersonName || "Direct"} ({detailOrder.punchedByLabel || "Retailer Direct"})</span><span style={{ padding: "2px 8px", background: "#f3e8ff", borderRadius: 4, fontSize: 12, color: "#6b21a8", fontWeight: 600 }}>🏢 Fulfillment Warehouse: {detailOrder.warehouseName || "Indore Central Fulfillment Hub"} ({detailOrder.warehouseCode || "WH-001"})</span></div></div><div className={`hero-decision ${detailOrder.status === "placed" || detailOrder.sapSyncStatus === "failed" ? "critical" : ""}`}><span className="decision-kicker"><i className="status-dot" /> next safe action</span><strong>{NEXT_ACTION[detailOrder.status] ?? "Inspect order"}</strong><p>{dependencyCopy(detailOrder)}</p>{actionControls(detailOrder, "workspace")}</div></div><div className="workspace-columns"><main><section className="diagnostic-section"><div className="section-head"><div><SectionLabel>Diagnostic instrument</SectionLabel><h2>Order health</h2></div><span className="small-note">canonical fields only</span></div><HealthMatrix order={detailOrder} /><Journey order={detailOrder} /></section><section className="items-section"><div className="section-head"><div><SectionLabel>Commercial lines</SectionLabel><h2>Items <em>{detailOrder.items?.length ?? 0} lines</em></h2></div><span className="small-note">unit prices from order</span></div>{detailOrder.commercialSnapshot ? <Breakdown value={detailOrder.commercialSnapshot}/> : null}<div className="item-ledger" hidden={!!detailOrder.commercialSnapshot}><div><span>item</span><span>ordered</span><span>unit price</span><span>line value</span></div>{(detailOrder.items ?? []).map((item: any) => <div key={item.id}><b>{item.variant?.product?.name ?? "Product unavailable"}</b><span>{item.qtyOrdered ?? 0}</span><span>{inr(Number(item.unitPrice ?? 0))}</span><strong>{inr(storedLineValue(detailOrder, item))}</strong></div>)}</div></section></main><aside className="inspector-context"><div className="context-block"><SectionLabel>Dependency</SectionLabel><h3>{detailOrder.status === "placed" ? "This order cannot move yet." : detailOrder.sapSyncStatus === "failed" ? "The ERP hand-off is blocked." : "This order has a clear next step."}</h3><p>{detailOrder.status === "placed" ? "Approval is required before warehouse work can begin." : detailOrder.sapSyncStatus === "failed" ? "The order remains in its current state until synchronization succeeds." : NEXT_ACTION[detailOrder.status]}</p><dl><div><dt>owner</dt><dd>{detailOrder.delivery?.routeId ?? "Operations"}</dd></div><div><dt>waiting</dt><dd>{ageLabel(detailOrder.createdAt)}</dd></div><div><dt>state</dt><dd className={toneFor(detailOrder) === "critical" ? "red-text" : "green-text"}>{STATUS_LABEL[detailOrder.status] ?? detailOrder.status}</dd></div></dl></div><div className="context-block related"><SectionLabel>Related context</SectionLabel><a href="/retailers">Retailer account <Icon name="arrow" size={13} /></a><a href="/ledger">Financial ledger <Icon name="arrow" size={13} /></a><a href="/sap">SAP state · {sapLabel(detailOrder)} <Icon name="arrow" size={13} /></a></div><div className="context-block activity"><SectionLabel>Activity ledger</SectionLabel><p><time>{detailOrder.createdAt ? new Date(detailOrder.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}</time> order received <small>{detailOrder.retailer?.name ?? "Retailer unavailable"}</small></p><p><time>now</time> current state evaluated <small>Admin read model</small></p></div></aside></div><div className="action-dock"><span><i className="pulse" /> next safe action</span><strong>{NEXT_ACTION[detailOrder.status] ?? "Inspect order"}</strong>{actionControls(detailOrder, "dock")}</div></section> : null}
    {reviewOrder ? <OrderReviewModal order={reviewOrder} busy={busyId === reviewOrder.id} error={error} onClose={() => closeReview(reviewOrder.id)} onOpenDetails={() => openDetails(reviewOrder)} actions={actionControls(reviewOrder, "review")} /> : null}
    {assignOrder && <AssignModal order={assignOrder} onClose={() => setAssignOrder(null)} onDone={(msg) => { setAssignOrder(null); setNotice(msg); void load(); }} />}{podOrder && <PodModal order={podOrder} onClose={() => setPodOrder(null)} onDone={(msg) => { setPodOrder(null); setNotice(msg); void load(); }} />}
  </div>;
}

export default function Orders({ mode = "admin" }: { mode?: "admin" | "warehouse" }) {
  return mode === "warehouse" ? <WarehouseOrdersPage /> : <AdminOrders />;
}
