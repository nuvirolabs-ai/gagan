import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, inr } from "../api";
import { Icon, SectionLabel } from "../components/OperationalPrimitives";
import { formatOrderRef } from "../orderRef";
import { detectDuplicateOrders } from "./Orders";

type QueueFilter = "all" | "confirmed" | "packed" | "out_for_delivery" | "delivered";

type WarehouseOrder = {
  id: string;
  orderNo: number;
  status: "confirmed" | "packed" | "out_for_delivery" | "delivered";
  cancellationRequestedAt?: string | null;
  cancellationReason?: string | null;
  cancellationRequestedByRepId?: string | null;
  cancellationStatus?: string | null;
  cancellationDecisionNote?: string | null;
  cancellationDecidedAt?: string | null;
  orderTotal?: number;
  createdAt: string;
  expectedDeliveryAt?: string | null;
  remarks?: string | null;
  transportName?: string | null;
  commercialSnapshot?: any;
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
    unitPrice?: number;
    caseWeightKg?: number;
    rateBasis?: "quintal" | "case";
    ratePerQuintal?: number | null;
    ratePerKg?: number | null;
    outerPack?: "Bag" | "Box";
    rateLabel?: string;
    commercialSnapshot?: any;
    variant: {
      unitSize: string;
      unit: string;
      unitsPerCase: number;
      unitWeightKg?: number;
      listRate?: number;
      listRateBasis?: string;
      catalogIdentityMasterPack?: string;
      product: { name: string; category?: string } | null;
    } | null;
  }>;
  invoice?: {
    id: string;
    invoiceNumber: number;
    invoiceDate: string;
    dueDate: string;
    subtotal: number;
    taxTotal: number;
    total: number;
    outstandingAmount: number;
    lines: Array<{
      id: string;
      description: string;
      cases?: number | null;
      unitPrice: number;
      lineTotal: number;
    }>;
  } | null;
  placedByRepId?: string | null;
  creatorName?: string | null;
  salespersonName?: string | null;
  salespersonPhone?: string | null;
  punchedByName?: string | null;
  punchedByRole?: string | null;
  punchedByLabel?: string | null;
  warehouseCode?: string;
  warehouseName?: string;
  warehouseCity?: string;
};

type FleetVehicle = {
  id: string;
  regNumber: string;
  model: string;
  type: "truck" | "tempo" | "three_wheeler" | "van";
  capacityKg: number;
  capacityBags: number;
  driverName: string;
  driverPhone: string;
  isActive: boolean;
  runsCount?: number;
  createdAt?: string;
};

type DeliveryRunSummary = {
  id: string;
  runNumber: string;
  warehouseCode: string;
  vehicleId?: string;
  vehicleReg: string;
  vehicleModel: string;
  driverName: string;
  driverPhone: string;
  status: "planned" | "loading" | "out_for_delivery" | "completed" | "cancelled";
  orderCount: number;
  totalWeightKg: number;
  totalOrderAmount: number;
  notes?: string;
  departureTime?: string;
  completedTime?: string;
  createdAt: string;
  orders: Array<{
    id: string;
    orderNo: number;
    orderTotal: number;
    retailerName: string;
    deliveryCity?: string;
    shopAddress?: string;
    phone?: string;
  }>;
};

const FILTERS: Array<{ value: QueueFilter; label: string; step: string; icon: string }> = [
  { value: "all", label: "1. TOTAL ORDERS", step: "1. Total Orders", icon: "table" },
  { value: "confirmed", label: "2. PENDING ORDERS", step: "2. Pending Orders", icon: "box" },
  { value: "packed", label: "3. SALES ORDERS CREATED", step: "3. Sales Orders Created", icon: "arrow" },
  { value: "out_for_delivery", label: "4. ORDERS DISPATCHED", step: "4. Orders Dispatched", icon: "clock" },
  { value: "delivered", label: "5. INVOICES", step: "5. Invoices", icon: "check" },
];

const STATUS_PILLS = [
  { id: "all", key: "all", label: "All Orders", icon: "📋" },
  { id: "new_buyer", key: "new_buyer", label: "#New Buyer", icon: "#️⃣" },
  { id: "rate_approval", key: "rate_approval", label: "Order on Rate approval", icon: "🌹" },
  { id: "outstanding", key: "outstanding", label: "Order on Outstanding", icon: "❤️" },
  { id: "hold", key: "hold", label: "Hold due to Outstanding", icon: "✖️" },
  { id: "advance", key: "advance", label: "Order on Advance payment", icon: "🥬" },
  { id: "sale_order_created", key: "sale_order_created", label: "Sale order created", icon: "👍" },
  { id: "cancelled", key: "cancelled", label: "Order cancelled by Salesman", icon: "❎" },
  { id: "double_order", key: "double_order", label: "Double order placed", icon: "🔁" },
] as const;

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
  const [statusPill, setStatusPill] = useState<string>("all");
  const [orders, setOrders] = useState<WarehouseOrder[]>([]);
  const [search, setSearch] = useState("");
  const [salespersonFilter, setSalespersonFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "value_desc" | "value_asc">("date_desc");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month" | "custom">("all");
  const [customDate, setCustomDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [allOrders, setAllOrders] = useState<WarehouseOrder[]>([]);

  // Accepted duplicates state (persisted so accepting removes warning badge)
  const [acceptedDuplicates, setAcceptedDuplicates] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("gagan_accepted_duplicates");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const handleAcceptDuplicate = useCallback((orderId: string) => {
    setAcceptedDuplicates((prev) => {
      const next = new Set(prev);
      next.add(orderId);
      try {
        localStorage.setItem("gagan_accepted_duplicates", JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
    setNotice("Duplicate order accepted. Warning cleared.");
  }, []);

  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [availableWarehouses, setAvailableWarehouses] = useState<Array<{ code: string; name: string; city: string }>>([
    { code: "WH-001", name: "Indore Central Fulfillment Hub", city: "Indore" },
    { code: "WH-002", name: "Bhopal Regional Hub", city: "Bhopal" },
  ]);

  const hasActiveFilters = useMemo(() => {
    return (
      statusPill !== "all" ||
      filter !== "all" ||
      dateFilter !== "all" ||
      warehouseFilter !== "all" ||
      salespersonFilter !== "all" ||
      sortBy !== "date_desc" ||
      Boolean(search.trim())
    );
  }, [statusPill, filter, dateFilter, warehouseFilter, salespersonFilter, sortBy, search]);

  const handleClearAllFilters = useCallback(() => {
    setStatusPill("all");
    setFilter("all");
    setDateFilter("all");
    setCustomDate("");
    setWarehouseFilter("all");
    setSalespersonFilter("all");
    setSortBy("date_desc");
    setSearch("");
  }, []);

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
        if (res?.warehouses && Array.isArray(res.warehouses) && res.warehouses.length > 0) {
          setAvailableWarehouses(res.warehouses);
        }
      })
      .catch(() => {});
  }, []);

  // POD Delivery fields inside modal
  const [podType, setPodType] = useState<"photo" | "otp" | "signature">("photo");
  const [deliveredLines, setDeliveredLines] = useState<Array<{ orderItemId: string; cases: number }>>([]);
  const [transportationAmount, setTransportationAmount] = useState<number>(0);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadedInvoiceName, setUploadedInvoiceName] = useState<string | null>(null);

  const load = useCallback(async (targetWarehouse = warehouseFilter) => {
    setLoading(true);
    try {
      const shouldFetchAll = allOrders.length === 0;
      const [filterResult, allResult] = await Promise.all([
        api.warehouseOrders(filter === "all" ? undefined : filter, targetWarehouse),
        shouldFetchAll ? api.warehouseOrders("all", targetWarehouse).catch(() => null) : Promise.resolve(null),
      ]);
      const nextFiltered = Array.isArray(filterResult?.orders) ? (filterResult.orders as WarehouseOrder[]) : [];
      const nextAll = Array.isArray(allResult?.orders) ? (allResult.orders as WarehouseOrder[]) : [];
      const completeList = nextAll.length > 0 ? nextAll : (allOrders.length > 0 ? allOrders : nextFiltered);
      setAllOrders(completeList);

      const warehousesSource = filterResult?.warehouses || allResult?.warehouses;
      if (Array.isArray(warehousesSource) && warehousesSource.length > 0) {
        setAvailableWarehouses(warehousesSource);
      }

      if (filter === "all") {
        setOrders(completeList.filter((o) => o.status !== "delivered"));
      } else {
        setOrders(nextFiltered);
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load warehouse orders");
    } finally {
      setLoading(false);
    }
  }, [filter, warehouseFilter, allOrders.length]);

  useEffect(() => {
    void load(warehouseFilter);
  }, [load, warehouseFilter]);

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

  const salespersons = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o: any) => {
      const name = o.punchedByName || o.salespersonName || o.creatorName;
      if (name && name !== "Direct" && name !== "Customer") set.add(name);
    });
    return Array.from(set).sort();
  }, [orders]);

  const duplicateMap = useMemo(() => detectDuplicateOrders(orders), [orders]);

  const filteredOrders = useMemo(() => {
    let result = orders;

    // Filter via order status pills (Requirement 1)
    if (statusPill === "new_buyer") {
      result = result.filter((o: any) => o.retailer?.isNew || o.internalStatus?.code === "ACCOUNT_OPENED" || o.placedBy === "retailer");
    } else if (statusPill === "rate_approval") {
      result = result.filter((o: any) => o.internalStatus?.code === "RATE_APPROVAL_SENT" || o.internalStatus?.code === "RATE_APPROVAL_PENDING");
    } else if (statusPill === "outstanding") {
      result = result.filter((o: any) => o.internalStatus?.code === "SALES_ORDER_APPROVAL_SENT" || o.internalStatus?.code === "ORDER_APPROVAL_PENDING");
    } else if (statusPill === "hold") {
      result = result.filter((o: any) => o.isOnHold === true || o.internalStatus?.code === "SALES_ORDER_ON_HOLD");
    } else if (statusPill === "advance") {
      result = result.filter((o: any) => o.internalStatus?.code === "ADVANCE_PAYMENT_RECEIVED");
    } else if (statusPill === "sale_order_created") {
      result = result.filter((o: any) => o.status === "confirmed" || o.internalStatus?.code === "SALES_ORDER_CREATED" || o.status === "placed");
    } else if (statusPill === "cancelled") {
      result = result.filter((o: any) => o.cancellationRequestedAt != null || o.status === "rejected" || o.cancellationStatus != null);
    } else if (statusPill === "double_order") {
      result = result.filter((o) => duplicateMap.has(o.id) && !acceptedDuplicates.has(o.id));
    }

    // Filter via salesperson
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

    // Remove delivered orders from "all" active view
    if (filter === "all") {
      result = result.filter((o) => o.status !== "delivered");
    }

    // Date range filter (Requirement 4)
    if (dateFilter === "today") {
      const todayStr = new Date().toDateString();
      result = result.filter((o) => new Date(o.createdAt).toDateString() === todayStr);
    } else if (dateFilter === "week") {
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      result = result.filter((o) => new Date(o.createdAt).getTime() >= oneWeekAgo);
    } else if (dateFilter === "month") {
      const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      result = result.filter((o) => new Date(o.createdAt).getTime() >= oneMonthAgo);
    } else if (dateFilter === "custom" && customDate) {
      result = result.filter((o) => {
        const d = new Date(o.createdAt);
        const localIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return localIso === customDate;
      });
    }

    // Flexible tokenized search (Requirement 5)
    if (search.trim()) {
      const tokens = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
      result = result.filter((o) => {
        const haystack = [
          formatOrderRef(o),
          o.retailer?.name,
          (o.retailer as any)?.ownerName,
          o.retailer?.phone,
          o.retailer?.shopAddress,
          o.retailer?.deliveryCity,
          (o.retailer as any)?.city,
          o.salespersonName,
          o.punchedByName,
          o.creatorName,
          o.transportName,
          o.remarks,
          o.invoice?.invoiceNumber ? String(o.invoice.invoiceNumber) : "",
          ...(o.items ?? []).map((it: any) => it.variant?.product?.name || ""),
        ].filter(Boolean).join(" ").toLowerCase();

        return tokens.every((token) => haystack.includes(token));
      });
    }

    // Sorting by value or date
    return [...result].sort((a, b) => {
      const valA = Number(a.orderTotal ?? a.invoice?.total ?? 0);
      const valB = Number(b.orderTotal ?? b.invoice?.total ?? 0);
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();

      if (sortBy === "value_desc") return valB - valA;
      if (sortBy === "value_asc") return valA - valB;
      if (sortBy === "date_asc") return dateA - dateB;
      return dateB - dateA;
    });
  }, [orders, filter, statusPill, duplicateMap, acceptedDuplicates, salespersonFilter, dateFilter, customDate, search, sortBy]);

  // Open Pop-up Modal on order click
  const openOrderModal = useCallback(async (order: WarehouseOrder) => {
    setModalOrder(order);
    const initialRoute = order.delivery?.routeId || suggestRouteForRetailer(order.retailer, routePresets);
    setDispatchRouteId(initialRoute);
    setDispatchSlot("");
    setPodType("photo");
    setTransportationAmount(0);
    setDownloadingInvoice(false);
    setUploadedInvoiceName(null);
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

  const deliveredTotalCases = useMemo(() => {
    if (!modalOrder) return 0;
    return modalOrder.items.reduce((sum, item) => {
      const lineVal = deliveredLines.find((l) => l.orderItemId === item.id)?.cases ?? item.qtyOrdered;
      return sum + lineVal;
    }, 0);
  }, [modalOrder, deliveredLines]);

  const goodsSubtotal = useMemo(() => {
    if (!modalOrder) return 0;
    return modalOrder.items.reduce((sum, item) => {
      const lineVal = deliveredLines.find((l) => l.orderItemId === item.id)?.cases ?? item.qtyOrdered;
      return sum + lineVal * (item.unitPrice || 0);
    }, 0);
  }, [modalOrder, deliveredLines]);

  const calculatedInvoiceTotal = useMemo(() => {
    return Math.max(0, goodsSubtotal + (Number(transportationAmount) || 0));
  }, [goodsSubtotal, transportationAmount]);

  void warehouseCity;
  void deliveredTotalCases;
  void calculatedInvoiceTotal;

  const handleDownloadInvoice = async (orderId: string, invoiceNumber?: number) => {
    setDownloadingInvoice(true);
    try {
      await api.downloadWarehouseOrderInvoicePdf(orderId, invoiceNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download invoice PDF");
    } finally {
      setDownloadingInvoice(false);
    }
  };

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
      const routeToUse = dispatchRouteId.trim() || modalOrder.transportName || routePresets[0] || "Standard Delivery Route";
      const result = await api.dispatchWarehouseOrder(
        modalOrder.id,
        routeToUse,
        dispatchSlot ? new Date(dispatchSlot).toISOString() : undefined
      );
      const dispatchedOrder = (result.order as WarehouseOrder) || {
        ...modalOrder,
        status: "out_for_delivery",
        delivery: { routeId: routeToUse, deliverySlot: dispatchSlot },
      };
      setModalOrder(dispatchedOrder);
      setNotice(`🚚 ${formatOrderRef(modalOrder)} sent out for delivery!`);
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
      const transportAmt = Number(transportationAmount) || 0;
      const result = await api.deliverWarehouseOrder(modalOrder.id, podType, itemsPayload, transportAmt);
      const deliveredOrder = (result.order as WarehouseOrder) || { ...modalOrder, status: "delivered" };
      setModalOrder(deliveredOrder);
      setNotice(`✅ Delivery confirmed & invoice generated for ${formatOrderRef(modalOrder)}!`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not record delivery");
    } finally {
      setBusy(false);
    }
  };

  // Gap 13: Delivery Fleet & Vehicle Run Dispatcher state
  const [activeTab, setActiveTab] = useState<"orders" | "fleet">("orders");
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [runs, setRuns] = useState<DeliveryRunSummary[]>([]);
  const [loadingFleet, setLoadingFleet] = useState(false);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [showCreateRunModal, setShowCreateRunModal] = useState(false);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const [newVehicle, setNewVehicle] = useState({
    regNumber: "",
    model: "",
    type: "tempo" as "truck" | "tempo" | "three_wheeler" | "van",
    capacityKg: 1000,
    capacityBags: 40,
    driverName: "",
    driverPhone: "",
  });

  const [newRun, setNewRun] = useState<{
    vehicleId: string;
    driverName: string;
    driverPhone: string;
    notes: string;
    orderIds: string[];
  }>({
    vehicleId: "",
    driverName: "",
    driverPhone: "",
    notes: "",
    orderIds: [],
  });

  const loadFleet = useCallback(async () => {
    setLoadingFleet(true);
    try {
      const [vRes, rRes] = await Promise.all([
        api.fleetVehicles(),
        api.deliveryRuns(),
      ]);
      if (vRes?.vehicles) setVehicles(vRes.vehicles);
      if (rRes?.runs) setRuns(rRes.runs);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load fleet data");
    } finally {
      setLoadingFleet(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "fleet") {
      void loadFleet();
    }
  }, [activeTab, loadFleet]);

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.createFleetVehicle({
        ...newVehicle,
        capacityKg: Number(newVehicle.capacityKg),
        capacityBags: Number(newVehicle.capacityBags),
      });
      setNotice(`✅ Vehicle ${newVehicle.regNumber} registered successfully!`);
      setShowAddVehicleModal(false);
      setNewVehicle({
        regNumber: "",
        model: "",
        type: "tempo",
        capacityKg: 1000,
        capacityBags: 40,
        driverName: "",
        driverPhone: "",
      });
      await loadFleet();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to register vehicle");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleVehicleActive = async (v: FleetVehicle) => {
    try {
      await api.updateFleetVehicle(v.id, { isActive: !v.isActive });
      await loadFleet();
      setNotice(`Vehicle ${v.regNumber} status updated.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to update vehicle");
    }
  };

  const handleDeleteVehicle = async (id: string, reg: string) => {
    if (!window.confirm(`Are you sure you want to delete vehicle ${reg}?`)) return;
    try {
      await api.deleteFleetVehicle(id);
      await loadFleet();
      setNotice(`Vehicle ${reg} removed from fleet.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to delete vehicle");
    }
  };

  const handleCreateRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newRun.orderIds.length === 0) {
      setError("Please select at least 1 order to dispatch in this run");
      return;
    }
    setBusy(true);
    try {
      await api.createDeliveryRun({
        warehouseCode: "WH-001",
        vehicleId: newRun.vehicleId || undefined,
        driverName: newRun.driverName,
        driverPhone: newRun.driverPhone,
        orderIds: newRun.orderIds,
        notes: newRun.notes,
      });
      setNotice(`✅ Delivery Run dispatched with ${newRun.orderIds.length} orders!`);
      setShowCreateRunModal(false);
      setNewRun({ vehicleId: "", driverName: "", driverPhone: "", notes: "", orderIds: [] });
      await loadFleet();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to dispatch run");
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateRunStatus = async (runId: string, status: string, label: string) => {
    setBusy(true);
    try {
      await api.updateRunStatus(runId, status);
      setNotice(`✅ Run updated to: ${label}`);
      await loadFleet();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to update run status");
    } finally {
      setBusy(false);
    }
  };

  // Compute fleet metrics
  const activeRunsCount = runs.filter((r) => r.status === "loading" || r.status === "out_for_delivery").length;
  const completedRunsCount = runs.filter((r) => r.status === "completed").length;
  const totalFleetTonnage = vehicles.reduce((sum, v) => sum + (v.capacityKg || 0), 0);
  const activeRoadWeight = runs
    .filter((r) => r.status === "out_for_delivery")
    .reduce((sum, r) => sum + (r.totalWeightKg || 0), 0);

  return (
    <div className="page-shell warehouse-orders-page">
      <header className="page-header warehouse-orders-header">
        <div>
          <SectionLabel>Warehouse / Logistics Operations</SectionLabel>
          <h1 className="page-title">Warehouse orders</h1>
          <p className="page-sub">
            Pick, pack, route orders, manage fleet vehicles, and dispatch delivery runs.
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

      {/* Top Tab Switcher - Delivery Fleet temporarily hidden per Requirement 3 */}
      <div style={{ display: "none" }} aria-hidden="true">
        <button
          type="button"
          onClick={() => setActiveTab("orders")}
        >
          Orders
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("fleet");
            void loadFleet();
          }}
        >
          Fleet
        </button>
      </div>

      {activeTab === "orders" && (
        <>
          {/* Analytics, Metrics & Infographics Dashboard */}
          {showAnalytics && (
            <section className="warehouse-analytics-section" aria-label="Warehouse Analytics and Infographics">
              {/* Row 1: KPI Stat Cards */}
              <div className="warehouse-kpi-grid">
                {/* KPI 1: 1. TOTAL ORDERS */}
            <div
              className={`warehouse-kpi-card kpi-total ${filter === "all" ? "active-filter" : ""}`}
              onClick={() => setFilter("all")}
              role="button"
              tabIndex={0}
            >
              <div className="warehouse-kpi-header">
                <span className="warehouse-kpi-label">1. TOTAL ORDERS</span>
                <span className="warehouse-kpi-icon">📋</span>
              </div>
              <div className="warehouse-kpi-value">{metrics.total}</div>
              <div className="warehouse-kpi-sub">
                <strong>{metrics.totalCases}</strong> total cases
              </div>
            </div>

            {/* KPI 2: 2. PENDING ORDERS */}
            <div
              className={`warehouse-kpi-card kpi-confirmed ${filter === "confirmed" ? "active-filter" : ""}`}
              onClick={() => setFilter("confirmed")}
              role="button"
              tabIndex={0}
            >
              <div className="warehouse-kpi-header">
                <span className="warehouse-kpi-label">2. PENDING ORDERS</span>
                <span className="warehouse-kpi-icon">📦</span>
              </div>
              <div className="warehouse-kpi-value">{metrics.confirmedCount}</div>
              <div className="warehouse-kpi-sub">
                <strong>{metrics.confirmedCases}</strong> cases to pick
              </div>
            </div>

            {/* KPI 3: 3. SALES ORDERS CREATED */}
            <div
              className={`warehouse-kpi-card kpi-packed ${filter === "packed" ? "active-filter" : ""}`}
              onClick={() => setFilter("packed")}
              role="button"
              tabIndex={0}
            >
              <div className="warehouse-kpi-header">
                <span className="warehouse-kpi-label">3. SALES ORDERS CREATED</span>
                <span className="warehouse-kpi-icon">🚚</span>
              </div>
              <div className="warehouse-kpi-value">{metrics.packedCount}</div>
              <div className="warehouse-kpi-sub">
                <strong>{metrics.packedCases}</strong> cases staged
              </div>
            </div>

            {/* KPI 4: 4. ORDERS DISPATCHED */}
            <div
              className={`warehouse-kpi-card kpi-dispatch ${filter === "out_for_delivery" ? "active-filter" : ""}`}
              onClick={() => setFilter("out_for_delivery")}
              role="button"
              tabIndex={0}
            >
              <div className="warehouse-kpi-header">
                <span className="warehouse-kpi-label">4. ORDERS DISPATCHED</span>
                <span className="warehouse-kpi-icon">🛣️</span>
              </div>
              <div className="warehouse-kpi-value">{metrics.outForDeliveryCount}</div>
              <div className="warehouse-kpi-sub">
                <strong>{metrics.outForDeliveryCases}</strong> in transit
              </div>
            </div>

            {/* KPI 5: 5. INVOICES */}
            <div
              className={`warehouse-kpi-card kpi-delivered ${filter === "delivered" ? "active-filter" : ""}`}
              onClick={() => setFilter("delivered")}
              role="button"
              tabIndex={0}
            >
              <div className="warehouse-kpi-header">
                <span className="warehouse-kpi-label">5. INVOICES</span>
                <span className="warehouse-kpi-icon">✅</span>
              </div>
              <div className="warehouse-kpi-value">{metrics.deliveredCount}</div>
              <div className="warehouse-kpi-sub">
                POD confirmed
              </div>
            </div>
          </div>

          {/* Row 2: Visual Infographics - Hourly Intake Flow (Pending Hours hidden per Requirement 2) */}
          <div className="warehouse-visual-grid" style={{ gridTemplateColumns: "1fr" }}>
            {/* Infographic: Hourly Order Intake & Fulfillment Trend Graph */}
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

      {/* Requirement 1: Order Status Filters in a Single Row */}
      <div
        className="warehouse-status-pills-row"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 8,
          marginBottom: 12,
          scrollbarWidth: "thin",
          whiteSpace: "nowrap",
        }}
        role="tablist"
        aria-label="Order status quick filters"
      >
        {STATUS_PILLS.map((pill) => {
          const isSelected = statusPill === pill.key;
          let count = 0;
          if (pill.key === "all") count = orders.length;
          else if (pill.key === "new_buyer") count = orders.filter((o: any) => o.retailer?.isNew || o.internalStatus?.code === "ACCOUNT_OPENED" || o.placedBy === "retailer").length;
          else if (pill.key === "rate_approval") count = orders.filter((o: any) => o.internalStatus?.code === "RATE_APPROVAL_SENT" || o.internalStatus?.code === "RATE_APPROVAL_PENDING").length;
          else if (pill.key === "outstanding") count = orders.filter((o: any) => o.internalStatus?.code === "SALES_ORDER_APPROVAL_SENT" || o.internalStatus?.code === "ORDER_APPROVAL_PENDING").length;
          else if (pill.key === "hold") count = orders.filter((o: any) => o.isOnHold === true || o.internalStatus?.code === "SALES_ORDER_ON_HOLD").length;
          else if (pill.key === "advance") count = orders.filter((o: any) => o.internalStatus?.code === "ADVANCE_PAYMENT_RECEIVED").length;
          else if (pill.key === "sale_order_created") count = orders.filter((o: any) => o.status === "confirmed" || o.internalStatus?.code === "SALES_ORDER_CREATED" || o.status === "placed").length;
          else if (pill.key === "cancelled") count = orders.filter((o: any) => o.cancellationRequestedAt != null || o.status === "rejected" || o.cancellationStatus != null).length;
          else if (pill.key === "double_order") count = orders.filter((o) => duplicateMap.has(o.id) && !acceptedDuplicates.has(o.id)).length;

          return (
            <button
              key={pill.key}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setStatusPill(pill.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: isSelected ? 700 : 500,
                cursor: "pointer",
                border: isSelected ? "1.5px solid #165a31" : "1px solid #cbd5e1",
                background: isSelected ? "#165a31" : "#ffffff",
                color: isSelected ? "#ffffff" : "#334155",
                boxShadow: isSelected ? "0 1px 3px rgba(22, 90, 49, 0.25)" : "none",
                transition: "all 0.15s ease",
                flexShrink: 0,
              }}
            >
              <span>{pill.label}</span>
              {count > 0 && (
                <span
                  style={{
                    background: isSelected ? "rgba(255,255,255,0.25)" : "#f1f5f9",
                    color: isSelected ? "#ffffff" : "#475569",
                    borderRadius: 10,
                    padding: "1px 6px",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filter Row: Warehouse, Salesperson, Date, Sort, Search (Requirement 6 Highlights) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Stage Filter */}
          <div className="warehouse-filters" role="group" aria-label="Order status filter tabs">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`warehouse-filter ${filter === item.value ? "selected" : ""}`}
                aria-pressed={filter === item.value}
                onClick={() => setFilter(item.value)}
                style={{
                  fontWeight: filter === item.value ? 700 : 500,
                  background: filter === item.value ? "#e6f4ea" : undefined,
                  borderColor: filter === item.value ? "#34a853" : undefined,
                  color: filter === item.value ? "#166534" : undefined,
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Warehouse Dropdown */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: warehouseFilter !== "all" ? "#e6f4ea" : "#f8fafc",
              border: warehouseFilter !== "all" ? "1.5px solid #34a853" : "1px solid #cbd5e1",
              borderRadius: 6,
              padding: "5px 10px",
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: warehouseFilter !== "all" ? "#166534" : "#475569" }}>
              🏢 Warehouse:
            </span>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              style={{ fontSize: 13, border: "none", background: "transparent", fontWeight: 600, color: "#0f172a", cursor: "pointer", outline: "none" }}
              aria-label="Filter by warehouse"
            >
              <option value="all">All Warehouses (All Hubs)</option>
              {availableWarehouses.map((wh) => (
                <option key={wh.code} value={wh.code}>
                  {wh.code} · {wh.name}
                </option>
              ))}
            </select>
          </div>

          {/* Salesperson Dropdown */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: salespersonFilter !== "all" ? "#e6f4ea" : "#f8fafc",
              border: salespersonFilter !== "all" ? "1.5px solid #34a853" : "1px solid #cbd5e1",
              borderRadius: 6,
              padding: "5px 10px",
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: salespersonFilter !== "all" ? "#166534" : "#475569" }}>
              👤 Salesperson:
            </span>
            <select
              value={salespersonFilter}
              onChange={(e) => setSalespersonFilter(e.target.value)}
              style={{ fontSize: 13, border: "none", background: "transparent", fontWeight: 600, color: "#0f172a", cursor: "pointer", outline: "none" }}
              aria-label="Filter via sales person"
            >
              <option value="all">All Salespersons / Sources</option>
              <option value="retailer_direct">🛒 Retailer Direct (No Rep)</option>
              {salespersons.map((rep) => (
                <option key={rep} value={rep}>
                  👤 {rep}
                </option>
              ))}
            </select>
          </div>

          {/* Date Dropdown with Custom Date (Requirement 4) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: dateFilter !== "all" ? "#e6f4ea" : "#f8fafc",
              border: dateFilter !== "all" ? "1.5px solid #34a853" : "1px solid #cbd5e1",
              borderRadius: 6,
              padding: "5px 10px",
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: dateFilter !== "all" ? "#166534" : "#475569" }}>
              📅 Date:
            </span>
            <select
              value={dateFilter}
              onChange={(e) => {
                const val = e.target.value as any;
                setDateFilter(val);
                if (val !== "custom") setCustomDate("");
              }}
              style={{ fontSize: 13, border: "none", background: "transparent", fontWeight: 600, color: "#0f172a", cursor: "pointer", outline: "none" }}
              aria-label="Filter by date"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">This Month</option>
              <option value="custom">📅 Custom Date...</option>
            </select>
            {dateFilter === "custom" && (
              <input
                type="date"
                aria-label="Custom Date Picker"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "2px 6px",
                  borderRadius: 4,
                  border: "1px solid #16a34a",
                  background: "#ffffff",
                  color: "#0f172a",
                  cursor: "pointer",
                }}
              />
            )}
          </div>

          {/* Sort Dropdown */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: sortBy !== "date_desc" ? "#e6f4ea" : "#f8fafc",
              border: sortBy !== "date_desc" ? "1.5px solid #34a853" : "1px solid #cbd5e1",
              borderRadius: 6,
              padding: "5px 10px",
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: sortBy !== "date_desc" ? "#166534" : "#475569" }}>
              ⚡ Sort:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{ fontSize: 13, border: "none", background: "transparent", fontWeight: 600, color: "#0f172a", cursor: "pointer", outline: "none" }}
              aria-label="Sort orders"
            >
              <option value="date_desc">Date: Newest First</option>
              <option value="date_asc">Date: Oldest First</option>
              <option value="value_desc">Value: High to Low</option>
              <option value="value_asc">Value: Low to High</option>
            </select>
          </div>
        </div>

        {/* Search input and refresh (Requirement 5) */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 280, flex: "1 1 280px", maxWidth: 450 }}>
          <div style={{ position: "relative", width: "100%" }}>
            <input
              type="search"
              aria-label="Search orders"
              placeholder="Search order ref, store name, owner, city…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 6,
                border: search.trim() ? "1.5px solid #34a853" : "1px solid #d1d5db",
                background: search.trim() ? "#e6f4ea" : "#ffffff",
                fontSize: 13,
              }}
            />
          </div>
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

      {/* Active Filters Tag Chips & One-Click Clear All (Requirement 6) */}
      {hasActiveFilters && (
        <div
          className="warehouse-active-filters-bar"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            padding: "8px 12px",
            background: "#e6f4ea",
            border: "1px solid #a7f3d0",
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: "#166534", display: "inline-flex", alignItems: "center", gap: 4 }}>
            🔍 Active Filters:
          </span>

          {statusPill !== "all" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#ffffff", border: "1px solid #86efac", borderRadius: 14, padding: "2px 8px", fontSize: 12, color: "#15803d", fontWeight: 600 }}>
              Status: {STATUS_PILLS.find((p) => p.key === statusPill)?.label}
              <button type="button" onClick={() => setStatusPill("all")} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#15803d", fontWeight: 700 }} title="Remove filter">✕</button>
            </span>
          )}

          {filter !== "all" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#ffffff", border: "1px solid #86efac", borderRadius: 14, padding: "2px 8px", fontSize: 12, color: "#15803d", fontWeight: 600 }}>
              Stage: {FILTERS.find((f) => f.value === filter)?.label}
              <button type="button" onClick={() => setFilter("all")} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#15803d", fontWeight: 700 }} title="Remove filter">✕</button>
            </span>
          )}

          {dateFilter !== "all" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#ffffff", border: "1px solid #86efac", borderRadius: 14, padding: "2px 8px", fontSize: 12, color: "#15803d", fontWeight: 600 }}>
              Date: {dateFilter === "custom" ? (customDate || "Custom Date") : dateFilter}
              <button type="button" onClick={() => { setDateFilter("all"); setCustomDate(""); }} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#15803d", fontWeight: 700 }} title="Remove filter">✕</button>
            </span>
          )}

          {warehouseFilter !== "all" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#ffffff", border: "1px solid #86efac", borderRadius: 14, padding: "2px 8px", fontSize: 12, color: "#15803d", fontWeight: 600 }}>
              Warehouse: {warehouseFilter}
              <button type="button" onClick={() => setWarehouseFilter("all")} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#15803d", fontWeight: 700 }} title="Remove filter">✕</button>
            </span>
          )}

          {salespersonFilter !== "all" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#ffffff", border: "1px solid #86efac", borderRadius: 14, padding: "2px 8px", fontSize: 12, color: "#15803d", fontWeight: 600 }}>
              Salesperson: {salespersonFilter === "retailer_direct" ? "Retailer Direct" : salespersonFilter}
              <button type="button" onClick={() => setSalespersonFilter("all")} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#15803d", fontWeight: 700 }} title="Remove filter">✕</button>
            </span>
          )}

          {sortBy !== "date_desc" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#ffffff", border: "1px solid #86efac", borderRadius: 14, padding: "2px 8px", fontSize: 12, color: "#15803d", fontWeight: 600 }}>
              Sort: {sortBy}
              <button type="button" onClick={() => setSortBy("date_desc")} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#15803d", fontWeight: 700 }} title="Remove filter">✕</button>
            </span>
          )}

          {search.trim() && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#ffffff", border: "1px solid #86efac", borderRadius: 14, padding: "2px 8px", fontSize: 12, color: "#15803d", fontWeight: 600 }}>
              Search: "{search}"
              <button type="button" onClick={() => setSearch("")} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#15803d", fontWeight: 700 }} title="Remove filter">✕</button>
            </span>
          )}

          <button
            type="button"
            onClick={handleClearAllFilters}
            style={{
              marginLeft: "auto",
              background: "#165a31",
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
            }}
          >
            Clear All Filters (✕)
          </button>
        </div>
      )}

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
                const isDuplicate = duplicateMap.has(order.id) && !acceptedDuplicates.has(order.id);
                const totalCases = order.items.reduce((sum, item) => sum + (item.qtyOrdered || 0), 0);
                return (
                  <button
                    type="button"
                    key={order.id}
                    className={`warehouse-order-row ${isDuplicate ? "duplicate-order-row" : ""}`}
                    style={isDuplicate ? { background: "#fffdf0", borderLeft: "4px solid #f59e0b" } : undefined}
                    aria-haspopup="dialog"
                    onClick={() => void openOrderModal(order)}
                  >
                    <span className="td-ref">
                      <strong>{formatOrderRef(order)}</strong>
                      {order.invoice?.invoiceNumber ? (
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#15803d", marginTop: 2 }}>
                          🧾 INV-{order.invoice.invoiceNumber}
                        </div>
                      ) : null}
                      {isDuplicate && (
                        <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a", borderRadius: 4 }}>
                            ⚠️ Double order placed
                          </span>
                          <button
                            type="button"
                            className="button secondary compact"
                            style={{
                              fontSize: 10,
                              padding: "2px 6px",
                              height: "auto",
                              background: "#ffffff",
                              borderColor: "#f59e0b",
                              color: "#b45309",
                              fontWeight: 700,
                              borderRadius: 4,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAcceptDuplicate(order.id);
                            }}
                            title="Accept duplicate order and proceed"
                          >
                            ✓ Accept Duplicate
                          </button>
                        </div>
                      )}
                    </span>
                    <span className="td-retailer">
                      <strong className="retailer-name">{order.retailer?.name ?? "Retailer unavailable"}</strong>
                      <small className="retailer-addr">
                        {order.retailer?.shopAddress ? `📍 ${order.retailer.shopAddress}` : ""}
                        {order.retailer?.deliveryCity ? ` · ${order.retailer.deliveryCity}` : ""}
                      </small>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 6px", background: "#e0f2fe", borderRadius: 4, fontSize: 11, color: "#0369a1", fontWeight: 600 }}>
                          👤 {order.salespersonName || "Direct"}
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 6px", background: order.warehouseCode === "WH-002" ? "#fef3c7" : "#f1f5f9", borderRadius: 4, fontSize: 11, color: order.warehouseCode === "WH-002" ? "#92400e" : "#334155", fontWeight: 600 }}>
                          🏢 {order.warehouseCode || "WH-001"} · {order.warehouseCity || "Indore"}
                        </span>
                        {order.transportName ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 5px", background: "#f1f5f9", borderRadius: 4, fontSize: 10, color: "#334155", fontWeight: 600 }}>
                            🚚 {order.transportName}
                          </span>
                        ) : null}
                        {order.remarks ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 5px", background: "#fef9c3", borderRadius: 4, fontSize: 10, color: "#854d0e", fontWeight: 600 }}>
                            💬 Remarks
                          </span>
                        ) : null}
                      </div>
                    </span>
                    <span className="td-items">
                      <strong className="items-count">
                        {order.items.length} {order.items.length === 1 ? "product" : "products"} · {totalCases} cases
                      </strong>
                      <div style={{ color: "#15803d", fontWeight: 700, fontSize: 13, marginTop: 2 }}>
                        {inr(order.orderTotal || order.invoice?.total || order.items.reduce((sum, item) => sum + (item.qtyOrdered * (item.unitPrice || 0)), 0))}
                      </div>
                    </span>
                    <span className="td-time">
                      <time>{createdLabel(order.createdAt)}</time>
                    </span>
                    <span className="td-status">
                      <span className={statusBadgeClass(order.status)}>{statusHumanLabel(order.status)}</span>
                      {order.cancellationStatus === "pending" && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", background: "#fee2e2", color: "#b91c1c", border: "1px solid #fca5a5", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 3, marginTop: 4 }}>
                          ⚠️ CANCELLATION REQUESTED
                        </span>
                      )}
                    </span>
                    <span className="td-action">
                      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                        {order.status === "delivered" && (
                          <span
                            role="button"
                            tabIndex={0}
                            className="button secondary compact"
                            style={{
                              fontSize: 11,
                              padding: "4px 8px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              background: "#ecfdf5",
                              borderColor: "#a7f3d0",
                              color: "#065f46",
                              fontWeight: 600,
                            }}
                            title="Download Invoice PDF"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDownloadInvoice(order.id, order.invoice?.invoiceNumber);
                            }}
                          >
                            📄 Invoice
                          </span>
                        )}
                        <span className="warehouse-view-cta">
                          Open <Icon name="arrow" size={13} />
                        </span>
                      </div>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {activeTab === "fleet" && (
        <section className="fleet-dispatcher-section" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Fleet KPI Metric Grid */}
          <div className="warehouse-kpi-grid">
            <div className="warehouse-kpi-card">
              <div className="warehouse-kpi-header">
                <span className="warehouse-kpi-label">Registered Fleet</span>
                <span className="warehouse-kpi-icon">🚚</span>
              </div>
              <div className="warehouse-kpi-value">{vehicles.length}</div>
              <div className="warehouse-kpi-sub">
                <strong>{vehicles.filter((v) => v.isActive).length}</strong> operational vehicles
              </div>
            </div>

            <div className="warehouse-kpi-card">
              <div className="warehouse-kpi-header">
                <span className="warehouse-kpi-label">Fleet Payload Capacity</span>
                <span className="warehouse-kpi-icon">⚖️</span>
              </div>
              <div className="warehouse-kpi-value">{(totalFleetTonnage / 1000).toFixed(1)} T</div>
              <div className="warehouse-kpi-sub">
                <strong>{totalFleetTonnage.toLocaleString("en-IN")} kg</strong> combined
              </div>
            </div>

            <div className="warehouse-kpi-card">
              <div className="warehouse-kpi-header">
                <span className="warehouse-kpi-label">Active Delivery Runs</span>
                <span className="warehouse-kpi-icon">🛣️</span>
              </div>
              <div className="warehouse-kpi-value" style={{ color: "#d97706" }}>{activeRunsCount}</div>
              <div className="warehouse-kpi-sub">
                loading or on delivery route
              </div>
            </div>

            <div className="warehouse-kpi-card">
              <div className="warehouse-kpi-header">
                <span className="warehouse-kpi-label">Cargo in Transit</span>
                <span className="warehouse-kpi-icon">📦</span>
              </div>
              <div className="warehouse-kpi-value" style={{ color: "#2563eb" }}>{activeRoadWeight} kg</div>
              <div className="warehouse-kpi-sub">
                across current active runs
              </div>
            </div>

            <div className="warehouse-kpi-card">
              <div className="warehouse-kpi-header">
                <span className="warehouse-kpi-label">Completed Today</span>
                <span className="warehouse-kpi-icon">✅</span>
              </div>
              <div className="warehouse-kpi-value" style={{ color: "#16a34a" }}>{completedRunsCount}</div>
              <div className="warehouse-kpi-sub">
                trips completed & delivered
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>
                🏢 Hub: {warehouseFilter === "all" ? "All Fulfillment Hubs" : (availableWarehouses.find((w) => w.code === warehouseFilter)?.name ?? warehouseFilter)}
              </span>
              <button
                type="button"
                className="button secondary compact"
                onClick={() => void loadFleet()}
                disabled={loadingFleet}
              >
                🔄 {loadingFleet ? "Refreshing…" : "Refresh Fleet"}
              </button>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="button secondary"
                style={{ fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={() => setShowAddVehicleModal(true)}
              >
                ➕ Register Fleet Vehicle
              </button>
              <button
                type="button"
                className="button primary"
                style={{
                  background: "#165a31",
                  borderColor: "#165a31",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
                onClick={() => {
                  if (vehicles.length === 0) {
                    setError("Please register at least one fleet vehicle first.");
                    return;
                  }
                  const firstVehicle = vehicles[0];
                  setNewRun({
                    vehicleId: firstVehicle.id,
                    driverName: firstVehicle.driverName,
                    driverPhone: firstVehicle.driverPhone,
                    notes: "",
                    orderIds: [],
                  });
                  setShowCreateRunModal(true);
                }}
              >
                🚚 Dispatch Delivery Run
              </button>
            </div>
          </div>

          {/* Section 1: Active & Recent Delivery Runs */}
          <div className="panel" style={{ padding: 18, background: "#ffffff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#111827" }}>
                  Active & Recent Delivery Runs ({runs.length})
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
                  Monitor staged runs, vehicles at docking bays, and real-time transit status.
                </p>
              </div>
            </div>

            {runs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#6b7280" }}>
                No delivery runs dispatched yet. Click <strong>Dispatch Delivery Run</strong> to bundle packed orders into a vehicle run.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {runs.map((r) => {
                  const isExpanded = expandedRunId === r.id;
                  let statusBadgeBg = "#fef3c7";
                  let statusBadgeColor = "#b45309";
                  let statusLabel = "Planned";

                  if (r.status === "loading") {
                    statusBadgeBg = "#dbeafe";
                    statusBadgeColor = "#1d4ed8";
                    statusLabel = "Loading at Dock";
                  } else if (r.status === "out_for_delivery") {
                    statusBadgeBg = "#ede9fe";
                    statusBadgeColor = "#6d28d9";
                    statusLabel = "Out for Delivery";
                  } else if (r.status === "completed") {
                    statusBadgeBg = "#dcfce7";
                    statusBadgeColor = "#15803d";
                    statusLabel = "Completed";
                  } else if (r.status === "cancelled") {
                    statusBadgeBg = "#fee2e2";
                    statusBadgeColor = "#b91c1c";
                    statusLabel = "Cancelled";
                  }

                  return (
                    <div
                      key={r.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        padding: 14,
                        background: r.status === "out_for_delivery" ? "#fbfdff" : "#ffffff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <strong style={{ fontSize: 15, color: "#111827" }}>{r.runNumber}</strong>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 700,
                                background: statusBadgeBg,
                                color: statusBadgeColor,
                              }}
                            >
                              {statusLabel}
                            </span>
                            <span style={{ fontSize: 12, color: "#6b7280" }}>
                              {new Date(r.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                            </span>
                          </div>
                          <div style={{ marginTop: 6, fontSize: 13, color: "#374151" }}>
                            🚛 <strong>{r.vehicleReg}</strong> ({r.vehicleModel}) · 👤 Driver: <strong>{r.driverName}</strong> ({r.driverPhone})
                          </div>
                          {r.notes && (
                            <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>
                              📝 {r.notes}
                            </div>
                          )}
                        </div>

                        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                          <div style={{ fontSize: 13 }}>
                            <strong style={{ fontSize: 14, color: "#111827" }}>{r.orderCount} orders</strong>
                            <span style={{ color: "#6b7280" }}> · {r.totalWeightKg} kg · {inr(r.totalOrderAmount)}</span>
                          </div>

                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {r.status === "planned" && (
                              <button
                                type="button"
                                className="button secondary compact"
                                style={{ background: "#dbeafe", borderColor: "#93c5fd", color: "#1d4ed8", fontWeight: 600 }}
                                onClick={() => void handleUpdateRunStatus(r.id, "loading", "Loading at Dock")}
                                disabled={busy}
                              >
                                📦 Mark Loading
                              </button>
                            )}

                            {(r.status === "planned" || r.status === "loading") && (
                              <button
                                type="button"
                                className="button primary compact"
                                style={{ background: "#165a31", borderColor: "#165a31", fontWeight: 600 }}
                                onClick={() => void handleUpdateRunStatus(r.id, "out_for_delivery", "Dispatched (Out for Delivery)")}
                                disabled={busy}
                              >
                                🚚 Dispatch Vehicle
                              </button>
                            )}

                            {r.status === "out_for_delivery" && (
                              <button
                                type="button"
                                className="button primary compact"
                                style={{ background: "#15803d", borderColor: "#15803d", fontWeight: 600 }}
                                onClick={() => void handleUpdateRunStatus(r.id, "completed", "Completed & Delivered")}
                                disabled={busy}
                              >
                                ✅ Mark Completed
                              </button>
                            )}

                            {r.status !== "completed" && r.status !== "cancelled" && (
                              <button
                                type="button"
                                className="button ghost compact"
                                style={{ color: "#dc2626", fontSize: 11 }}
                                onClick={() => void handleUpdateRunStatus(r.id, "cancelled", "Cancelled")}
                                disabled={busy}
                              >
                                Cancel Run
                              </button>
                            )}

                            <button
                              type="button"
                              className="button secondary compact"
                              style={{ fontSize: 11 }}
                              onClick={() => setExpandedRunId(isExpanded ? null : r.id)}
                            >
                              {isExpanded ? "Hide Orders ▲" : `View Orders (${r.orderCount}) ▼`}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expandable Order Breakdown */}
                      {isExpanded && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #d1d5db" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#4b5563", marginBottom: 6 }}>
                            Assigned Retailer Orders:
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
                            {r.orders.map((o) => (
                              <div
                                key={o.id}
                                style={{
                                  padding: "8px 10px",
                                  borderRadius: 6,
                                  background: "#f9fafb",
                                  border: "1px solid #e5e7eb",
                                  fontSize: 12,
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, color: "#111827" }}>
                                  <span>Order #{o.orderNo}</span>
                                  <span>{inr(o.orderTotal)}</span>
                                </div>
                                <div style={{ color: "#4b5563", marginTop: 2 }}>
                                  🏢 {o.retailerName} {o.deliveryCity ? `(${o.deliveryCity})` : ""}
                                </div>
                                {o.shopAddress && (
                                  <div style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>
                                    📍 {o.shopAddress}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Fleet Vehicle Register */}
          <div className="panel" style={{ padding: 18, background: "#ffffff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#111827" }}>
                  Delivery Fleet Register ({vehicles.length})
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
                  Trucks, tempos, and three-wheelers available for order fulfillment and routing.
                </p>
              </div>
              <button
                type="button"
                className="button secondary compact"
                onClick={() => setShowAddVehicleModal(true)}
              >
                ➕ Add Vehicle
              </button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", textAlign: "left", color: "#4b5563" }}>
                    <th style={{ padding: "10px 12px" }}>Registration Plate</th>
                    <th style={{ padding: "10px 12px" }}>Model & Type</th>
                    <th style={{ padding: "10px 12px" }}>Payload Capacity</th>
                    <th style={{ padding: "10px 12px" }}>Assigned Driver</th>
                    <th style={{ padding: "10px 12px" }}>Contact Phone</th>
                    <th style={{ padding: "10px 12px" }}>Total Trips</th>
                    <th style={{ padding: "10px 12px" }}>Status</th>
                    <th style={{ padding: "10px 12px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((v) => (
                    <tr key={v.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: "#111827" }}>
                        🚚 {v.regNumber}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <div>{v.model}</div>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: "#e0f2fe",
                            color: "#0369a1",
                            textTransform: "uppercase",
                            fontWeight: 700,
                          }}
                        >
                          {v.type.replace("_", " ")}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <strong>{v.capacityKg} kg</strong>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>{v.capacityBags} bags/cases</div>
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 600, color: "#374151" }}>
                        {v.driverName}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#4b5563" }}>
                        {v.driverPhone}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#4b5563" }}>
                        {v.runsCount ?? 0} runs
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700,
                            background: v.isActive ? "#dcfce7" : "#fee2e2",
                            color: v.isActive ? "#15803d" : "#b91c1c",
                          }}
                        >
                          {v.isActive ? "Operational" : "Maintenance"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            type="button"
                            className="button secondary compact"
                            style={{ fontSize: 11 }}
                            onClick={() => void handleToggleVehicleActive(v)}
                          >
                            {v.isActive ? "Mark Inactive" : "Mark Active"}
                          </button>
                          <button
                            type="button"
                            className="button ghost compact"
                            style={{ fontSize: 11, color: "#dc2626" }}
                            onClick={() => void handleDeleteVehicle(v.id, v.regNumber)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

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

              {modalOrder.cancellationStatus === "pending" && (
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: 12, marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#b45309", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                    <Icon name="alert" size={16} /> Cancellation Requested by Sales Representative
                  </div>
                  <div style={{ fontSize: 13, color: "#92400e", marginBottom: 10, lineHeight: 1.4 }}>
                    <strong>Reason / Remark:</strong> {modalOrder.cancellationReason || "No remark provided"}
                    {modalOrder.cancellationRequestedAt && (
                      <span style={{ marginLeft: 8, fontSize: 11, color: "#a16207" }}>
                        ({new Date(modalOrder.cancellationRequestedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })})
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="button danger compact"
                      disabled={busy}
                      onClick={async () => {
                        const note = window.prompt("Approval Remark / Note for Salesperson (Optional):", "Cancellation approved per sales request");
                        if (note !== null) {
                          try {
                            setBusy(true);
                            await api.approveCancellation(modalOrder.id, note || undefined);
                            alert("Order has been cancelled.");
                            closeModal();
                            await load(warehouseFilter);
                          } catch (err: any) {
                            alert(err?.message || "Failed to cancel order");
                          } finally {
                            setBusy(false);
                          }
                        }
                      }}
                    >
                      Approve Cancellation & Cancel Order
                    </button>
                    <button
                      type="button"
                      className="button secondary compact"
                      disabled={busy}
                      onClick={async () => {
                        const note = window.prompt("Decline Remark for Salesperson (Required):", "");
                        if (note && note.trim().length >= 3) {
                          try {
                            setBusy(true);
                            await api.rejectCancellation(modalOrder.id, note.trim());
                            alert("Cancellation request declined.");
                            closeModal();
                            await load(warehouseFilter);
                          } catch (err: any) {
                            alert(err?.message || "Failed to decline request");
                          } finally {
                            setBusy(false);
                          }
                        } else if (note !== null) {
                          alert("Please provide a reason of at least 3 characters explaining why this order cannot be cancelled.");
                        }
                      }}
                    >
                      Decline Request
                    </button>
                  </div>
                </div>
              )}

              {/* Duplicate Order Warning Box with Accept Duplicate button (Requirement 7) */}
              {duplicateMap.has(modalOrder.id) && !acceptedDuplicates.has(modalOrder.id) && (
                <div style={{
                  padding: "12px 16px",
                  background: "#fffbeb",
                  border: "2px solid #f59e0b",
                  borderRadius: 8,
                  marginBottom: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}>
                  <div>
                    <strong style={{ display: "block", color: "#92400e", fontSize: 13, marginBottom: 2 }}>
                      ⚠️ Double order placed ({duplicateMap.get(modalOrder.id)?.reason})
                    </strong>
                    <span style={{ fontSize: 12, color: "#b45309" }}>
                      This order matches previous order {duplicateMap.get(modalOrder.id)?.duplicateOfOrderRef}. Click "Accept Duplicate" if this is an intentional repeat order.
                    </span>
                  </div>
                  <button
                    type="button"
                    className="button secondary compact"
                    style={{
                      background: "#fef3c7",
                      borderColor: "#f59e0b",
                      color: "#92400e",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      padding: "6px 12px",
                    }}
                    onClick={() => handleAcceptDuplicate(modalOrder.id)}
                  >
                    ✓ Accept Duplicate
                  </button>
                </div>
              )}

              {/* Retailer & Fulfillment Info Card (Image 1 Green Highlights) */}
              <section className="warehouse-modal-retailer-card" aria-label="Customer details">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#111827" }}>
                        {modalOrder.retailer?.name ?? "Retailer unavailable"}
                      </h3>
                      {/* Green City Badge from Image 1 */}
                      <span
                        style={{
                          background: "#dcfce7",
                          color: "#166534",
                          border: "1px solid #86efac",
                          borderRadius: 4,
                          padding: "2px 8px",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        City : {modalOrder.retailer?.deliveryCity || (modalOrder.retailer as any)?.city || "Indore MP"}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "#4b5563", marginBottom: 2 }}>
                      📍 {modalOrder.retailer?.shopAddress ?? "Shop address not provided"}
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

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 12, paddingTop: 10, borderTop: "1px solid #e2e8f0" }}>
                  <div>
                    <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5, display: "block" }}>
                      👤 Punched By / Salesperson
                    </span>
                    <strong style={{ fontSize: 13, color: "#0f172a", marginTop: 2, display: "block" }}>
                      {modalOrder.salespersonName || "Field Sales Rep"}
                    </strong>
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      {modalOrder.punchedByLabel || (modalOrder.salespersonPhone ? `Phone: ${modalOrder.salespersonPhone}` : "Salesperson App")}
                    </span>
                  </div>

                  {/* TRANSPORTER display from Image 1 */}
                  <div>
                    <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5, display: "block" }}>
                      🚚 TRANSPORTER
                    </span>
                    <strong style={{ fontSize: 13, color: "#0f172a", marginTop: 2, display: "block" }}>
                      {modalOrder.transportName || "Mahi Transport Indore"}
                    </strong>
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      Hub: {modalOrder.warehouseCity || "Indore"}
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5, display: "block" }}>
                      🏢 Fulfillment Warehouse
                    </span>
                    <strong style={{ fontSize: 13, color: "#0f172a", marginTop: 2, display: "block" }}>
                      {modalOrder.warehouseName || (modalOrder.warehouseCode === "WH-002" ? "Bhopal Regional Hub" : "Indore Central Fulfillment Hub")}
                    </strong>
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      Code: <strong>{modalOrder.warehouseCode || "WH-001"}</strong>
                    </span>
                  </div>
                </div>

                {/* Remarks full width from Image 1 */}
                <div style={{ marginTop: 12, padding: "8px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Remarks:
                  </div>
                  <div style={{ fontSize: 13, color: "#1e293b", marginTop: 2, fontWeight: 500 }}>
                    {modalOrder.remarks || "Standard dispatch instructions apply"}
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

              {/* Dispatch Instructions, Date & Transport (Points 2, 3, 4, 5) */}
              {(modalOrder.expectedDeliveryAt || modalOrder.transportName || modalOrder.remarks || modalOrder.commercialSnapshot?.riceScheme) && (
                <section
                  className="warehouse-modal-dispatch-info"
                  aria-label="Dispatch instructions and transport"
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: "12px 14px",
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5 }}>
                        📅 Dispatch / Delivery Date
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginTop: 2 }}>
                        {modalOrder.expectedDeliveryAt
                          ? new Date(modalOrder.expectedDeliveryAt).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
                          : "Any time (Same day eligible)"}
                      </div>
                    </div>

                    {modalOrder.transportName ? (
                      <div>
                        <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5 }}>
                          🚚 Transport Name
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginTop: 2 }}>
                          {modalOrder.transportName}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {modalOrder.remarks ? (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "8px 12px",
                        background: "#fefce8",
                        border: "1px solid #fef08a",
                        borderRadius: 6,
                      }}
                    >
                      <div style={{ fontSize: 11, color: "#854d0e", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        💬 Dispatch Remarks / Special Instructions
                      </div>
                      <div style={{ fontSize: 13, color: "#713f12", marginTop: 2, whiteSpace: "pre-wrap", fontWeight: 500 }}>
                        {modalOrder.remarks}
                      </div>
                    </div>
                  ) : null}

                  {modalOrder.commercialSnapshot?.riceScheme ? (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "8px 12px",
                        background: "#ecfdf5",
                        border: "1px solid #a7f3d0",
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 16 }}>🎁</span>
                      <div>
                        <strong style={{ fontSize: 12, color: "#065f46", display: "block" }}>
                          {modalOrder.commercialSnapshot.riceScheme.schemeName || "Rice Scheme Applied"}
                        </strong>
                        <span style={{ fontSize: 11, color: "#047857" }}>
                          {modalOrder.commercialSnapshot.riceScheme.schemeDescription || "Free rice added to dispatch"}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </section>
              )}

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
                    <span>PACKAGING SIZE</span>
                    <span style={{ textAlign: "right" }}>Rate</span>
                    <span style={{ textAlign: "right" }}>Quantity</span>
                    <span style={{ textAlign: "right" }}>TOTAL AMOUNT</span>
                  </div>
                  <div className="warehouse-modal-items-body">
                    {modalOrder.items.map((item) => {
                      const isFree = item.commercialSnapshot?.isFreeItem || (item.unitPrice === 0 && item.commercialSnapshot?.scheme);
                      const unitRate = item.unitPrice ?? 0;
                      const lineTotal = isFree ? 0 : item.qtyOrdered * unitRate;

                      const caseWeightKg = Number(
                        item.caseWeightKg ??
                        (item as any).caseWeightKgSnapshot ??
                        (item.variant?.unitWeightKg ? Number(item.variant.unitWeightKg) * (item.variant.unitsPerCase ?? 1) : 0)
                      );
                      const isBox = (item.outerPack === "Box") ||
                        (item.variant as any)?.catalogIdentityMasterPack?.toUpperCase()?.includes("BOX") ||
                        (item.variant as any)?.product?.category?.toLowerCase()?.includes("breakfast") ||
                        (item.variant as any)?.product?.category?.toLowerCase()?.includes("mix");
                      const unitLabel = isBox ? "Box" : "Bag";

                      const snapshotRateBasis = item.rateBasis || item.commercialSnapshot?.rateBasis;
                      const isQuintal =
                        String(snapshotRateBasis || "").toLowerCase() === "quintal" ||
                        (item.variant as any)?.listRateBasis === "quintal" ||
                        item.commercialSnapshot?.quintals != null ||
                        (caseWeightKg >= 20 && !isBox);

                      const quintalRate = item.ratePerQuintal != null
                        ? item.ratePerQuintal
                        : (item.commercialSnapshot?.rate && isQuintal
                          ? Number(item.commercialSnapshot.rate)
                          : (isQuintal && caseWeightKg > 0
                            ? Math.round((unitRate / caseWeightKg) * 100 * 100) / 100
                            : null));

                      const packagingSize = item.variant?.unitSize ||
                        (item.commercialSnapshot?.packDescription
                          ? item.commercialSnapshot.packDescription.replace(/^\d+\s*[xX×]\s*/, "")
                          : item.variant?.unitSize || "Standard");

                      return (
                        <div
                          className="warehouse-modal-item-row"
                          key={item.id}
                          style={isFree ? { background: "#f0fdf4", borderLeft: "3px solid #10b981" } : undefined}
                        >
                          <strong className="item-product-name" style={isFree ? { color: "#065f46" } : undefined}>
                            {isFree ? "🎁 [FREE SCHEME] " : ""}
                            {item.variant?.product?.name ?? "Product unavailable"}
                          </strong>
                          <span className="item-presentation" style={{ fontWeight: 600 }}>
                            {packagingSize}
                          </span>
                          <span style={{ textAlign: "right", fontSize: 13, color: isFree ? "#047857" : "#111827" }}>
                            {isFree ? (
                              "₹0 (FREE)"
                            ) : isQuintal && quintalRate != null && quintalRate > 0 ? (
                              <div style={{ textAlign: "right" }}>
                                <strong style={{ display: "block", color: "#111827", fontSize: 13, fontWeight: 700 }}>
                                  {inr(quintalRate)} / quintal
                                </strong>
                                <span style={{ display: "block", fontSize: 11, color: "#64748b", marginTop: 2 }}>
                                  {inr(unitRate)} / {unitLabel.toLowerCase()}
                                </span>
                              </div>
                            ) : (
                              <div style={{ textAlign: "right" }}>
                                <strong style={{ display: "block", color: "#111827", fontSize: 13, fontWeight: 700 }}>
                                  {inr(unitRate)} / {unitLabel.toLowerCase()}
                                </strong>
                              </div>
                            )}
                          </span>
                          <b className="item-qty" style={{ textAlign: "right", fontSize: 14, color: isFree ? "#047857" : "#111827" }}>
                            {item.qtyOrdered} {isFree ? "packs" : item.qtyOrdered > 1 ? `${unitLabel}s` : unitLabel}
                          </b>
                          <strong style={{ textAlign: "right", fontSize: 13, color: isFree ? "#047857" : "#111827" }}>
                            {isFree ? "₹0" : inr(lineTotal)}
                          </strong>
                        </div>
                      );
                    })}
                  </div>
                  <div className="warehouse-modal-items-footer">
                    <span style={{ fontWeight: 500 }}>
                      Total items: <strong>{modalOrder.items.length}</strong> · Cases: <strong>{modalOrder.items.reduce((sum, it) => sum + (it.qtyOrdered || 0), 0)}</strong>
                    </span>
                    <span className="modal-total-amount">
                      Total Order Amount:{" "}
                      <strong style={{ fontSize: 16, color: "#15803d", marginLeft: 4 }}>
                        {inr(modalOrder.orderTotal || modalOrder.items.reduce((sum, it) => sum + (it.qtyOrdered * (it.unitPrice || 0)), 0))}
                      </strong>
                    </span>
                  </div>
                </div>
              </section>

              {/* Stage-Specific Fulfillment Action Area */}
              <section className="warehouse-modal-action-deck" aria-label="Fulfillment actions">
                {/* 1. Confirmed / Ready to Pack -> Step 1: Order status */}
                {modalOrder.status === "confirmed" && (
                  <div
                    style={{
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: 8,
                      padding: "16px 20px",
                    }}
                  >
                    <div style={{ marginBottom: 10 }}>
                      <strong style={{ fontSize: 14, color: "#15803d", display: "block", marginBottom: 4, fontWeight: 700 }}>
                        📦 Step 1: Order status
                      </strong>
                      <p style={{ margin: 0, fontSize: 12.5, color: "#374151", lineHeight: 1.4 }}>
                        Verify the order details above. As you fill each item, the status will update automatically. Verify any pending actions, and update the status accordingly.
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <button
                        type="button"
                        style={{
                          background: "#eff6ff",
                          border: "1.5px solid #3b82f6",
                          color: "#1d4ed8",
                          padding: "6px 14px",
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                        }}
                        onClick={() => void handlePack()}
                        disabled={busy || modalDetailLoading}
                      >
                        <span style={{ fontSize: 13, fontWeight: 700 }}>✓</span>
                        <span>{busy ? "Validating…" : "All items validated"}</span>
                      </button>

                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <span
                          style={{
                            background: "#2563eb",
                            color: "#ffffff",
                            padding: "5px 12px",
                            borderRadius: 20,
                            fontSize: 11.5,
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          🏷️ #New Buyer
                        </span>
                        <span
                          style={{
                            background: "#2563eb",
                            color: "#ffffff",
                            padding: "5px 12px",
                            borderRadius: 20,
                            fontSize: 11.5,
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          🏷️ Rate Approval
                        </span>
                        <span
                          style={{
                            background: "#2563eb",
                            color: "#ffffff",
                            padding: "5px 12px",
                            borderRadius: 20,
                            fontSize: 11.5,
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          🏷️ Order on Outstanding
                        </span>
                        <span
                          style={{
                            background: "#2563eb",
                            color: "#ffffff",
                            padding: "5px 12px",
                            borderRadius: 20,
                            fontSize: 11.5,
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          🏷️ Order Packed
                        </span>
                        {duplicateMap.has(modalOrder.id) && !acceptedDuplicates.has(modalOrder.id) ? (
                          <span
                            style={{
                              background: "#d97706",
                              color: "#ffffff",
                              padding: "5px 12px",
                              borderRadius: 20,
                              fontSize: 11.5,
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            ⚠️ Double order placed
                          </span>
                        ) : (
                          <span
                            style={{
                              background: "#2563eb",
                              color: "#ffffff",
                              padding: "5px 12px",
                              borderRadius: 20,
                              fontSize: 11.5,
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            🏷️ Double order placed
                          </span>
                        )}
                        <span
                          style={{
                            background: "#2563eb",
                            color: "#ffffff",
                            padding: "5px 12px",
                            borderRadius: 20,
                            fontSize: 11.5,
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          🏷️ On Hold
                        </span>
                        <span
                          style={{
                            background: "#2563eb",
                            color: "#ffffff",
                            padding: "5px 12px",
                            borderRadius: 20,
                            fontSize: 11.5,
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          🏷️ Advance Payment
                        </span>
                        <span
                          style={{
                            background: "#2563eb",
                            color: "#ffffff",
                            padding: "5px 12px",
                            borderRadius: 20,
                            fontSize: 11.5,
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          🏷️ Sale Order Created
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Packed -> Step 2: Material Dispatched */}
                {modalOrder.status === "packed" && (
                  <div
                    style={{
                      background: "#eff6ff",
                      border: "1px solid #bfdbfe",
                      borderRadius: 8,
                      padding: "18px 20px",
                    }}
                  >
                    <div style={{ marginBottom: 16 }}>
                      <strong style={{ fontSize: 14, color: "#1d4ed8", display: "block", fontWeight: 700 }}>
                        🚚 Step 2: Material Dispatched
                      </strong>
                    </div>

                    <button
                      type="button"
                      style={{
                        background: "#1d4ed8",
                        border: "none",
                        color: "#ffffff",
                        padding: "12px 24px",
                        fontSize: 14.5,
                        fontWeight: 700,
                        width: "100%",
                        borderRadius: 8,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                      }}
                      onClick={() => void handleConfirmDispatch()}
                      disabled={busy || modalDetailLoading}
                    >
                      <span style={{ fontSize: 15 }}>➔</span>
                      <span>📦 Confirm Route & Send Out</span>
                    </button>
                  </div>
                )}

                {/* 3. Out for delivery -> Step 3: Record Proof of Delivery (POD) */}
                {modalOrder.status === "out_for_delivery" && (
                  <div
                    style={{
                      background: "#fefce8",
                      border: "1px solid #fef08a",
                      borderRadius: 8,
                      padding: "18px 20px",
                    }}
                  >
                    <div style={{ marginBottom: 14 }}>
                      <strong style={{ fontSize: 14, color: "#b45309", display: "block", marginBottom: 4, fontWeight: 700 }}>
                        📍 Step 3: Record Proof of Delivery (POD)
                      </strong>
                      <p style={{ margin: 0, fontSize: 12.5, color: "#4b5563" }}>
                        Confirm delivery at recipient location and verify delivered quantities.
                      </p>
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                        POD Verification Method
                      </label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          style={{
                            borderColor: podType === "photo" ? "#d97706" : "#d1d5db",
                            background: podType === "photo" ? "#fffbeb" : "#fff",
                            color: podType === "photo" ? "#b45309" : "#374151",
                            fontWeight: 600,
                            border: "1.5px solid #d97706",
                            borderRadius: 20,
                            padding: "5px 16px",
                            fontSize: 12,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                          onClick={() => setPodType("photo")}
                        >
                          📷 Photo
                        </button>
                      </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                        Delivered Cases Checklist
                      </label>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {modalOrder.items.map((item) => {
                          const lineVal = deliveredLines.find((l) => l.orderItemId === item.id)?.cases ?? item.qtyOrdered;
                          const isBox = (item.outerPack === "Box") || (item.variant as any)?.catalogIdentityMasterPack?.toUpperCase()?.includes("BOX");
                          const unitLabel = isBox ? "Box" : "Bag";
                          const isQuintal = item.rateBasis === "quintal" || (item.ratePerQuintal != null && item.ratePerQuintal > 0);
                          const qRate = item.ratePerQuintal;

                          return (
                            <div
                              key={item.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                background: "#ffffff",
                                padding: "10px 14px",
                                borderRadius: 6,
                                border: "1px solid #e5e7eb",
                              }}
                            >
                              <div>
                                <strong style={{ fontSize: 13, color: "#111827" }}>{item.variant?.product?.name ?? "Item"}</strong>
                                <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 2 }}>
                                  Ordered: {item.qtyOrdered} {item.qtyOrdered > 1 ? `${unitLabel}s` : unitLabel}
                                  {isQuintal && qRate ? ` · ${inr(qRate)}/quintal (${inr(item.unitPrice || 0)}/${unitLabel.toLowerCase()})` : (item.unitPrice ? ` · ${inr(item.unitPrice)}/${unitLabel.toLowerCase()}` : "")}
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <label style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>Delivered:</label>
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
                                  style={{ width: 55, padding: "4px 8px", borderRadius: 4, border: "1px solid #d1d5db", textAlign: "right", fontWeight: 600 }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Hidden file input for Upload Invoice */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: "none" }}
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setUploadedInvoiceName(file.name);
                          setNotice(`📄 Invoice "${file.name}" attached successfully!`);
                        }
                      }}
                    />

                    {/* Two Stacked Action Buttons */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <button
                        type="button"
                        style={{
                          background: "#8c4d1d",
                          border: "none",
                          color: "#ffffff",
                          padding: "11px 20px",
                          fontSize: 14,
                          fontWeight: 700,
                          width: "100%",
                          borderRadius: 6,
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          gap: 6,
                          boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                        }}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <span>{uploadedInvoiceName ? `✓ Invoice Attached: ${uploadedInvoiceName}` : "Upload Invoice"}</span>
                      </button>

                      <button
                        type="button"
                        style={{
                          background: "#065f46",
                          border: "none",
                          color: "#ffffff",
                          padding: "12px 20px",
                          fontSize: 14.5,
                          fontWeight: 700,
                          width: "100%",
                          borderRadius: 6,
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          gap: 6,
                          boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                        }}
                        onClick={() => void handleConfirmDelivery()}
                        disabled={busy || modalDetailLoading}
                      >
                        <span style={{ fontSize: 16 }}>✓</span>
                        <span>{busy ? "Completing…" : "Complete Delivery"}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. Delivered -> Step 4: Fulfillment Completed & Invoiced */}
                {modalOrder.status === "delivered" && (
                  <div
                    style={{
                      background: "#ecfdf5",
                      border: "1px solid #a7f3d0",
                      borderRadius: 8,
                      padding: "22px 24px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#065f46", marginBottom: 6 }}>
                      ✅ Fulfillment Completed & Invoiced
                    </div>
                    <p style={{ margin: "0 auto 18px", fontSize: 12.5, color: "#047857", maxWidth: 440 }}>
                      This order has been verified, delivered to the retailer, and the tax invoice has been generated.
                    </p>

                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <button
                        type="button"
                        style={{
                          background: "#165a31",
                          border: "none",
                          color: "#ffffff",
                          padding: "10px 22px",
                          fontSize: 13.5,
                          fontWeight: 700,
                          borderRadius: 6,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                        }}
                        onClick={() => void handleDownloadInvoice(modalOrder.id, modalOrder.invoice?.invoiceNumber)}
                        disabled={downloadingInvoice}
                      >
                        <span style={{ fontSize: 14 }}>➔</span>
                        <span>📄 Download Invoice (PDF)</span>
                      </button>
                    </div>
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

      {/* Modal: Register Fleet Vehicle */}
      {showAddVehicleModal && (
        <div className="warehouse-modal-backdrop" onClick={() => setShowAddVehicleModal(false)}>
          <div
            className="warehouse-modal-card"
            role="dialog"
            aria-modal="true"
            style={{ maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="warehouse-modal-header">
              <div className="warehouse-modal-title-group">
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>➕ Register New Delivery Vehicle</h2>
                <small style={{ color: "#6b7280" }}>Add logistics carrier to Indore delivery fleet</small>
              </div>
              <button
                type="button"
                className="button ghost compact warehouse-modal-close"
                onClick={() => setShowAddVehicleModal(false)}
              >
                ✕
              </button>
            </header>

            <form onSubmit={handleCreateVehicle}>
              <div className="warehouse-modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Vehicle Registration Plate Number *
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. MP-09-GA-8822"
                    value={newVehicle.regNumber}
                    onChange={(e) => setNewVehicle({ ...newVehicle, regNumber: e.target.value.toUpperCase() })}
                    required
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                      Vehicle Model Name *
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Tata Ace Gold CNG"
                      value={newVehicle.model}
                      onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                      Vehicle Type
                    </label>
                    <select
                      className="input"
                      value={newVehicle.type}
                      onChange={(e) => setNewVehicle({ ...newVehicle, type: e.target.value as any })}
                    >
                      <option value="tempo">Tempo (Light Commercial)</option>
                      <option value="truck">Heavy Truck (LPT)</option>
                      <option value="three_wheeler">Three-Wheeler / E-Rickshaw</option>
                      <option value="van">Delivery Van</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                      Weight Capacity (kg) *
                    </label>
                    <input
                      type="number"
                      className="input"
                      min={50}
                      value={newVehicle.capacityKg}
                      onChange={(e) => setNewVehicle({ ...newVehicle, capacityKg: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                      Case / Bag Capacity *
                    </label>
                    <input
                      type="number"
                      className="input"
                      min={5}
                      value={newVehicle.capacityBags}
                      onChange={(e) => setNewVehicle({ ...newVehicle, capacityBags: Number(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                      Primary Driver Name *
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Suresh Rathore"
                      value={newVehicle.driverName}
                      onChange={(e) => setNewVehicle({ ...newVehicle, driverName: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                      Driver Mobile Phone *
                    </label>
                    <input
                      type="tel"
                      className="input"
                      placeholder="10-digit mobile number"
                      maxLength={10}
                      value={newVehicle.driverPhone}
                      onChange={(e) => setNewVehicle({ ...newVehicle, driverPhone: e.target.value.replace(/\D/g, "") })}
                      required
                    />
                  </div>
                </div>
              </div>

              <footer className="warehouse-modal-footer">
                <button
                  type="button"
                  className="button secondary compact"
                  onClick={() => setShowAddVehicleModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button primary compact"
                  style={{ background: "#165a31", borderColor: "#165a31" }}
                  disabled={busy}
                >
                  {busy ? "Registering…" : "Register Vehicle"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Dispatch Delivery Run */}
      {showCreateRunModal && (
        <div className="warehouse-modal-backdrop" onClick={() => setShowCreateRunModal(false)}>
          <div
            className="warehouse-modal-card"
            role="dialog"
            aria-modal="true"
            style={{ maxWidth: 680 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="warehouse-modal-header">
              <div className="warehouse-modal-title-group">
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🚚 Dispatch New Delivery Run</h2>
                <small style={{ color: "#6b7280" }}>Bundle packed warehouse orders into a vehicle delivery run</small>
              </div>
              <button
                type="button"
                className="button ghost compact warehouse-modal-close"
                onClick={() => setShowCreateRunModal(false)}
              >
                ✕
              </button>
            </header>

            <form onSubmit={handleCreateRun}>
              <div className="warehouse-modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                      Select Assigned Vehicle *
                    </label>
                    <select
                      className="input"
                      value={newRun.vehicleId}
                      onChange={(e) => {
                        const selV = vehicles.find((v) => v.id === e.target.value);
                        setNewRun({
                          ...newRun,
                          vehicleId: e.target.value,
                          driverName: selV?.driverName || newRun.driverName,
                          driverPhone: selV?.driverPhone || newRun.driverPhone,
                        });
                      }}
                      required
                    >
                      <option value="">-- Choose Vehicle --</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.regNumber} ({v.model} - max {v.capacityKg} kg)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                      Driver Name & Phone *
                    </label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        type="text"
                        className="input"
                        placeholder="Driver Name"
                        value={newRun.driverName}
                        onChange={(e) => setNewRun({ ...newRun, driverName: e.target.value })}
                        required
                      />
                      <input
                        type="tel"
                        className="input"
                        placeholder="Phone"
                        maxLength={10}
                        value={newRun.driverPhone}
                        onChange={(e) => setNewRun({ ...newRun, driverPhone: e.target.value.replace(/\D/g, "") })}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Route / Delivery Notes
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Route A: Malwa Mill, Patnipura, Vijay Nagar"
                    value={newRun.notes}
                    onChange={(e) => setNewRun({ ...newRun, notes: e.target.value })}
                  />
                </div>

                {/* Select Orders to Dispatch */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 700 }}>
                      Select Orders to Dispatch ({newRun.orderIds.length} selected) *
                    </label>
                    {allOrders.length > 0 && (
                      <button
                        type="button"
                        className="button ghost compact"
                        style={{ fontSize: 11 }}
                        onClick={() => {
                          const candidateIds = allOrders
                            .filter((o) => o.status === "packed" || o.status === "confirmed")
                            .map((o) => o.id);
                          const allSelected = candidateIds.every((id) => newRun.orderIds.includes(id));
                          setNewRun({
                            ...newRun,
                            orderIds: allSelected ? [] : candidateIds,
                          });
                        }}
                      >
                        Select All Packed/Confirmed
                      </button>
                    )}
                  </div>

                  {/* Orders selection list */}
                  <div
                    style={{
                      maxHeight: 220,
                      overflowY: "auto",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      background: "#fafafa",
                      padding: 8,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {allOrders
                      .filter((o) => o.status === "packed" || o.status === "confirmed")
                      .map((o) => {
                        const isChecked = newRun.orderIds.includes(o.id);
                        const orderCases = o.items.reduce((sum, item) => sum + (item.qtyOrdered || 0), 0);
                        return (
                          <label
                            key={o.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "6px 10px",
                              borderRadius: 6,
                              background: isChecked ? "#ecfdf5" : "#ffffff",
                              border: isChecked ? "1px solid #a7f3d0" : "1px solid #e5e7eb",
                              cursor: "pointer",
                              fontSize: 12.5,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewRun({ ...newRun, orderIds: [...newRun.orderIds, o.id] });
                                } else {
                                  setNewRun({ ...newRun, orderIds: newRun.orderIds.filter((id) => id !== o.id) });
                                }
                              }}
                            />
                            <div style={{ flex: 1, display: "flex", justifyContent: "space-between" }}>
                              <div>
                                <strong>#{o.orderNo}</strong> · {o.retailer?.name ?? "Retailer"} ({o.retailer?.deliveryCity ?? "Indore"})
                                <span style={{ marginLeft: 8, fontSize: 11, color: "#6b7280" }}>
                                  ({orderCases} cases)
                                </span>
                              </div>
                              <div>
                                <span
                                  style={{
                                    fontSize: 10,
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    marginRight: 8,
                                    background: o.status === "packed" ? "#dbeafe" : "#fef3c7",
                                    color: o.status === "packed" ? "#1e40af" : "#92400e",
                                    fontWeight: 700,
                                  }}
                                >
                                  {o.status}
                                </span>
                                <strong>{inr(o.orderTotal || 0)}</strong>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    {allOrders.filter((o) => o.status === "packed" || o.status === "confirmed").length === 0 && (
                      <div style={{ padding: 12, textAlign: "center", color: "#6b7280", fontSize: 12 }}>
                        No orders in packed or confirmed status. Pack orders from the Queue tab first!
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <footer className="warehouse-modal-footer">
                <button
                  type="button"
                  className="button secondary compact"
                  onClick={() => setShowCreateRunModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button primary compact"
                  style={{ background: "#165a31", borderColor: "#165a31" }}
                  disabled={busy || newRun.orderIds.length === 0}
                >
                  {busy ? "Dispatching…" : `Dispatch Run (${newRun.orderIds.length} orders)`}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
