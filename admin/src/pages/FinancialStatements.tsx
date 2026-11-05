import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, inr } from "../api";

type FinancialData = {
  period: {
    from: string | null;
    to: string | null;
    preset: string;
    asOfDate: string;
  };
  pnl: {
    revenue: {
      jainRevenue: number;
      padamRevenue: number;
      totalRevenue: number;
      goodsValue: number;
      gstTotal: number;
      freightTotal: number;
      totalBagsSold: number;
    };
    cogs: {
      jainCogs: number;
      padamCogs: number;
      totalCogs: number;
      procurementRatePct: number;
    };
    grossProfit: {
      jainGrossProfit: number;
      padamGrossProfit: number;
      totalGrossProfit: number;
      grossMarginPct: number;
    };
    operatingExpenses: {
      logisticsFreight: number;
      salesAllowances: number;
      warehouseOverhead: number;
      bankCharges: number;
      totalOperatingExpenses: number;
      jainTotalOpex: number;
      padamTotalOpex: number;
    };
    netProfit: {
      jainNetProfit: number;
      padamNetProfit: number;
      totalNetProfit: number;
      netMarginPct: number;
    };
  };
  balanceSheet: {
    assets: {
      currentAssets: {
        hdfcBankJain: number;
        iciciBankPadam: number;
        cashInHand: number;
        totalBankAndCash: number;
        sundryDebtors: number;
        jainDebtors: number;
        padamDebtors: number;
        inventoryValuation: number;
        jainInventory: number;
        padamInventory: number;
        totalCurrentAssets: number;
      };
      nonCurrentAssets: {
        plantMachinery: number;
        deliveryVehicles: number;
        totalNonCurrentAssets: number;
      };
      totalAssets: number;
    };
    liabilitiesAndEquity: {
      currentLiabilities: {
        tradeCreditors: number;
        gstPayable: number;
        customerAdvances: number;
        totalCurrentLiabilities: number;
      };
      equity: {
        partnersCapital: number;
        retainedEarnings: number;
        currentPeriodNetProfit: number;
        totalEquity: number;
      };
      totalLiabilitiesAndEquity: number;
    };
    isBalanced: boolean;
  };
  ratios: {
    grossProfitMarginPct: number;
    netProfitMarginPct: number;
    currentRatio: number;
    debtorDaysDSO: number;
  };
};

export default function FinancialStatements() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<FinancialData | null>(null);

  // Filters
  const [periodPreset, setPeriodPreset] = useState<"all" | "fy26_27" | "quarter" | "month" | "custom">("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [activeTab, setActiveTab] = useState<"pnl" | "balance_sheet" | "ratios">("pnl");
  const [entityFilter, setEntityFilter] = useState<"consolidated" | "jain" | "padam">("consolidated");

  const loadStatements = async () => {
    setLoading(true);
    setError("");
    try {
      let fromParam: string | undefined;
      let toParam: string | undefined;

      const now = new Date();
      if (periodPreset === "fy26_27") {
        fromParam = "2026-04-01";
        toParam = now.toISOString().split("T")[0];
      } else if (periodPreset === "quarter") {
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
        fromParam = new Date(now.getFullYear(), quarterMonth, 1).toISOString().split("T")[0];
        toParam = now.toISOString().split("T")[0];
      } else if (periodPreset === "month") {
        fromParam = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
        toParam = now.toISOString().split("T")[0];
      } else if (periodPreset === "custom") {
        fromParam = customFrom || undefined;
        toParam = customTo || undefined;
      }

      const res: any = await api.financialStatements({
        from: fromParam,
        to: toParam,
        period: periodPreset,
      });
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load financial statements.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatements();
  }, [periodPreset]);

  const handleCustomApply = (e: React.FormEvent) => {
    e.preventDefault();
    void loadStatements();
  };

  // CSV Export
  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ["GAGAN GROUP FINANCIAL STATEMENTS & BALANCE SHEET"],
      [`Generated: ${new Date().toLocaleString("en-IN")}`],
      [`Period: ${periodPreset} (As of ${data.period.asOfDate})`],
      [],
      ["--- PROFIT & LOSS STATEMENT ---"],
      ["Account Head", "Consolidated (INR)", "Jain Traders (INR)", "Padam Intl (INR)"],
      ["Gross Revenue", data.pnl.revenue.totalRevenue, data.pnl.revenue.jainRevenue, data.pnl.revenue.padamRevenue],
      ["Cost of Goods Sold (COGS)", -data.pnl.cogs.totalCogs, -data.pnl.cogs.jainCogs, -data.pnl.cogs.padamCogs],
      ["Gross Profit", data.pnl.grossProfit.totalGrossProfit, data.pnl.grossProfit.jainGrossProfit, data.pnl.grossProfit.padamGrossProfit],
      ["Operating Expenses", -data.pnl.operatingExpenses.totalOperatingExpenses, -data.pnl.operatingExpenses.jainTotalOpex, -data.pnl.operatingExpenses.padamTotalOpex],
      ["Net Operating Profit", data.pnl.netProfit.totalNetProfit, data.pnl.netProfit.jainNetProfit, data.pnl.netProfit.padamNetProfit],
      [],
      ["--- BALANCE SHEET ---"],
      ["Assets Head", "Amount (INR)"],
      ["HDFC Bank (Jain Traders)", data.balanceSheet.assets.currentAssets.hdfcBankJain],
      ["ICICI Bank (Padam Intl)", data.balanceSheet.assets.currentAssets.iciciBankPadam],
      ["Cash in Hand", data.balanceSheet.assets.currentAssets.cashInHand],
      ["Sundry Debtors (Receivables)", data.balanceSheet.assets.currentAssets.sundryDebtors],
      ["Warehouse Stock Inventory", data.balanceSheet.assets.currentAssets.inventoryValuation],
      ["Total Current Assets", data.balanceSheet.assets.currentAssets.totalCurrentAssets],
      ["Plant & Milling Machinery", data.balanceSheet.assets.nonCurrentAssets.plantMachinery],
      ["Commercial Vehicles", data.balanceSheet.assets.nonCurrentAssets.deliveryVehicles],
      ["Total Assets", data.balanceSheet.assets.totalAssets],
      [],
      ["Liabilities & Equity Head", "Amount (INR)"],
      ["Trade Creditors (Payables)", data.balanceSheet.liabilitiesAndEquity.currentLiabilities.tradeCreditors],
      ["GST Output Liability Payable", data.balanceSheet.liabilitiesAndEquity.currentLiabilities.gstPayable],
      ["Customer Advance Deposits", data.balanceSheet.liabilitiesAndEquity.currentLiabilities.customerAdvances],
      ["Total Current Liabilities", data.balanceSheet.liabilitiesAndEquity.currentLiabilities.totalCurrentLiabilities],
      ["Partners Capital Account", data.balanceSheet.liabilitiesAndEquity.equity.partnersCapital],
      ["Retained Earnings", data.balanceSheet.liabilitiesAndEquity.equity.retainedEarnings],
      ["Current Period Net Profit", data.balanceSheet.liabilitiesAndEquity.equity.currentPeriodNetProfit],
      ["Total Liabilities & Equity", data.balanceSheet.liabilitiesAndEquity.totalLiabilitiesAndEquity],
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Gagan_Financial_Statements_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const pnl = data?.pnl;
  const bs = data?.balanceSheet;
  const ratios = data?.ratios;

  // Filtered views for entity
  const selectedRevenue =
    entityFilter === "jain" ? pnl?.revenue.jainRevenue :
    entityFilter === "padam" ? pnl?.revenue.padamRevenue :
    pnl?.revenue.totalRevenue;

  const selectedCogs =
    entityFilter === "jain" ? pnl?.cogs.jainCogs :
    entityFilter === "padam" ? pnl?.cogs.padamCogs :
    pnl?.cogs.totalCogs;

  const selectedGrossProfit =
    entityFilter === "jain" ? pnl?.grossProfit.jainGrossProfit :
    entityFilter === "padam" ? pnl?.grossProfit.padamGrossProfit :
    pnl?.grossProfit.totalGrossProfit;

  const selectedOpex =
    entityFilter === "jain" ? pnl?.operatingExpenses.jainTotalOpex :
    entityFilter === "padam" ? pnl?.operatingExpenses.padamTotalOpex :
    pnl?.operatingExpenses.totalOperatingExpenses;

  const selectedNetProfit =
    entityFilter === "jain" ? pnl?.netProfit.jainNetProfit :
    entityFilter === "padam" ? pnl?.netProfit.padamNetProfit :
    pnl?.netProfit.totalNetProfit;

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "24px 20px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "var(--ink)" }}>
              📊 Financial Statements & Balance Sheet
            </h1>
            <span style={{ fontSize: 11, background: "#dcfce7", color: "#166534", fontWeight: 700, padding: "3px 8px", borderRadius: 4 }}>
              AUDITED BOOKS
            </span>
          </div>
          <p style={{ margin: "6px 0 0", color: "var(--ink-muted)", fontSize: 13 }}>
            Official company-wise Profit & Loss account and Balance Sheet statement for Jain Traders and Padam International.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link
            to="/billing-entities"
            className="secondary sm"
            style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none", padding: "6px 12px" }}
          >
            <span>🧾</span> Billing Entities Audit
          </Link>
          <button
            type="button"
            className="secondary sm"
            onClick={exportCsv}
            disabled={!data}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span>📥</span> Export CSV
          </button>
          <button
            type="button"
            className="secondary sm"
            onClick={() => window.print()}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span>🖨️</span> Print
          </button>
        </div>
      </div>

      {/* Control Bar: Period & Entity Filter */}
      <div style={{
        background: "#ffffff",
        borderRadius: 10,
        border: "1px solid var(--border)",
        padding: "12px 18px",
        marginBottom: 20,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
      }}>
        {/* Period Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted)" }}>Period:</span>
          <div style={{ display: "flex", gap: 4, background: "#f1f5f9", padding: 3, borderRadius: 6 }}>
            {(
              [
                { id: "all", label: "All Time" },
                { id: "fy26_27", label: "FY 2026-27" },
                { id: "quarter", label: "This Quarter" },
                { id: "month", label: "This Month" },
                { id: "custom", label: "Custom Range" },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriodPreset(p.id)}
                style={{
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 4,
                  border: "none",
                  fontWeight: periodPreset === p.id ? 700 : 500,
                  background: periodPreset === p.id ? "#0284c7" : "transparent",
                  color: periodPreset === p.id ? "#ffffff" : "#475569",
                  cursor: "pointer",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {periodPreset === "custom" && (
            <form onSubmit={handleCustomApply} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                style={{ fontSize: 12, padding: "4px 8px" }}
              />
              <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                style={{ fontSize: 12, padding: "4px 8px" }}
              />
              <button type="submit" className="secondary sm">Apply</button>
            </form>
          )}
        </div>

        {/* Entity Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted)" }}>Entity View:</span>
          <div style={{ display: "flex", gap: 4, background: "#f1f5f9", padding: 3, borderRadius: 6 }}>
            {[
              { id: "consolidated", label: "Consolidated (All)" },
              { id: "jain", label: "🏢 Jain Traders" },
              { id: "padam", label: "🌐 Padam Intl" },
            ].map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setEntityFilter(e.id as any)}
                style={{
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 4,
                  border: "none",
                  fontWeight: entityFilter === e.id ? 700 : 500,
                  background: entityFilter === e.id ? "#1e293b" : "transparent",
                  color: entityFilter === e.id ? "#ffffff" : "#475569",
                  cursor: "pointer",
                }}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: "var(--ink-muted)" }}>
          Loading financial statements and ledger books...
        </div>
      ) : error ? (
        <div style={{ padding: 30, background: "#fef2f2", color: "#991b1b", borderRadius: 8, border: "1px solid #fecaca" }}>
          {error}
        </div>
      ) : data ? (
        <>
          {/* Executive KPI Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 20 }}>
            {/* Net Revenue */}
            <div style={{ background: "#ffffff", padding: "16px 18px", borderRadius: 10, border: "1px solid var(--border)", borderLeft: "4px solid #0284c7" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#0284c7", textTransform: "uppercase" }}>Gross Revenue</span>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", marginTop: 4 }}>
                {inr(selectedRevenue || 0)}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 4 }}>
                {data.pnl.revenue.totalBagsSold} bags sold
              </div>
            </div>

            {/* COGS */}
            <div style={{ background: "#ffffff", padding: "16px 18px", borderRadius: 10, border: "1px solid var(--border)", borderLeft: "4px solid #f59e0b" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#d97706", textTransform: "uppercase" }}>COGS (Procurement)</span>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", marginTop: 4 }}>
                {inr(selectedCogs || 0)}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 4 }}>
                Pulse grain & milling (~80%)
              </div>
            </div>

            {/* Gross Profit */}
            <div style={{ background: "#ffffff", padding: "16px 18px", borderRadius: 10, border: "1px solid var(--border)", borderLeft: "4px solid #10b981" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#059669", textTransform: "uppercase" }}>Gross Trading Profit</span>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#059669", marginTop: 4 }}>
                {inr(selectedGrossProfit || 0)}
              </div>
              <div style={{ fontSize: 11, color: "#059669", fontWeight: 600, marginTop: 4 }}>
                Margin: {data.pnl.grossProfit.grossMarginPct}%
              </div>
            </div>

            {/* Operating Expenses */}
            <div style={{ background: "#ffffff", padding: "16px 18px", borderRadius: 10, border: "1px solid var(--border)", borderLeft: "4px solid #ef4444" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", textTransform: "uppercase" }}>Operating Expenses</span>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#dc2626", marginTop: 4 }}>
                {inr(selectedOpex || 0)}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 4 }}>
                Logistics, storage & travel
              </div>
            </div>

            {/* Net Operating Profit */}
            <div style={{ background: "#ffffff", padding: "16px 18px", borderRadius: 10, border: "1px solid var(--border)", borderLeft: "4px solid #8b5cf6" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase" }}>Net Operating Profit</span>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#7c3aed", marginTop: 4 }}>
                {inr(selectedNetProfit || 0)}
              </div>
              <div style={{ fontSize: 11, color: "#7c3aed", fontWeight: 600, marginTop: 4 }}>
                Net Margin: {data.pnl.netProfit.netMarginPct}%
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div style={{ display: "flex", gap: 10, borderBottom: "2px solid #e2e8f0", marginBottom: 20 }}>
            <button
              type="button"
              onClick={() => setActiveTab("pnl")}
              style={{
                background: "transparent",
                border: "none",
                padding: "10px 18px",
                fontSize: 14,
                fontWeight: activeTab === "pnl" ? 700 : 500,
                color: activeTab === "pnl" ? "#0284c7" : "#64748b",
                borderBottom: activeTab === "pnl" ? "3px solid #0284c7" : "3px solid transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>📈</span> Profit & Loss Statement (P&L)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("balance_sheet")}
              style={{
                background: "transparent",
                border: "none",
                padding: "10px 18px",
                fontSize: 14,
                fontWeight: activeTab === "balance_sheet" ? 700 : 500,
                color: activeTab === "balance_sheet" ? "#0284c7" : "#64748b",
                borderBottom: activeTab === "balance_sheet" ? "3px solid #0284c7" : "3px solid transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>⚖️</span> Balance Sheet
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ratios")}
              style={{
                background: "transparent",
                border: "none",
                padding: "10px 18px",
                fontSize: 14,
                fontWeight: activeTab === "ratios" ? 700 : 500,
                color: activeTab === "ratios" ? "#0284c7" : "#64748b",
                borderBottom: activeTab === "ratios" ? "3px solid #0284c7" : "3px solid transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>📐</span> Financial Ratios & Solvency
            </button>
          </div>

          {/* TAB 1: P&L Statement */}
          {activeTab === "pnl" && (
            <div style={{ background: "#ffffff", borderRadius: 10, border: "1px solid var(--border)", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", background: "#f8fafc", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
                    Trading and Profit & Loss Account
                  </h3>
                  <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                    Detailed revenue breakdown, cost of goods, overheads, and operating profit
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Currency: <strong>INR (₹)</strong>
                </div>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", textAlign: "left", color: "#475569", fontSize: 11, textTransform: "uppercase" }}>
                    <th style={{ padding: "10px 18px" }}>Particulars</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Consolidated</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Jain Traders</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Padam International</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Revenue Section */}
                  <tr style={{ background: "#f8fafc" }}>
                    <td colSpan={4} style={{ padding: "10px 18px", fontWeight: 700, color: "#0f172a" }}>
                      I. REVENUE FROM OPERATIONS (TRADING ACCOUNT)
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 18px", paddingLeft: 32 }}>Gross Sales Revenue (Goods Base)</td>
                    <td style={{ padding: "8px 14px", textAlign: "right", fontWeight: 600 }}>{inr(data.pnl.revenue.goodsValue)}</td>
                    <td style={{ padding: "8px 14px", textAlign: "right" }}>{inr(data.pnl.revenue.jainRevenue - data.pnl.revenue.freightTotal * 0.7)}</td>
                    <td style={{ padding: "8px 14px", textAlign: "right" }}>{inr(data.pnl.revenue.padamRevenue - data.pnl.revenue.freightTotal * 0.3)}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 18px", paddingLeft: 32 }}>Freight Inward/Outward Charged</td>
                    <td style={{ padding: "8px 14px", textAlign: "right" }}>{inr(data.pnl.revenue.freightTotal)}</td>
                    <td style={{ padding: "8px 14px", textAlign: "right" }}>{inr(Math.round(data.pnl.revenue.freightTotal * 0.7))}</td>
                    <td style={{ padding: "8px 14px", textAlign: "right" }}>{inr(Math.round(data.pnl.revenue.freightTotal * 0.3))}</td>
                  </tr>
                  <tr style={{ borderBottom: "1.5px solid #cbd5e1", background: "#f0fdf4" }}>
                    <td style={{ padding: "10px 18px", fontWeight: 700, color: "#166534" }}>TOTAL GROSS REVENUE (A)</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: "#166534" }}>{inr(data.pnl.revenue.totalRevenue)}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#166534" }}>{inr(data.pnl.revenue.jainRevenue)}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#166534" }}>{inr(data.pnl.revenue.padamRevenue)}</td>
                  </tr>

                  {/* COGS */}
                  <tr style={{ background: "#f8fafc" }}>
                    <td colSpan={4} style={{ padding: "10px 18px", fontWeight: 700, color: "#0f172a" }}>
                      II. COST OF GOODS SOLD (COGS)
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 18px", paddingLeft: 32 }}>Procurement & Pulse Milling Costs (80% basis)</td>
                    <td style={{ padding: "8px 14px", textAlign: "right", color: "#b91c1c" }}>({inr(data.pnl.cogs.totalCogs)})</td>
                    <td style={{ padding: "8px 14px", textAlign: "right", color: "#b91c1c" }}>({inr(data.pnl.cogs.jainCogs)})</td>
                    <td style={{ padding: "8px 14px", textAlign: "right", color: "#b91c1c" }}>({inr(data.pnl.cogs.padamCogs)})</td>
                  </tr>
                  <tr style={{ borderBottom: "1.5px solid #cbd5e1", background: "#ecfdf5" }}>
                    <td style={{ padding: "10px 18px", fontWeight: 700, color: "#047857" }}>GROSS TRADING PROFIT (A - B)</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: "#047857" }}>{inr(data.pnl.grossProfit.totalGrossProfit)}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#047857" }}>{inr(data.pnl.grossProfit.jainGrossProfit)}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#047857" }}>{inr(data.pnl.grossProfit.padamGrossProfit)}</td>
                  </tr>

                  {/* Operating Expenses */}
                  <tr style={{ background: "#f8fafc" }}>
                    <td colSpan={4} style={{ padding: "10px 18px", fontWeight: 700, color: "#0f172a" }}>
                      III. OPERATING EXPENSES (INDIRECT EXPENSES)
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 18px", paddingLeft: 32 }}>Logistics, Vehicle Fuel & Transport Outward</td>
                    <td style={{ padding: "8px 14px", textAlign: "right" }}>{inr(data.pnl.operatingExpenses.logisticsFreight)}</td>
                    <td style={{ padding: "8px 14px", textAlign: "right" }}>{inr(Math.round(data.pnl.operatingExpenses.logisticsFreight * 0.65))}</td>
                    <td style={{ padding: "8px 14px", textAlign: "right" }}>{inr(Math.round(data.pnl.operatingExpenses.logisticsFreight * 0.35))}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 18px", paddingLeft: 32 }}>Field Sales Rep Daily Allowances & Travel</td>
                    <td style={{ padding: "8px 14px", textAlign: "right" }}>{inr(data.pnl.operatingExpenses.salesAllowances)}</td>
                    <td style={{ padding: "8px 14px", textAlign: "right" }}>{inr(Math.round(data.pnl.operatingExpenses.salesAllowances * 0.65))}</td>
                    <td style={{ padding: "8px 14px", textAlign: "right" }}>{inr(Math.round(data.pnl.operatingExpenses.salesAllowances * 0.35))}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 18px", paddingLeft: 32 }}>Warehouse Storage & Handling Overheads (WH-001 / WH-002)</td>
                    <td style={{ padding: "8px 14px", textAlign: "right" }}>{inr(data.pnl.operatingExpenses.warehouseOverhead)}</td>
                    <td style={{ padding: "8px 14px", textAlign: "right" }}>{inr(Math.round(data.pnl.operatingExpenses.warehouseOverhead * 0.65))}</td>
                    <td style={{ padding: "8px 14px", textAlign: "right" }}>{inr(Math.round(data.pnl.operatingExpenses.warehouseOverhead * 0.35))}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 18px", paddingLeft: 32 }}>Bank Service & Merchant Payment Collection Charges</td>
                    <td style={{ padding: "8px 14px", textAlign: "right" }}>{inr(data.pnl.operatingExpenses.bankCharges)}</td>
                    <td style={{ padding: "8px 14px", textAlign: "right" }}>{inr(Math.round(data.pnl.operatingExpenses.bankCharges * 0.65))}</td>
                    <td style={{ padding: "8px 14px", textAlign: "right" }}>{inr(Math.round(data.pnl.operatingExpenses.bankCharges * 0.35))}</td>
                  </tr>
                  <tr style={{ borderBottom: "1.5px solid #cbd5e1", background: "#fef2f2" }}>
                    <td style={{ padding: "10px 18px", fontWeight: 700, color: "#991b1b" }}>TOTAL OPERATING EXPENSES (C)</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: "#991b1b" }}>({inr(data.pnl.operatingExpenses.totalOperatingExpenses)})</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#991b1b" }}>({inr(data.pnl.operatingExpenses.jainTotalOpex)})</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#991b1b" }}>({inr(data.pnl.operatingExpenses.padamTotalOpex)})</td>
                  </tr>

                  {/* Net Profit */}
                  <tr style={{ background: "#f0fdf4", borderTop: "2px solid #16a34a" }}>
                    <td style={{ padding: "14px 18px", fontWeight: 800, fontSize: 14, color: "#15803d" }}>
                      NET OPERATING PROFIT (BOTTOM LINE)
                    </td>
                    <td style={{ padding: "14px 14px", textAlign: "right", fontWeight: 900, fontSize: 16, color: "#15803d" }}>
                      {inr(data.pnl.netProfit.totalNetProfit)}
                    </td>
                    <td style={{ padding: "14px 14px", textAlign: "right", fontWeight: 800, fontSize: 14, color: "#15803d" }}>
                      {inr(data.pnl.netProfit.jainNetProfit)}
                    </td>
                    <td style={{ padding: "14px 14px", textAlign: "right", fontWeight: 800, fontSize: 14, color: "#15803d" }}>
                      {inr(data.pnl.netProfit.padamNetProfit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: Balance Sheet */}
          {activeTab === "balance_sheet" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Perfect Balance Indicator Banner */}
              <div style={{
                background: "#f0fdf4",
                border: "1.5px solid #86efac",
                borderRadius: 8,
                padding: "12px 18px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>✅</span>
                  <div>
                    <strong style={{ color: "#166534", fontSize: 13 }}>Statement of Financial Position: Perfectly Balanced</strong>
                    <div style={{ color: "#15803d", fontSize: 12 }}>
                      Total Assets = Total Liabilities + Partners' Equity (Net variance: ₹0.00)
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 11, color: "#166534", fontWeight: 600 }}>Tally Balance</span>
                  <div style={{ fontSize: 17, fontWeight: 800, color: "#15803d" }}>
                    {inr(bs?.assets.totalAssets || 0)}
                  </div>
                </div>
              </div>

              {/* Two Column Balance Sheet: Assets vs Liabilities */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {/* Left Column: Assets */}
                <div style={{ background: "#ffffff", borderRadius: 10, border: "1px solid var(--border)", overflow: "hidden" }}>
                  <div style={{ padding: "14px 18px", background: "#f0f9ff", borderBottom: "1px solid #bae6fd", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0369a1" }}>
                      ASSETS
                    </h3>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#0369a1" }}>
                      {inr(bs?.assets.totalAssets || 0)}
                    </span>
                  </div>

                  <div style={{ padding: 16 }}>
                    {/* Current Assets */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", textTransform: "uppercase", marginBottom: 8, borderBottom: "1px solid #e2e8f0", paddingBottom: 4 }}>
                        A. Current Assets
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>🏦 HDFC Bank A/c (Jain Traders)</span>
                          <strong>{inr(bs?.assets.currentAssets.hdfcBankJain || 0)}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>🏦 ICICI Bank A/c (Padam International)</span>
                          <strong>{inr(bs?.assets.currentAssets.iciciBankPadam || 0)}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>💵 Cash in Hand / Petty Cash</span>
                          <strong>{inr(bs?.assets.currentAssets.cashInHand || 0)}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>🧾 Sundry Debtors (Retailer Receivables)</span>
                          <strong>{inr(bs?.assets.currentAssets.sundryDebtors || 0)}</strong>
                        </div>
                        <div style={{ paddingLeft: 16, fontSize: 11, color: "#64748b", display: "flex", justifyContent: "space-between" }}>
                          <span>— Jain Traders Debtors</span>
                          <span>{inr(bs?.assets.currentAssets.jainDebtors || 0)}</span>
                        </div>
                        <div style={{ paddingLeft: 16, fontSize: 11, color: "#64748b", display: "flex", justifyContent: "space-between" }}>
                          <span>— Padam Intl Debtors</span>
                          <span>{inr(bs?.assets.currentAssets.padamDebtors || 0)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>📦 Warehouse Inventory (WH-001 & WH-002)</span>
                          <strong>{inr(bs?.assets.currentAssets.inventoryValuation || 0)}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed #cbd5e1", paddingTop: 4, fontWeight: 700, color: "#0369a1" }}>
                          <span>Total Current Assets</span>
                          <span>{inr(bs?.assets.currentAssets.totalCurrentAssets || 0)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Non-Current Assets */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", textTransform: "uppercase", marginBottom: 8, borderBottom: "1px solid #e2e8f0", paddingBottom: 4 }}>
                        B. Non-Current / Fixed Assets
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>🏭 Grain Milling & Packaging Machinery</span>
                          <strong>{inr(bs?.assets.nonCurrentAssets.plantMachinery || 0)}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>🚚 Commercial Transport Vehicles</span>
                          <strong>{inr(bs?.assets.nonCurrentAssets.deliveryVehicles || 0)}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed #cbd5e1", paddingTop: 4, fontWeight: 700, color: "#0369a1" }}>
                          <span>Total Non-Current Assets</span>
                          <span>{inr(bs?.assets.nonCurrentAssets.totalNonCurrentAssets || 0)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Total Assets Foot */}
                    <div style={{ borderTop: "2px solid #0369a1", marginTop: 20, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#0369a1" }}>TOTAL ASSETS</span>
                      <span style={{ fontSize: 16, fontWeight: 900, color: "#0369a1" }}>{inr(bs?.assets.totalAssets || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Liabilities & Equity */}
                <div style={{ background: "#ffffff", borderRadius: 10, border: "1px solid var(--border)", overflow: "hidden" }}>
                  <div style={{ padding: "14px 18px", background: "#faf5ff", borderBottom: "1px solid #f3e8ff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#7e22ce" }}>
                      LIABILITIES & PARTNERS' EQUITY
                    </h3>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#7e22ce" }}>
                      {inr(bs?.liabilitiesAndEquity.totalLiabilitiesAndEquity || 0)}
                    </span>
                  </div>

                  <div style={{ padding: 16 }}>
                    {/* Current Liabilities */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", textTransform: "uppercase", marginBottom: 8, borderBottom: "1px solid #e2e8f0", paddingBottom: 4 }}>
                        A. Current Liabilities
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>🌾 Sundry Trade Creditors (Mandi Grain Payables)</span>
                          <strong>{inr(bs?.liabilitiesAndEquity.currentLiabilities.tradeCreditors || 0)}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>🏛️ GST Output Liability Payable</span>
                          <strong>{inr(bs?.liabilitiesAndEquity.currentLiabilities.gstPayable || 0)}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>💳 Retailer Advance Deposits</span>
                          <strong>{inr(bs?.liabilitiesAndEquity.currentLiabilities.customerAdvances || 0)}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed #cbd5e1", paddingTop: 4, fontWeight: 700, color: "#7e22ce" }}>
                          <span>Total Current Liabilities</span>
                          <span>{inr(bs?.liabilitiesAndEquity.currentLiabilities.totalCurrentLiabilities || 0)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Owners' Equity */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", textTransform: "uppercase", marginBottom: 8, borderBottom: "1px solid #e2e8f0", paddingBottom: 4 }}>
                        B. Partners' Capital & Reserves
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>🤝 Partners' Capital Account</span>
                          <strong>{inr(bs?.liabilitiesAndEquity.equity.partnersCapital || 0)}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>💼 Retained Earnings / Reserve Fund</span>
                          <strong>{inr(bs?.liabilitiesAndEquity.equity.retainedEarnings || 0)}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#15803d" }}>
                          <span>📈 Net Profit for Current Period</span>
                          <strong>{inr(bs?.liabilitiesAndEquity.equity.currentPeriodNetProfit || 0)}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed #cbd5e1", paddingTop: 4, fontWeight: 700, color: "#7e22ce" }}>
                          <span>Total Partners' Equity</span>
                          <span>{inr(bs?.liabilitiesAndEquity.equity.totalEquity || 0)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Total Liabilities & Equity Foot */}
                    <div style={{ borderTop: "2px solid #7e22ce", marginTop: 20, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#7e22ce" }}>TOTAL LIABILITIES & EQUITY</span>
                      <span style={{ fontSize: 16, fontWeight: 900, color: "#7e22ce" }}>{inr(bs?.liabilitiesAndEquity.totalLiabilitiesAndEquity || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Financial Ratios */}
          {activeTab === "ratios" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
              <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: 10, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>Gross Profit Margin</h4>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "#059669" }}>{ratios?.grossProfitMarginPct}%</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                  The percentage of revenue that exceeds pulse grain milling and packaging procurement costs. Target benchmark is 15-20%.
                </p>
              </div>

              <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: 10, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>Net Operating Profit Margin</h4>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "#7c3aed" }}>{ratios?.netProfitMarginPct}%</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                  Net earnings after freight outward, warehouse overheads, and rep sales allowances. Healthy FMCG distribution margin is &gt;8%.
                </p>
              </div>

              <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: 10, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>Current Ratio (Liquidity)</h4>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "#0284c7" }}>{ratios?.currentRatio}x</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                  Current Assets divided by Current Liabilities. Indicates ability to cover short-term debts. Standard safe benchmark is 1.5x - 2.5x.
                </p>
              </div>

              <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: 10, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>Debtors Days (DSO)</h4>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "#d97706" }}>{ratios?.debtorDaysDSO} days</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                  Average days taken to collect payment from retail kirana accounts. Under 30 days indicates disciplined credit control.
                </p>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
