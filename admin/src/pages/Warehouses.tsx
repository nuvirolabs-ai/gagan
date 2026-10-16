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
  const [tab, setTab] = useState<"warehouses" | "routing">("warehouses");
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
          {tab === "warehouses" ? (
            <button onClick={() => setShowAddWarehouse(true)}>+ Add Warehouse Hub</button>
          ) : (
            <button onClick={() => setShowAddRouting(true)}>+ Add City Route</button>
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
