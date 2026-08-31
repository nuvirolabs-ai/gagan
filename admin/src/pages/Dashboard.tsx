import { useMemo, useState } from "react";

type RangeKey = "today" | "week" | "month" | "year";
type IntelKey = "volume" | "items" | "salesperson";
type SalesPeriod = "day" | "week" | "month";

const rangeData: Record<RangeKey, { metrics: [string, string, string, string][]; labels: string[]; current: number[]; previous: number[]; total: string }> = {
  today: {
    metrics: [["Gross sales", "₹ 8,42,650", "↑ 18.6%", "vs yesterday"], ["Orders", "260", "↑ 12.4%", "vs yesterday"], ["Avg. order value", "₹ 3,241", "↑ 5.2%", "vs yesterday"], ["Fill rate", "92.4%", "↑ 2.8%", "vs yesterday"]],
    labels: ["20 Aug", "21 Aug", "22 Aug", "23 Aug", "24 Aug", "25 Aug", "26 Aug"], current: [96, 123, 112, 151, 133, 169, 188], previous: [84, 107, 103, 116, 125, 137, 155], total: "₹ 8,42,650",
  },
  week: {
    metrics: [["Gross sales", "₹ 42,18,920", "↑ 14.2%", "vs last week"], ["Orders", "1,284", "↑ 10.8%", "vs last week"], ["Avg. order value", "₹ 3,286", "↑ 3.4%", "vs last week"], ["Fill rate", "91.8%", "↑ 1.9%", "vs last week"]],
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], current: [322, 418, 371, 526, 462, 584, 610], previous: [281, 352, 347, 401, 420, 448, 502], total: "₹ 42,18,920",
  },
  month: {
    metrics: [["Gross sales", "₹ 1,68,42,110", "↑ 21.8%", "vs last month"], ["Orders", "5,192", "↑ 16.3%", "vs last month"], ["Avg. order value", "₹ 3,242", "↑ 4.7%", "vs last month"], ["Fill rate", "92.1%", "↑ 2.5%", "vs last month"]],
    labels: ["Wk 1", "Wk 2", "Wk 3", "Wk 4", "Wk 5", "Wk 6", "Wk 7"], current: [1120, 1680, 1430, 1940, 1760, 2180, 2460], previous: [980, 1260, 1210, 1490, 1530, 1620, 1820], total: "₹ 1,68,42,110",
  },
  year: {
    metrics: [["Gross sales", "₹ 18,42,65,900", "↑ 32.6%", "vs last year"], ["Orders", "58,420", "↑ 27.1%", "vs last year"], ["Avg. order value", "₹ 3,154", "↑ 4.3%", "vs last year"], ["Fill rate", "90.6%", "↑ 3.1%", "vs last year"]],
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"], current: [9200, 12400, 11100, 15800, 14600, 18100, 20500], previous: [7600, 9400, 9800, 11200, 12100, 13700, 15400], total: "₹ 18,42,65,900",
  },
};

type Order = [string, string, string, number, string, string];
const orderRows: Record<IntelKey, Order[]> = {
  volume: [
    ["GG-10482", "Kavya Retail", "₹ 48,920", 24, "Meera Joshi", "Priority"], ["GG-10476", "Mango & Co.", "₹ 38,450", 18, "Arjun Nair", "On track"], ["GG-10469", "Urban Supply", "₹ 31,280", 12, "Sana Khan", "On track"], ["GG-10451", "The Good Store", "₹ 27,600", 9, "Meera Joshi", "Priority"], ["GG-10443", "Nimble Living", "₹ 22,840", 15, "Arjun Nair", "On track"], ["GG-10438", "Northstar Goods", "₹ 18,940", 8, "Sana Khan", "Priority"], ["GG-10422", "Mira Home", "₹ 16,520", 7, "Meera Joshi", "On track"], ["GG-10411", "Bloom Basket", "₹ 14,680", 10, "Arjun Nair", "On track"], ["GG-10398", "Daily Mart", "₹ 12,240", 6, "Sana Khan", "On track"], ["GG-10387", "Oak & Olive", "₹ 10,920", 5, "Meera Joshi", "On track"],
  ],
  items: [
    ["GG-10482", "Kavya Retail", "₹ 48,920", 24, "Meera Joshi", "Priority"], ["GG-10461", "Haven House", "₹ 19,820", 22, "Arjun Nair", "On track"], ["GG-10476", "Mango & Co.", "₹ 38,450", 18, "Arjun Nair", "On track"], ["GG-10443", "Nimble Living", "₹ 22,840", 15, "Sana Khan", "On track"], ["GG-10469", "Urban Supply", "₹ 31,280", 12, "Meera Joshi", "On track"], ["GG-10411", "Bloom Basket", "₹ 14,680", 10, "Arjun Nair", "On track"], ["GG-10451", "The Good Store", "₹ 27,600", 9, "Sana Khan", "Priority"], ["GG-10438", "Northstar Goods", "₹ 18,940", 8, "Meera Joshi", "Priority"], ["GG-10422", "Mira Home", "₹ 16,520", 7, "Arjun Nair", "On track"], ["GG-10398", "Daily Mart", "₹ 12,240", 6, "Sana Khan", "On track"],
  ],
  salesperson: [
    ["GG-10482", "Kavya Retail", "₹ 48,920", 24, "Meera Joshi", "Priority"], ["GG-10476", "Mango & Co.", "₹ 38,450", 18, "Arjun Nair", "On track"], ["GG-10469", "Urban Supply", "₹ 31,280", 12, "Sana Khan", "On track"], ["GG-10438", "Northstar Goods", "₹ 18,940", 8, "Meera Joshi", "Priority"], ["GG-10422", "Mira Home", "₹ 16,520", 7, "Arjun Nair", "On track"], ["GG-10411", "Bloom Basket", "₹ 14,680", 10, "Sana Khan", "On track"], ["GG-10451", "The Good Store", "₹ 27,600", 9, "Meera Joshi", "Priority"], ["GG-10398", "Daily Mart", "₹ 12,240", 6, "Arjun Nair", "On track"], ["GG-10443", "Nimble Living", "₹ 22,840", 15, "Sana Khan", "On track"], ["GG-10387", "Oak & Olive", "₹ 10,920", 5, "Meera Joshi", "On track"],
  ],
};

const salesRows: Record<SalesPeriod, [string, string, string, string][]> = {
  day: [["Meera Joshi", "₹ 1,84,200", "32 orders", "MJ"], ["Arjun Nair", "₹ 1,52,840", "27 orders", "AN"], ["Sana Khan", "₹ 1,21,560", "21 orders", "SK"], ["Riya Menon", "₹ 98,420", "18 orders", "RM"], ["Kabir Singh", "₹ 86,760", "16 orders", "KS"]],
  week: [["Arjun Nair", "₹ 8,42,630", "128 orders", "AN"], ["Meera Joshi", "₹ 7,94,280", "116 orders", "MJ"], ["Sana Khan", "₹ 6,88,410", "101 orders", "SK"], ["Kabir Singh", "₹ 5,98,140", "92 orders", "KS"], ["Riya Menon", "₹ 5,54,820", "87 orders", "RM"]],
  month: [["Meera Joshi", "₹ 28,42,600", "412 orders", "MJ"], ["Sana Khan", "₹ 25,62,140", "389 orders", "SK"], ["Arjun Nair", "₹ 24,78,930", "374 orders", "AN"], ["Riya Menon", "₹ 20,86,440", "312 orders", "RM"], ["Kabir Singh", "₹ 18,92,120", "287 orders", "KS"]],
};

type Warehouse = { id: number; name: string; location: string; manager: string; capacity: number; used: number; cover: number; status: "Healthy" | "Watch" };
type Product = { name: string; sku: string; stock: number; cover: number; warehouse: number; symbol: string };

const initialWarehouses: Warehouse[] = [
  { id: 1, name: "Bhiwandi Hub", location: "Thane, MH", manager: "Rohan Mehta", capacity: 18000, used: 12420, cover: 21, status: "Healthy" },
  { id: 2, name: "Delhi North", location: "Gurugram, HR", manager: "Ishita Kapoor", capacity: 12500, used: 10500, cover: 12, status: "Watch" },
  { id: 3, name: "Bengaluru South", location: "Hoskote, KA", manager: "Vikram Rao", capacity: 9000, used: 4860, cover: 28, status: "Healthy" },
];
const initialProducts: Product[] = [
  { name: "AeroFlex Running Shoes", sku: "AF-RS-042", stock: 2180, cover: 24, warehouse: 1, symbol: "⌁" }, { name: "CloudRest Memory Pillow", sku: "CR-MP-018", stock: 940, cover: 11, warehouse: 2, symbol: "◒" }, { name: "Everyday Carry Backpack", sku: "EC-BP-007", stock: 1260, cover: 18, warehouse: 1, symbol: "▱" }, { name: "TerraSip Steel Bottle", sku: "TS-SB-031", stock: 620, cover: 9, warehouse: 3, symbol: "◉" }, { name: "PulseFit Smart Band", sku: "PF-SB-011", stock: 780, cover: 16, warehouse: 2, symbol: "⌁" }, { name: "Luma Desk Lamp", sku: "LD-LM-022", stock: 415, cover: 13, warehouse: 3, symbol: "◐" },
];

function RevenueChart({ data }: { data: (typeof rangeData)[RangeKey] }) {
  const width = 700, height = 194, pad = 9, max = Math.max(...data.current, ...data.previous) * 1.14;
  const x = (i: number) => pad + (i * (width - pad * 2)) / (data.current.length - 1);
  const y = (v: number) => height - 24 - (v / max) * (height - 40);
  const points = (values: number[]) => values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return <svg className="dashboard-chart" viewBox={`0 0 ${width} ${height + 20}`} preserveAspectRatio="none" role="img" aria-label="Revenue trend chart">
    <defs><linearGradient id="revenueFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#6d8f72" stopOpacity=".27" /><stop offset="1" stopColor="#6d8f72" stopOpacity="0" /></linearGradient></defs>
    {data.labels.map((label, i) => <g key={label}><line x1={x(i)} x2={x(i)} y1={12} y2={height - 24} stroke="#e8e7de" strokeDasharray="2 4" /><text x={x(i)} y={height + 2} textAnchor="middle">{label}</text></g>)}
    <polyline points={points(data.previous)} fill="none" stroke="#d5a650" strokeWidth="2" strokeDasharray="4 4" opacity=".8" />
    <polygon points={`${points(data.current)} ${x(data.current.length - 1)},${height - 24} ${x(0)},${height - 24}`} fill="url(#revenueFill)" />
    <polyline points={points(data.current)} fill="none" stroke="#2b6340" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    {data.current.map((value, i) => <circle key={i} cx={x(i)} cy={y(value)} r={i === data.current.length - 1 ? 4 : 2.8} fill="#fff" stroke="#2b6340" strokeWidth="2" />)}
    <rect x={x(data.current.length - 1) - 29} y={y(data.current[data.current.length - 1]) - 30} width="58" height="21" rx="5" fill="#183a25" /><text className="chart-callout" x={x(data.current.length - 1)} y={y(data.current[data.current.length - 1]) - 16} textAnchor="middle">{data.total.length > 12 ? "₹ 24.6L" : "₹ 1.88L"}</text>
  </svg>;
}

export default function Dashboard() {
  const [range, setRange] = useState<RangeKey>("today");
  const [intel, setIntel] = useState<IntelKey>("volume");
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>("day");
  const warehouses = initialWarehouses;
  const products = initialProducts;
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const data = rangeData[range];
  const warehouseName = (id: number) => warehouses.find((warehouse) => warehouse.id === id)?.name ?? "Unassigned";
  const filteredProducts = useMemo(() => products.filter((product) => `${product.name} ${product.sku}`.toLowerCase().includes(search.toLowerCase())), [products, search]);

  return <div className="dashboard-page">
    <div className="dashboard-heading between"><div><div className="eyebrow"><span className="live-dot" />Live business pulse</div><h1 className="page-title">Good morning, Ananya <span>✦</span></h1><p className="page-sub">Here’s how the business is moving today.</p></div><div className="row dashboard-actions"><button className="secondary" onClick={() => setNotice("Overview report is ready to download.")}>↓ Export report</button></div></div>
    <div className="between dashboard-toolbar"><div className="range-tabs">{(["today", "week", "month", "year"] as RangeKey[]).map((key) => <button key={key} className={range === key ? "active" : ""} onClick={() => setRange(key)}>{key === "today" ? "Today" : key === "week" ? "This week" : key === "month" ? "This month" : "This year"}</button>)}</div><span className="date-filter">26 Aug 2026 · IST</span></div>
    <section className="dashboard-metrics">{data.metrics.map(([label, value, change, compare], index) => <article className="dashboard-metric" key={label}><div className="between"><span>{label}</span><span className={`metric-symbol symbol-${index}`}>{["↗", "▤", "⌁", "✓"][index]}</span></div><strong>{value}</strong><small><b>{change}</b> {compare}</small></article>)}</section>
    <section className="dashboard-grid two-up"><article className="dashboard-panel revenue-card"><div className="panel-heading between"><div><h2>Revenue overview</h2><p>Net sales across all channels</p></div><div className="panel-total"><strong>{data.total}</strong><small>↑ 18.6%</small></div></div><div className="chart-legend"><span><i className="dot-green" />Net revenue</span><span><i className="dot-gold" />Previous period</span><span className="legend-period">Last 7 days⌄</span></div><div className="chart-axis"><div><span>₹ 2.0L</span><span>₹ 1.5L</span><span>₹ 1.0L</span><span>₹ 0.5L</span><span>₹ 0</span></div><RevenueChart data={data} /></div></article><article className="dashboard-panel health-card"><div className="panel-heading between"><div><h2>Business health</h2><p>Key signals worth your attention</p></div><span className="more-dots">•••</span></div><div className="health-list"><div className="health-row"><span className="health-icon good">✓</span><div><b>Fulfilment is on track</b><small>92% orders shipped within SLA</small></div><strong>92%</strong></div><div className="health-row"><span className="health-icon gold">↗</span><div><b>Average order value grew</b><small>Up ₹ 340 from last period</small></div><strong>₹ 3,240</strong></div><div className="health-row"><span className="health-icon purple">⌁</span><div><b>2 warehouses need a look</b><small>Stock cover below 14 days</small></div><button className="link-button" onClick={() => setNotice("Open the Warehouses section from the sidebar to review alerts.")}>Review →</button></div></div><div className="health-footer"><span className="signal-bars">▂▃▅▆▆</span>Healthy momentum <em>Updated just now</em></div></article></section>
    <section className="dashboard-grid two-up"><article className="dashboard-panel orders-intelligence"><div className="panel-heading between"><div><h2>Today’s order intelligence</h2><p>Top 10 opportunities, recalculated by each lens</p></div><span className="link-button">260 orders</span></div><div className="intel-tabs">{(["volume", "items", "salesperson"] as IntelKey[]).map((key) => <button key={key} className={intel === key ? "active" : ""} onClick={() => setIntel(key)}>{key === "volume" ? "By order volume" : key === "items" ? "By line items" : "By sales person"}</button>)}</div><div className="order-table"><div className="order-table-head"><span>#</span><span>Order & retailer</span><span>Value</span><span>Items</span><span>Signal</span></div>{orderRows[intel].map(([id, customer, value, items, rep, status], index) => <div className="order-table-row" key={`${intel}-${id}`}><span className="rank-number">{String(index + 1).padStart(2, "0")}</span><span><b>#{id}</b><small>{customer} · {rep}</small></span><strong>{value}</strong><span>{items}</span><span className={`status-pill ${status === "Priority" ? "priority" : ""}`}>{status}</span></div>)}</div></article><article className="dashboard-panel sales-card"><div className="panel-heading between"><div><h2>Top sales team</h2><p>Top 5 people making today happen</p></div><span className="more-dots">•••</span></div><div className="sales-tabs">{(["day", "week", "month"] as SalesPeriod[]).map((key) => <button key={key} className={salesPeriod === key ? "active" : ""} onClick={() => setSalesPeriod(key)}>{key === "day" ? "Today" : key === "week" ? "Week" : "Month"}</button>)}</div><div className="sales-list">{salesRows[salesPeriod].map(([name, total, orders, initials], index) => <div className="sales-row" key={name}><span className="rank-number">0{index + 1}</span><span className={`sales-avatar avatar-${index}`}>{initials}</span><span><b>{name}</b><small>{orders}</small></span><strong>{total}{index === 0 && <small> ★</small>}</strong></div>)}</div><button className="full-button" onClick={() => setNotice("Detailed sales leaderboard is ready for the next dashboard slice.")}>See sales leaderboard <span>→</span></button></article></section>
    <section className="dashboard-panel warehouse-pulse"><div className="panel-heading between"><div><h2>Warehouse pulse</h2><p>Read-only inventory health from the SAP network</p></div><span className="data-source-badge">SAP SOURCE · DEMO</span></div><div className="warehouse-card-grid">{warehouses.map((warehouse) => <div className="warehouse-card" key={warehouse.id}><div className="warehouse-card-title"><span className="warehouse-icon">⌂</span><span><b>{warehouse.name}</b><small>{warehouse.location}</small></span></div><div className="capacity-line"><span>Capacity used</span><b>{Math.round((warehouse.used / warehouse.capacity) * 100)}%</b></div><div className="capacity-bar"><i className={warehouse.status === "Watch" ? "warn" : ""} style={{ width: `${Math.round((warehouse.used / warehouse.capacity) * 100)}%` }} /></div><span className={`cover-pill ${warehouse.status === "Watch" ? "warn" : ""}`}>{warehouse.status === "Watch" ? "⚠" : "✓"} {warehouse.cover} days cover</span></div>)}</div></section>
    <section className="dashboard-panel inventory-preview"><div className="panel-heading between"><div><h2>Products by warehouse</h2><p>Imported fulfilment mapping · read only</p></div><input className="dashboard-search" placeholder="⌕ Search products" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="inventory-scroll"><table><thead><tr><th>Product</th><th>SKU</th><th>Stock on hand</th><th>Stock cover</th><th>Fulfil from</th></tr></thead><tbody>{filteredProducts.map((product) => <tr key={product.sku}><td><span className="product-cell"><i>{product.symbol}</i><span><b>{product.name}</b><small>{product.cover < 14 ? "Reorder recommended" : "Healthy stock cover"}</small></span></span></td><td className="mono-text">{product.sku}</td><td>{product.stock.toLocaleString("en-IN")}</td><td><b className={product.cover < 14 ? "warn-text" : "good-text"}>{product.cover} days</b></td><td><span className="warehouse-readonly">⌂ {warehouseName(product.warehouse)}</span></td></tr>)}</tbody></table></div></section>
    <p className="demo-note"><span>DEMO DATA</span> Numbers are seeded for preview · Last synced 2 min ago</p>
    {notice && <button className="dashboard-toast" onClick={() => setNotice(null)}><b>✓</b><span><strong>Done</strong><small>{notice}</small></span></button>}
  </div>;
}
