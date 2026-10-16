import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Icon, SectionLabel } from "../components/OperationalPrimitives";
import { formatOrderRef } from "../orderRef";

type QueueFilter = "all" | "confirmed" | "packed" | "out_for_delivery" | "delivered";

type WarehouseOrder = {
  id: string;
  orderNo: number;
  status: "confirmed" | "packed" | "out_for_delivery" | "delivered";
  createdAt: string;
  retailer: {
    id: string;
    name: string;
    phone?: string;
    shopAddress?: string;
    deliveryCity?: string;
  } | null;
  delivery?: {
    routeId?: string;
    deliverySlot?: string;
  } | null;
  items: Array<{
    id: string;
    qtyOrdered: number;
    caseWeightKg?: number;
    variant: {
      unitSize: string;
      unit: string;
      unitsPerCase: number;
      unitWeightKg?: number;
      product: { name: string } | null;
    } | null;
  }>;
};

const FILTERS: Array<{ value: QueueFilter; label: string; step: string; icon: string }> = [
  { value: "all", label: "All", step: "All stages", icon: "table" },
  { value: "confirmed", label: "Confirmed", step: "1. To Pack", icon: "box" },
  { value: "packed", label: "Packed", step: "2. To Dispatch", icon: "arrow" },
  { value: "out_for_delivery", label: "Out for delivery", step: "3. On the road", icon: "clock" },
  { value: "delivered", label: "Delivered", step: "4. Delivered", icon: "check" },
];

const DEFAULT_ROUTE_PRESETS = [
  "ROUTE-INDORE-CENTRAL",
  "ROUTE-MALWAMILL-PATNIPURA",
  "ROUTE-VIJAYNAGAR-SCHEME78",
  "ROUTE-EXPRESS",
];

function suggestRouteForRetailer(retailer?: WarehouseOrder["retailer"], presets: string[] = DEFAULT_ROUTE_PRESETS): string {
  if (!retailer) return presets[0] || "ROUTE-INDORE-CENTRAL";
  const haystack = `${retailer.name ?? ""} ${retailer.shopAddress ?? ""} ${retailer.deliveryCity ?? ""}`.toUpperCase();
  if (haystack.includes("MALWAMILL") || haystack.includes("PATNIPURA") || haystack.includes("NANDA NAGAR")) {
    const match = presets.find((p) => p.includes("MALWAMILL") || p.includes("PATNIPURA"));
    if (match) return match;
  }
  if (haystack.includes("VIJAY NAGAR") || haystack.includes("SCHEME 78") || haystack.includes("MALVIYA NAGAR")) {
    const match = presets.find((p) => p.includes("VIJAYNAGAR") || p.includes("SCHEME78"));
    if (match) return match;
  }
  return presets[0] || "ROUTE-INDORE-CENTRAL";
}

function statusBadgeClass(status: WarehouseOrder["status"]) {
  switch (status) {
    case "confirmed":
      return "warehouse-status confirmed";
    case "packed":
      return "warehouse-status packed";
    case "out_for_delivery":
      return "warehouse-status out-for-delivery";
    case "delivered":
      return "warehouse-status delivered";
    default:
      return "warehouse-status";
  }
}

function statusHumanLabel(status: WarehouseOrder["status"]) {
  switch (status) {
    case "confirmed":
      return "Ready to Pack";
    case "packed":
      return "Packed & Ready for Dispatch";
    case "out_for_delivery":
      return "Out for Delivery";
    case "delivered":
      return "Delivered & Completed";
    default:
      return status;
  }
}

function createdLabel(value?: string) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function humanErrorMessage(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "kyc_required":
      return "⚠️ Retailer KYC verification is pending. Please have the Sales Lead approve this retailer before dispatching.";
    case "dispatch_authorization_required":
      return "⚠️ Sales Lead approval is required before warehouse fulfillment can begin.";
    case "order_transition_conflict":
      return "⚠️ This order was updated by another team member. Refreshed latest state.";
    default:
      return code.includes("_") ? code.replace(/_/g, " ") : code;
  }
}

export default function WarehouseOrders() {
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [orders, setOrders] = useState<WarehouseOrder[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [allOrders, setAllOrders] = useState<WarehouseOrder[]>([]);

  // Pop-up Modal State
  const [modalOrder, setModalOrder] = useState<WarehouseOrder | null>(null);
  const [modalDetailLoading, setModalDetailLoading] = useState(false);

  // Dispatch fields inside modal
  const [routePresets, setRoutePresets] = useState<string[]>(DEFAULT_ROUTE_PRESETS);
  const [warehouseCity, setWarehouseCity] = useState("Indore");
  const [dispatchRouteId, setDispatchRouteId] = useState("ROUTE-INDORE-CENTRAL");
  const [dispatchSlot, setDispatchSlot] = useState("");

  useEffect(() => {
    api.warehouseRoutes?.()
      .then((res) => {
        if (res?.routes && Array.isArray(res.routes) && res.routes.length > 0) {
          setRoutePresets(res.routes);
        }
        if (res?.warehouseCity) {
          setWarehouseCity(res.warehouseCity);
        }
      })
      .catch(() => {});
  }, []);

  // POD Delivery fields inside modal
  const [podType, setPodType] = useState<"photo" | "otp" | "signature">("photo");
  const [deliveredLines, setDeliveredLines] = useState<Array<{ orderItemId: string; cases: number }>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [filterResult, allResult] = await Promise.all([
        api.warehouseOrders(filter === "all" ? undefined : filter),
        api.warehouseOrders("all").catch(() => null),
      ]);
      const nextFiltered = Array.isArray(filterResult?.orders) ? (filterResult.orders as WarehouseOrder[]) : [];
      const nextAll = Array.isArray(allResult?.orders) ? (allResult.orders as WarehouseOrder[]) : [];
      const completeList = nextAll.length > 0 ? nextAll : nextFiltered;
      setAllOrders(completeList);

      if (filter === "all") {
        setOrders(completeList);
      } else {
        setOrders(nextFiltered);
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load warehouse orders");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Compute live analytics, aging hours, and hourly fulfillment infographics
  const metrics = useMemo(() => {
    const list = allOrders.length > 0 ? allOrders : orders;
    const now = Date.now();

    const confirmed = list.filter((o) => o.status === "confirmed");
    const packed = list.filter((o) => o.status === "packed");
    const outForDelivery = list.filter((o) => o.status === "out_for_delivery");
    const delivered = list.filter((o) => o.status === "delivered");
    const pending = list.filter((o) => o.status === "confirmed" || o.status === "packed");

    const totalCases = list.reduce(
      (sum, o) => sum + (o.items ?? []).reduce((s, i) => s + (i.qtyOrdered || 0), 0),
      0
    );

    // Aging breakdown for pending orders (< 2h, 2-6h, > 6h)
    const pendingUnder2h = pending.filter(
      (o) => (now - new Date(o.createdAt).getTime()) < 2 * 3600 * 1000
    );
    const pending2to6h = pending.filter((o) => {
      const age = now - new Date(o.createdAt).getTime();
      return age >= 2 * 3600 * 1000 && age < 6 * 3600 * 1000;
    });
    const pendingOver6h = pending.filter(
      (o) => (now - new Date(o.createdAt).getTime()) >= 6 * 3600 * 1000
    );

    const pendingTotal = pending.length;
    const pctUnder2h = pendingTotal > 0 ? Math.round((pendingUnder2h.length / pendingTotal) * 100) : 0;
    const pct2to6h = pendingTotal > 0 ? Math.round((pending2to6h.length / pendingTotal) * 100) : 0;
    const pctOver6h = pendingTotal > 0 ? Math.max(0, 100 - pctUnder2h - pct2to6h) : 0;

    const avgAgingHours = pendingTotal > 0
      ? (pending.reduce((sum, o) => sum + Math.max(0, now - new Date(o.createdAt).getTime()), 0) / (pendingTotal * 3600 * 1000)).toFixed(1)
      : "0.0";

    const oldestAgingHours = pendingTotal > 0
      ? (Math.max(...pending.map((o) => Math.max(0, now - new Date(o.createdAt).getTime()))) / (3600 * 1000)).toFixed(1)
      : "0.0";

    // Hourly distribution for intake & fulfillment (8am to 8pm in 2-hour buckets)
    const hourlyBuckets = [
      { label: "8 AM", start: 8, end: 10, count: 0, dispatched: 0 },
      { label: "10 AM", start: 10, end: 12, count: 0, dispatched: 0 },
      { label: "12 PM", start: 12, end: 14, count: 0, dispatched: 0 },
      { label: "2 PM", start: 14, end: 16, count: 0, dispatched: 0 },
      { label: "4 PM", start: 16, end: 18, count: 0, dispatched: 0 },
      { label: "6 PM", start: 18, end: 20, count: 0, dispatched: 0 },
      { label: "8 PM+", start: 20, end: 24, count: 0, dispatched: 0 },
    ];

    list.forEach((o) => {
      const d = new Date(o.createdAt);
      const h = d.getHours();
      const bucket = hourlyBuckets.find((b) => h >= b.start && h < b.end) || hourlyBuckets[hourlyBuckets.length - 1];
      if (bucket) {
        bucket.count++;
        if (o.status === "out_for_delivery" || o.status === "delivered") {
          bucket.dispatched++;
        }
      }
    });

    const maxBucketCount = Math.max(1, ...hourlyBuckets.map((b) => Math.max(b.count, b.dispatched)));

    return {
      total: list.length,
      totalCases,
      confirmedCount: confirmed.length,
      confirmedCases: confirmed.reduce((sum, o) => sum + (o.items ?? []).reduce((s, i) => s + (i.qtyOrdered || 0), 0), 0),
      packedCount: packed.length,
      packedCases: packed.reduce((sum, o) => sum + (o.items ?? []).reduce((s, i) => s + (i.qtyOrdered || 0), 0), 0),
      outForDeliveryCount: outForDelivery.length,
      outForDeliveryCases: outForDelivery.reduce((sum, o) => sum + (o.items ?? []).reduce((s, i) => s + (i.qtyOrdered || 0), 0), 0),
      deliveredCount: delivered.length,
      pendingTotal,
      pendingUnder2h: pendingUnder2h.length,
      pending2to6h: pending2to6h.length,
      pendingOver6h: pendingOver6h.length,
      pctUnder2h,
      pct2to6h,
      pctOver6h,
      avgAgingHours,
      oldestAgingHours,
      hourlyBuckets,
      maxBucketCount,
    };
  }, [allOrders, orders]);

  // Trap escape key and body scroll when modal is open
  useEffect(() => {
    if (!modalOrder) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        e.preventDefault();
        setModalOrder(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [modalOrder, busy]);

  const filteredOrders = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter(
      (o) =>
        formatOrderRef(o).toLowerCase().includes(q) ||
        (o.retailer?.name ?? "").toLowerCase().includes(q) ||
        (o.retailer?.shopAddress ?? "").toLowerCase().includes(q) ||
        (o.retailer?.deliveryCity ?? "").toLowerCase().includes(q)
    );
  }, [orders, search]);

  // Open Pop-up Modal on order click
  const openOrderModal = useCallback(async (order: WarehouseOrder) => {
    setModalOrder(order);
    const initialRoute = order.delivery?.routeId || suggestRouteForRetailer(order.retailer, routePresets);
    setDispatchRouteId(initialRoute);
    setDispatchSlot("");
    setPodType("photo");
    setDeliveredLines(order.items.map((i) => ({ orderItemId: i.id, cases: i.qtyOrdered })));
    setError(null);
    setNotice(null);

    // Fetch fresh order details from backend to ensure latest line items
    setModalDetailLoading(true);
    try {
      const result = await api.warehouseOrder(order.id);
      if (result?.order) {
        const fresh = result.order as WarehouseOrder;
        setModalOrder(fresh);
        setDeliveredLines(fresh.items.map((i) => ({ orderItemId: i.id, cases: i.qtyOrdered })));
      }
    } catch {
      // Keep existing data if detail fetch fails
    } finally {
      setModalDetailLoading(false);
    }
  }, [routePresets]);

  const closeModal = useCallback(() => {
    if (busy) return;
    setModalOrder(null);
  }, [busy]);

  // Action: Pack inside modal
  const handlePack = async () => {
    if (!modalOrder || modalOrder.status !== "confirmed") return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.packWarehouseOrder(modalOrder.id);
      const packedOrder = (result.order as WarehouseOrder) || { ...modalOrder, status: "packed" };
      setModalOrder(packedOrder);
      setNotice("Packing complete");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not pack order");
    } finally {
      setBusy(false);
    }
  };

  // Action: Confirm Dispatch inside modal
  const handleConfirmDispatch = async () => {
    if (!modalOrder || modalOrder.status !== "packed") return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.dispatchWarehouseOrder(
        modalOrder.id,
        dispatchRouteId,
        dispatchSlot ? new Date(dispatchSlot).toISOString() : undefined
      );
      const dispatchedOrder = (result.order as WarehouseOrder) || {
        ...modalOrder,
        status: "out_for_delivery",
        delivery: { routeId: dispatchRouteId, deliverySlot: dispatchSlot },
      };
      setModalOrder(dispatchedOrder);
      setNotice(`🚚 ${formatOrderRef(modalOrder)} sent out on route ${dispatchRouteId}!`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not dispatch order");
    } finally {
      setBusy(false);
    }
  };

  // Action: Confirm Delivery inside modal
  const handleConfirmDelivery = async () => {
    if (!modalOrder || modalOrder.status !== "out_for_delivery") return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const itemsPayload = deliveredLines.map((line) => ({
        orderItemId: line.orderItemId,
        qtyDelivered: line.cases,
      }));
      const result = await api.deliverWarehouseOrder(modalOrder.id, podType, itemsPayload);
      const deliveredOrder = (result.order as WarehouseOrder) || { ...modalOrder, status: "delivered" };
      setModalOrder(deliveredOrder);
      setNotice(`✅ Delivery confirmed for ${formatOrderRef(modalOrder)}! POD recorded.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not record delivery");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-shell warehouse-orders-page">
      <header className="page-header warehouse-orders-header">
        <div>
          <SectionLabel>Warehouse / Fulfillment Operations</SectionLabel>
          <h1 className="page-title">Warehouse orders</h1>
          <p className="page-sub">
            Pick, pack, route, and complete deliveries with simple one-click operations.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            type="button"
            className="button secondary compact"
            onClick={() => setShowAnalytics((v) => !v)}
            aria-expanded={showAnalytics}
          >
            <Icon name="arrow" size={14} /> {showAnalytics ? "Hide Analytics" : "Show Analytics & Infographics"}
          </button>
          <button
            type="button"
            className="button secondary compact"
            onClick={() => setShowTutorial((v) => !v)}
            aria-expanded={showTutorial}
          >
            <Icon name="check" size={14} /> {showTutorial ? "Hide Tutorial" : "How It Works (Tutorial)"}
          </button>
          <div className="warehouse-queue-count" aria-live="polite">
            <span>orders in queue</span>
            <strong>{loading ? "—" : metrics.pendingTotal}</strong>
          </div>
        </div>
      </header>

      {/* Analytics, Metrics & Infographics Dashboard */}
      {showAnalytics && (
        <section className="warehouse-analytics-section" aria-label="Warehouse Analytics and Infographics">
          {/* Row 1: KPI Stat Cards */}
          <div className="warehouse-kpi-grid">
            <div
              className={`warehouse-kpi-card kpi-total ${filter === "all" ? "active-filter" : ""}`}
              onClick={() => setFilter("all")}
              role="button"
              tabIndex={0}
            >
              <div className="warehouse-kpi-header">
                <span className="warehouse-kpi-label">Total Pipeline</span>
                <span className="warehouse-kpi-icon">📋</span>
              </div>
              <div className="warehouse-kpi-value">{metrics.total}</div>
              <div className="warehouse-kpi-sub">
                <strong>{metrics.totalCases}</strong> total cases
              </div>
            </div>

            <div
              className={`warehouse-kpi-card kpi-confirmed ${filter === "confirmed" ? "active-filter" : ""}`}
              onClick={() => setFilter("confirmed")}
              role="button"
              tabIndex={0}
            >
              <div className="warehouse-kpi-header">
                <span className="warehouse-kpi-label">1. To Pack</span>
                <span className="warehouse-kpi-icon">📦</span>
              </div>
              <div className="warehouse-kpi-value">{metrics.confirmedCount}</div>
              <div className="warehouse-kpi-sub">
                <strong>{metrics.confirmedCases}</strong> cases to pick
              </div>
            </div>

            <div
              className={`warehouse-kpi-card kpi-packed ${filter === "packed" ? "active-filter" : ""}`}
              onClick={() => setFilter("packed")}
              role="button"
              tabIndex={0}
            >
              <div className="warehouse-kpi-header">
                <span className="warehouse-kpi-label">2. To Dispatch</span>
                <span className="warehouse-kpi-icon">🚚</span>
              </div>
              <div className="warehouse-kpi-value">{metrics.packedCount}</div>
              <div className="warehouse-kpi-sub">
                <strong>{metrics.packedCases}</strong> cases staged
              </div>
            </div>

            <div
              className={`warehouse-kpi-card kpi-dispatch ${filter === "out_for_delivery" ? "active-filter" : ""}`}
              onClick={() => setFilter("out_for_delivery")}
              role="button"
              tabIndex={0}
            >
              <div className="warehouse-kpi-header">
                <span className="warehouse-kpi-label">3. On Routes</span>
                <span className="warehouse-kpi-icon">🛣️</span>
              </div>
              <div className="warehouse-kpi-value">{metrics.outForDeliveryCount}</div>
              <div className="warehouse-kpi-sub">
                <strong>{metrics.outForDeliveryCases}</strong> in transit
              </div>
            </div>

            <div
              className={`warehouse-kpi-card kpi-delivered ${filter === "delivered" ? "active-filter" : ""}`}
              onClick={() => setFilter("delivered")}
              role="button"
              tabIndex={0}
            >
              <div className="warehouse-kpi-header">
                <span className="warehouse-kpi-label">4. Delivered</span>
                <span className="warehouse-kpi-icon">✅</span>
              </div>
              <div className="warehouse-kpi-value">{metrics.deliveredCount}</div>
              <div className="warehouse-kpi-sub">
                POD confirmed
              </div>
            </div>
          </div>

          {/* Row 2: Visual Infographics - Orders Pending in Hours (Aging SLA) & Hourly Intake Flow */}
          <div className="warehouse-visual-grid">
            {/* Infographic 1: Orders Pending in Hours (Aging SLA) */}
            <div className="warehouse-visual-card">
              <div className="warehouse-visual-header">
                <div>
                  <div className="warehouse-visual-title">
                    <span>⏱️ Orders Pending in Hours</span>
                    <span style={{ fontSize: 11, background: "#f1f5f9", padding: "2px 8px", borderRadius: 12, color: "#475569", fontWeight: 600 }}>
                      {metrics.pendingTotal} in queue
                    </span>
                  </div>
                  <div className="warehouse-visual-sub">
                    Elapsed queue wait time since salesperson punched the order
                  </div>
                </div>
              </div>

              {/* 3 Tier Infographic Badges */}
              <div className="warehouse-aging-tiers">
                <div className="warehouse-aging-tier tier-green">
                  <span className="warehouse-aging-tier-title">🟢 Fresh &lt; 2 hrs</span>
                  <span className="warehouse-aging-tier-val">{metrics.pendingUnder2h}</span>
                  <span className="warehouse-aging-tier-sub">{metrics.pctUnder2h}% of queue</span>
                </div>
                <div className="warehouse-aging-tier tier-amber">
                  <span className="warehouse-aging-tier-title">🟡 Processing 2–6 hrs</span>
                  <span className="warehouse-aging-tier-val">{metrics.pending2to6h}</span>
                  <span className="warehouse-aging-tier-sub">{metrics.pct2to6h}% of queue</span>
                </div>
                <div className="warehouse-aging-tier tier-red">
                  <span className="warehouse-aging-tier-title">🔴 Priority &gt; 6 hrs</span>
                  <span className="warehouse-aging-tier-val">{metrics.pendingOver6h}</span>
                  <span className="warehouse-aging-tier-sub">{metrics.pctOver6h}% of queue</span>
                </div>
              </div>

              {/* Segmented SLA Progress Bar */}
              <div className="warehouse-sla-bar-container">
                <div className="warehouse-sla-bar">
                  <div className="warehouse-sla-segment seg-green" style={{ width: `${metrics.pctUnder2h}%` }} title="< 2 hrs" />
                  <div className="warehouse-sla-segment seg-amber" style={{ width: `${metrics.pct2to6h}%` }} title="2 - 6 hrs" />
                  <div className="warehouse-sla-segment seg-red" style={{ width: `${metrics.pctOver6h}%` }} title="> 6 hrs" />
                </div>
              </div>

              {/* Aging summary KPIs */}
              <div className="warehouse-aging-footer">
                <div className="warehouse-aging-stat">
                  <span>Avg Aging:</span>
                  <strong>{metrics.avgAgingHours} hrs</strong>
                </div>
                <div className="warehouse-aging-stat">
                  <span>Oldest Pending:</span>
                  <strong style={{ color: Number(metrics.oldestAgingHours) > 6 ? "#b91c1c" : "#1f2937" }}>
                    {metrics.oldestAgingHours} hrs
                  </strong>
                </div>
                <div className="warehouse-aging-stat">
                  <span>Target SLA:</span>
                  <strong style={{ color: "#166534" }}>&lt; 4.0 hrs</strong>
                </div>
              </div>
            </div>

            {/* Infographic 2: Hourly Order Intake & Fulfillment Trend Graph */}
            <div className="warehouse-visual-card">
              <div className="warehouse-visual-header">
                <div>
                  <div className="warehouse-visual-title">
                    <span>📊 Hourly Intake & Fulfillment Trend</span>
                  </div>
                  <div className="warehouse-visual-sub">
                    Live orders punched vs dispatches across today's shifts
                  </div>
                </div>
                <div className="warehouse-chart-legend">
                  <div className="warehouse-chart-legend-item">
                    <span className="warehouse-chart-dot in" />
                    <span>Inflow</span>
                  </div>
                  <div className="warehouse-chart-legend-item">
                    <span className="warehouse-chart-dot out" />
                    <span>Dispatched</span>
                  </div>
                </div>
              </div>

              {/* Responsive SVG Chart */}
              <div className="warehouse-chart-wrapper">
                {metrics.total === 0 ? (
                  <div style={{ textAlign: "center", color: "#64748b", padding: 20 }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>📈</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Awaiting incoming orders</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>Real-time hourly intake & dispatch velocity will map here</div>
                  </div>
                ) : (
                  <svg viewBox="0 0 460 140" style={{ width: "100%", height: "100%", overflow: "visible" }}>
                    <defs>
                      <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#4f46e5" />
                      </linearGradient>
                      <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" />
                        <stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Grid lines */}
                    <line x1="30" y1="20" x2="440" y2="20" stroke="#f1f5f9" strokeDasharray="3 3" />
                    <line x1="30" y1="60" x2="440" y2="60" stroke="#f1f5f9" strokeDasharray="3 3" />
                    <line x1="30" y1="100" x2="440" y2="100" stroke="#f1f5f9" strokeDasharray="3 3" />
                    <line x1="30" y1="116" x2="440" y2="116" stroke="#cbd5e1" />

                    {metrics.hourlyBuckets.map((b, idx) => {
                      const x = 50 + idx * 56;
                      const maxVal = Math.max(metrics.maxBucketCount, 4);
                      const heightIn = (b.count / maxVal) * 86;
                      const heightOut = (b.dispatched / maxVal) * 86;
                      const yIn = 116 - heightIn;
                      const yOut = 116 - heightOut;

                      return (
                        <g key={b.label}>
                          {/* Inflow bar */}
                          <rect
                            x={x - 10}
                            y={yIn}
                            width="9"
                            height={Math.max(b.count > 0 ? 3 : 0, heightIn)}
                            rx="2"
                            fill="url(#inflowGrad)"
                          />
                          {/* Outflow bar */}
                          <rect
                            x={x + 1}
                            y={yOut}
                            width="9"
                            height={Math.max(b.dispatched > 0 ? 3 : 0, heightOut)}
                            rx="2"
                            fill="url(#outflowGrad)"
                          />

                          {/* Data label */}
                          {b.count > 0 && (
                            <text x={x - 6} y={yIn - 4} textAnchor="middle" fontSize="9" fontWeight="700" fill="#4338ca">
                              {b.count}
                            </text>
                          )}
                          {b.dispatched > 0 && (
                            <text x={x + 5} y={yOut - 4} textAnchor="middle" fontSize="9" fontWeight="700" fill="#047857">
                              {b.dispatched}
                            </text>
                          )}

                          {/* X-axis tick */}
                          <text x={x} y="132" textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="600">
                            {b.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Self-Tutorial Walkthrough Guide */}
      {showTutorial && (
        <section
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
            padding: "16px 20px",
            marginBottom: 20,
          }}
          aria-label="Warehouse Workflow Guide"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <strong style={{ fontSize: 15, color: "#166534" }}>
              📖 Self-Tutorial: How to use this warehouse panel without manuals
            </strong>
            <button
              type="button"
              className="text-button"
              style={{ fontSize: 13, color: "#166534" }}
              onClick={() => setShowTutorial(false)}
            >
              ✕ Got it, dismiss
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              fontSize: 13,
              color: "#1f2937",
            }}
          >
            <div style={{ background: "#ffffff", padding: "12px 14px", borderRadius: 6, border: "1px solid #dcfce7" }}>
              <div style={{ fontWeight: 600, color: "#15803d", marginBottom: 4 }}>📦 Step 1: Pack Orders</div>
              <p style={{ margin: 0, color: "#4b5563" }}>
                Click <strong>"Confirmed"</strong> tab. Click any order row to open its checklist pop-up, verify picked cases, and click{" "}
                <strong>"✓ Mark Order Packed"</strong>.
              </p>
            </div>
            <div style={{ background: "#ffffff", padding: "12px 14px", borderRadius: 6, border: "1px solid #dcfce7" }}>
              <div style={{ fontWeight: 600, color: "#1d4ed8", marginBottom: 4 }}>🚚 Step 2: Assign & Dispatch</div>
              <p style={{ margin: 0, color: "#4b5563" }}>
                Click <strong>"Packed"</strong> tab. Click an order to open the pop-up, select a delivery route preset, and send out the truck!
              </p>
            </div>
            <div style={{ background: "#ffffff", padding: "12px 14px", borderRadius: 6, border: "1px solid #dcfce7" }}>
              <div style={{ fontWeight: 600, color: "#b45309", marginBottom: 4 }}>📍 Step 3: Record Delivery</div>
              <p style={{ margin: 0, color: "#4b5563" }}>
                When goods arrive at the retailer, click <strong>"Out for delivery"</strong> tab, open the pop-up, and record Proof of Delivery (Photo/OTP/Signature). Done!
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Filter Tabs and Search Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div className="warehouse-filters" role="group" aria-label="Order status filter tabs">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`warehouse-filter ${filter === item.value ? "selected" : ""}`}
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
              style={{ fontWeight: filter === item.value ? 600 : 400 }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 300 }}>
          <input
            type="search"
            aria-label="Search orders"
            placeholder="Search order ref, store name, or city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
          />
          <button
            type="button"
            className="button secondary compact warehouse-refresh"
            aria-label="Refresh orders"
            onClick={() => void load()}
            disabled={loading}
          >
            <Icon name="arrow" size={14} /> Refresh
          </button>
        </div>
      </div>

      {error && !modalOrder && (
        <div className="banner error" role="alert" style={{ marginBottom: 16 }}>
          {humanErrorMessage(error)}
        </div>
      )}
      {notice && !modalOrder && (
        <div className="banner success" role="status" style={{ marginBottom: 16 }}>
          {notice}
        </div>
      )}

      {/* Full Width Order Queue Table */}
      <div className="warehouse-queue-wrapper">
        <div className="warehouse-section-heading">
          <div>
            <SectionLabel>Queue</SectionLabel>
            <h2>
              {FILTERS.find((f) => f.value === filter)?.label ?? "Orders"} <em>{filteredOrders.length}</em>
            </h2>
          </div>
          <span style={{ fontSize: 12, color: "#6b7280" }}>
            💡 Click any order to open fulfillment checklist pop-up window
          </span>
        </div>

        {loading ? (
          <div className="empty-state quiet">Loading warehouse orders…</div>
        ) : filteredOrders.length === 0 ? (
          <div className="empty-state quiet">
            {search ? "No matching orders found." : "No orders waiting in this stage. Great job!"}
          </div>
        ) : (
          <div className="warehouse-table-container">
            <div className="warehouse-table-header" role="row">
              <span className="th-ref">Order Ref</span>
              <span className="th-retailer">Retailer & Delivery Location</span>
              <span className="th-items">Items & Pack</span>
              <span className="th-time">Placed Time</span>
              <span className="th-status">Stage Status</span>
              <span className="th-action">Action</span>
            </div>

            <div className="warehouse-table-body" role="rowgroup">
              {filteredOrders.map((order) => {
                const totalCases = order.items.reduce((sum, item) => sum + (item.qtyOrdered || 0), 0);
                return (
                  <button
                    type="button"
                    key={order.id}
                    className="warehouse-order-row"
                    aria-haspopup="dialog"
                    onClick={() => void openOrderModal(order)}
                  >
                    <span className="td-ref">
                      <strong>{formatOrderRef(order)}</strong>
                    </span>
                    <span className="td-retailer">
                      <strong className="retailer-name">{order.retailer?.name ?? "Retailer unavailable"}</strong>
                      <small className="retailer-addr">
                        {order.retailer?.shopAddress ? `📍 ${order.retailer.shopAddress}` : ""}
                        {order.retailer?.deliveryCity ? ` · ${order.retailer.deliveryCity}` : ""}
                      </small>
                    </span>
                    <span className="td-items">
                      <strong className="items-count">
                        {order.items.length} {order.items.length === 1 ? "product" : "products"}
                      </strong>
                      <small className="cases-count">{totalCases} cases</small>
                    </span>
                    <span className="td-time">
                      <time>{createdLabel(order.createdAt)}</time>
                    </span>
                    <span className="td-status">
                      <span className={statusBadgeClass(order.status)}>{statusHumanLabel(order.status)}</span>
                    </span>
                    <span className="td-action">
                      <span className="warehouse-view-cta">
                        Open pop-up <Icon name="arrow" size={13} />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* POP-UP MODAL WINDOW FOR ORDER FULFILLMENT */}
      {modalOrder && (
        <div className="warehouse-modal-backdrop" onClick={closeModal}>
          <div
            className="warehouse-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="warehouse-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <header className="warehouse-modal-header">
              <div className="warehouse-modal-title-group">
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h2 id="warehouse-modal-title" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                    {formatOrderRef(modalOrder)}
                  </h2>
                  <span className={statusBadgeClass(modalOrder.status)}>
                    {statusHumanLabel(modalOrder.status)}
                  </span>
                </div>
                <small style={{ color: "#6b7280", marginTop: 4, display: "block" }}>
                  Order Fulfillment & Checklist Modal
                </small>
              </div>
              <button
                type="button"
                className="button ghost compact warehouse-modal-close"
                onClick={closeModal}
                disabled={busy}
                aria-label="Close pop-up"
              >
                ✕
              </button>
            </header>

            {/* Modal Scrollable Content */}
            <div className="warehouse-modal-body">
              {error && (
                <div className="banner error" role="alert" style={{ marginBottom: 14 }}>
                  {humanErrorMessage(error)}
                </div>
              )}
              {notice && (
                <div className="banner success" role="status" style={{ marginBottom: 14 }}>
                  {notice}
                </div>
              )}

              {/* Retailer & Fulfillment Info Card */}
              <section className="warehouse-modal-retailer-card" aria-label="Customer details">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#111827" }}>
                      {modalOrder.retailer?.name ?? "Retailer unavailable"}
                    </h3>
                    <div style={{ fontSize: 13, color: "#4b5563", marginBottom: 2 }}>
                      📍 {modalOrder.retailer?.shopAddress ?? "Shop address not provided"}
                      {modalOrder.retailer?.deliveryCity ? ` · Delivery City: ${modalOrder.retailer.deliveryCity}` : ""}
                    </div>
                    {modalOrder.retailer?.phone ? (
                      <div style={{ fontSize: 13, color: "#4b5563" }}>
                        📞 Contact: <strong>{modalOrder.retailer.phone}</strong>
                      </div>
                    ) : null}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Placed At
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#374151", marginTop: 2 }}>
                      {createdLabel(modalOrder.createdAt)}
                    </div>
                  </div>
                </div>

                {modalOrder.delivery?.routeId ? (
                  <div
                    style={{
                      marginTop: 10,
                      padding: "8px 12px",
                      background: "#eff6ff",
                      borderRadius: 6,
                      fontSize: 13,
                      color: "#1d4ed8",
                      fontWeight: 600,
                    }}
                  >
                    🚚 Assigned Route: {modalOrder.delivery.routeId}
                  </div>
                ) : null}
              </section>

              {/* Items picking table */}
              <section className="warehouse-modal-items-section" aria-label="Items checklist">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <h4 style={{ margin: 0, fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5, color: "#4b5563" }}>
                    Items to Pick & Pack ({modalOrder.items.length})
                  </h4>
                  {modalDetailLoading && (
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>Refreshing lines…</span>
                  )}
                </div>

                <div className="warehouse-modal-items-table">
                  <div className="warehouse-modal-items-header" aria-hidden="true">
                    <span>Product</span>
                    <span>Presentation / Pack</span>
                    <span style={{ textAlign: "right" }}>Quantity</span>
                  </div>
                  <div className="warehouse-modal-items-body">
                    {modalOrder.items.map((item) => (
                      <div className="warehouse-modal-item-row" key={item.id}>
                        <strong className="item-product-name">
                          {item.variant?.product?.name ?? "Product unavailable"}
                        </strong>
                        <span className="item-presentation">
                          {item.variant
                            ? `${item.variant.unitsPerCase} × ${item.variant.unitSize}`
                            : "Standard Pack"}
                        </span>
                        <b className="item-qty" style={{ textAlign: "right", fontSize: 14, color: "#111827" }}>
                          {item.qtyOrdered} cases
                        </b>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Stage-Specific Fulfillment Action Area */}
              <section className="warehouse-modal-action-deck" aria-label="Fulfillment actions">
                {/* 1. Confirmed -> Pack action */}
                {modalOrder.status === "confirmed" && (
                  <div className="warehouse-stage-panel stage-pack">
                    <div style={{ marginBottom: 12 }}>
                      <strong style={{ fontSize: 14, color: "#15803d", display: "block", marginBottom: 4 }}>
                        📦 Step 1: Pack Verification
                      </strong>
                      <p style={{ margin: 0, fontSize: 13, color: "#4b5563" }}>
                        Pick the cases listed above from the warehouse shelf, verify presentation, then mark order packed.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="button primary"
                      style={{
                        background: "#15803d",
                        borderColor: "#15803d",
                        padding: "10px 20px",
                        fontSize: 14,
                        fontWeight: 600,
                        width: "100%",
                        justifyContent: "center",
                      }}
                      onClick={() => void handlePack()}
                      disabled={busy || modalDetailLoading}
                    >
                      <Icon name="check" size={16} /> {busy ? "Packing…" : "Mark packed"}
                    </button>
                  </div>
                )}

                {/* 2. Packed -> Assign Route & Dispatch */}
                {modalOrder.status === "packed" && (
                  <div className="warehouse-stage-panel stage-dispatch">
                    <div style={{ marginBottom: 14 }}>
                      <strong style={{ fontSize: 14, color: "#1d4ed8", display: "block", marginBottom: 4 }}>
                        🚚 Step 2: Assign Route & Dispatch
                      </strong>
                      <p style={{ margin: 0, fontSize: 13, color: "#4b5563" }}>
                        Choose a delivery route preset or enter route name to send out the logistics vehicle.
                      </p>
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                        Route Presets <span style={{ fontSize: 11, fontWeight: 400, color: "#6b7280" }}>({warehouseCity})</span>
                      </label>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                        {routePresets.map((p) => (
                          <button
                            key={p}
                            type="button"
                            className="button secondary compact"
                            style={{
                              borderColor: dispatchRouteId === p ? "#1d4ed8" : "#d1d5db",
                              background: dispatchRouteId === p ? "#eff6ff" : "#fff",
                              color: dispatchRouteId === p ? "#1d4ed8" : "#374151",
                              fontWeight: dispatchRouteId === p ? 600 : 400,
                            }}
                            onClick={() => setDispatchRouteId(p)}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={dispatchRouteId}
                        onChange={(e) => setDispatchRouteId(e.target.value)}
                        placeholder="Or enter route name..."
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
                      />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                        Delivery Slot (Optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={dispatchSlot}
                        onChange={(e) => setDispatchSlot(e.target.value)}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
                      />
                    </div>

                    <button
                      type="button"
                      className="button primary"
                      style={{
                        background: "#1d4ed8",
                        borderColor: "#1d4ed8",
                        padding: "10px 20px",
                        fontSize: 14,
                        fontWeight: 600,
                        width: "100%",
                        justifyContent: "center",
                      }}
                      onClick={() => void handleConfirmDispatch()}
                      disabled={busy || !dispatchRouteId.trim() || modalDetailLoading}
                    >
                      <Icon name="arrow" size={16} /> {busy ? "Dispatching…" : "🚚 Confirm Route & Send Out"}
                    </button>
                  </div>
                )}

                {/* 3. Out for delivery -> Record Proof of Delivery */}
                {modalOrder.status === "out_for_delivery" && (
                  <div className="warehouse-stage-panel stage-delivery">
                    <div style={{ marginBottom: 14 }}>
                      <strong style={{ fontSize: 14, color: "#b45309", display: "block", marginBottom: 4 }}>
                        📍 Step 3: Record Proof of Delivery (POD)
                      </strong>
                      <p style={{ margin: 0, fontSize: 13, color: "#4b5563" }}>
                        Confirm delivery at recipient location and verify delivered quantities.
                      </p>
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                        POD Verification Method
                      </label>
                      <div style={{ display: "flex", gap: 8 }}>
                        {(["photo", "otp", "signature"] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            className="button secondary compact"
                            style={{
                              flex: 1,
                              borderColor: podType === mode ? "#d97706" : "#d1d5db",
                              background: podType === mode ? "#fffbeb" : "#fff",
                              color: podType === mode ? "#b45309" : "#374151",
                              fontWeight: podType === mode ? 600 : 400,
                            }}
                            onClick={() => setPodType(mode)}
                          >
                            {mode === "photo" ? "📷 Photo" : mode === "otp" ? "🔑 OTP" : "✍️ Signature"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                        Delivered Cases Checklist
                      </label>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {modalOrder.items.map((item) => {
                          const lineVal = deliveredLines.find((l) => l.orderItemId === item.id)?.cases ?? item.qtyOrdered;
                          return (
                            <div
                              key={item.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                background: "#f9fafb",
                                padding: "8px 12px",
                                borderRadius: 6,
                                border: "1px solid #e5e7eb",
                              }}
                            >
                              <div>
                                <strong style={{ fontSize: 13 }}>{item.variant?.product?.name ?? "Item"}</strong>
                                <div style={{ fontSize: 11, color: "#6b7280" }}>Ordered: {item.qtyOrdered} cases</div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <label style={{ fontSize: 12, color: "#374151" }}>Delivered:</label>
                                <input
                                  type="number"
                                  min={0}
                                  max={item.qtyOrdered}
                                  value={lineVal}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10) || 0;
                                    setDeliveredLines((prev) =>
                                      prev.map((l) => (l.orderItemId === item.id ? { ...l, cases: val } : l))
                                    );
                                  }}
                                  style={{ width: 60, padding: "4px 8px", borderRadius: 4, border: "1px solid #d1d5db", textAlign: "right" }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="button primary"
                      style={{
                        background: "#d97706",
                        borderColor: "#d97706",
                        padding: "10px 20px",
                        fontSize: 14,
                        fontWeight: 600,
                        width: "100%",
                        justifyContent: "center",
                      }}
                      onClick={() => void handleConfirmDelivery()}
                      disabled={busy || modalDetailLoading}
                    >
                      <Icon name="check" size={16} /> {busy ? "Recording…" : "📦 Complete Delivery & Invoice"}
                    </button>
                  </div>
                )}

                {/* 4. Delivered -> Completed state */}
                {modalOrder.status === "delivered" && (
                  <div
                    style={{
                      background: "#ecfdf5",
                      border: "1px solid #a7f3d0",
                      borderRadius: 8,
                      padding: "16px 20px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#065f46", marginBottom: 4 }}>
                      ✅ Fulfillment Completed & Invoiced
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: "#047857" }}>
                      This order has been verified, delivered to the retailer, and handed off for automated invoice generation.
                    </p>
                  </div>
                )}
              </section>
            </div>

            {/* Modal Footer */}
            <footer className="warehouse-modal-footer">
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                Status: <strong>{statusHumanLabel(modalOrder.status)}</strong>
              </span>
              <button
                type="button"
                className="button secondary compact"
                onClick={closeModal}
                disabled={busy}
              >
                Close
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
