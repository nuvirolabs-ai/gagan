import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { api, inr } from "../api";
import { formatOrderRef } from "../orderRef";

type AuditedLine = {
  orderItemId?: string;
  variantId: string;
  productName: string;
  pack: string;
  cases: number;
  weightKg: number;
  rate: number;
  rateBasis: string;
  base: number;
  gst: number;
  total: number;
  routingClass: string;
  reason: string;
};

type AuditedOrder = {
  id: string;
  orderNo: number;
  createdAt: string;
  status: string;
  retailerId?: string;
  retailerName: string;
  retailerPhone?: string;
  deliveryCity: string;
  destination: "INDORE_CITY" | "OUTSIDE_INDORE";
  isSplit: boolean;
  explanation: string;
  eligibleContributionBags: number;
  jain: {
    goods: number;
    gst: number;
    freight: number;
    total: number;
    bags: number;
    itemsCount: number;
    lines: AuditedLine[];
    paid: number;
    outstanding: number;
  };
  padam: {
    goods: number;
    gst: number;
    freight: number;
    total: number;
    bags: number;
    itemsCount: number;
    lines: AuditedLine[];
    paid: number;
    outstanding: number;
  };
  grandTotal: number;
  invoiceNumber: number | null;
  invoiceStatus: string | null;
  totalPaid: number;
  totalOutstanding: number;
  accountingStatus?: "open" | "closed";
  accountingClosedAt?: string | null;
  accountingClosedBy?: string | null;
  accountingNotes?: string | null;
};

type AuditSummary = {
  totalRevenue: number;
  totalOrders: number;
  splitOrdersCount: number;
  accountingClosedOrdersCount?: number;
  accountingOpenOrdersCount?: number;
  jain: {
    totalRevenue: number;
    goodsValue: number;
    gstAmount: number;
    freightAmount: number;
    paymentsCollected: number;
    outstandingAmount: number;
    totalBags: number;
    ordersCount: number;
    reasons: {
      INDORE_CITY_OVERRIDE: number;
      LAXMI_ALWAYS_JAIN: number;
      ELIGIBLE_THRESHOLD_LT_5_BAGS: number;
      FIXED_OR_OTHER: number;
    };
  };
  padam: {
    totalRevenue: number;
    goodsValue: number;
    gstAmount: number;
    freightAmount: number;
    paymentsCollected: number;
    outstandingAmount: number;
    totalBags: number;
    ordersCount: number;
    reasons: {
      ELIGIBLE_THRESHOLD_GTE_5_BAGS: number;
      FIXED_OR_OTHER: number;
    };
  };
  destinations: {
    indoreCity: { count: number; total: number };
    outsideIndore: { count: number; total: number };
  };
};

export default function BillingEntitiesAudit() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [orders, setOrders] = useState<AuditedOrder[]>([]);

  // Filter states
  const [datePreset, setDatePreset] = useState<"all" | "today" | "week" | "month" | "custom">("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [cityFilter, setCityFilter] = useState<"all" | "indore" | "outside_indore">("all");
  const [entityFilter, setEntityFilter] = useState<"all" | "jain_traders" | "padam_international" | "split">("all");
  const [accountingFilter, setAccountingFilter] = useState<"all" | "open" | "closed" | "payment_pending" | "ready_to_close">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Selection states for bulk actions
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Expandable row state
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Live Simulator state
  const [showSimulator, setShowSimulator] = useState(false);
  const [simCity, setSimCity] = useState("Bhopal");
  const [simLines, setSimLines] = useState<Array<{
    productName: string;
    routingClass: "LAXMI_TOOR" | "INSTANT_MIX" | "OTHER";
    quantity: number;
    caseWeightKg: number;
    routingBagEquivalent?: number;
    estimatedRate: number;
  }>>([
    { productName: "Gagan Basmati Rice Classic (30kg)", routingClass: "OTHER", quantity: 6, caseWeightKg: 30, routingBagEquivalent: 1, estimatedRate: 2100 },
    { productName: "Gagan Gulab Jamun Instant Mix (1kg x 20)", routingClass: "INSTANT_MIX", quantity: 1, caseWeightKg: 20, estimatedRate: 1800 },
    { productName: "Laxmi Toor Dal Premium (30kg)", routingClass: "LAXMI_TOOR", quantity: 2, caseWeightKg: 30, estimatedRate: 4200 },
  ]);
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  // Payment Recording Modal State
  const [paymentModalOrder, setPaymentModalOrder] = useState<AuditedOrder | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentBankAccount, setPaymentBankAccount] = useState<string>("HDFC_JAIN");
  const [paymentMode, setPaymentMode] = useState<string>("NEFT_RTGS");
  const [paymentReference, setPaymentReference] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState<string>("");
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  // Edit Order Modal State
  const [editModalOrder, setEditModalOrder] = useState<AuditedOrder | null>(null);
  const [editLines, setEditLines] = useState<Array<{
    orderItemId?: string;
    variantId: string;
    productName: string;
    pack: string;
    cases: number;
    unitPrice: number;
    total: number;
  }>>([]);
  const [editFreight, setEditFreight] = useState<number>(0);
  const [editRemarks, setEditRemarks] = useState<string>("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Calculate actual date boundaries based on preset
  const dateParams = useMemo(() => {
    const now = new Date();
    if (datePreset === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      return { from: start, to: now.toISOString() };
    }
    if (datePreset === "week") {
      const first = now.getDate() - now.getDay();
      const start = new Date(now.setDate(first)).toISOString();
      return { from: start, to: new Date().toISOString() };
    }
    if (datePreset === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      return { from: start, to: new Date().toISOString() };
    }
    if (datePreset === "custom") {
      return {
        from: customFrom ? new Date(customFrom).toISOString() : undefined,
        to: customTo ? new Date(customTo).toISOString() : undefined,
      };
    }
    return {};
  }, [datePreset, customFrom, customTo]);

  // Load audit data
  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const res: any = await api.entityBillingAudit({
        from: dateParams.from,
        to: dateParams.to,
        city: cityFilter,
        entity: entityFilter,
        q: searchQuery,
      });
      setSummary(res.summary);
      setOrders(res.orders || []);
      setSelectedOrderIds([]);
    } catch (err: any) {
      setError(err?.message || "Failed to load billing audit data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [dateParams, cityFilter, entityFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void loadData();
  };

  // Run Simulator
  const runSimulator = async () => {
    setSimLoading(true);
    try {
      const res: any = await api.simulateEntityRouting({
        destinationCity: simCity,
        lines: simLines.map((l, i) => ({
          variantId: `sim-var-${i}`,
          productName: l.productName,
          routingClass: l.routingClass,
          quantity: Number(l.quantity),
          caseWeightKg: Number(l.caseWeightKg),
          routingBagEquivalent: l.routingBagEquivalent,
          estimatedRate: Number(l.estimatedRate),
        })),
      });
      setSimResult(res.plan);
    } catch (err: any) {
      alert("Simulator error: " + (err?.message || String(err)));
    } finally {
      setSimLoading(false);
    }
  };

  // Accounting Actions
  const handleAcceptOrder = async (order: AuditedOrder) => {
    if (!window.confirm(`Accept and commercially confirm order ${formatOrderRef(order)} for ${order.retailerName}?`)) return;
    try {
      await api.approve(order.id);
      setActionMessage(`Order ${formatOrderRef(order)} accepted & confirmed successfully.`);
      setTimeout(() => setActionMessage(""), 5000);
      void loadData();
    } catch (err: any) {
      alert("Failed to accept order: " + (err?.message || String(err)));
    }
  };

  const handleCancelOrder = async (order: AuditedOrder) => {
    const reason = window.prompt(`Enter accounting/commercial reason to cancel order ${formatOrderRef(order)}:`, "Cancelled by accounts review");
    if (!reason) return;
    try {
      await api.reject(order.id, reason);
      setActionMessage(`Order ${formatOrderRef(order)} has been cancelled.`);
      setTimeout(() => setActionMessage(""), 5000);
      void loadData();
    } catch (err: any) {
      alert("Failed to cancel order: " + (err?.message || String(err)));
    }
  };

  const handleCloseSingleAccounting = async (order: AuditedOrder) => {
    const notes = window.prompt(`Close order ${formatOrderRef(order)} for accounting audit? Optional notes:`, "Audited and verified in books");
    if (notes === null) return;
    try {
      await api.closeOrderAccounting(order.id, notes);
      setActionMessage(`Order ${formatOrderRef(order)} successfully 🔒 Closed for Accounting.`);
      setTimeout(() => setActionMessage(""), 5000);
      void loadData();
    } catch (err: any) {
      alert("Failed to close order for accounting: " + (err?.message || String(err)));
    }
  };

  const handleBulkCloseAccounting = async () => {
    if (!selectedOrderIds.length) return;
    if (!window.confirm(`Close ${selectedOrderIds.length} selected orders for accounting? These orders will be stamped as audited and locked in the books.`)) return;
    setBulkProcessing(true);
    try {
      await api.bulkCloseAccounting(selectedOrderIds, "Batch audited and finalized by Accounts Team");
      setActionMessage(`Successfully closed ${selectedOrderIds.length} orders for accounting.`);
      setTimeout(() => setActionMessage(""), 5000);
      setSelectedOrderIds([]);
      void loadData();
    } catch (err: any) {
      alert("Failed to bulk close orders: " + (err?.message || String(err)));
    } finally {
      setBulkProcessing(false);
    }
  };

  // Payment Recording Handlers
  const openPaymentModal = (order: AuditedOrder) => {
    setPaymentModalOrder(order);
    setPaymentAmount(order.totalOutstanding > 0 ? order.totalOutstanding : order.grandTotal);
    setPaymentBankAccount(order.destination === "INDORE_CITY" || order.jain.total >= order.padam.total ? "HDFC_JAIN" : "ICICI_PADAM");
    setPaymentReference(`UTR-${Math.floor(100000 + Math.random() * 900000)}`);
    setPaymentNotes(`Payment for Order ${formatOrderRef(order)}`);
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalOrder || !paymentModalOrder.retailerId) return;
    if (paymentAmount <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }
    setPaymentSubmitting(true);
    try {
      const idempotencyKey = `pay-${paymentModalOrder.id}-${Date.now()}`;
      await api.recordPayment(
        paymentModalOrder.retailerId,
        paymentAmount,
        idempotencyKey,
        {
          paymentMode,
          reference: paymentReference,
          bankAccount: paymentBankAccount,
          notes: paymentNotes,
          invoiceScopeId: paymentModalOrder.invoiceNumber ? String(paymentModalOrder.invoiceNumber) : undefined,
        }
      );
      setActionMessage(`Recorded ₹${paymentAmount} payment for ${paymentModalOrder.retailerName} successfully.`);
      setTimeout(() => setActionMessage(""), 5000);
      setPaymentModalOrder(null);
      void loadData();
    } catch (err: any) {
      alert("Payment recording failed: " + (err?.message || String(err)));
    } finally {
      setPaymentSubmitting(false);
    }
  };

  // Order Editing Handlers
  const openEditModal = (order: AuditedOrder) => {
    setEditModalOrder(order);
    const combinedLines = [...order.jain.lines, ...order.padam.lines].map((l) => ({
      orderItemId: l.orderItemId,
      variantId: l.variantId,
      productName: l.productName,
      pack: l.pack,
      cases: l.cases,
      unitPrice: l.rate,
      total: l.total,
    }));
    setEditLines(combinedLines);
    setEditFreight(order.jain.freight + order.padam.freight);
    setEditRemarks(order.accountingNotes || "");
  };

  const handleLineQtyChange = (idx: number, qty: number) => {
    const updated = [...editLines];
    updated[idx].cases = qty;
    updated[idx].total = Math.round(qty * updated[idx].unitPrice * 100) / 100;
    setEditLines(updated);
  };

  const handleLinePriceChange = (idx: number, price: number) => {
    const updated = [...editLines];
    updated[idx].unitPrice = price;
    updated[idx].total = Math.round(updated[idx].cases * price * 100) / 100;
    setEditLines(updated);
  };

  const computedEditSubtotal = editLines.reduce((sum, l) => sum + (l.cases * l.unitPrice), 0);
  const computedEditGst = Math.round(computedEditSubtotal * 0.05 * 100) / 100;
  const computedEditGrandTotal = Math.round((computedEditSubtotal + computedEditGst + Number(editFreight || 0)) * 100) / 100;

  const handleSaveEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalOrder) return;
    setEditSubmitting(true);
    try {
      await api.editOrder(editModalOrder.id, {
        freightAmount: Number(editFreight),
        remarks: editRemarks,
        items: editLines.map((l) => ({
          orderItemId: l.orderItemId,
          variantId: l.variantId,
          qtyOrdered: l.cases,
          unitPrice: l.unitPrice,
        })),
      });
      setActionMessage(`Order ${formatOrderRef(editModalOrder)} successfully updated with new commercial rates and totals.`);
      setTimeout(() => setActionMessage(""), 5000);
      setEditModalOrder(null);
      void loadData();
    } catch (err: any) {
      alert("Failed to update order: " + (err?.message || String(err)));
    } finally {
      setEditSubmitting(false);
    }
  };

  // Filter orders based on accounting status filter
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (accountingFilter === "open") return o.accountingStatus !== "closed";
      if (accountingFilter === "closed") return o.accountingStatus === "closed";
      if (accountingFilter === "payment_pending") return o.totalOutstanding > 0;
      if (accountingFilter === "ready_to_close") return o.totalOutstanding === 0 && o.accountingStatus !== "closed";
      return true;
    });
  }, [orders, accountingFilter]);

  // Selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedOrderIds(filteredOrders.map((o) => o.id));
    } else {
      setSelectedOrderIds([]);
    }
  };

  const handleToggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Export to CSV
  const exportToCsv = () => {
    if (!filteredOrders.length) return;
    const headers = [
      "Order Ref",
      "Order Date",
      "Retailer Name",
      "Delivery City",
      "Destination Zone",
      "Split Order?",
      "Jain Total (INR)",
      "Padam Total (INR)",
      "Grand Total (INR)",
      "Paid (INR)",
      "Outstanding (INR)",
      "Payment Status",
      "Accounting Status",
      "Closed By",
      "Routing Reason",
    ];

    const rows = filteredOrders.map((o) => [
      formatOrderRef(o),
      new Date(o.createdAt).toLocaleDateString("en-IN"),
      `"${o.retailerName.replace(/"/g, '""')}"`,
      `"${o.deliveryCity.replace(/"/g, '""')}"`,
      o.destination === "INDORE_CITY" ? "Indore City" : "Outside Indore",
      o.isSplit ? "YES" : "NO",
      o.jain.total.toFixed(2),
      o.padam.total.toFixed(2),
      o.grandTotal.toFixed(2),
      o.totalPaid.toFixed(2),
      o.totalOutstanding.toFixed(2),
      o.totalOutstanding === 0 ? "PAID_FULL" : o.totalPaid > 0 ? "PARTIAL" : "UNPAID",
      o.accountingStatus === "closed" ? "CLOSED" : "OPEN",
      o.accountingClosedBy || "",
      `"${o.explanation.replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Gagan_Billing_Entities_Audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Percent shares
  const jainShare = summary && summary.totalRevenue > 0
    ? Math.round((summary.jain.totalRevenue / summary.totalRevenue) * 100)
    : 0;
  const padamShare = summary && summary.totalRevenue > 0
    ? Math.round((summary.padam.totalRevenue / summary.totalRevenue) * 100)
    : 0;

  const totalBagsAll = (summary?.jain.totalBags ?? 0) + (summary?.padam.totalBags ?? 0);
  const jainBagShare = totalBagsAll > 0 ? Math.round(((summary?.jain.totalBags ?? 0) / totalBagsAll) * 100) : 0;
  const padamBagShare = totalBagsAll > 0 ? Math.round(((summary?.padam.totalBags ?? 0) / totalBagsAll) * 100) : 0;

  return (
    <div className="main-content" style={{ padding: "24px 32px", maxWidth: 1440, margin: "0 auto" }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: "var(--ink)" }}>
              Billing Entities &amp; Accounting Audit
            </h1>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", background: "#fef3c7", color: "#92400e", borderRadius: 4, border: "1px solid #fde68a" }}>
              JAIN TRADERS vs PADAM INT.
            </span>
          </div>
          <p style={{ margin: "6px 0 0", color: "var(--ink-muted)", fontSize: 13.5 }}>
            Full accounting suite: order review, rate edit, payment checking &amp; recording, one-click closure for books, and P&amp;L balance sheet generation.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link
            to="/financial-statements"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
              padding: "7px 16px",
              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
              color: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 2px 4px rgba(2, 132, 199, 0.2)",
            }}
          >
            <span>📊</span> P&amp;L &amp; Balance Sheet
          </Link>
          <button
            type="button"
            className="secondary"
            onClick={() => setShowSimulator(!showSimulator)}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
          >
            <span>🧪</span> {showSimulator ? "Hide Simulator" : "Routing Simulator"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={exportToCsv}
            disabled={!filteredOrders.length}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
          >
            <span>📥</span> Export CSV
          </button>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
          >
            <span>🔄</span> Refresh
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {actionMessage && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 16px", marginBottom: 16, color: "#166534", fontSize: 13, fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>✅ {actionMessage}</span>
          <button type="button" onClick={() => setActionMessage("")} style={{ background: "none", border: "none", color: "#166534", cursor: "pointer", fontSize: 14 }}>✕</button>
        </div>
      )}

      {/* Accounting Quick Stats Bar */}
      {summary && (
        <div style={{
          background: "#ffffff",
          borderRadius: 10,
          border: "1px solid var(--border)",
          padding: "12px 20px",
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}>
          <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <div>
              <span style={{ fontSize: 11, color: "var(--ink-muted)", fontWeight: 600, textTransform: "uppercase" }}>Total Commercial Flow</span>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>{inr(summary.totalRevenue)}</div>
            </div>
            <div style={{ width: 1, height: 28, background: "#e2e8f0" }}></div>
            <div>
              <span style={{ fontSize: 11, color: "#166534", fontWeight: 600, textTransform: "uppercase" }}>Total Collected Inflow</span>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#15803d" }}>
                {inr(summary.jain.paymentsCollected + summary.padam.paymentsCollected)}
              </div>
            </div>
            <div style={{ width: 1, height: 28, background: "#e2e8f0" }}></div>
            <div>
              <span style={{ fontSize: 11, color: "#9a3412", fontWeight: 600, textTransform: "uppercase" }}>Total Outstanding Dues</span>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#c2410c" }}>
                {inr(summary.jain.outstandingAmount + summary.padam.outstandingAmount)}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              color: "#166534",
              padding: "4px 12px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}>
              <span>🔒</span> Closed for Accounting: {summary.accountingClosedOrdersCount ?? orders.filter((o) => o.accountingStatus === "closed").length}
            </span>
            <span style={{
              background: "#fffbeb",
              border: "1px solid #fde68a",
              color: "#92400e",
              padding: "4px 12px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}>
              <span>📝</span> Open / Pending Audit: {summary.accountingOpenOrdersCount ?? orders.filter((o) => o.accountingStatus !== "closed").length}
            </span>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div style={{ background: "#ffffff", padding: "14px 18px", borderRadius: 10, border: "1px solid var(--border)", marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", justifyContent: "space-between" }}>
        {/* Date presets */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", marginRight: 4 }}>Period:</span>
          {(["all", "today", "week", "month", "custom"] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={datePreset === p ? "" : "secondary"}
              style={{ fontSize: 12, padding: "4px 10px", borderRadius: 20 }}
              onClick={() => setDatePreset(p)}
            >
              {p === "all" ? "All Time" : p === "today" ? "Today" : p === "week" ? "This Week" : p === "month" ? "This Month" : "Custom Range"}
            </button>
          ))}
          {datePreset === "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                style={{ padding: "3px 8px", fontSize: 12, width: 130 }}
              />
              <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                style={{ padding: "3px 8px", fontSize: 12, width: 130 }}
              />
              <button type="button" className="sm" onClick={loadData}>Apply</button>
            </div>
          )}
        </div>

        {/* Zone, Entity & Accounting Dropdowns */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted)" }}>Zone:</span>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value as any)}
              style={{ fontSize: 12, padding: "4px 8px", width: 130 }}
            >
              <option value="all">All Destinations</option>
              <option value="indore">Indore City Only</option>
              <option value="outside_indore">Outside Indore Only</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted)" }}>Entity:</span>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value as any)}
              style={{ fontSize: 12, padding: "4px 8px", width: 160 }}
            >
              <option value="all">All Entities &amp; Splits</option>
              <option value="jain_traders">Jain Traders Only</option>
              <option value="padam_international">Padam International Only</option>
              <option value="split">⚡ Split Orders Only</option>
            </select>
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="text"
              placeholder="Search retailer, city, ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ fontSize: 12, padding: "4px 8px", width: 170 }}
            />
            <button type="submit" className="secondary sm">Search</button>
          </form>
        </div>
      </div>

      {/* Simulator Panel (Collapsible) */}
      {showSimulator && (
        <div style={{ background: "#f8fafc", border: "1.5px dashed #94a3b8", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: 8 }}>
              <span>🧪</span> Interactive Routing Policy Simulator
            </h3>
            <span style={{ fontSize: 12, color: "#64748b" }}>Rule Version: <strong>jain-padam-v2</strong></span>
          </div>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#475569" }}>
            Test how any combination of products and destination city is routed by the core engine before order punch.
          </p>

          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            <div style={{ width: 220 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>
                Delivery Destination City:
              </label>
              <input
                type="text"
                value={simCity}
                onChange={(e) => setSimCity(e.target.value)}
                placeholder="e.g. Bhopal, Indore, Jabalpur..."
                style={{ padding: "6px 10px", fontSize: 13 }}
              />
              <small style={{ color: "#64748b", fontSize: 11, marginTop: 2, display: "block" }}>
                "Indore" triggers 100% Jain override.
              </small>
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>
                Simulated Products in Basket:
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {simLines.map((line, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 10, alignItems: "center", background: "#ffffff", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1" }}>
                    <div style={{ flex: 2 }}>
                      <input
                        type="text"
                        value={line.productName}
                        onChange={(e) => {
                          const updated = [...simLines];
                          updated[idx].productName = e.target.value;
                          setSimLines(updated);
                        }}
                        style={{ fontSize: 12, padding: "4px 8px" }}
                      />
                    </div>
                    <div style={{ flex: 1.5 }}>
                      <select
                        value={line.routingClass}
                        onChange={(e) => {
                          const updated = [...simLines];
                          updated[idx].routingClass = e.target.value as any;
                          setSimLines(updated);
                        }}
                        style={{ fontSize: 12, padding: "4px 6px" }}
                      >
                        <option value="OTHER">OTHER (Rice / 1 Bag Eq)</option>
                        <option value="INSTANT_MIX">INSTANT_MIX (5kg = 1 Bag)</option>
                        <option value="LAXMI_TOOR">LAXMI_TOOR (Always Jain)</option>
                      </select>
                    </div>
                    <div style={{ width: 90 }}>
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={line.quantity}
                        onChange={(e) => {
                          const updated = [...simLines];
                          updated[idx].quantity = Number(e.target.value);
                          setSimLines(updated);
                        }}
                        style={{ fontSize: 12, padding: "4px 8px" }}
                      />
                    </div>
                    <div style={{ width: 110 }}>
                      <input
                        type="number"
                        min="1"
                        placeholder="Weight (kg)"
                        value={line.caseWeightKg}
                        onChange={(e) => {
                          const updated = [...simLines];
                          updated[idx].caseWeightKg = Number(e.target.value);
                          setSimLines(updated);
                        }}
                        style={{ fontSize: 12, padding: "4px 8px" }}
                      />
                    </div>
                    <button
                      type="button"
                      className="danger sm"
                      onClick={() => setSimLines(simLines.filter((_, i) => i !== idx))}
                      style={{ padding: "4px 8px" }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="secondary sm"
                  onClick={() => setSimLines([...simLines, { productName: "New Rice / Item", routingClass: "OTHER", quantity: 5, caseWeightKg: 30, routingBagEquivalent: 1, estimatedRate: 2000 }])}
                >
                  + Add Item
                </button>
                <button
                  type="button"
                  onClick={runSimulator}
                  disabled={simLoading || !simLines.length}
                  style={{ background: "#0284c7", color: "#fff", fontSize: 12, padding: "4px 14px" }}
                >
                  {simLoading ? "Simulating…" : "Run Simulation ⚡"}
                </button>
              </div>
            </div>
          </div>

          {/* Simulation Output */}
          {simResult && (
            <div style={{ background: "#ffffff", padding: 16, borderRadius: 8, border: "1px solid #93c5fd", marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: 10, marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", textTransform: "uppercase" }}>Simulation Result</span>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginTop: 2 }}>
                    Destination: {simResult.destinationCity} ({simResult.destination === "INDORE_CITY" ? "Local Indore" : "Outside Indore"})
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "#64748b" }}>Eligible Bags Counted</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: Number(simResult.eligibleContributionBags) >= 5 ? "#16a34a" : "#d97706" }}>
                    {simResult.eligibleContributionBags} / 5.00 Bags
                  </div>
                </div>
              </div>

              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "10px 14px", borderRadius: 6, fontSize: 13, color: "#166534", marginBottom: 14 }}>
                <strong>Routing Rule Applied:</strong> {simResult.explanation}
              </div>

              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                    <th style={{ padding: "6px 10px" }}>Item</th>
                    <th style={{ padding: "6px 10px" }}>Class</th>
                    <th style={{ padding: "6px 10px" }}>Qty / Weight</th>
                    <th style={{ padding: "6px 10px" }}>Bags Contribution</th>
                    <th style={{ padding: "6px 10px" }}>Routed Billing Company</th>
                    <th style={{ padding: "6px 10px" }}>Reason Code</th>
                  </tr>
                </thead>
                <tbody>
                  {simResult.lines.map((l: any, i: number) => {
                    const originalLine = simLines[i] || {};
                    const isPadam = l.entity === "padam_international";
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "6px 10px", fontWeight: 600 }}>{originalLine.productName || l.variantId}</td>
                        <td style={{ padding: "6px 10px" }}>{l.routingClass}</td>
                        <td style={{ padding: "6px 10px" }}>{originalLine.quantity} cases · {originalLine.caseWeightKg * originalLine.quantity} kg</td>
                        <td style={{ padding: "6px 10px" }}>{l.contributionBags ? `${l.contributionBags} bags` : "— (excluded)"}</td>
                        <td style={{ padding: "6px 10px" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "3px 8px",
                            borderRadius: 4,
                            fontWeight: 700,
                            fontSize: 11,
                            background: isPadam ? "#f3e8ff" : "#e0f2fe",
                            color: isPadam ? "#7e22ce" : "#0369a1",
                            border: `1px solid ${isPadam ? "#d8b4fe" : "#bae6fd"}`,
                          }}>
                            {isPadam ? "🌐 Padam International" : "🏢 Jain Traders"}
                          </span>
                        </td>
                        <td style={{ padding: "6px 10px", color: "#64748b", fontFamily: "monospace", fontSize: 11 }}>{l.reason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Infographics: Money Flow & Entity Comparisons */}
      {summary && (
        <div style={{ marginBottom: 24 }}>
          {/* Top Big Comparison Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 16 }}>
            {/* Jain Traders Card */}
            <div style={{
              background: "#ffffff",
              borderRadius: 12,
              border: "1.5px solid #bfdbfe",
              boxShadow: "0 2px 6px rgba(3, 105, 161, 0.06)",
              overflow: "hidden",
            }}>
              <div style={{ background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)", padding: "16px 20px", color: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, opacity: 0.9, fontWeight: 700 }}>
                    Domestic &amp; Local Operating Company
                  </div>
                  <h2 style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 800 }}>
                    🏢 Jain Traders
                  </h2>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ background: "rgba(255,255,255,0.2)", padding: "4px 10px", borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                    {jainShare}% of Total Flow
                  </span>
                </div>
              </div>

              <div style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
                  <div>
                    <span style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 600 }}>Total Billed Revenue</span>
                    <div style={{ fontSize: 26, fontWeight: 800, color: "#0369a1", marginTop: 2 }}>
                      {inr(summary.jain.totalRevenue)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 600 }}>Volume</span>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>
                      {summary.jain.totalBags} Bags <span style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 500 }}>({summary.jain.ordersCount} orders)</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, background: "#f8fafc", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", marginBottom: 14 }}>
                  <div>
                    <span style={{ fontSize: 11, color: "#64748b" }}>Goods Base</span>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b", marginTop: 2 }}>{inr(summary.jain.goodsValue)}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "#64748b" }}>GST / Tax</span>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b", marginTop: 2 }}>{inr(summary.jain.gstAmount)}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "#64748b" }}>Freight</span>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b", marginTop: 2 }}>{inr(summary.jain.freightAmount)}</div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0", marginBottom: 14 }}>
                  <div>
                    <span style={{ fontSize: 11, color: "#166534", fontWeight: 600 }}>Cash &amp; Bank Inflow (Collected)</span>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#15803d" }}>{inr(summary.jain.paymentsCollected)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 11, color: "#9a3412", fontWeight: 600 }}>Outstanding Balance</span>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#c2410c" }}>{inr(summary.jain.outstandingAmount)}</div>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>
                    Routing Reasons (Why money routed to Jain)
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    <span style={{ fontSize: 11, padding: "3px 8px", background: "#f1f5f9", borderRadius: 4, color: "#334155" }}>
                      🏙️ Indore City: <strong>{summary.jain.reasons.INDORE_CITY_OVERRIDE}</strong>
                    </span>
                    <span style={{ fontSize: 11, padding: "3px 8px", background: "#f1f5f9", borderRadius: 4, color: "#334155" }}>
                      🌾 Laxmi Dal: <strong>{summary.jain.reasons.LAXMI_ALWAYS_JAIN}</strong>
                    </span>
                    <span style={{ fontSize: 11, padding: "3px 8px", background: "#f1f5f9", borderRadius: 4, color: "#334155" }}>
                      📦 Below 5 Bags: <strong>{summary.jain.reasons.ELIGIBLE_THRESHOLD_LT_5_BAGS}</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Padam International Card */}
            <div style={{
              background: "#ffffff",
              borderRadius: 12,
              border: "1.5px solid #e9d5ff",
              boxShadow: "0 2px 6px rgba(126, 34, 206, 0.06)",
              overflow: "hidden",
            }}>
              <div style={{ background: "linear-gradient(135deg, #9333ea 0%, #7e22ce 100%)", padding: "16px 20px", color: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, opacity: 0.9, fontWeight: 700 }}>
                    Outstation &amp; Bulk Commercial Entity
                  </div>
                  <h2 style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 800 }}>
                    🌐 Padam International
                  </h2>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ background: "rgba(255,255,255,0.2)", padding: "4px 10px", borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                    {padamShare}% of Total Flow
                  </span>
                </div>
              </div>

              <div style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
                  <div>
                    <span style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 600 }}>Total Billed Revenue</span>
                    <div style={{ fontSize: 26, fontWeight: 800, color: "#7e22ce", marginTop: 2 }}>
                      {inr(summary.padam.totalRevenue)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 600 }}>Volume</span>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>
                      {summary.padam.totalBags} Bags <span style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 500 }}>({summary.padam.ordersCount} orders)</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, background: "#faf5ff", padding: "10px 12px", borderRadius: 8, border: "1px solid #f3e8ff", marginBottom: 14 }}>
                  <div>
                    <span style={{ fontSize: 11, color: "#6b21a8" }}>Goods Base</span>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b", marginTop: 2 }}>{inr(summary.padam.goodsValue)}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "#6b21a8" }}>GST / Tax</span>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b", marginTop: 2 }}>{inr(summary.padam.gstAmount)}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "#6b21a8" }}>Freight</span>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b", marginTop: 2 }}>{inr(summary.padam.freightAmount)}</div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0", marginBottom: 14 }}>
                  <div>
                    <span style={{ fontSize: 11, color: "#166534", fontWeight: 600 }}>Cash &amp; Bank Inflow (Collected)</span>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#15803d" }}>{inr(summary.padam.paymentsCollected)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 11, color: "#9a3412", fontWeight: 600 }}>Outstanding Balance</span>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#c2410c" }}>{inr(summary.padam.outstandingAmount)}</div>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>
                    Routing Reasons (Why money routed to Padam)
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    <span style={{ fontSize: 11, padding: "3px 8px", background: "#f3e8ff", borderRadius: 4, color: "#6b21a8" }}>
                      🚚 Outstation Bulk (≥ 5 Bags): <strong>{summary.padam.reasons.ELIGIBLE_THRESHOLD_GTE_5_BAGS}</strong>
                    </span>
                    <span style={{ fontSize: 11, padding: "3px 8px", background: "#f3e8ff", borderRadius: 4, color: "#6b21a8" }}>
                      📌 Fixed Master Rule: <strong>{summary.padam.reasons.FIXED_OR_OTHER}</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Visual Revenue Stream Bar */}
          <div style={{ background: "#ffffff", padding: "14px 18px", borderRadius: 10, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                Combined Revenue Distribution ({inr(summary.totalRevenue)})
              </span>
              <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#0284c7" }}></span>
                  Jain Traders: <strong>{inr(summary.jain.totalRevenue)} ({jainShare}%)</strong>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#9333ea" }}></span>
                  Padam International: <strong>{inr(summary.padam.totalRevenue)} ({padamShare}%)</strong>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6, background: "#fef3c7", padding: "2px 8px", borderRadius: 4, color: "#92400e", fontWeight: 600 }}>
                  ⚡ Split Orders: <strong>{summary.splitOrdersCount}</strong>
                </span>
              </div>
            </div>

            <div style={{ height: 14, borderRadius: 7, background: "#e2e8f0", display: "flex", overflow: "hidden", marginBottom: 6 }}>
              <div style={{ width: `${jainShare}%`, background: "#0284c7", transition: "width 0.4s ease" }} title={`Jain Traders: ${jainShare}%`}></div>
              <div style={{ width: `${padamShare}%`, background: "#9333ea", transition: "width 0.4s ease" }} title={`Padam International: ${padamShare}%`}></div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "var(--ink-muted)" }}>
              <span>Bag Volume Split: Jain Traders {summary.jain.totalBags} bags ({jainBagShare}%)</span>
              <span>Padam International {summary.padam.totalBags} bags ({padamBagShare}%)</span>
            </div>
          </div>
        </div>
      )}

      {/* Accounting Status Tabs & Bulk Action Controls */}
      <div style={{
        background: "#ffffff",
        borderRadius: "12px 12px 0 0",
        border: "1px solid var(--border)",
        borderBottom: "none",
        padding: "14px 20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
      }}>
        {/* Accounting Status Tabs */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {[
            { id: "all", label: `All Orders (${orders.length})` },
            { id: "payment_pending", label: `⏳ Payment Pending (${orders.filter((o) => o.totalOutstanding > 0).length})` },
            { id: "ready_to_close", label: `🟢 Settled & Ready (${orders.filter((o) => o.totalOutstanding === 0 && o.accountingStatus !== "closed").length})` },
            { id: "closed", label: `🔒 Closed for Books (${orders.filter((o) => o.accountingStatus === "closed").length})` },
            { id: "open", label: `📝 Open Audit (${orders.filter((o) => o.accountingStatus !== "closed").length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAccountingFilter(tab.id as any)}
              style={{
                fontSize: 12,
                padding: "5px 12px",
                borderRadius: 20,
                border: "1px solid",
                borderColor: accountingFilter === tab.id ? "#0284c7" : "#e2e8f0",
                background: accountingFilter === tab.id ? "#e0f2fe" : "#ffffff",
                color: accountingFilter === tab.id ? "#0369a1" : "#475569",
                fontWeight: accountingFilter === tab.id ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Bulk Action Controls */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {selectedOrderIds.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#eff6ff", padding: "4px 10px", borderRadius: 6, border: "1px solid #bfdbfe" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#1e40af" }}>
                {selectedOrderIds.length} orders selected
              </span>
              <button
                type="button"
                onClick={handleBulkCloseAccounting}
                disabled={bulkProcessing}
                style={{
                  background: "#16a34a",
                  color: "#ffffff",
                  border: "none",
                  padding: "5px 12px",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span>🔒</span> {bulkProcessing ? "Closing..." : `Close Selected for Accounting (${selectedOrderIds.length})`}
              </button>
              <button
                type="button"
                className="secondary sm"
                onClick={() => setSelectedOrderIds([])}
                style={{ fontSize: 11, padding: "3px 6px" }}
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Orders Accounting Table */}
      <div style={{ background: "#ffffff", borderRadius: "0 0 12px 12px", border: "1px solid var(--border)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--ink-muted)" }}>
            Loading audit details...
          </div>
        ) : error ? (
          <div style={{ padding: 30, textAlign: "center", color: "var(--danger)" }}>
            {error}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--ink-muted)" }}>
            No orders found matching the selected filters.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, tableLayout: "fixed" }}>
            <thead>
              <tr style={{ background: "var(--surface-alt)", textAlign: "left", color: "var(--ink-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                <th style={{ width: "3.5%", padding: "10px 8px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={selectedOrderIds.length === filteredOrders.length && filteredOrders.length > 0}
                    onChange={handleSelectAll}
                    title="Select / Deselect All Visible"
                  />
                </th>
                <th style={{ width: "13%", padding: "10px 12px" }}>Order / Invoice</th>
                <th style={{ width: "16%", padding: "10px 10px" }}>Retailer &amp; Zone</th>
                <th style={{ width: "11%", padding: "10px 10px", textAlign: "right" }}>Jain Amount</th>
                <th style={{ width: "11%", padding: "10px 10px", textAlign: "right" }}>Padam Amount</th>
                <th style={{ width: "9%", padding: "10px 10px", textAlign: "right" }}>Order Total</th>
                <th style={{ width: "13.5%", padding: "10px 10px", textAlign: "center" }}>Payment Status</th>
                <th style={{ width: "10.5%", padding: "10px 10px", textAlign: "center" }}>Accounting Audit</th>
                <th style={{ width: "12.5%", padding: "10px 10px", textAlign: "center" }}>Accounting Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => {
                const isExpanded = expandedOrderId === o.id;
                const isSelected = selectedOrderIds.includes(o.id);
                const hasJain = o.jain.total > 0;
                const hasPadam = o.padam.total > 0;
                const isIndore = o.destination === "INDORE_CITY";
                const isClosed = o.accountingStatus === "closed";
                const isPlaced = o.status === "placed";

                const isPaidFull = o.totalOutstanding === 0;
                const isPartial = o.totalPaid > 0 && o.totalOutstanding > 0;

                return (
                  <React.Fragment key={o.id}>
                    <tr style={{
                      borderBottom: "1px solid var(--border)",
                      background: isSelected ? "#eff6ff" : isExpanded ? "#f8fafc" : undefined,
                    }}>
                      {/* Checkbox */}
                      <td style={{ padding: "10px 8px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectOrder(o.id)}
                        />
                      </td>

                      {/* Order / Invoice */}
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ fontWeight: 800, color: "var(--ink)", fontSize: 13 }}>
                          {formatOrderRef(o)}
                        </div>
                        <div style={{ color: "var(--ink-muted)", fontSize: 11, marginTop: 1 }}>
                          {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          {o.invoiceNumber ? ` · Inv #${o.invoiceNumber}` : ""}
                        </div>
                        <div style={{ marginTop: 2 }}>
                          <span style={{
                            fontSize: 10,
                            padding: "1px 5px",
                            borderRadius: 3,
                            background: isPlaced ? "#fef3c7" : "#f1f5f9",
                            color: isPlaced ? "#b45309" : "#475569",
                            fontWeight: 600,
                            textTransform: "uppercase",
                          }}>
                            {o.status}
                          </span>
                        </div>
                      </td>

                      {/* Retailer & Zone */}
                      <td style={{ padding: "10px 10px" }}>
                        <div style={{ fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={o.retailerName}>
                          {o.retailerName}
                        </div>
                        <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 2 }}>
                          <span style={{ fontSize: 11, color: "var(--ink-muted)" }}>{o.deliveryCity || "Indore"}</span>
                          <span style={{
                            fontSize: 9.5,
                            fontWeight: 700,
                            padding: "1px 4px",
                            borderRadius: 3,
                            background: isIndore ? "#e0f2fe" : "#fef3c7",
                            color: isIndore ? "#0369a1" : "#92400e",
                          }}>
                            {isIndore ? "Indore" : "Outstation"}
                          </span>
                        </div>
                      </td>

                      {/* Jain Amount */}
                      <td style={{ padding: "10px 10px", textAlign: "right" }}>
                        {hasJain ? (
                          <div>
                            <span style={{ fontWeight: 700, color: "#0369a1", fontSize: 12.5 }}>{inr(o.jain.total)}</span>
                            <div style={{ fontSize: 10.5, color: "var(--ink-muted)" }}>
                              {o.jain.bags} bags
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>

                      {/* Padam Amount */}
                      <td style={{ padding: "10px 10px", textAlign: "right" }}>
                        {hasPadam ? (
                          <div>
                            <span style={{ fontWeight: 700, color: "#7e22ce", fontSize: 12.5 }}>{inr(o.padam.total)}</span>
                            <div style={{ fontSize: 10.5, color: "var(--ink-muted)" }}>
                              {o.padam.bags} bags
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>

                      {/* Order Total */}
                      <td style={{ padding: "10px 10px", textAlign: "right" }}>
                        <div style={{ fontWeight: 800, color: "var(--ink)", fontSize: 13 }}>
                          {inr(o.grandTotal)}
                        </div>
                        {o.isSplit && (
                          <span style={{ fontSize: 9.5, padding: "1px 4px", borderRadius: 3, background: "#fef3c7", color: "#b45309", fontWeight: 700 }}>
                            ⚡ SPLIT
                          </span>
                        )}
                      </td>

                      {/* Payment Status & Quick Record */}
                      <td style={{ padding: "10px 10px", textAlign: "center" }}>
                        <div style={{ marginBottom: 4 }}>
                          {isPaidFull ? (
                            <span style={{
                              display: "inline-block",
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 4,
                              background: "#dcfce7",
                              color: "#15803d",
                              border: "1px solid #bbf7d0",
                            }}>
                              🟢 Paid in Full
                            </span>
                          ) : isPartial ? (
                            <div>
                              <span style={{
                                display: "inline-block",
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 4,
                                background: "#fef9c3",
                                color: "#854d0e",
                                border: "1px solid #fef08a",
                              }}>
                                🟡 Partial ({inr(o.totalPaid)})
                              </span>
                              <div style={{ fontSize: 10, color: "#c2410c", fontWeight: 600, marginTop: 1 }}>
                                Due: {inr(o.totalOutstanding)}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span style={{
                                display: "inline-block",
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 4,
                                background: "#fee2e2",
                                color: "#991b1b",
                                border: "1px solid #fecaca",
                              }}>
                                🔴 Unpaid
                              </span>
                              <div style={{ fontSize: 10, color: "#991b1b", fontWeight: 600, marginTop: 1 }}>
                                Due: {inr(o.grandTotal)}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Quick Record Payment Button */}
                        <button
                          type="button"
                          onClick={() => openPaymentModal(o)}
                          style={{
                            fontSize: 10.5,
                            padding: "2px 6px",
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            color: "#0369a1",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          <span>💳</span> Record Pay
                        </button>
                      </td>

                      {/* Accounting Audit Status */}
                      <td style={{ padding: "10px 10px", textAlign: "center" }}>
                        {isClosed ? (
                          <div>
                            <span style={{
                              display: "inline-block",
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 4,
                              background: "#dcfce7",
                              color: "#166534",
                              border: "1px solid #86efac",
                            }}>
                              🔒 Closed for Books
                            </span>
                            {o.accountingClosedBy && (
                              <div style={{ fontSize: 9.5, color: "#64748b", marginTop: 2 }}>
                                by {o.accountingClosedBy}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span style={{
                              display: "inline-block",
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 4,
                              background: "#f1f5f9",
                              color: "#475569",
                              border: "1px solid #cbd5e1",
                            }}>
                              📝 Open Audit
                            </span>
                            <div style={{ marginTop: 4 }}>
                              <button
                                type="button"
                                onClick={() => handleCloseSingleAccounting(o)}
                                style={{
                                  fontSize: 10.5,
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                  border: "none",
                                  background: "#16a34a",
                                  color: "#ffffff",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                                title="Close and finalize for accounting"
                              >
                                🔒 Close
                              </button>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Accounting Actions */}
                      <td style={{ padding: "10px 10px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
                          {isPlaced && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleAcceptOrder(o)}
                                style={{
                                  fontSize: 10.5,
                                  padding: "2px 6px",
                                  borderRadius: 3,
                                  border: "none",
                                  background: "#0284c7",
                                  color: "#ffffff",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                                title="Accept commercial booking"
                              >
                                ✓ Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelOrder(o)}
                                style={{
                                  fontSize: 10.5,
                                  padding: "2px 6px",
                                  borderRadius: 3,
                                  border: "1px solid #fecaca",
                                  background: "#fff",
                                  color: "#dc2626",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                                title="Cancel order"
                              >
                                ✕
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => openEditModal(o)}
                            style={{
                              fontSize: 10.5,
                              padding: "2px 6px",
                              borderRadius: 3,
                              border: "1px solid #cbd5e1",
                              background: "#ffffff",
                              color: "#334155",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                            title="Edit lines, rates or freight"
                          >
                            ✏️ Edit
                          </button>

                          <button
                            type="button"
                            className="secondary sm"
                            onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}
                            style={{ fontSize: 10.5, padding: "2px 6px" }}
                            title="Inspect item breakdown"
                          >
                            {isExpanded ? "▲" : "▼"}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Line Items Details */}
                    {isExpanded && (
                      <tr style={{ background: "#f8fafc" }}>
                        <td colSpan={9} style={{ padding: "16px 20px" }}>
                          <div style={{ display: "grid", gridTemplateColumns: hasJain && hasPadam ? "1fr 1fr" : "1fr", gap: 16 }}>
                            {/* Jain lines */}
                            {hasJain && (
                              <div style={{ background: "#ffffff", padding: "12px 16px", borderRadius: 8, border: "1px solid #bfdbfe" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, borderBottom: "1px solid #e0f2fe", paddingBottom: 6 }}>
                                  <strong style={{ color: "#0369a1", fontSize: 13 }}>🏢 Jain Traders Line Items</strong>
                                  <span style={{ fontWeight: 700, color: "#0369a1", fontSize: 13 }}>{inr(o.jain.total)}</span>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  {o.jain.lines.map((jl, idx) => (
                                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#334155" }}>
                                      <div>
                                        <span style={{ fontWeight: 600 }}>{jl.productName}</span> ({jl.pack}) · <span style={{ color: "#64748b" }}>{jl.cases} cases</span>
                                        <div style={{ fontSize: 10, color: "#0284c7" }}>Rule: {jl.reason}</div>
                                      </div>
                                      <div style={{ textAlign: "right", fontWeight: 600 }}>
                                        {inr(jl.total)}
                                        <div style={{ fontSize: 10, color: "#64748b" }}>Base ₹{jl.base} + GST ₹{jl.gst}</div>
                                      </div>
                                    </div>
                                  ))}
                                  {o.jain.freight > 0 && (
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#334155", paddingTop: 4, borderTop: "1px dashed #e2e8f0" }}>
                                      <span>Freight (Jain Traders)</span>
                                      <strong>{inr(o.jain.freight)}</strong>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Padam lines */}
                            {hasPadam && (
                              <div style={{ background: "#ffffff", padding: "12px 16px", borderRadius: 8, border: "1px solid #e9d5ff" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, borderBottom: "1px solid #f3e8ff", paddingBottom: 6 }}>
                                  <strong style={{ color: "#7e22ce", fontSize: 13 }}>🌐 Padam International Line Items</strong>
                                  <span style={{ fontWeight: 700, color: "#7e22ce", fontSize: 13 }}>{inr(o.padam.total)}</span>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  {o.padam.lines.map((pl, idx) => (
                                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#334155" }}>
                                      <div>
                                        <span style={{ fontWeight: 600 }}>{pl.productName}</span> ({pl.pack}) · <span style={{ color: "#64748b" }}>{pl.cases} cases</span>
                                        <div style={{ fontSize: 10, color: "#9333ea" }}>Rule: {pl.reason}</div>
                                      </div>
                                      <div style={{ textAlign: "right", fontWeight: 600 }}>
                                        {inr(pl.total)}
                                        <div style={{ fontSize: 10, color: "#64748b" }}>Base ₹{pl.base} + GST ₹{pl.gst}</div>
                                      </div>
                                    </div>
                                  ))}
                                  {o.padam.freight > 0 && (
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#334155", paddingTop: 4, borderTop: "1px dashed #e2e8f0" }}>
                                      <span>Freight (Padam International)</span>
                                      <strong>{inr(o.padam.freight)}</strong>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL 1: Record Payment Modal */}
      {paymentModalOrder && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(15, 23, 42, 0.6)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
          padding: 20,
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: 12,
            width: "100%",
            maxWidth: 500,
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            overflow: "hidden",
          }}>
            <div style={{ padding: "16px 20px", background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)", color: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>💳 Record Payment Receipt</h3>
                <span style={{ fontSize: 12, opacity: 0.9 }}>Order {formatOrderRef(paymentModalOrder)} · {paymentModalOrder.retailerName}</span>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalOrder(null)}
                style={{ background: "transparent", border: "none", color: "#ffffff", fontSize: 18, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} style={{ padding: 20 }}>
              <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "#64748b" }}>Order Grand Total:</span>
                  <strong style={{ color: "#1e293b" }}>{inr(paymentModalOrder.grandTotal)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "#64748b" }}>Currently Paid:</span>
                  <span style={{ color: "#15803d", fontWeight: 600 }}>{inr(paymentModalOrder.totalPaid)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderTop: "1px dashed #cbd5e1", paddingTop: 4 }}>
                  <span style={{ color: "#9a3412", fontWeight: 700 }}>Outstanding Balance Due:</span>
                  <strong style={{ color: "#c2410c", fontSize: 14 }}>{inr(paymentModalOrder.totalOutstanding)}</strong>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#334155", display: "block", marginBottom: 4 }}>
                  Amount Received (₹):
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 12px", fontSize: 14, fontWeight: 700 }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#334155", display: "block", marginBottom: 4 }}>
                  Deposited To Bank Account:
                </label>
                <select
                  value={paymentBankAccount}
                  onChange={(e) => setPaymentBankAccount(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", fontSize: 13 }}
                >
                  <option value="HDFC_JAIN">🏢 Jain Traders - HDFC Bank (A/c #50200049281729)</option>
                  <option value="ICICI_PADAM">🌐 Padam International - ICICI Bank (A/c #003505019283)</option>
                  <option value="CASH_IN_HAND">💵 Cash in Hand / Counter Collection</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#334155", display: "block", marginBottom: 4 }}>
                    Payment Mode:
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", fontSize: 13 }}
                  >
                    <option value="NEFT_RTGS">NEFT / RTGS / IMPS</option>
                    <option value="UPI">UPI / QR Transfer</option>
                    <option value="CHEQUE">Bank Cheque</option>
                    <option value="CASH">Cash</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#334155", display: "block", marginBottom: 4 }}>
                    Reference / UTR No:
                  </label>
                  <input
                    type="text"
                    required
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="e.g. UTR-982319"
                    style={{ width: "100%", padding: "8px 10px", fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#334155", display: "block", marginBottom: 4 }}>
                  Notes / Accounting Narration:
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Full settlement against Invoice"
                  style={{ width: "100%", padding: "8px 10px", fontSize: 13 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setPaymentModalOrder(null)}
                  disabled={paymentSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentSubmitting}
                  style={{ background: "#16a34a", color: "#ffffff", fontWeight: 700, padding: "8px 18px", border: "none", borderRadius: 6 }}
                >
                  {paymentSubmitting ? "Posting..." : "Confirm & Post Payment Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Order Modal */}
      {editModalOrder && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(15, 23, 42, 0.6)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
          padding: 20,
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: 12,
            width: "100%",
            maxWidth: 750,
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            overflow: "hidden",
          }}>
            <div style={{ padding: "16px 20px", background: "#1e293b", color: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>✏️ Edit Commercial Order &amp; Rates</h3>
                <span style={{ fontSize: 12, opacity: 0.9 }}>Order {formatOrderRef(editModalOrder)} · {editModalOrder.retailerName}</span>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOrder(null)}
                style={{ background: "transparent", border: "none", color: "#ffffff", fontSize: 18, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditSubmit} style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              <div style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>
                  Order Line Items:
                </span>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                      <th style={{ padding: "6px 10px" }}>Product &amp; Pack</th>
                      <th style={{ padding: "6px 10px", width: 110 }}>Qty (Cases)</th>
                      <th style={{ padding: "6px 10px", width: 130 }}>Unit Price (₹)</th>
                      <th style={{ padding: "6px 10px", textAlign: "right", width: 120 }}>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editLines.map((line, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "8px 10px" }}>
                          <strong>{line.productName}</strong>
                          <div style={{ fontSize: 11, color: "#64748b" }}>{line.pack}</div>
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          <input
                            type="number"
                            min="1"
                            value={line.cases}
                            onChange={(e) => handleLineQtyChange(idx, Number(e.target.value))}
                            style={{ width: "100%", padding: "4px 8px", fontSize: 12 }}
                          />
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.unitPrice}
                            onChange={(e) => handleLinePriceChange(idx, Number(e.target.value))}
                            style={{ width: "100%", padding: "4px 8px", fontSize: 12 }}
                          />
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700 }}>
                          {inr(line.cases * line.unitPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#334155", display: "block", marginBottom: 4 }}>
                    Freight Amount (₹):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editFreight}
                    onChange={(e) => setEditFreight(Number(e.target.value))}
                    style={{ width: "100%", padding: "6px 10px", fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#334155", display: "block", marginBottom: 4 }}>
                    Accounting Remarks:
                  </label>
                  <input
                    type="text"
                    value={editRemarks}
                    onChange={(e) => setEditRemarks(e.target.value)}
                    placeholder="e.g. Revised rate per commercial agreement"
                    style={{ width: "100%", padding: "6px 10px", fontSize: 13 }}
                  />
                </div>
              </div>

              {/* Live Recalculated Order Summary */}
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "12px 16px", borderRadius: 8, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span>Goods Subtotal:</span>
                  <strong>{inr(computedEditSubtotal)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span>Freight Amount:</span>
                  <strong>{inr(Number(editFreight || 0))}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span>Estimated GST (5%):</span>
                  <strong>{inr(computedEditGst)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, borderTop: "1px dashed #86efac", paddingTop: 4 }}>
                  <strong style={{ color: "#166534" }}>New Grand Total:</strong>
                  <strong style={{ color: "#166534", fontSize: 16 }}>{inr(computedEditGrandTotal)}</strong>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditModalOrder(null)}
                  disabled={editSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  style={{ background: "#0284c7", color: "#ffffff", fontWeight: 700, padding: "8px 18px", border: "none", borderRadius: 6 }}
                >
                  {editSubmitting ? "Saving..." : "Save Changes & Recalculate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
