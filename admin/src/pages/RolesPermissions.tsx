import { useEffect, useState } from "react";
import { api } from "../api";
import { explain } from "../errorCopy";

interface PermissionItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
}

interface RoleItem {
  id: string;
  name: string;
  description: string | null;
  color: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  permissionCount: number;
  staffCount: number;
  permissionIds: string[];
  permissions: PermissionItem[];
  sampleStaff: { id: string; name: string; email: string }[];
}

interface RbacMetrics {
  totalRoles: number;
  customRoles: number;
  totalPermissions: number;
  staffEnforced: number;
}

interface AuditEventItem {
  id: string;
  action: string;
  subjectType: string;
  subjectId: string;
  actorStaffId: string | null;
  createdAt: string;
  metadata: any;
}

const PRESET_COLORS = [
  { label: "Red", value: "#dc2626" },
  { label: "Blue", value: "#2563eb" },
  { label: "Emerald", value: "#059669" },
  { label: "Amber", value: "#d97706" },
  { label: "Purple", value: "#7c3aed" },
  { label: "Cyan", value: "#0891b2" },
  { label: "Orange", value: "#ea580c" },
];

export default function RolesPermissions() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [metrics, setMetrics] = useState<RbacMetrics | null>(null);
  const [categories, setCategories] = useState<Record<string, PermissionItem[]>>({});
  const [auditEvents, setAuditEvents] = useState<AuditEventItem[]>([]);

  const [activeTab, setActiveTab] = useState<"matrix" | "audit">("matrix");
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [activePermissionIds, setActivePermissionIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Create Role Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createRoleForm, setCreateRoleForm] = useState({
    name: "",
    description: "",
    color: "#2563eb",
    permissionIds: [] as string[],
  });
  const [createBusy, setCreateBusy] = useState(false);

  // Edit Role Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editRoleForm, setEditRoleForm] = useState({
    description: "",
    color: "#2563eb",
  });
  const [editBusy, setEditBusy] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes, auditRes] = await Promise.all([
        api.rbacRoles(),
        api.rbacPermissions(),
        api.rbacAuditTrail(),
      ]);

      const loadedRoles: RoleItem[] = rolesRes.roles || [];
      setRoles(loadedRoles);
      setMetrics(rolesRes.metrics || null);
      setCategories(permsRes.categories || {});
      setAuditEvents(auditRes.events || []);

      if (loadedRoles.length > 0) {
        const currentSelected = loadedRoles.find((r) => r.id === selectedRoleId) || loadedRoles[0];
        setSelectedRoleId(currentSelected.id);
        setActivePermissionIds(currentSelected.permissionIds || []);
      }
      setError(null);
    } catch (err) {
      setError(explain(err, "Failed to load RBAC permissions data"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSelectRole = (r: RoleItem) => {
    setSelectedRoleId(r.id);
    setActivePermissionIds(r.permissionIds || []);
  };

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  const togglePermission = (id: string) => {
    setActivePermissionIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const toggleCategoryAll = (catPerms: PermissionItem[]) => {
    const catIds = catPerms.map((p) => p.id);
    const allSelected = catIds.every((id) => activePermissionIds.includes(id));

    if (allSelected) {
      setActivePermissionIds((prev) => prev.filter((id) => !catIds.includes(id)));
    } else {
      setActivePermissionIds((prev) => Array.from(new Set([...prev, ...catIds])));
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    setSavingPermissions(true);
    setError(null);
    try {
      await api.updateRbacRolePermissions(selectedRole.id, activePermissionIds);
      setNotice(`Updated permissions matrix for "${selectedRole.name}" (${activePermissionIds.length} granted).`);
      await loadData();
    } catch (err) {
      setError(explain(err, "Failed to update permissions"));
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleCreateRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createRoleForm.name.trim()) {
      setError("Please specify a role name.");
      return;
    }

    setCreateBusy(true);
    setError(null);
    try {
      const res = await api.createRbacRole({
        name: createRoleForm.name.trim(),
        description: createRoleForm.description.trim() || undefined,
        color: createRoleForm.color,
        permissionIds: createRoleForm.permissionIds,
      });

      setNotice(`Custom role "${res.role.name}" created successfully!`);
      setShowCreateModal(false);
      setCreateRoleForm({
        name: "",
        description: "",
        color: "#2563eb",
        permissionIds: [],
      });
      await loadData();
      if (res.role?.id) {
        setSelectedRoleId(res.role.id);
      }
    } catch (err) {
      setError(explain(err, "Failed to create custom role"));
    } finally {
      setCreateBusy(false);
    }
  };

  const handleEditRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;

    setEditBusy(true);
    setError(null);
    try {
      await api.updateRbacRole(selectedRole.id, {
        description: editRoleForm.description.trim(),
        color: editRoleForm.color,
      });

      setNotice(`Updated role details for "${selectedRole.name}".`);
      setShowEditModal(false);
      await loadData();
    } catch (err) {
      setError(explain(err, "Failed to update role details"));
    } finally {
      setEditBusy(false);
    }
  };

  const handleDeleteRole = async (r: RoleItem) => {
    if (r.isSystem) {
      alert("System protected roles cannot be deleted.");
      return;
    }
    if (!confirm(`Are you sure you want to permanently delete custom role "${r.name}"?`)) return;

    setError(null);
    try {
      await api.deleteRbacRole(r.id);
      setNotice(`Custom role "${r.name}" deleted.`);
      await loadData();
    } catch (err) {
      setError(explain(err, "Failed to delete role"));
    }
  };

  const isDirty = selectedRole
    ? JSON.stringify(selectedRole.permissionIds.slice().sort()) !==
      JSON.stringify(activePermissionIds.slice().sort())
    : false;

  return (
    <div style={{ maxWidth: 1240, paddingBottom: 60 }}>
      {/* Top Header */}
      <div className="between" style={{ marginBottom: 18, alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            Role-Based Access Control (RBAC) & Permissions Editor
          </h1>
          <p className="page-sub" style={{ margin: "4px 0 0" }}>
            Define custom internal organizational roles, configure granular module permissions, and inspect security audit trails.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="secondary" onClick={() => void loadData()} disabled={loading}>
            Refresh
          </button>
          <button
            className="primary"
            style={{ background: "#7c3aed", borderColor: "#7c3aed", display: "flex", alignItems: "center", gap: 6 }}
            onClick={() => {
              setCreateRoleForm({
                name: "",
                description: "",
                color: "#7c3aed",
                permissionIds: [],
              });
              setShowCreateModal(true);
            }}
          >
            <span>🛡️</span> + Create Custom Role
          </button>
        </div>
      </div>

      {notice && (
        <div className="banner success" style={{ marginBottom: 16 }}>
          {notice}
          <button className="ghost" style={{ float: "right", padding: 0 }} onClick={() => setNotice(null)}>
            ✕
          </button>
        </div>
      )}
      {error && (
        <div className="banner error" style={{ marginBottom: 16 }}>
          {error}
          <button className="ghost" style={{ float: "right", padding: 0 }} onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div className="card" style={{ padding: 18, borderLeft: "4px solid #7c3aed" }}>
          <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
            Total Roles
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#111827", marginTop: 4 }}>
            {metrics?.totalRoles ?? "—"}
          </div>
          <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>
            Active system and custom roles
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: "4px solid #ea580c" }}>
          <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
            Custom Roles
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#ea580c", marginTop: 4 }}>
            {metrics?.customRoles ?? "—"}
          </div>
          <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>
            Created by operations administrators
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: "4px solid #059669" }}>
          <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
            Governed Permissions
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#059669", marginTop: 4 }}>
            {metrics?.totalPermissions ?? "—"}
          </div>
          <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>
            Granular action tokens tracked
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: "4px solid #2563eb" }}>
          <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
            Staff Enforced
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#2563eb", marginTop: 4 }}>
            {metrics?.staffEnforced ?? "—"}
          </div>
          <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>
            Distinct staff users with roles
          </div>
        </div>
      </div>

      {/* Main Mode Tabs */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, borderBottom: "2px solid #e5e7eb" }}>
        <button
          type="button"
          onClick={() => setActiveTab("matrix")}
          style={{
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 700,
            background: "none",
            border: "none",
            cursor: "pointer",
            borderBottom: activeTab === "matrix" ? "3px solid #7c3aed" : "3px solid transparent",
            color: activeTab === "matrix" ? "#7c3aed" : "#6b7280",
            marginBottom: -2,
          }}
        >
          🔐 Roles & Permissions Matrix
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("audit")}
          style={{
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 700,
            background: "none",
            border: "none",
            cursor: "pointer",
            borderBottom: activeTab === "audit" ? "3px solid #7c3aed" : "3px solid transparent",
            color: activeTab === "audit" ? "#7c3aed" : "#6b7280",
            marginBottom: -2,
          }}
        >
          📜 Security Governance Audit Trail ({auditEvents.length})
        </button>
      </div>

      {/* TAB 1: Roles & Permissions Matrix */}
      {activeTab === "matrix" && (
        <div>
          {/* Role Selector Badges */}
          <div className="card" style={{ padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 10 }}>
              Select Role To Edit Permissions:
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {roles.map((r) => {
                const isSelected = r.id === selectedRoleId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelectRole(r)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 14px",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: isSelected ? 800 : 600,
                      cursor: "pointer",
                      border: isSelected ? `2px solid ${r.color || "#7c3aed"}` : "1px solid #d1d5db",
                      background: isSelected ? "#faf5ff" : "#fff",
                      color: isSelected ? "#581c87" : "#374151",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: r.color || "#7c3aed",
                      }}
                    />
                    <span>{r.name}</span>
                    <span
                      style={{
                        padding: "1px 6px",
                        borderRadius: 10,
                        fontSize: 10,
                        fontWeight: 700,
                        background: r.isSystem ? "#f3f4f6" : "#ffedd5",
                        color: r.isSystem ? "#4b5563" : "#c2410c",
                      }}
                    >
                      {r.isSystem ? "SYSTEM" : "CUSTOM"}
                    </span>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>
                      ({r.permissionCount} perms)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Role Actions & Permissions Grid */}
          {selectedRole ? (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {/* Header Box */}
              <div
                style={{
                  padding: "18px 24px",
                  background: "#f9fafb",
                  borderBottom: "1px solid #e5e7eb",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: selectedRole.color || "#7c3aed",
                      }}
                    />
                    <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: "#111827" }}>
                      {selectedRole.name}
                    </h2>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700,
                        background: selectedRole.isSystem ? "#e5e7eb" : "#ffedd5",
                        color: selectedRole.isSystem ? "#374151" : "#c2410c",
                      }}
                    >
                      {selectedRole.isSystem ? "🔒 Protected System Role" : "⭐ Custom Configured Role"}
                    </span>
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "#4b5563" }}>
                    {selectedRole.description || "No description provided."} · Assigned to {selectedRole.staffCount} staff member(s).
                  </p>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    className="secondary"
                    style={{ fontSize: 12, padding: "6px 12px" }}
                    onClick={() => {
                      setEditRoleForm({
                        description: selectedRole.description || "",
                        color: selectedRole.color || "#7c3aed",
                      });
                      setShowEditModal(true);
                    }}
                  >
                    ✏️ Edit Details
                  </button>
                  {!selectedRole.isSystem && (
                    <button
                      className="ghost"
                      style={{ fontSize: 12, padding: "6px 12px", color: "#b91c1c" }}
                      onClick={() => void handleDeleteRole(selectedRole)}
                    >
                      🗑️ Delete Role
                    </button>
                  )}
                  <button
                    className="primary"
                    disabled={savingPermissions || !isDirty}
                    style={{
                      background: isDirty ? "#059669" : "#9ca3af",
                      borderColor: isDirty ? "#059669" : "#9ca3af",
                      padding: "8px 16px",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                    onClick={() => void handleSavePermissions()}
                  >
                    {savingPermissions
                      ? "Saving..."
                      : isDirty
                      ? `💾 Save Changes (${activePermissionIds.length} Granted)`
                      : `✓ Permissions Saved (${activePermissionIds.length})`}
                  </button>
                </div>
              </div>

              {/* Categorized Permissions Grid */}
              <div style={{ padding: 24 }}>
                {Object.entries(categories).map(([categoryName, catPerms]) => {
                  const catGrantedCount = catPerms.filter((p) =>
                    activePermissionIds.includes(p.id)
                  ).length;
                  const allCatSelected = catGrantedCount === catPerms.length;

                  return (
                    <div
                      key={categoryName}
                      style={{
                        marginBottom: 24,
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        overflow: "hidden",
                      }}
                    >
                      {/* Category Header */}
                      <div
                        style={{
                          padding: "10px 16px",
                          background: "#f8fafc",
                          borderBottom: "1px solid #e5e7eb",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
                            {categoryName}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: 10,
                              background: catGrantedCount > 0 ? "#ecfdf5" : "#f1f5f9",
                              color: catGrantedCount > 0 ? "#065f46" : "#64748b",
                            }}
                          >
                            {catGrantedCount} / {catPerms.length} active
                          </span>
                        </div>

                        <button
                          type="button"
                          className="ghost"
                          style={{ fontSize: 11, padding: "2px 8px", color: "#2563eb", fontWeight: 700 }}
                          onClick={() => toggleCategoryAll(catPerms)}
                        >
                          {allCatSelected ? "Deselect All" : "Select All in Category"}
                        </button>
                      </div>

                      {/* Permissions List in Category */}
                      <div
                        style={{
                          padding: "12px 16px",
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                          gap: 12,
                        }}
                      >
                        {catPerms.map((p) => {
                          const isChecked = activePermissionIds.includes(p.id);
                          return (
                            <label
                              key={p.id}
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 10,
                                padding: 8,
                                borderRadius: 6,
                                background: isChecked ? "#f0fdf4" : "transparent",
                                border: `1px solid ${isChecked ? "#bbf7d0" : "#f3f4f6"}`,
                                cursor: "pointer",
                                transition: "all 0.1s ease",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => togglePermission(p.id)}
                                style={{ marginTop: 3, cursor: "pointer" }}
                              />
                              <div>
                                <div
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: isChecked ? "#15803d" : "#374151",
                                    fontFamily: "monospace",
                                  }}
                                >
                                  {p.name}
                                </div>
                                {p.description && (
                                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                                    {p.description}
                                  </div>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
              Please select a role from the top list to configure permissions.
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Security Governance Audit Trail */}
      {activeTab === "audit" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#111827" }}>
              Security Governance & Privilege Changes Audit Trail ({auditEvents.length})
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280" }}>
              Immutable system record of RBAC modifications, role lifecycle events, and emergency administrative actions.
            </p>
          </div>

          {auditEvents.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
              No security audit events recorded yet.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: "10px 16px", fontWeight: 700, color: "#4b5563", fontSize: 11, textTransform: "uppercase" }}>
                      Timestamp (IST)
                    </th>
                    <th style={{ padding: "10px 16px", fontWeight: 700, color: "#4b5563", fontSize: 11, textTransform: "uppercase" }}>
                      Action Token
                    </th>
                    <th style={{ padding: "10px 16px", fontWeight: 700, color: "#4b5563", fontSize: 11, textTransform: "uppercase" }}>
                      Subject Type
                    </th>
                    <th style={{ padding: "10px 16px", fontWeight: 700, color: "#4b5563", fontSize: 11, textTransform: "uppercase" }}>
                      Details & Modifications
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {auditEvents.map((evt) => (
                    <tr key={evt.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap", color: "#4b5563" }}>
                        {new Date(evt.createdAt).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            fontFamily: "monospace",
                            background: evt.action.includes("create")
                              ? "#ecfdf5"
                              : evt.action.includes("delete") || evt.action.includes("cancel")
                              ? "#fef2f2"
                              : "#eff6ff",
                            color: evt.action.includes("create")
                              ? "#065f46"
                              : evt.action.includes("delete") || evt.action.includes("cancel")
                              ? "#b91c1c"
                              : "#1d4ed8",
                          }}
                        >
                          {evt.action}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: "#374151" }}>
                        {evt.subjectType.toUpperCase()}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#4b5563", fontSize: 12 }}>
                        {evt.metadata ? (
                          <pre
                            style={{
                              margin: 0,
                              fontFamily: "monospace",
                              fontSize: 11,
                              background: "#f9fafb",
                              padding: "4px 8px",
                              borderRadius: 4,
                              maxWidth: 480,
                              overflowX: "auto",
                            }}
                          >
                            {JSON.stringify(evt.metadata, null, 1)}
                          </pre>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Custom Role Modal */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 580,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
            }}
          >
            <div className="between" style={{ marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}>
                Create Custom Organization Role
              </h2>
              <button
                className="ghost"
                style={{ fontSize: 16, padding: "2px 8px" }}
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRoleSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  Role Name * (e.g. Regional Accounts Lead, Inventory Auditor)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. regional_accounts_lead"
                  value={createRoleForm.name}
                  onChange={(e) => setCreateRoleForm({ ...createRoleForm, name: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", fontSize: 13, borderRadius: 6, border: "1px solid #d1d5db" }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  Role Purpose / Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe operational responsibilities and approval authority..."
                  value={createRoleForm.description}
                  onChange={(e) => setCreateRoleForm({ ...createRoleForm, description: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", fontSize: 13, borderRadius: 6, border: "1px solid #d1d5db" }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Badge Color Theme
                </label>
                <div style={{ display: "flex", gap: 10 }}>
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCreateRoleForm({ ...createRoleForm, color: c.value })}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: c.value,
                        border: createRoleForm.color === c.value ? "3px solid #111827" : "1px solid transparent",
                        cursor: "pointer",
                      }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div className="between" style={{ marginTop: 20 }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={createBusy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary"
                  style={{ background: "#7c3aed", borderColor: "#7c3aed" }}
                  disabled={createBusy}
                >
                  {createBusy ? "Creating Role..." : "Create Custom Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role Details Modal */}
      {showEditModal && selectedRole && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 500,
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
            }}
          >
            <div className="between" style={{ marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}>
                Edit Role: {selectedRole.name}
              </h2>
              <button
                className="ghost"
                style={{ fontSize: 16, padding: "2px 8px" }}
                onClick={() => setShowEditModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditRoleSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  Description / Responsibilities
                </label>
                <textarea
                  rows={3}
                  value={editRoleForm.description}
                  onChange={(e) => setEditRoleForm({ ...editRoleForm, description: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", fontSize: 13, borderRadius: 6, border: "1px solid #d1d5db" }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Badge Color Theme
                </label>
                <div style={{ display: "flex", gap: 10 }}>
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setEditRoleForm({ ...editRoleForm, color: c.value })}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: c.value,
                        border: editRoleForm.color === c.value ? "3px solid #111827" : "1px solid transparent",
                        cursor: "pointer",
                      }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div className="between" style={{ marginTop: 20 }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setShowEditModal(false)}
                  disabled={editBusy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary"
                  style={{ background: "#7c3aed", borderColor: "#7c3aed" }}
                  disabled={editBusy}
                >
                  {editBusy ? "Saving..." : "Save Details"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
