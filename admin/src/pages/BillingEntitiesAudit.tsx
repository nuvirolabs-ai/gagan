import React, { useEffect, useState, useMemo } from "react";
import { api, inr } from "../api";
import { formatOrderRef } from "../orderRef";

type AuditedLine = {
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
};

type AuditSummary = {
  totalRevenue: number;
  totalOrders: number;
  splitOrdersCount: number;
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
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [orders, setOrders] = useState<AuditedOrder[]>([]);

  // Filter states
  const [datePreset, setDatePreset] = useState<"all" | "today" | "week" | "month" | "custom">("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [cityFilter, setCityFilter] = useState<"all" | "indore" | "outside_indore">("all");
  const [entityFilter, setEntityFilter] = useState<"all" | "jain_traders" | "padam_international" | "split">("all");
  const [searchQuery, setSearchQuery] = useState("");

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
    } catch (err: any) {
      setError(err?.message || "Failed to load billing audit data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [dateParams, cityFilter, entityFilter]);

  // Search trigger on enter or blur
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

  // Export to CSV
  const exportToCsv = () => {
    if (!orders.length) return;
    const headers = [
      "Order Ref",
      "Order Date",
      "Retailer Name",
      "Delivery City",
      "Destination Zone",
      "Split Order?",
      "Jain Goods (INR)",
      "Jain GST (INR)",
      "Jain Total (INR)",
      "Jain Bags",
      "Padam Goods (INR)",
      "Padam GST (INR)",
      "Padam Total (INR)",
      "Padam Bags",
      "Grand Total (INR)",
      "Paid (INR)",
      "Outstanding (INR)",
      "Routing Reason",
    ];

    const rows = orders.map(o => [
      formatOrderRef(o),
      new Date(o.createdAt).toLocaleDateString("en-IN"),
      `"${o.retailerName.replace(/"/g, '""')}"`,
      `"${o.deliveryCity.replace(/"/g, '""')}"`,
      o.destination === "INDORE_CITY" ? "Indore City" : "Outside Indore",
      o.isSplit ? "YES" : "NO",
      o.jain.goods.toFixed(2),
      o.jain.gst.toFixed(2),
      o.jain.total.toFixed(2),
      o.jain.bags,
      o.padam.goods.toFixed(2),
      o.padam.gst.toFixed(2),
      o.padam.total.toFixed(2),
      o.padam.bags,
      o.grandTotal.toFixed(2),
      o.totalPaid.toFixed(2),
      o.totalOutstanding.toFixed(2),
      `"${o.explanation.replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
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
    <div className="main-content" style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--ink)" }}>
              Billing Entities & Money Flow Audit
            </h1>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", background: "#fef3c7", color: "#92400e", borderRadius: 4, border: "1px solid #fde68a" }}>
              JAIN TRADERS vs PADAM INT.
            </span>
          </div>
          <p style={{ margin: "6px 0 0", color: "var(--ink-muted)", fontSize: 13.5 }}>
            Automated entity routing, tax segregation, cash inflow, and multi-entity order distribution.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="secondary"
            onClick={() => setShowSimulator(!showSimulator)}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
          >
            <span>🧪</span> {showSimulator ? "Hide Simulator" : "Live Routing Simulator"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={exportToCsv}
            disabled={!orders.length}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
          >
            <span>📥</span> Export to CSV
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

      {/* Filter Toolbar */}
      <div style={{ background: "#ffffff", padding: "14px 18px", borderRadius: 10, border: "1px solid var(--border)", marginBottom: 24, display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", justifyContent: "space-between" }}>
        {/* Date presets */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", marginRight: 4 }}>Period:</span>
          {(["all", "today", "week", "month", "custom"] as const).map(p => (
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
                onChange={e => setCustomFrom(e.target.value)}
                style={{ padding: "3px 8px", fontSize: 12, width: 130 }}
              />
              <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>to</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                style={{ padding: "3px 8px", fontSize: 12, width: 130 }}
              />
              <button type="button" className="sm" onClick={loadData}>Apply</button>
            </div>
          )}
        </div>

        {/* Zone & Entity Dropdowns */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted)" }}>Destination Zone:</span>
            <select
              value={cityFilter}
              onChange={e => setCityFilter(e.target.value as any)}
              style={{ fontSize: 12, padding: "4px 8px", width: 170 }}
            >
              <option value="all">All Destinations</option>
              <option value="indore">Indore City Only (100% Jain)</option>
              <option value="outside_indore">Outside Indore (Eligible)</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted)" }}>Entity:</span>
            <select
              value={entityFilter}
              onChange={e => setEntityFilter(e.target.value as any)}
              style={{ fontSize: 12, padding: "4px 8px", width: 170 }}
            >
              <option value="all">All Entities & Splits</option>
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
              onChange={e => setSearchQuery(e.target.value)}
              style={{ fontSize: 12, padding: "4px 8px", width: 180 }}
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
                onChange={e => setSimCity(e.target.value)}
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
                        onChange={e => {
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
                        onChange={e => {
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
                        onChange={e => {
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
                        onChange={e => {
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
        <div style={{ marginBottom: 28 }}>
          {/* Top Big Comparison Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
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
                    Domestic & Local Operating Company
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

              <div style={{ padding: "20px 22px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
                  <div>
                    <span style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 600 }}>Total Billed Revenue</span>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "#0369a1", marginTop: 2 }}>
                      {inr(summary.jain.totalRevenue)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 600 }}>Volume</span>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
                      {summary.jain.totalBags} Bags <span style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 500 }}>({summary.jain.ordersCount} orders)</span>
                    </div>
                  </div>
                </div>

                {/* Sub-breakdown: Goods, GST, Freight */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, background: "#f8fafc", padding: "12px 14px", borderRadius: 8, border: "1px solid #e2e8f0", marginBottom: 16 }}>
                  <div>
                    <span style={{ fontSize: 11, color: "#64748b" }}>Goods Base</span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginTop: 2 }}>{inr(summary.jain.goodsValue)}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "#64748b" }}>GST / Tax</span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginTop: 2 }}>{inr(summary.jain.gstAmount)}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "#64748b" }}>Freight</span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginTop: 2 }}>{inr(summary.jain.freightAmount)}</div>
                  </div>
                </div>

                {/* Money Flow In vs Dues */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0", marginBottom: 16 }}>
                  <div>
                    <span style={{ fontSize: 11, color: "#166534", fontWeight: 600 }}>Cash & Bank Inflow (Collected)</span>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#15803d" }}>{inr(summary.jain.paymentsCollected)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 11, color: "#9a3412", fontWeight: 600 }}>Outstanding Balance</span>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#c2410c" }}>{inr(summary.jain.outstandingAmount)}</div>
                  </div>
                </div>

                {/* Why orders went to Jain */}
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>
                    Routing Reasons (Why money routed to Jain)
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
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
                    Outstation & Bulk Commercial Entity
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

              <div style={{ padding: "20px 22px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
                  <div>
                    <span style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 600 }}>Total Billed Revenue</span>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "#7e22ce", marginTop: 2 }}>
                      {inr(summary.padam.totalRevenue)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 600 }}>Volume</span>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
                      {summary.padam.totalBags} Bags <span style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 500 }}>({summary.padam.ordersCount} orders)</span>
                    </div>
                  </div>
                </div>

                {/* Sub-breakdown: Goods, GST, Freight */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, background: "#faf5ff", padding: "12px 14px", borderRadius: 8, border: "1px solid #f3e8ff", marginBottom: 16 }}>
                  <div>
                    <span style={{ fontSize: 11, color: "#6b21a8" }}>Goods Base</span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginTop: 2 }}>{inr(summary.padam.goodsValue)}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "#6b21a8" }}>GST / Tax</span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginTop: 2 }}>{inr(summary.padam.gstAmount)}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "#6b21a8" }}>Freight</span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginTop: 2 }}>{inr(summary.padam.freightAmount)}</div>
                  </div>
                </div>

                {/* Money Flow In vs Dues */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0", marginBottom: 16 }}>
                  <div>
                    <span style={{ fontSize: 11, color: "#166534", fontWeight: 600 }}>Cash & Bank Inflow (Collected)</span>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#15803d" }}>{inr(summary.padam.paymentsCollected)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 11, color: "#9a3412", fontWeight: 600 }}>Outstanding Balance</span>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#c2410c" }}>{inr(summary.padam.outstandingAmount)}</div>
                  </div>
                </div>

                {/* Why orders went to Padam */}
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>
                    Routing Reasons (Why money routed to Padam)
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
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
          <div style={{ background: "#ffffff", padding: "16px 20px", borderRadius: 10, border: "1px solid var(--border)" }}>
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

            {/* Proportional Split Bar */}
            <div style={{ height: 16, borderRadius: 8, background: "#e2e8f0", display: "flex", overflow: "hidden", marginBottom: 8 }}>
              <div style={{ width: `${jainShare}%`, background: "#0284c7", transition: "width 0.4s ease" }} title={`Jain Traders: ${jainShare}%`}></div>
              <div style={{ width: `${padamShare}%`, background: "#9333ea", transition: "width 0.4s ease" }} title={`Padam International: ${padamShare}%`}></div>
            </div>

            {/* Bag Volume Split Bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "var(--ink-muted)", marginTop: 6 }}>
              <span>Bag Volume Split: Jain Traders {summary.jain.totalBags} bags ({jainBagShare}%)</span>
              <span>Padam International {summary.padam.totalBags} bags ({padamBagShare}%)</span>
            </div>
          </div>
        </div>
      )}

      {/* Orders Audit Table */}
      <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
              Audited Orders & Invoice Splits ({orders.length})
            </h3>
            <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
              Detailed financial breakdown showing exact amounts routed to Jain vs Padam.
            </span>
          </div>
          {orders.length > 0 && (
            <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
              Showing {orders.length} orders
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--ink-muted)" }}>
            Loading audit details...
          </div>
        ) : error ? (
          <div style={{ padding: 30, textAlign: "center", color: "var(--danger)" }}>
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--ink-muted)" }}>
            No orders found matching the selected filters.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, tableLayout: "fixed" }}>
            <thead>
              <tr style={{ background: "var(--surface-alt)", textAlign: "left", color: "var(--ink-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                <th style={{ width: "14%", padding: "10px 16px" }}>Order / Invoice</th>
                <th style={{ width: "18%", padding: "10px 14px" }}>Retailer & Destination</th>
                <th style={{ width: "24%", padding: "10px 14px" }}>Routing Explanation</th>
                <th style={{ width: "12%", padding: "10px 14px", textAlign: "right" }}>Jain Amount</th>
                <th style={{ width: "12%", padding: "10px 14px", textAlign: "right" }}>Padam Amount</th>
                <th style={{ width: "10%", padding: "10px 14px", textAlign: "right" }}>Order Total</th>
                <th style={{ width: "5%", padding: "10px 8px", textAlign: "center" }}>Split?</th>
                <th style={{ width: "5%", padding: "10px 8px", textAlign: "center" }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const isExpanded = expandedOrderId === o.id;
                const hasJain = o.jain.total > 0;
                const hasPadam = o.padam.total > 0;
                const isIndore = o.destination === "INDORE_CITY";

                return (
                  <React.Fragment key={o.id}>
                    <tr style={{ borderBottom: "1px solid var(--border)", background: isExpanded ? "#f8fafc" : undefined }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 800, color: "var(--ink)", fontSize: 13 }}>
                          {formatOrderRef(o)}
                        </div>
                        <div style={{ color: "var(--ink-muted)", fontSize: 11, marginTop: 2 }}>
                          {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          {o.invoiceNumber ? ` · Inv #${o.invoiceNumber}` : ""}
                        </div>
                      </td>

                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontWeight: 600, color: "var(--ink)" }}>{o.retailerName}</div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3 }}>
                          <span style={{ fontSize: 11, color: "var(--ink-muted)" }}>{o.deliveryCity || "Indore"}</span>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: isIndore ? "#e0f2fe" : "#fef3c7",
                            color: isIndore ? "#0369a1" : "#92400e",
                          }}>
                            {isIndore ? "Indore City" : "Outside Indore"}
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: "12px 14px", maxWidth: 280 }}>
                        <div style={{ fontSize: 11.5, color: "#334155", lineHeight: 1.4 }}>
                          {o.explanation}
                        </div>
                        {o.destination === "OUTSIDE_INDORE" && (
                          <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 2 }}>
                            Eligible bags: <strong>{o.eligibleContributionBags}</strong> / 5.00
                          </div>
                        )}
                      </td>

                      {/* Jain Amount */}
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>
                        {hasJain ? (
                          <div>
                            <span style={{ fontWeight: 700, color: "#0369a1", fontSize: 13 }}>{inr(o.jain.total)}</span>
                            <div style={{ fontSize: 11, color: "var(--ink-muted)" }}>
                              {o.jain.bags} bags ({o.jain.itemsCount} lines)
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>

                      {/* Padam Amount */}
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>
                        {hasPadam ? (
                          <div>
                            <span style={{ fontWeight: 700, color: "#7e22ce", fontSize: 13 }}>{inr(o.padam.total)}</span>
                            <div style={{ fontSize: 11, color: "var(--ink-muted)" }}>
                              {o.padam.bags} bags ({o.padam.itemsCount} lines)
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>

                      {/* Grand Total */}
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>
                        <div style={{ fontWeight: 800, color: "var(--ink)", fontSize: 13.5 }}>
                          {inr(o.grandTotal)}
                        </div>
                        <div style={{ fontSize: 10.5, color: o.totalOutstanding > 0 ? "#c2410c" : "#15803d", fontWeight: 600 }}>
                          {o.totalOutstanding > 0 ? `${inr(o.totalOutstanding)} dues` : "Settled"}
                        </div>
                      </td>

                      {/* Split Badge */}
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        {o.isSplit ? (
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#fef3c7", color: "#b45309", fontWeight: 700, border: "1px solid #fde68a" }}>
                            ⚡ SPLIT
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>Single</span>
                        )}
                      </td>

                      {/* Expand / Collapse Button */}
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <button
                          type="button"
                          className="secondary sm"
                          onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}
                          style={{ fontSize: 11, padding: "3px 8px" }}
                        >
                          {isExpanded ? "Hide ▲" : "Inspect ▼"}
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Line Items Details */}
                    {isExpanded && (
                      <tr style={{ background: "#f8fafc" }}>
                        <td colSpan={8} style={{ padding: "16px 20px" }}>
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
    </div>
  );
}
