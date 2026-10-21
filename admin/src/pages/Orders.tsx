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
  { key: "placed", label: "📝 Sales Order Created (Awaiting approval)" },
  { key: "confirmed", label: "Confirmed" },
  { key: "packed", label: "Packed" },
  { key: "out_for_delivery", label: "🚚 Order Dispatched" },
  { key: "delivered", label: "🧾 Invoices" },
  { key: "rejected", label: "Rejected" },
] as const;

export type DuplicateMatch = {
  isDuplicate: boolean;
  duplicateOfOrderRef: string;
  duplicateOrderId: string;
  reason: string;
};

export function detectDuplicateOrders(orders: any[]): Map<string, DuplicateMatch> {
  const duplicates = new Map<string, DuplicateMatch>();
  const activeOrders = orders.filter((o) => o.status !== "rejected");
  if (activeOrders.length <= 1) return duplicates;

  // Group by party identifier to avoid comparing unrelated retailers (drops comparisons from 20,000 to <20)
  const partyGroups = new Map<string, any[]>();
  for (const o of activeOrders) {
    const key = o.retailerId || o.retailer?.phone?.trim() || o.retailer?.name?.trim().toLowerCase() || o.id;
    const group = partyGroups.get(key);
    if (group) group.push(o);
    else partyGroups.set(key, [o]);
  }

  // Pre-calculate items signature once per order
  const signatures = new Map<string, string>();
  for (const o of activeOrders) {
    const items = o.items || [];
    const sig = items.map((it: any) => `${it.variantId || it.id}_${it.qtyOrdered}`).sort().join("|");
    signatures.set(o.id, sig);
  }

  for (const group of partyGroups.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      const a = group[i];
      for (let j = i + 1; j < group.length; j++) {
        const b = group[j];
        const cityA = (a.retailer?.deliveryCity || a.retailer?.city || "").trim().toLowerCase();
        const cityB = (b.retailer?.deliveryCity || b.retailer?.city || "").trim().toLowerCase();
        const stationMatches = !cityA || !cityB || cityA === cityB;
        if (!stationMatches) continue;

        const itemsA = a.items || [];
        const itemsB = b.items || [];
        const sameItemsCount = itemsA.length === itemsB.length && itemsA.length > 0;
        const sameTotal = Math.abs(Number(a.orderTotal || 0) - Number(b.orderTotal || 0)) < 1;

        let itemsMatch = sameTotal && sameItemsCount;
        if (sameItemsCount && signatures.get(a.id) === signatures.get(b.id)) {
          itemsMatch = true;
        }
        if (!itemsMatch) continue;

        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        const diffHours = Math.abs(timeA - timeB) / (1000 * 60 * 60);
        if (diffHours > 168) continue;

        const newer = timeA >= timeB ? a : b;
        const older = timeA >= timeB ? b : a;
        const olderRef = formatOrderRef(older);

        duplicates.set(newer.id, {
          isDuplicate: true,
          duplicateOfOrderRef: olderRef,
          duplicateOrderId: older.id,
          reason: `Matches order ${olderRef} (identical ${itemsA.length} items, total ₹${Number(newer.orderTotal || 0).toLocaleString("en-IN")}) placed for ${newer.retailer?.name || "Party"} at ${cityA || "Indore"}.`,
        });
      }
    }
  }
  return duplicates;
}

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
  const [salespersonFilter, setSalespersonFilter] = useState<string>("all");
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

  const [folderCategory, setFolderCategory] = useState<"salesman" | "status" | "date" | "none">("salesman");
  const [activeFolderLabel, setActiveFolderLabel] = useState<string | null>(null);
  const [tabSummaries, setTabSummaries] = useState<Record<string, { count: number; value: number }>>({});

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

  const fetchQueues = useCallback(async (targetWarehouse = warehouseFilter, activeTab: string = tab) => {
    const countsPromise = typeof api.orderCounts === "function"
      ? api.orderCounts(targetWarehouse).catch(() => null)
      : Promise.resolve(null);

    const [countsResult, activeResult, commercial] = await Promise.all([
      countsPromise,
      api.orders(activeTab, targetWarehouse),
      api.commercialStatuses(),
    ]);

    let queues: Record<string, any[]> = {};
    let fetchedWarehouses: any[] = [];

    if (countsResult?.counts) {
      setTabSummaries(countsResult.counts);
      queues = {
        [activeTab]: Array.isArray(activeResult?.orders) ? activeResult.orders : [],
      };
      if (Array.isArray(countsResult.warehouses) && countsResult.warehouses.length > 0) {
        fetchedWarehouses = countsResult.warehouses;
      }
    } else {
      const otherTabs = TABS.filter((t) => t.key !== activeTab);
      const responses = await Promise.all(
        otherTabs.map(async (item) => ({ key: item.key, result: await api.orders(item.key, targetWarehouse) }))
      );
      queues[activeTab] = Array.isArray(activeResult?.orders) ? activeResult.orders : [];
      responses.forEach(({ key, result }) => {
        queues[key] = Array.isArray(result?.orders) ? result.orders : [];
        if (Array.isArray(result?.warehouses) && result.warehouses.length > 0) {
          fetchedWarehouses = result.warehouses;
        }
      });
    }

    if (Array.isArray(activeResult?.warehouses) && activeResult.warehouses.length > 0) {
      fetchedWarehouses = activeResult.warehouses;
    }
    if (fetchedWarehouses.length > 0) {
      setWarehouses(fetchedWarehouses);
    }
    const statuses = new Map<string, any>(((commercial?.orders ?? []) as any[]).map((order) => [order.id, order.internalStatus]));
    return { queues, statuses };
  }, [warehouseFilter, tab]);

  const load = useCallback(async (targetWarehouse = warehouseFilter, activeTab: string = tab) => {
    setLoading(true);
    try {
      const { queues, statuses } = await fetchQueues(targetWarehouse, activeTab);
      publishQueues(queues, statuses);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load orders");
    } finally { setLoading(false); }
  }, [fetchQueues, publishQueues, warehouseFilter, tab]);

  const loadTab = useCallback(async (targetTab: string) => {
    try {
      const result = await api.orders(targetTab, warehouseFilter);
      const nextOrders = Array.isArray(result?.orders) ? result.orders : [];
      setQueueData((prev) => {
        const nextQueues = { ...prev, [targetTab]: nextOrders };
        const visible = filterTab(nextQueues, statusByOrderId, targetTab);
        setOrders(visible);
        setSelectedId((current) => current && visible.some((order) => order.id === current) ? current : visible[0]?.id ?? null);
        return nextQueues;
      });
    } catch {}
  }, [warehouseFilter, filterTab, statusByOrderId]);

  useEffect(() => { void load(warehouseFilter); }, [load, warehouseFilter]);
  useEffect(() => () => clearDeparture(), []);
  useEffect(() => { if (requestedTab && TABS.some((item) => item.key === requestedTab) && requestedTab !== tab) setTab(requestedTab); }, [requestedTab, tab]);

  const reviewOrder = orders.find((order) => order.id === reviewId) ?? null;
  const detailOrder = orders.find((order) => order.id === detailId) ?? null;
  const selected = orders.find((order) => order.id === selectedId) ?? reviewOrder ?? detailOrder;
  const selectedTab = TABS.find((item) => item.key === tab)?.label ?? "Orders";
  const metricOrders = useMemo(() => filterTab(queueData, statusByOrderId), [filterTab, queueData, statusByOrderId]);

  const salespersons = useMemo(() => {
    const set = new Set<string>();
    Object.values(queueData).forEach((list) => {
      (list || []).forEach((o: any) => {
        const name = o.punchedByName || o.salespersonName || o.creatorName;
        if (name && name !== "Direct" && name !== "Customer") set.add(name);
      });
    });
    return Array.from(set).sort();
  }, [queueData]);

  const displayedOrders = useMemo(() => {
    let result = orders;

    if (salespersonFilter === "retailer_direct") {
      result = result.filter((o) => o.punchedByRole === "Retailer" || (!o.placedByRepId && !o.salespersonName));
    } else if (salespersonFilter !== "all") {
      const target = salespersonFilter.toLowerCase();
      result = result.filter(
        (o) =>
          (o.salespersonName ?? "").toLowerCase() === target ||
          (o.punchedByName ?? "").toLowerCase() === target ||
          (o.creatorName ?? "").toLowerCase() === target
      );
    }

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
  }, [orders, salespersonFilter, dateFilter, searchTerm, sortBy]);

  const queueValue = metricOrders.reduce((sum, order) => sum + Number(order.orderTotal ?? 0), 0);
  const ages = useMemo(() => ageCounts(metricOrders), [metricOrders]);
  const oldest = useMemo(() => metricOrders.slice().sort((a, b) => (ageHours(b.createdAt) ?? -1) - (ageHours(a.createdAt) ?? -1))[0], [metricOrders]);
  const outsideSla = ages[3];

  const duplicateMap = useMemo(() => detectDuplicateOrders(metricOrders.length > 0 ? metricOrders : orders), [metricOrders, orders]);

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
    if (!queueData[key] || queueData[key].length === 0) {
      void loadTab(key);
    }
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

    <section className="stage-rail" aria-label="Order lifecycle stages">{TABS.map((stage) => {
      const stageOrders = queueData[stage.key] ?? [];
      const stageValue = stageOrders.reduce((sum, order) => sum + Number(order.orderTotal ?? 0), 0);
      const count = tabSummaries[stage.key]?.count ?? stageOrders.length;
      const val = tabSummaries[stage.key]?.value ?? stageValue;
      return (
        <button key={stage.key} className={tab === stage.key ? "active" : ""} onClick={() => setStage(stage.key)}>
          <span className="stage-count">{loading && !queueData[stage.key] && tabSummaries[stage.key] == null ? "—" : count}</span>
          <span>{stage.label}</span>
          <small>{inr(val)}</small>
        </button>
      );
    })}</section>
    <div className="internal-status-rail" aria-label="Internal commercial status filters">{INTERNAL_STATUS_FILTERS.map((filter) => <button key={filter.key} className={internalFilter === filter.key ? "selected" : ""} onClick={() => setInternalFilter(filter.key)}>{filter.label}</button>)}</div>
    <section className="queue-summary" aria-label="Queue health"><div><span>active queue</span><strong>{selectedTab}</strong></div><div><span>oldest order</span><strong>{ageLabel(oldest?.createdAt)}</strong></div><div><span>outside SLA</span><strong className={outsideSla > 0 ? "red-text" : "green-text"}>{outsideSla} orders</strong></div><div><span>queue value</span><strong>{loading ? "—" : inr(queueValue)}</strong></div><AgeDistribution counts={ages} /></section>
    {error && !reviewOrder && <div className="banner error" role="alert">{error}</div>}{notice && <div className="banner success" role="status">{notice}</div>}
    
    {/* Folders Navigation: Salesman, Under Process Status, Date-wise (Points 1 & 3) */}
    <section className="order-folders-section" aria-label="Order folder directories" style={{
      background: "#f8fafc",
      border: "1px solid #e2e8f0",
      borderRadius: 8,
      padding: "12px 14px",
      marginBottom: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong style={{ fontSize: 13, color: "#1e293b", textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 6 }}>
            📁 Order Folders
          </strong>
          {activeFolderLabel && (
            <span style={{ fontSize: 11, background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: 12, fontWeight: 700 }}>
              Active: {activeFolderLabel} ({displayedOrders.length} orders)
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Folder view:</span>
          <button
            type="button"
            className={`button compact ${folderCategory === "salesman" ? "primary" : "ghost"}`}
            style={{ fontSize: 12, padding: "3px 10px", height: "auto" }}
            onClick={() => setFolderCategory("salesman")}
          >
            👤 Salesman Folders
          </button>
          <button
            type="button"
            className={`button compact ${folderCategory === "status" ? "primary" : "ghost"}`}
            style={{ fontSize: 12, padding: "3px 10px", height: "auto" }}
            onClick={() => setFolderCategory("status")}
          >
            📋 Under Process Folders
          </button>
          <button
            type="button"
            className={`button compact ${folderCategory === "date" ? "primary" : "ghost"}`}
            style={{ fontSize: 12, padding: "3px 10px", height: "auto" }}
            onClick={() => setFolderCategory("date")}
          >
            📅 Date Folders
          </button>
          {activeFolderLabel && (
            <button
              type="button"
              className="button ghost compact"
              style={{ fontSize: 11, color: "#dc2626", padding: "3px 8px", height: "auto" }}
              onClick={() => {
                setSalespersonFilter("all");
                setInternalFilter("");
                setDateFilter("all");
                setActiveFolderLabel(null);
              }}
            >
              ✕ Reset Filters
            </button>
          )}
        </div>
      </div>

      {folderCategory === "salesman" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => { setSalespersonFilter("all"); setActiveFolderLabel(null); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 6,
              border: salespersonFilter === "all" ? "1px solid #0284c7" : "1px solid #cbd5e1",
              background: salespersonFilter === "all" ? "#e0f2fe" : "#ffffff",
              color: salespersonFilter === "all" ? "#0369a1" : "#334155",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <span>📁 All Salespeople</span>
            <span style={{ padding: "1px 6px", background: "rgba(0,0,0,0.06)", borderRadius: 10, fontSize: 11 }}>
              {metricOrders.length}
            </span>
          </button>
          {salespersons.map((rep) => {
            const count = metricOrders.filter((o) => (o.salespersonName || o.punchedByName || o.creatorName) === rep).length;
            const isSelected = salespersonFilter.toLowerCase() === rep.toLowerCase();
            return (
              <button
                type="button"
                key={rep}
                onClick={() => { setSalespersonFilter(rep); setActiveFolderLabel(`Salesman: ${rep}`); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: isSelected ? "1px solid #0284c7" : "1px solid #cbd5e1",
                  background: isSelected ? "#e0f2fe" : "#ffffff",
                  color: isSelected ? "#0369a1" : "#334155",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <span>📁 {rep}</span>
                <span style={{ padding: "1px 6px", background: "rgba(0,0,0,0.06)", borderRadius: 10, fontSize: 11 }}>
                  {count}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => { setSalespersonFilter("retailer_direct"); setActiveFolderLabel("Salesman: Retailer Direct"); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 6,
              border: salespersonFilter === "retailer_direct" ? "1px solid #0284c7" : "1px solid #cbd5e1",
              background: salespersonFilter === "retailer_direct" ? "#e0f2fe" : "#ffffff",
              color: salespersonFilter === "retailer_direct" ? "#0369a1" : "#334155",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <span>📁 Retailer Direct</span>
            <span style={{ padding: "1px 6px", background: "rgba(0,0,0,0.06)", borderRadius: 10, fontSize: 11 }}>
              {metricOrders.filter((o) => o.punchedByRole === "Retailer" || (!o.placedByRepId && !o.salespersonName)).length}
            </span>
          </button>
        </div>
      )}

      {folderCategory === "status" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => { setInternalFilter(""); setActiveFolderLabel(null); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 6,
              border: internalFilter === "" ? "1px solid #16a34a" : "1px solid #cbd5e1",
              background: internalFilter === "" ? "#dcfce7" : "#ffffff",
              color: internalFilter === "" ? "#15803d" : "#334155",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <span>📁 All Statuses</span>
            <span style={{ padding: "1px 6px", background: "rgba(0,0,0,0.06)", borderRadius: 10, fontSize: 11 }}>
              {metricOrders.length}
            </span>
          </button>
          {INTERNAL_STATUS_FILTERS.filter((f) => f.key).map((filter) => {
            const count = metricOrders.filter((o) => o.internalStatus?.currentCode === filter.key).length;
            const isSelected = internalFilter === filter.key;
            return (
              <button
                type="button"
                key={filter.key}
                onClick={() => { setInternalFilter(filter.key); setActiveFolderLabel(`Status: ${filter.label}`); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: isSelected ? "1px solid #16a34a" : "1px solid #cbd5e1",
                  background: isSelected ? "#dcfce7" : "#ffffff",
                  color: isSelected ? "#15803d" : "#334155",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <span>📁 {filter.label}</span>
                <span style={{ padding: "1px 6px", background: "rgba(0,0,0,0.06)", borderRadius: 10, fontSize: 11 }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {folderCategory === "date" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { key: "all", label: "📁 All Dates" },
            { key: "today", label: "📁 Today" },
            { key: "week", label: "📁 Last 7 Days" },
            { key: "month", label: "📁 This Month" },
          ].map((d) => {
            const isSelected = dateFilter === d.key;
            return (
              <button
                type="button"
                key={d.key}
                onClick={() => { setDateFilter(d.key as any); setActiveFolderLabel(d.key === "all" ? null : `Date: ${d.label}`); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: isSelected ? "1px solid #7c3aed" : "1px solid #cbd5e1",
                  background: isSelected ? "#f3e8ff" : "#ffffff",
                  color: isSelected ? "#6d28d9" : "#334155",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <span>{d.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>

    <div className="orders-layout"><section className="order-table-zone"><div className="table-toolbar"><div><SectionLabel>Operational queue</SectionLabel><h2>{selectedTab} <em>{displayedOrders.length} orders</em></h2></div><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
  <select value={salespersonFilter} onChange={(e) => setSalespersonFilter(e.target.value)} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", fontWeight: 600, color: "#0f172a" }} aria-label="Filter via sales person">
    <option value="all">👤 All Salespersons</option>
    <option value="retailer_direct">🛒 Retailer Direct (No Rep)</option>
    {salespersons.map((rep) => (
      <option key={rep} value={rep}>
        👤 {rep}
      </option>
    ))}
  </select>
  <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as any)} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)" }} aria-label="Filter by date"><option value="all">📅 All Dates</option><option value="today">Today</option><option value="week">Last 7 Days</option><option value="month">This Month</option></select><select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)" }} aria-label="Sort orders"><option value="date_desc">⚡ Date: Newest First</option><option value="date_asc">Date: Oldest First</option><option value="value_desc">Value: High to Low</option><option value="value_asc">Value: Low to High</option></select><label className="search" style={{ margin: 0 }}><span>⌕</span><input aria-label="Search order, retailer, or rep" placeholder="Search order, retailer, rep…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></label></div></div><div className="order-table"><div className="order-table-header"><span>order / retailer</span><span>salesperson</span><span>warehouse</span><span>age</span><span>items</span><span>value</span><span>state</span><span>owner / next</span><span /></div>{loading ? <div className="table-loading"><div className="skeleton skeleton-row" /><div className="skeleton skeleton-row" /><div className="skeleton skeleton-row" /></div> : displayedOrders.length === 0 ? <div className="empty-state quiet">No orders match the selected filters or state.</div> : displayedOrders.map((order) => {
        const isDuplicate = duplicateMap.has(order.id);
        const dupMatch = duplicateMap.get(order.id);
        return (
          <button type="button" key={order.id} data-order-id={order.id} className={`order-table-row row-${rowSurface(order)} ${selectedId === order.id ? "selected" : ""}`} aria-pressed={selectedId === order.id} aria-haspopup="dialog" onClick={(event) => { event.currentTarget.focus(); openReview(order.id); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.focus(); openReview(order.id); } }}>
            <span className="table-order">
              <i className={`status-rail ${toneFor(order)}`} />
              <b>{formatOrderRef(order)}</b>
              <small>{order.retailer?.name ?? "Retailer unavailable"}</small>
              {isDuplicate && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 3, marginTop: 3, width: "fit-content" }}>
                  ⚠️ Duplicate: {dupMatch?.duplicateOfOrderRef}
                </span>
              )}
            </span>
            <span className="table-salesperson" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}><strong style={{ fontSize: 12, color: "#0284c7", display: "inline-flex", alignItems: "center", gap: 3 }}>👤 {order.salespersonName || "Direct"}</strong><small style={{ fontSize: 10, color: "#64748b" }}>{order.punchedByRole === "Salesperson" ? (order.salespersonPhone ? `Rep · ${order.salespersonPhone}` : "Sales Rep") : "Retailer Direct"}</small></span><span className="table-warehouse" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}><span style={{ fontSize: 11, fontWeight: 700, padding: "2px 6px", background: order.warehouseCode === "WH-002" ? "#fef3c7" : "#f1f5f9", color: order.warehouseCode === "WH-002" ? "#92400e" : "#334155", borderRadius: 4, width: "fit-content" }}>🏢 {order.warehouseCode || "WH-001"}</span><small style={{ fontSize: 10, color: "#64748b" }}>{order.warehouseCity || "Indore"}</small></span><span className={`table-age ${(ageHours(order.createdAt) ?? 0) > 12 ? "critical" : ""}`}><Icon name="clock" size={13} />{ageLabel(order.createdAt)}</span><span className="tabular">{order.items?.length ?? 0} lines</span><strong className="tabular">{inr(Number(order.orderTotal ?? 0))}</strong><span className={`constraint ${toneFor(order)}`}>{queueStatusLabel(order)}</span><span className="table-next"><b>{order.delivery?.routeId ?? "Operations"}</b><small>{NEXT_ACTION[order.status] ?? "Inspect order"} <Icon name="arrow" size={13} /></small></span><Icon name="chevron" size={15} />
          </button>
        );
      })}</div></section>
      <aside className="order-side-note"><SectionLabel>Queue read</SectionLabel><strong>{outsideSla > 0 ? `${outsideSla} orders have crossed the twelve-hour band.` : "No order has crossed the twelve-hour band."}</strong><p>{selected ? `${formatOrderRef(selected)} is ${ageLabel(selected.createdAt)} old. Review and act from the queue. Open the full workspace only for ledger, retailer, or SAP detail.` : "Open an order to review the next safe action without leaving this list."}</p>{selected ? <button className="text-button" onClick={() => { setSelectedId(null); setReviewId(null); setDetailId(null); }}>clear selection <Icon name="arrow" size={14} /></button> : null}</aside>
    </div>
    {detailOrder ? <section className="order-workspace" id="order-workspace" aria-label="Selected order workspace"><div className="workspace-heading"><div><SectionLabel>Order workspace / selected object</SectionLabel><h2>{formatOrderRef(detailOrder)}</h2><p>{detailOrder.retailer?.name ?? "Retailer unavailable"} · placed {ageLabel(detailOrder.createdAt)} ago{detailOrder.retailer?.phone ? ` · ${detailOrder.retailer.phone}` : ""}</p></div><div className={`workspace-status ${toneFor(detailOrder)}`}><span className="status-dot" />{STATUS_LABEL[detailOrder.status] ?? detailOrder.status}<strong>{inr(Number(detailOrder.orderTotal ?? 0))}</strong></div></div><div className="workspace-hero"><div className="hero-value"><span>order value</span><strong>{inr(Number(detailOrder.orderTotal ?? 0))}</strong><small>{detailOrder.items?.length ?? 0} lines · {detailOrder.delivery?.routeId ? `route ${detailOrder.delivery.routeId}` : "route not assigned"}</small><div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}><span style={{ padding: "2px 8px", background: "#e0f2fe", borderRadius: 4, fontSize: 12, color: "#0369a1", fontWeight: 600 }}>👤 Salesperson: {detailOrder.salespersonName || "Direct"} ({detailOrder.punchedByLabel || "Retailer Direct"})</span><span style={{ padding: "2px 8px", background: "#f3e8ff", borderRadius: 4, fontSize: 12, color: "#6b21a8", fontWeight: 600 }}>🏢 Fulfillment Warehouse: {detailOrder.warehouseName || "Indore Central Fulfillment Hub"} ({detailOrder.warehouseCode || "WH-001"})</span></div></div><div className={`hero-decision ${detailOrder.status === "placed" || detailOrder.sapSyncStatus === "failed" ? "critical" : ""}`}><span className="decision-kicker"><i className="status-dot" /> next safe action</span><strong>{NEXT_ACTION[detailOrder.status] ?? "Inspect order"}</strong><p>{dependencyCopy(detailOrder)}</p>{actionControls(detailOrder, "workspace")}</div></div><div className="workspace-columns"><main><section className="diagnostic-section"><div className="section-head"><div><SectionLabel>Diagnostic instrument</SectionLabel><h2>Order health</h2></div><span className="small-note">canonical fields only</span></div><HealthMatrix order={detailOrder} /><Journey order={detailOrder} /></section><section className="items-section"><div className="section-head"><div><SectionLabel>Commercial lines</SectionLabel><h2>Items <em>{detailOrder.items?.length ?? 0} lines</em></h2></div><span className="small-note">unit prices from order</span></div>{detailOrder.commercialSnapshot ? <Breakdown value={detailOrder.commercialSnapshot}/> : null}<div className="item-ledger" hidden={!!detailOrder.commercialSnapshot}><div><span>item</span><span>ordered</span><span>unit price</span><span>line value</span></div>{(detailOrder.items ?? []).map((item: any) => {
  const unitRate = Number(item.unitPrice ?? 0);
  const caseWeightKg = Number(item.caseWeightKg ?? item.caseWeightKgSnapshot ?? (item.variant?.unitWeightKg ? Number(item.variant.unitWeightKg) * (item.variant.unitsPerCase ?? 1) : 0));
  const isBox = (item.outerPack === "Box") || item.variant?.catalogIdentityMasterPack?.toUpperCase()?.includes("BOX");
  const unitLabel = isBox ? "Box" : "Bag";
  const isQuintal = item.rateBasis === "quintal" || (caseWeightKg >= 20 && !isBox);
  const quintalRate = item.ratePerQuintal != null ? item.ratePerQuintal : (isQuintal && caseWeightKg > 0 ? Math.round((unitRate / caseWeightKg) * 100 * 100) / 100 : null);
  return <div key={item.id}><b>{item.variant?.product?.name ?? "Product unavailable"}</b><span>{item.qtyOrdered ?? 0} {isBox ? "boxes" : "bags"}</span><span>{isQuintal && quintalRate != null && quintalRate > 0 ? <div><strong>{inr(quintalRate)} / quintal</strong><small style={{ color: "#64748b", display: "block" }}>{inr(unitRate)} / {unitLabel.toLowerCase()}</small></div> : inr(unitRate)}</span><strong>{inr(storedLineValue(detailOrder, item))}</strong></div>;
})}</div></section></main><aside className="inspector-context"><div className="context-block"><SectionLabel>Dependency</SectionLabel><h3>{detailOrder.status === "placed" ? "This order cannot move yet." : detailOrder.sapSyncStatus === "failed" ? "The ERP hand-off is blocked." : "This order has a clear next step."}</h3><p>{detailOrder.status === "placed" ? "Approval is required before warehouse work can begin." : detailOrder.sapSyncStatus === "failed" ? "The order remains in its current state until synchronization succeeds." : NEXT_ACTION[detailOrder.status]}</p><dl><div><dt>owner</dt><dd>{detailOrder.delivery?.routeId ?? "Operations"}</dd></div><div><dt>waiting</dt><dd>{ageLabel(detailOrder.createdAt)}</dd></div><div><dt>state</dt><dd className={toneFor(detailOrder) === "critical" ? "red-text" : "green-text"}>{STATUS_LABEL[detailOrder.status] ?? detailOrder.status}</dd></div></dl></div><div className="context-block related"><SectionLabel>Related context</SectionLabel><a href="/retailers">Retailer account <Icon name="arrow" size={13} /></a><a href="/ledger">Financial ledger <Icon name="arrow" size={13} /></a><a href="/sap">SAP state · {sapLabel(detailOrder)} <Icon name="arrow" size={13} /></a></div><div className="context-block activity"><SectionLabel>Activity ledger</SectionLabel><p><time>{detailOrder.createdAt ? new Date(detailOrder.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}</time> order received <small>{detailOrder.retailer?.name ?? "Retailer unavailable"}</small></p><p><time>now</time> current state evaluated <small>Admin read model</small></p></div></aside></div><div className="action-dock"><span><i className="pulse" /> next safe action</span><strong>{NEXT_ACTION[detailOrder.status] ?? "Inspect order"}</strong>{actionControls(detailOrder, "dock")}</div></section> : null}
    {reviewOrder ? (
      <OrderReviewModal
        order={reviewOrder}
        busy={busyId === reviewOrder.id}
        error={error}
        onClose={() => closeReview(reviewOrder.id)}
        onOpenDetails={() => openDetails(reviewOrder)}
        actions={actionControls(reviewOrder, "review")}
        duplicateInfo={duplicateMap.get(reviewOrder.id)}
        onCancelDuplicate={async (orderId, remarks) => {
          await api.reject(orderId, remarks);
          setNotice(`Order ${formatOrderRef(reviewOrder)} cancelled as duplicate`);
          void load();
        }}
        onStatusChange={() => void load()}
      />
    ) : null}
    {assignOrder && <AssignModal order={assignOrder} onClose={() => setAssignOrder(null)} onDone={(msg) => { setAssignOrder(null); setNotice(msg); void load(); }} />}{podOrder && <PodModal order={podOrder} onClose={() => setPodOrder(null)} onDone={(msg) => { setPodOrder(null); setNotice(msg); void load(); }} />}
  </div>;
}

export default function Orders({ mode = "admin" }: { mode?: "admin" | "warehouse" }) {
  return mode === "warehouse" ? <WarehouseOrdersPage /> : <AdminOrders />;
}
