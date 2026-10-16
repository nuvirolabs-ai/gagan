import { useEffect, useState } from "react";
import { api } from "../api";
import { explain } from "../errorCopy";

interface Warehouse {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  city: string;
  state: string;
  pincode?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  isActive: boolean;
  activeSkus?: number;
  routedCities?: string[];
}

interface CityRouting {
  id: string;
  city: string;
  state: string;
  pincodes?: string | null;
  primaryWarehouseCode: string;
  fallbackWarehouseCode?: string | null;
  slaHours: number;
  isActive: boolean;
}

export default function Warehouses() {
  const [tab, setTab] = useState<"warehouses" | "routing" | "stock">("warehouses");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [routings, setRoutings] = useState<CityRouting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Modals
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [showAddRouting, setShowAddRouting] = useState(false);
  const [editingRouting, setEditingRouting] = useState<CityRouting | null>(null);

  // Gap 12: Stock Adjustments & Transfers state
  const [stockWarehouse, setStockWarehouse] = useState("WH-001");
  const [stockData, setStockData] = useState<any | null>(null);
  const [stockMovements, setStockMovements] = useState<any[]>([]);
  const [stockTransfers, setStockTransfers] = useState<any[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState({
    variantId: "",
    type: "receipt" as "receipt" | "spoilage" | "damage" | "discrepancy" | "audit_reconciliation",
    quantity: "10",
    reason: "",
    performedBy: "Warehouse Manager",
  });
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({
    fromWarehouseCode: "WH-001",
    toWarehouseCode: "WH-002",
    variantId: "",
    quantity: "20",
    notes: "",
  });

  // Forms
  const [warehouseForm, setWarehouseForm] = useState({
    code: "",
    name: "",
    address: "",
    city: "Indore",
    state: "Madhya Pradesh",
    pincode: "",
    contactName: "",
    contactPhone: "",
    isActive: true,
  });

  const [routingForm, setRoutingForm] = useState({
    city: "",
    state: "Madhya Pradesh",
    pincodes: "",
    primaryWarehouseCode: "WH-001",
    fallbackWarehouseCode: "",
    slaHours: 24,
    isActive: true,
  });

  const loadStock = async (whCode = stockWarehouse) => {
    setStockLoading(true);
    try {
      const [summary, movements, transfers] = await Promise.all([
        api.inventorySummary(whCode),
        api.inventoryMovements(whCode),
        api.inventoryTransfers(),
      ]);
      setStockData(summary);
      setStockMovements(movements.movements || []);
      setStockTransfers(transfers.transfers || []);
    } catch (err: any) {
      setError(err.message || "Failed to load stock data");
    } finally {
      setStockLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.warehouses();
      setWarehouses(data.warehouses ?? []);
      setRoutings(data.routings ?? []);
      setError(null);
    } catch (err) {
      setError(explain(err, "Could not load warehouses and routing rules"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createWarehouse(warehouseForm);
      setNotice(`Warehouse ${warehouseForm.code} - ${warehouseForm.name} created successfully.`);
      setShowAddWarehouse(false);
      setWarehouseForm({
        code: "",
        name: "",
        address: "",
        city: "Indore",
        state: "Madhya Pradesh",
        pincode: "",
        contactName: "",
        contactPhone: "",
        isActive: true,
      });
      await load();
    } catch (err) {
      setError(explain(err, "Could not create warehouse"));
    }
  };

  const handleUpdateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWarehouse) return;
    try {
      await api.updateWarehouse(editingWarehouse.id, {
        name: editingWarehouse.name,
        address: editingWarehouse.address,
        city: editingWarehouse.city,
        state: editingWarehouse.state,
        pincode: editingWarehouse.pincode,
        contactName: editingWarehouse.contactName,
        contactPhone: editingWarehouse.contactPhone,
        isActive: editingWarehouse.isActive,
      });
      setNotice(`Warehouse ${editingWarehouse.code} updated.`);
      setEditingWarehouse(null);
      await load();
    } catch (err) {
      setError(explain(err, "Could not update warehouse"));
    }
  };

  const handleSaveRouting = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.upsertCityRouting({
        city: routingForm.city.trim(),
        state: routingForm.state.trim(),
        pincodes: routingForm.pincodes.trim() || undefined,
        primaryWarehouseCode: routingForm.primaryWarehouseCode,
        fallbackWarehouseCode: routingForm.fallbackWarehouseCode || null,
        slaHours: Number(routingForm.slaHours) || 24,
        isActive: routingForm.isActive,
      });
      setNotice(`Fulfillment route for ${routingForm.city} configured.`);
      setShowAddRouting(false);
      setEditingRouting(null);
      setRoutingForm({
        city: "",
        state: "Madhya Pradesh",
        pincodes: "",
        primaryWarehouseCode: warehouses[0]?.code ?? "WH-001",
        fallbackWarehouseCode: "",
        slaHours: 24,
        isActive: true,
      });
      await load();
    } catch (err) {
      setError(explain(err, "Could not save routing rule"));
    }
  };

  const handleDeleteRouting = async (id: string, city: string) => {
    if (!window.confirm(`Are you sure you want to delete the routing rule for ${city}?`)) return;
    try {
      await api.deleteCityRouting(id);
      setNotice(`Routing rule for ${city} deleted.`);
      await load();
    } catch (err) {
      setError(explain(err, "Could not delete routing rule"));
    }
  };

  return (
    <div>
      <div className="between" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="page-title">Warehouses & Multi-Hub Routing</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Manage fulfillment hubs, warehouse inventory connections, and regional city routing policies.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {tab === "warehouses" && (
            <button onClick={() => setShowAddWarehouse(true)}>+ Add Warehouse Hub</button>
          )}
          {tab === "routing" && (
            <button onClick={() => setShowAddRouting(true)}>+ Add City Route</button>
          )}
          {tab === "stock" && (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="secondary" onClick={() => setShowTransferModal(true)}>+ New Stock Transfer</button>
              <button onClick={() => setShowAdjustmentModal(true)}>+ Record Stock Adjustment</button>
            </div>
          )}
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner success">{notice}</div>}

      <div className="tab-row" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          className={tab === "warehouses" ? "primary" : "secondary"}
          onClick={() => setTab("warehouses")}
        >
          Fulfillment Warehouses ({warehouses.length})
        </button>
        <button
          className={tab === "routing" ? "primary" : "secondary"}
          onClick={() => setTab("routing")}
        >
          City & Hub Routing Matrix ({routings.length})
        </button>
        <button
          className={tab === "stock" ? "primary" : "secondary"}
          onClick={() => {
            setTab("stock");
            void loadStock(stockWarehouse);
          }}
        >
          Stock Adjustments & Transfers (Gap 12)
        </button>
      </div>

      {tab === "warehouses" && (
        <>
          <div className="metrics" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
            <div className="metric card">
              <div className="metric-label">Total Warehouses</div>
              <div className="metric-value">{warehouses.length}</div>
            </div>
            <div className="metric card">
              <div className="metric-label">Active Hubs</div>
              <div className="metric-value">{warehouses.filter((w) => w.isActive).length}</div>
            </div>
            <div className="metric card">
              <div className="metric-label">Routed Cities</div>
              <div className="metric-value">{routings.length}</div>
            </div>
            <div className="metric card">
              <div className="metric-label">Primary Hub</div>
              <div className="metric-value" style={{ fontSize: 18, fontWeight: 600 }}>
                {warehouses[0]?.code ?? "WH-001"}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            {loading ? (
              <div className="muted" style={{ padding: 22 }}>Loading warehouses…</div>
            ) : warehouses.length === 0 ? (
              <div className="empty-state">No warehouses configured yet.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Hub Code</th>
                    <th>Warehouse Name</th>
                    <th>Location</th>
                    <th>Contact Manager</th>
                    <th>Routed Coverage</th>
                    <th>Status</th>
                    <th className="right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouses.map((wh) => (
                    <tr key={wh.id}>
                      <td>
                        <span className="pill" style={{ fontWeight: 700, letterSpacing: 0.5 }}>
                          {wh.code}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 650 }}>{wh.name}</div>
                        <div className="small muted">{wh.address || "No street address"}</div>
                      </td>
                      <td>
                        <div>{wh.city}, {wh.state}</div>
                        {wh.pincode && <div className="small muted">PIN: {wh.pincode}</div>}
                      </td>
                      <td>
                        <div>{wh.contactName || "Unassigned"}</div>
                        <div className="small muted">{wh.contactPhone || "—"}</div>
                      </td>
                      <td>
                        {wh.routedCities && wh.routedCities.length > 0 ? (
                          <div className="chip-row">
                            {wh.routedCities.map((c) => (
                              <span key={c} className="pill status-confirmed">{c}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="small muted">Fallback only</span>
                        )}
                      </td>
                      <td>
                        <span className={`pill ${wh.isActive ? "status-confirmed" : "status-rejected"}`}>
                          {wh.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="right">
                        <button
                          className="ghost sm"
                          onClick={() => setEditingWarehouse({ ...wh })}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === "routing" && (
        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <div className="muted" style={{ padding: 22 }}>Loading routing matrix…</div>
          ) : routings.length === 0 ? (
            <div className="empty-state">No city routing rules defined yet.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Delivery City</th>
                  <th>Primary Warehouse</th>
                  <th>Fallback Warehouse</th>
                  <th>Delivery SLA</th>
                  <th>Covered Pincodes</th>
                  <th>Status</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {routings.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 650 }}>{r.city}</div>
                      <div className="small muted">{r.state}</div>
                    </td>
                    <td>
                      <span className="pill status-confirmed" style={{ fontWeight: 600 }}>
                        {r.primaryWarehouseCode}
                      </span>
                    </td>
                    <td>
                      {r.fallbackWarehouseCode ? (
                        <span className="pill status-placed">{r.fallbackWarehouseCode}</span>
                      ) : (
                        <span className="small muted">None</span>
                      )}
                    </td>
                    <td>
                      <span className="pill">{r.slaHours} Hours</span>
                    </td>
                    <td>
                      <span className="small">{r.pincodes || "All City Pincodes"}</span>
                    </td>
                    <td>
                      <span className={`pill ${r.isActive ? "status-confirmed" : "status-rejected"}`}>
                        {r.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="right">
                      <button
                        className="ghost sm"
                        onClick={() => {
                          setEditingRouting(r);
                          setRoutingForm({
                            city: r.city,
                            state: r.state,
                            pincodes: r.pincodes || "",
                            primaryWarehouseCode: r.primaryWarehouseCode,
                            fallbackWarehouseCode: r.fallbackWarehouseCode || "",
                            slaHours: r.slaHours,
                            isActive: r.isActive,
                          });
                          setShowAddRouting(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="ghost sm danger"
                        style={{ marginLeft: 6 }}
                        onClick={() => handleDeleteRouting(r.id, r.city)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Gap 12: Stock Adjustments & Transfers Tab */}
      {tab === "stock" && (
        <div>
          {/* Top Hub Filter */}
          <div className="between" style={{ marginBottom: 16, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <label style={{ fontWeight: 600, fontSize: 13 }}>Current Hub:</label>
              <select
                value={stockWarehouse}
                onChange={(e) => {
                  setStockWarehouse(e.target.value);
                  void loadStock(e.target.value);
                }}
                style={{ minWidth: 240, padding: "6px 12px", borderRadius: 6, fontWeight: 500 }}
              >
                {warehouses.map((wh) => (
                  <option key={wh.code} value={wh.code}>
                    {wh.code} — {wh.name} ({wh.city})
                  </option>
                ))}
              </select>
            </div>
            <button className="secondary sm" onClick={() => void loadStock(stockWarehouse)}>
              Refresh Stock
            </button>
          </div>

          {/* Metrics */}
          <div className="metrics" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
            <div className="metric card">
              <div className="metric-label">Tracked SKUs</div>
              <div className="metric-value">{stockData?.metrics?.totalSkus ?? 0}</div>
            </div>
            <div className="metric card">
              <div className="metric-label">Total On-Hand Units</div>
              <div className="metric-value" style={{ color: "var(--primary)" }}>
                {stockData?.metrics?.totalOnHand?.toLocaleString("en-IN") ?? 0}
              </div>
            </div>
            <div className="metric card">
              <div className="metric-label">Committed To Orders</div>
              <div className="metric-value">{stockData?.metrics?.totalCommitted?.toLocaleString("en-IN") ?? 0}</div>
            </div>
            <div className="metric card">
              <div className="metric-label">Low Stock Warnings</div>
              <div
                className="metric-value"
                style={{ color: (stockData?.metrics?.lowStockCount ?? 0) > 0 ? "var(--danger)" : "var(--green)" }}
              >
                {stockData?.metrics?.lowStockCount ?? 0}
              </div>
            </div>
          </div>

          {/* Section 1: Stock On Hand Table */}
          <div className="card" style={{ marginBottom: 24, padding: 0 }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15 }}>SKU Inventory & Threshold Levels</h3>
                <div className="small muted">Live physical counts, order reservations, and alert thresholds</div>
              </div>
            </div>
            {stockLoading ? (
              <div className="muted" style={{ padding: 22 }}>Loading warehouse inventory…</div>
            ) : !stockData?.inventory || stockData.inventory.length === 0 ? (
              <div className="empty-state">No inventory snapshots found for {stockWarehouse}.</div>
            ) : (
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-muted, #f8f9fa)", textAlign: "left" }}>
                    <th style={{ padding: "10px 14px" }}>SKU Variant</th>
                    <th style={{ padding: "10px 14px" }}>Category</th>
                    <th style={{ padding: "10px 14px" }}>Packaging</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>On Hand</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Committed</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Available</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Alert Below</th>
                    <th style={{ padding: "10px 14px", textAlign: "center" }}>Stock Status</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Quick Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stockData.inventory.map((item: any) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>{item.productName}</td>
                      <td style={{ padding: "10px 14px", color: "var(--text-muted)" }}>{item.category}</td>
                      <td style={{ padding: "10px 14px" }}>{item.pack}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>{item.onHand}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", color: "var(--text-muted)" }}>{item.committed}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: item.isLowStock ? "var(--danger)" : "var(--green)" }}>
                        {item.available}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>
                        <button
                          className="ghost sm"
                          style={{ fontSize: 11, padding: "2px 6px" }}
                          onClick={() => {
                            const input = window.prompt("Enter new low-stock alert threshold (minimum units):", String(item.lowStockThreshold));
                            if (input !== null) {
                              const val = parseInt(input, 10);
                              if (!isNaN(val) && val >= 0) {
                                void api.setVariantLowStockThreshold(item.variantId, val).then(() => {
                                  setNotice("Low stock threshold updated");
                                  void loadStock(stockWarehouse);
                                });
                              }
                            }
                          }}
                        >
                          ≤ {item.lowStockThreshold} units ✎
                        </button>
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        {item.isLowStock ? (
                          <span className="pill" style={{ background: "#fee2e2", color: "#991b1b" }}>⚠ Low Stock</span>
                        ) : (
                          <span className="pill status-confirmed">✓ In Stock</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>
                        <button
                          className="sm secondary"
                          onClick={() => {
                            setAdjustmentForm({
                              variantId: item.variantId,
                              type: "receipt",
                              quantity: "10",
                              reason: "",
                              performedBy: "Warehouse Manager",
                            });
                            setShowAdjustmentModal(true);
                          }}
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Section 2: Movements Log & Transfers Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Movements Log */}
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0f0f0" }}>
                <h3 style={{ margin: 0, fontSize: 14 }}>Recent Stock Movements Audit</h3>
                <div className="small muted">Audited receipts, breakage, spoilage & discrepancies</div>
              </div>
              <div style={{ maxHeight: 320, overflowY: "auto" }}>
                {stockMovements.length === 0 ? (
                  <div className="empty-state" style={{ padding: 20 }}>No stock movements recorded yet.</div>
                ) : (
                  <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "var(--surface-muted, #f8f9fa)", textAlign: "left" }}>
                        <th style={{ padding: "8px 12px" }}>Time</th>
                        <th style={{ padding: "8px 12px" }}>SKU</th>
                        <th style={{ padding: "8px 12px" }}>Type</th>
                        <th style={{ padding: "8px 12px", textAlign: "right" }}>Qty</th>
                        <th style={{ padding: "8px 12px" }}>Reason & Actor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockMovements.map((m) => (
                        <tr key={m.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                          <td style={{ padding: "8px 12px", color: "var(--text-muted)", fontSize: 11 }}>
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td style={{ padding: "8px 12px", fontWeight: 600 }}>{m.variantName}</td>
                          <td style={{ padding: "8px 12px" }}>
                            <span
                              className="pill"
                              style={{
                                fontSize: 10,
                                background: m.type === "receipt" ? "#dcfce7" : m.type === "spoilage" ? "#fee2e2" : "#fef3c7",
                                color: m.type === "receipt" ? "#166534" : m.type === "spoilage" ? "#991b1b" : "#92400e",
                              }}
                            >
                              {m.type.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700 }}>
                            {m.type === "spoilage" || m.type === "damage" ? `-${m.quantity}` : `+${m.quantity}`}
                          </td>
                          <td style={{ padding: "8px 12px" }}>
                            <div>{m.reason}</div>
                            <div className="small muted">By {m.performedBy}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Inter-Warehouse Transfers */}
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 14 }}>Inter-Warehouse Transfers</h3>
                  <div className="small muted">Stock in-transit between company depots</div>
                </div>
                <button className="sm" onClick={() => setShowTransferModal(true)}>+ New Transfer</button>
              </div>
              <div style={{ maxHeight: 320, overflowY: "auto" }}>
                {stockTransfers.length === 0 ? (
                  <div className="empty-state" style={{ padding: 20 }}>No inter-warehouse transfers.</div>
                ) : (
                  <div style={{ padding: 12 }}>
                    {stockTransfers.map((t) => (
                      <div
                        key={t.id}
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: 6,
                          padding: 10,
                          marginBottom: 8,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>{t.transferNumber}</span>
                            <span
                              className="pill"
                              style={{
                                fontSize: 10,
                                background: t.status === "received" ? "#dcfce7" : t.status === "in_transit" ? "#fef3c7" : "#f1f5f9",
                                color: t.status === "received" ? "#166534" : t.status === "in_transit" ? "#92400e" : "#475569",
                              }}
                            >
                              {t.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="small muted" style={{ marginTop: 2 }}>
                            {t.fromWarehouseCode} → {t.toWarehouseCode} · {t.items?.length || 1} SKU item(s)
                          </div>
                          {t.notes && <div className="small" style={{ color: "#64748b", marginTop: 2 }}>"{t.notes}"</div>}
                        </div>
                        <div>
                          {t.status === "in_transit" && (
                            <button
                              className="sm"
                              onClick={async () => {
                                try {
                                  await api.updateTransferStatus(t.id, "received");
                                  setNotice(`Transfer ${t.transferNumber} marked as received.`);
                                  await loadStock(stockWarehouse);
                                } catch (err: any) {
                                  setError(err.message);
                                }
                              }}
                            >
                              Mark Received
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Record Stock Adjustment */}
      {showAdjustmentModal && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="card" style={{ width: 500, maxWidth: "90vw" }}>
            <h2 className="section-title">Record Stock Adjustment ({stockWarehouse})</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!adjustmentForm.variantId) return setError("Please select a SKU variant");
                try {
                  await api.recordStockAdjustment({
                    warehouseCode: stockWarehouse,
                    variantId: adjustmentForm.variantId,
                    type: adjustmentForm.type,
                    quantity: parseFloat(adjustmentForm.quantity),
                    reason: adjustmentForm.reason.trim(),
                    performedBy: adjustmentForm.performedBy,
                  });
                  setNotice("Stock adjustment recorded successfully.");
                  setShowAdjustmentModal(false);
                  setAdjustmentForm({ ...adjustmentForm, reason: "" });
                  await loadStock(stockWarehouse);
                } catch (err: any) {
                  setError(err.message || "Failed to record adjustment");
                }
              }}
            >
              <div className="form-grid">
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>Select SKU Variant *</label>
                  <select
                    value={adjustmentForm.variantId}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, variantId: e.target.value })}
                    required
                  >
                    <option value="">-- Choose Product SKU --</option>
                    {(stockData?.inventory ?? []).map((i: any) => (
                      <option key={i.variantId} value={i.variantId}>
                        {i.productName} ({i.pack}) — Current: {i.onHand}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Adjustment Type *</label>
                  <select
                    value={adjustmentForm.type}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, type: e.target.value as any })}
                  >
                    <option value="receipt">Stock Receipt / Inward (+)</option>
                    <option value="spoilage">Damage / Spoilage (-)</option>
                    <option value="discrepancy">Physical Discrepancy (Set Count)</option>
                    <option value="audit_reconciliation">Audit Reconciliation (Set Count)</option>
                  </select>
                </div>
                <div className="field">
                  <label>Quantity Units *</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={adjustmentForm.quantity}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, quantity: e.target.value })}
                    required
                  />
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>Audit Reason / Memo *</label>
                  <input
                    placeholder="e.g. Factory shipment batch, bag tear during unloading, physical audit"
                    value={adjustmentForm.reason}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
                <button type="button" className="secondary" onClick={() => setShowAdjustmentModal(false)}>
                  Cancel
                </button>
                <button type="submit">Commit Adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Stock Transfer */}
      {showTransferModal && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="card" style={{ width: 520, maxWidth: "90vw" }}>
            <h2 className="section-title">Initiate Inter-Warehouse Transfer</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!transferForm.variantId) return setError("Please select a SKU variant to transfer");
                try {
                  await api.createStockTransfer({
                    fromWarehouseCode: transferForm.fromWarehouseCode,
                    toWarehouseCode: transferForm.toWarehouseCode,
                    notes: transferForm.notes,
                    items: [{ variantId: transferForm.variantId, quantity: parseFloat(transferForm.quantity) }],
                  });
                  setNotice("Stock transfer initiated successfully.");
                  setShowTransferModal(false);
                  await loadStock(stockWarehouse);
                } catch (err: any) {
                  setError(err.message || "Failed to create transfer");
                }
              }}
            >
              <div className="form-grid">
                <div className="field">
                  <label>Source Hub (From) *</label>
                  <select
                    value={transferForm.fromWarehouseCode}
                    onChange={(e) => setTransferForm({ ...transferForm, fromWarehouseCode: e.target.value })}
                  >
                    {warehouses.map((w) => (
                      <option key={w.code} value={w.code}>{w.code} — {w.name}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Destination Hub (To) *</label>
                  <select
                    value={transferForm.toWarehouseCode}
                    onChange={(e) => setTransferForm({ ...transferForm, toWarehouseCode: e.target.value })}
                  >
                    {warehouses.map((w) => (
                      <option key={w.code} value={w.code}>{w.code} — {w.name}</option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>SKU Variant to Move *</label>
                  <select
                    value={transferForm.variantId}
                    onChange={(e) => setTransferForm({ ...transferForm, variantId: e.target.value })}
                    required
                  >
                    <option value="">-- Choose Product SKU --</option>
                    {(stockData?.inventory ?? []).map((i: any) => (
                      <option key={i.variantId} value={i.variantId}>
                        {i.productName} ({i.pack})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Transfer Quantity (Bags/Cases) *</label>
                  <input
                    type="number"
                    min="1"
                    value={transferForm.quantity}
                    onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label>Transfer Dispatch Notes</label>
                  <input
                    placeholder="e.g. Weekly replenishment transfer"
                    value={transferForm.notes}
                    onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
                <button type="button" className="secondary" onClick={() => setShowTransferModal(false)}>
                  Cancel
                </button>
                <button type="submit">Dispatch Transfer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Warehouse Modal */}
      {showAddWarehouse && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="card" style={{ width: 520, maxWidth: "90vw", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 className="section-title">Add Fulfillment Warehouse</h2>
            <form onSubmit={handleCreateWarehouse}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="wh-code">Hub Code *</label>
                  <input
                    id="wh-code"
                    placeholder="e.g. WH-003"
                    value={warehouseForm.code}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="wh-name">Warehouse Name *</label>
                  <input
                    id="wh-name"
                    placeholder="e.g. Ujjain Regional Depot"
                    value={warehouseForm.name}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="wh-addr">Street Address</label>
                  <input
                    id="wh-addr"
                    placeholder="Plot / Industrial Area"
                    value={warehouseForm.address}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, address: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="wh-city">City *</label>
                  <input
                    id="wh-city"
                    value={warehouseForm.city}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, city: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="wh-pin">Pincode</label>
                  <input
                    id="wh-pin"
                    value={warehouseForm.pincode}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, pincode: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="wh-mgr">Contact Manager Name</label>
                  <input
                    id="wh-mgr"
                    value={warehouseForm.contactName}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, contactName: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="wh-mgr-phone">Manager Phone</label>
                  <input
                    id="wh-mgr-phone"
                    value={warehouseForm.contactPhone}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, contactPhone: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
                <button type="button" className="secondary" onClick={() => setShowAddWarehouse(false)}>
                  Cancel
                </button>
                <button type="submit">Create Warehouse</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Warehouse Modal */}
      {editingWarehouse && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="card" style={{ width: 520, maxWidth: "90vw", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 className="section-title">Edit Warehouse: {editingWarehouse.code}</h2>
            <form onSubmit={handleUpdateWarehouse}>
              <div className="form-grid">
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="edit-wh-name">Warehouse Name *</label>
                  <input
                    id="edit-wh-name"
                    value={editingWarehouse.name}
                    onChange={(e) => setEditingWarehouse({ ...editingWarehouse, name: e.target.value })}
                    required
                  />
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="edit-wh-addr">Street Address</label>
                  <input
                    id="edit-wh-addr"
                    value={editingWarehouse.address || ""}
                    onChange={(e) => setEditingWarehouse({ ...editingWarehouse, address: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="edit-wh-city">City *</label>
                  <input
                    id="edit-wh-city"
                    value={editingWarehouse.city}
                    onChange={(e) => setEditingWarehouse({ ...editingWarehouse, city: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="edit-wh-pin">Pincode</label>
                  <input
                    id="edit-wh-pin"
                    value={editingWarehouse.pincode || ""}
                    onChange={(e) => setEditingWarehouse({ ...editingWarehouse, pincode: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="edit-wh-mgr">Contact Manager Name</label>
                  <input
                    id="edit-wh-mgr"
                    value={editingWarehouse.contactName || ""}
                    onChange={(e) => setEditingWarehouse({ ...editingWarehouse, contactName: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="edit-wh-mgr-phone">Manager Phone</label>
                  <input
                    id="edit-wh-mgr-phone"
                    value={editingWarehouse.contactPhone || ""}
                    onChange={(e) => setEditingWarehouse({ ...editingWarehouse, contactPhone: e.target.value })}
                  />
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label className="check-row" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={editingWarehouse.isActive}
                      onChange={(e) => setEditingWarehouse({ ...editingWarehouse, isActive: e.target.checked })}
                    />
                    <span>Active Hub (Enabled for Order Fulfillment Allocation)</span>
                  </label>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
                <button type="button" className="secondary" onClick={() => setEditingWarehouse(null)}>
                  Cancel
                </button>
                <button type="submit">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit City Route Modal */}
      {showAddRouting && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="card" style={{ width: 500, maxWidth: "90vw" }}>
            <h2 className="section-title">
              {editingRouting ? `Edit Route: ${editingRouting.city}` : "Add City Fulfillment Route"}
            </h2>
            <form onSubmit={handleSaveRouting}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="route-city">Delivery City *</label>
                  <input
                    id="route-city"
                    placeholder="e.g. Gwalior"
                    value={routingForm.city}
                    onChange={(e) => setRoutingForm({ ...routingForm, city: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="route-state">State</label>
                  <input
                    id="route-state"
                    value={routingForm.state}
                    onChange={(e) => setRoutingForm({ ...routingForm, state: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="route-primary">Primary Warehouse *</label>
                  <select
                    id="route-primary"
                    value={routingForm.primaryWarehouseCode}
                    onChange={(e) => setRoutingForm({ ...routingForm, primaryWarehouseCode: e.target.value })}
                    required
                  >
                    {warehouses.map((w) => (
                      <option key={w.code} value={w.code}>
                        {w.code} - {w.name} ({w.city})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="route-fallback">Fallback Warehouse</label>
                  <select
                    id="route-fallback"
                    value={routingForm.fallbackWarehouseCode}
                    onChange={(e) => setRoutingForm({ ...routingForm, fallbackWarehouseCode: e.target.value })}
                  >
                    <option value="">None</option>
                    {warehouses.map((w) => (
                      <option key={w.code} value={w.code}>
                        {w.code} - {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="route-sla">Delivery SLA (Hours)</label>
                  <input
                    id="route-sla"
                    type="number"
                    min="1"
                    max="168"
                    value={routingForm.slaHours}
                    onChange={(e) => setRoutingForm({ ...routingForm, slaHours: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="route-pincodes">Pincodes (Optional)</label>
                  <input
                    id="route-pincodes"
                    placeholder="Comma-separated or leave blank for all"
                    value={routingForm.pincodes}
                    onChange={(e) => setRoutingForm({ ...routingForm, pincodes: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setShowAddRouting(false);
                    setEditingRouting(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit">Save City Route</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
