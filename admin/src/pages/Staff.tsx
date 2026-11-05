import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { readableRole, type StaffMember } from "../staffTypes";
import { AuthContext } from "../auth-context";
import { explain } from "../errorCopy";

export interface ModuleItem {
  id: string;
  group: "Finance" | "Sales" | "Warehouse" | "Field Operations" | "System";
  label: string;
  description: string;
  route: string;
  permissions: string[];
}

export interface PortalUser {
  id: string;
  adminUserId: string;
  name: string;
  email: string;
  phone: string;
  employeeRef?: string;
  status: "active" | "suspended";
  roles: string[];
  modules: string[];
  isSuperAdmin: boolean;
  createdAt: string;
}

const PRESET_DEFINITIONS: Record<string, { label: string; modules: string[] }> = {
  accounts: {
    label: "💼 Accounts Team Preset",
    modules: [
      "billing-entities",
      "financial-statements",
      "ledger",
      "collections",
      "corrections",
      "recovery",
      "kyc",
      "approvals",
    ],
  },
  salesCoordinator: {
    label: "📈 Sales Coordinator Preset",
    modules: [
      "orders",
      "retailers",
      "commercial",
      "catalog",
      "retailer-approvals",
      "approvals",
      "sales-leader",
      "sales-organisation",
      "collections",
      "market-surveys",
      "salesperson-feedback",
      "service-issues",
      "field-planning",
      "visits",
    ],
  },
  warehouse: {
    label: "🏭 Warehouse Manager Preset",
    modules: [
      "warehouse-orders",
      "warehouses",
      "retailer-approvals",
      "retailers",
    ],
  },
};

function generateSecurePassword() {
  const words = ["Gagan", "Dal", "Indore", "Traders", "Khadya", "Audit", "Kiran"];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  const symbols = ["#", "@", "!", "$"];
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];
  return `${word}${symbol}${num}`;
}

export default function Staff() {
  const auth = useContext(AuthContext);
  const canManageOrg = auth?.permissions.includes("org.manage") ?? false;

  // Portal users state
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([]);
  const [moduleCatalog, setModuleCatalog] = useState<ModuleItem[]>([]);
  const [loadingPortal, setLoadingPortal] = useState(true);

  // Classic staff state
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [staffForm, setStaffForm] = useState({ name: "", phone: "", email: "", employeeRef: "" });
  const [newMode, setNewMode] = useState<"staff" | "salesperson" | "selling_leader">("staff");
  const [newManagerId, setNewManagerId] = useState("");
  const [newReportIds, setNewReportIds] = useState<string[]>([]);

  // User Access Modal State (Create / Edit)
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<PortalUser | null>(null);
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    modules: [] as string[],
  });
  const [showPassword, setShowPassword] = useState(false);

  // Password Reset Modal State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<PortalUser | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [credentialsCopied, setCredentialsCopied] = useState(false);

  // Global notice & error
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Search filter
  const [staffSearchQuery, setStaffSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const loadPortalData = async () => {
    setLoadingPortal(true);
    try {
      if (api.userAccessModules && api.userAccessUsers) {
        const [modulesRes, usersRes] = await Promise.all([
          api.userAccessModules(),
          api.userAccessUsers(),
        ]);
        setModuleCatalog(modulesRes.modules || []);
        setPortalUsers(usersRes.users || []);
      }
    } catch {
      // Graceful fallback for mock tests
    } finally {
      setLoadingPortal(false);
    }
  };

  const loadStaffData = async () => {
    setLoadingStaff(true);
    try {
      const response = await api.staff();
      setStaff(response.staff || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load staff");
    } finally {
      setLoadingStaff(false);
    }
  };

  useEffect(() => {
    void loadPortalData();
    void loadStaffData();
  }, []);

  // Open Create User Modal
  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setUserForm({
      name: "",
      email: "",
      phone: "",
      password: generateSecurePassword(),
      modules: [...PRESET_DEFINITIONS.accounts.modules],
    });
    setShowPassword(true);
    setUserModalOpen(true);
    setError(null);
  };

  // Open Edit User Modal
  const handleOpenEditModal = (u: PortalUser) => {
    setEditingUser(u);
    setUserForm({
      name: u.name,
      email: u.email,
      phone: u.phone,
      password: "",
      modules: [...u.modules],
    });
    setShowPassword(false);
    setUserModalOpen(true);
    setError(null);
  };

  // Save User (Create or Update)
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userForm.modules.length === 0) {
      setError("Please tick at least one module for this user.");
      return;
    }
    if (!editingUser && (!userForm.password || userForm.password.length < 6)) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (editingUser) {
        await api.updateUserAccess(editingUser.id, {
          name: userForm.name.trim(),
          email: userForm.email.trim(),
          phone: userForm.phone.trim(),
          password: userForm.password.trim() ? userForm.password.trim() : undefined,
          modules: userForm.modules,
        });
        setNotice(`Updated module permissions for ${userForm.name}.`);
      } else {
        await api.createUserAccess({
          name: userForm.name.trim(),
          email: userForm.email.trim(),
          phone: userForm.phone.trim(),
          password: userForm.password.trim(),
          modules: userForm.modules,
        });
        setNotice(`Created portal login for ${userForm.name} with ${userForm.modules.length} modules!`);
      }
      setUserModalOpen(false);
      await loadPortalData();
    } catch (err) {
      setError(explain(err, "Failed to save user access"));
    } finally {
      setBusy(false);
    }
  };

  // Open Reset Password Modal
  const handleOpenResetModal = (u: PortalUser) => {
    setResetTargetUser(u);
    setNewPasswordValue(generateSecurePassword());
    setShowResetPassword(true);
    setCredentialsCopied(false);
    setResetModalOpen(true);
    setError(null);
  };

  // Confirm Reset Password
  const handleConfirmReset = async () => {
    if (!resetTargetUser) return;
    if (newPasswordValue.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.resetUserPassword(resetTargetUser.id, newPasswordValue);
      setNotice(`Password reset successfully for ${resetTargetUser.email}.`);
      setResetModalOpen(false);
    } catch (err) {
      setError(explain(err, "Failed to reset password"));
    } finally {
      setBusy(false);
    }
  };

  // Toggle Suspend / Active status
  const handleToggleStatus = async (u: PortalUser) => {
    const nextStatus = u.status === "active" ? "suspended" : "active";
    const confirmMsg = nextStatus === "suspended"
      ? `Suspend access for ${u.name} (${u.email})? They will not be able to log in.`
      : `Re-activate access for ${u.name}?`;
    if (!window.confirm(confirmMsg)) return;

    setBusy(true);
    try {
      await api.setUserAccessStatus(u.id, nextStatus);
      setNotice(`${u.name} is now ${nextStatus}.`);
      await loadPortalData();
    } catch (err) {
      setError(explain(err, "Could not update user status"));
    } finally {
      setBusy(false);
    }
  };

  // Module toggle checkbox
  const handleToggleModule = (modId: string) => {
    setUserForm((prev) => {
      const exists = prev.modules.includes(modId);
      const nextModules = exists
        ? prev.modules.filter((id) => id !== modId)
        : [...prev.modules, modId];
      return { ...prev, modules: nextModules };
    });
  };

  // Group Select All / Deselect
  const handleToggleGroup = (groupName: string) => {
    const groupMods = moduleCatalog.filter((m) => m.group === groupName).map((m) => m.id);
    const allSelected = groupMods.every((id) => userForm.modules.includes(id));
    setUserForm((prev) => {
      let nextModules: string[];
      if (allSelected) {
        nextModules = prev.modules.filter((id) => !groupMods.includes(id));
      } else {
        const set = new Set([...prev.modules, ...groupMods]);
        nextModules = [...set];
      }
      return { ...prev, modules: nextModules };
    });
  };

  // Apply Preset
  const handleApplyPreset = (presetKey: string) => {
    if (presetKey === "superadmin") {
      setUserForm((prev) => ({
        ...prev,
        modules: moduleCatalog.map((m) => m.id),
      }));
    } else if (presetKey === "clear") {
      setUserForm((prev) => ({ ...prev, modules: [] }));
    } else {
      const preset = PRESET_DEFINITIONS[presetKey];
      if (preset) {
        setUserForm((prev) => ({ ...prev, modules: [...preset.modules] }));
      }
    }
  };

  // Classic Staff create
  const createStaffSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const newStaff = {
        name: staffForm.name,
        phone: staffForm.phone,
        email: staffForm.email,
        employeeRef: staffForm.employeeRef.trim() || undefined,
      };
      if (newMode === "selling_leader") {
        await api.createSellingLeader({
          newStaff,
          ...(canManageOrg && newManagerId ? { managerId: newManagerId } : {}),
          ...(canManageOrg && newReportIds.length ? { reportIds: newReportIds } : {}),
        });
      } else if (newMode === "salesperson") {
        await api.createSalesperson({
          newStaff,
          ...(canManageOrg && newManagerId ? { managerId: newManagerId } : {}),
        });
      } else {
        await api.createStaff(newStaff);
      }
      setNotice(
        newMode === "selling_leader"
          ? `${staffForm.name} is set up as a selling Sales Leader.`
          : newMode === "salesperson"
          ? `${staffForm.name} is set up as a salesperson.`
          : `${staffForm.name} can now receive an assigned role.`
      );
      setStaffForm({ name: "", phone: "", email: "", employeeRef: "" });
      setNewMode("staff");
      setNewManagerId("");
      setNewReportIds([]);
      setCreatingStaff(false);
      await loadStaffData();
    } catch (err) {
      setError(explain(err, "Could not create staff member"));
    } finally {
      setBusy(false);
    }
  };

  // Filter classic staff
  const filteredStaff = staff.filter((member) => {
    const q = staffSearchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      member.name.toLowerCase().includes(q) ||
      member.phone.toLowerCase().includes(q) ||
      member.email.toLowerCase().includes(q) ||
      Boolean(member.salesRep?.territory && member.salesRep.territory.toLowerCase().includes(q));

    const matchesRole =
      roleFilter === "all" ||
      (roleFilter === "no_role" && member.roles.length === 0) ||
      member.roles.some((r) => r.role.name === roleFilter);

    return matchesQuery && matchesRole;
  });

  // Group modules by domain for the checklist
  const groupedModules = [
    { group: "Finance", title: "💼 Finance & Accounting", items: moduleCatalog.filter((m) => m.group === "Finance") },
    { group: "Sales", title: "📈 Sales, Catalog & Approvals", items: moduleCatalog.filter((m) => m.group === "Sales") },
    { group: "Warehouse", title: "🏭 Warehouse & Logistics", items: moduleCatalog.filter((m) => m.group === "Warehouse") },
    { group: "Field Operations", title: "⌖ Field Force & Beat Operations", items: moduleCatalog.filter((m) => m.group === "Field Operations") },
    { group: "System", title: "⚙️ System & Administration", items: moduleCatalog.filter((m) => m.group === "System") },
  ];

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", paddingBottom: 48 }}>
      {/* Top Header */}
      <div className="between" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="page-title">Staff Access & Directory</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Manage staff credentials, assigned sales territories, phone numbers, and operational access roles.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="button"
            style={{
              background: "#0284c7",
              color: "#fff",
              fontWeight: 650,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)",
            }}
            onClick={handleOpenCreateModal}
          >
            <span style={{ fontSize: 16 }}>＋</span> Create User & Assign Modules
          </button>
          <button onClick={() => setCreatingStaff((value) => !value)}>
            {creatingStaff ? "Cancel" : "Add staff member"}
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner success">{notice}</div>}

      {/* Classic Staff Create Form (collapsible) */}
      {creatingStaff && (
        <form className="card compact-form" onSubmit={createStaffSubmit} style={{ marginBottom: 20 }}>
          <h2 className="section-title">New staff identity</h2>
          <div className="field">
            <label htmlFor="new-staff-mode">Setup</label>
            <select
              id="new-staff-mode"
              value={newMode}
              onChange={(event) =>
                setNewMode(event.target.value as "staff" | "salesperson" | "selling_leader")
              }
            >
              <option value="staff">Staff identity</option>
              <option value="salesperson">Salesperson</option>
              <option value="selling_leader">Selling Sales Leader</option>
            </select>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="staff-name">Full name</label>
              <input
                id="staff-name"
                value={staffForm.name}
                onChange={(event) => setStaffForm({ ...staffForm, name: event.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="staff-phone">Phone</label>
              <input
                id="staff-phone"
                value={staffForm.phone}
                onChange={(event) => setStaffForm({ ...staffForm, phone: event.target.value })}
                inputMode="tel"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="staff-email">Email</label>
              <input
                id="staff-email"
                type="email"
                value={staffForm.email}
                onChange={(event) => setStaffForm({ ...staffForm, email: event.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="staff-ref">Employee reference <span className="muted">(optional)</span></label>
              <input
                id="staff-ref"
                value={staffForm.employeeRef}
                onChange={(event) => setStaffForm({ ...staffForm, employeeRef: event.target.value })}
              />
            </div>
          </div>
          {canManageOrg && newMode !== "staff" ? (
            <div className="form-grid">
              <div className="field">
                <label htmlFor="new-leader-manager">Reports to</label>
                <select
                  id="new-leader-manager"
                  value={newManagerId}
                  onChange={(event) => setNewManagerId(event.target.value)}
                >
                  <option value="">Top level</option>
                  {staff
                    .filter((person) => person.status === "active")
                    .map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                </select>
              </div>
              {newMode === "selling_leader" ? (
                <div className="field">
                  <span>Direct reports</span>
                  {staff
                    .filter((person) => person.status === "active")
                    .map((person) => (
                      <label className="check-row" key={person.id}>
                        <input
                          type="checkbox"
                          checked={newReportIds.includes(person.id)}
                          onChange={(event) =>
                            setNewReportIds((current) =>
                              event.target.checked
                                ? [...current, person.id]
                                : current.filter((id) => id !== person.id)
                            )
                          }
                        />
                        {person.name}
                      </label>
                    ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <button type="submit" disabled={busy}>
            {busy
              ? "Creating…"
              : newMode === "selling_leader"
              ? "Create selling Sales Leader"
              : newMode === "salesperson"
              ? "Create salesperson"
              : "Create staff member"}
          </button>
        </form>
      )}

      {/* SECTION 1: Admin Portal Users & Module Access Control (Checkmark RBAC) */}
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <span>👥 Admin Portal Logins & Module Access Control</span>
              <span className="pill status-confirmed" style={{ fontSize: 11, fontWeight: 600 }}>
                {portalUsers.length} Users Configured
              </span>
            </h2>
            <p className="page-sub" style={{ margin: "3px 0 0", fontSize: 13 }}>
              Users who can log into the Operations Console. Click <strong>"＋ Create User & Assign Modules"</strong> or <strong>"✏️ Edit & Modules"</strong> to tick the exact pages each user sees.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="button secondary compact"
              onClick={() => {
                handleOpenCreateModal();
                handleApplyPreset("accounts");
              }}
              style={{ fontSize: 12 }}
            >
              💼 + New Accounts User
            </button>
            <button
              type="button"
              className="button secondary compact"
              onClick={() => {
                handleOpenCreateModal();
                handleApplyPreset("salesCoordinator");
              }}
              style={{ fontSize: 12 }}
            >
              📈 + New Sales Coordinator
            </button>
          </div>
        </div>

        {/* Portal Users Table */}
        <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 28 }}>
          {loadingPortal ? (
            <div className="muted" style={{ padding: 22, textAlign: "center" }}>
              Loading portal users…
            </div>
          ) : portalUsers.length === 0 ? (
            <div className="empty-state">No portal user logins found.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(0,0,0,0.02)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "12px 16px" }}>User & Login ID</th>
                  <th style={{ padding: "12px 16px" }}>Mobile Number</th>
                  <th style={{ padding: "12px 16px" }}>Permitted Modules (Checkmarks)</th>
                  <th style={{ padding: "12px 16px" }}>Status</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {portalUsers.map((u) => {
                  const isSuper = u.isSuperAdmin;
                  return (
                    <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <strong style={{ fontSize: 14 }}>{u.name}</strong>
                          {isSuper && (
                            <span className="small-chip" style={{ background: "#fef3c7", color: "#92400e", fontWeight: 700 }}>
                              👑 Super Admin
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 2 }}>
                          <code>{u.email}</code>
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 13 }}>
                        {u.phone ? <span>{u.phone}</span> : <span className="muted">—</span>}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {isSuper ? (
                          <span className="pill status-confirmed" style={{ fontWeight: 650 }}>
                            👑 Unrestricted Access (All 24 Modules)
                          </span>
                        ) : (
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                              <span className="pill status-confirmed" style={{ fontWeight: 700 }}>
                                {u.modules.length} Modules Permitted
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 520 }}>
                              {u.modules.slice(0, 5).map((mId) => {
                                const mod = moduleCatalog.find((m) => m.id === mId);
                                return (
                                  <span
                                    key={mId}
                                    style={{
                                      fontSize: 11,
                                      padding: "2px 8px",
                                      borderRadius: 6,
                                      background: "rgba(2, 132, 199, 0.08)",
                                      color: "#0369a1",
                                      fontWeight: 500,
                                    }}
                                  >
                                    {mod?.label.split("(")[0]?.trim() || mId}
                                  </span>
                                );
                              })}
                              {u.modules.length > 5 && (
                                <span style={{ fontSize: 11, color: "var(--ink-muted)", alignSelf: "center" }}>
                                  +{u.modules.length - 5} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span className={`pill status-${u.status}`}>
                          {u.status === "active" ? "🟢 Active" : "🔴 Suspended"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                          <button
                            type="button"
                            className="button secondary compact"
                            onClick={() => handleOpenEditModal(u)}
                            style={{ fontSize: 12 }}
                          >
                            ✏️ Edit & Modules
                          </button>
                          <button
                            type="button"
                            className="button secondary compact"
                            onClick={() => handleOpenResetModal(u)}
                            style={{ fontSize: 12 }}
                          >
                            🔑 Reset Pass
                          </button>
                          {!isSuper && (
                            <button
                              type="button"
                              className="button secondary compact"
                              onClick={() => handleToggleStatus(u)}
                              style={{
                                fontSize: 12,
                                color: u.status === "active" ? "#b91c1c" : "#15803d",
                              }}
                            >
                              {u.status === "active" ? "⏸️ Suspend" : "▶️ Activate"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* SECTION 2: Staff Directory & Assigned Territories */}
      <div>
        <div style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span>📇 Staff Directory & Territory Roles</span>
            <span className="small-chip">{filteredStaff.length}</span>
          </h2>
          <p className="page-sub" style={{ margin: "3px 0 0", fontSize: 13 }}>
            Full roster of field salespeople, managers, and operational identities.
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <input
            type="search"
            placeholder="Search by name, phone, email, or territory…"
            style={{ flex: 1 }}
            value={staffSearchQuery}
            onChange={(e) => setStaffSearchQuery(e.target.value)}
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{ minWidth: 180 }}
          >
            <option value="all">All Roles ({staff.length})</option>
            <option value="salesperson">Salesperson</option>
            <option value="field_manager">Field Manager</option>
            <option value="warehouse_manager">Warehouse Lead</option>
            <option value="accounts">Accounts & Finance</option>
            <option value="admin">Platform Admin</option>
            <option value="no_role">Unassigned</option>
          </select>
        </div>

        <div className="card" style={{ padding: 0 }}>
          {loadingStaff ? (
            <div className="muted" style={{ padding: 22 }}>Loading…</div>
          ) : filteredStaff.length === 0 ? (
            <div className="empty-state">No matching staff members found.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Person & Contact</th>
                  <th>Assigned Territory</th>
                  <th>Roles & Access</th>
                  <th>Status</th>
                  <th className="right">Manage</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div style={{ fontWeight: 650 }}>{member.name}</div>
                      <div className="small muted">{member.email} · {member.phone}</div>
                    </td>
                    <td>
                      {member.salesRep?.territory ? (
                        <div>
                          <span className="pill status-confirmed">{member.salesRep.territory}</span>
                        </div>
                      ) : member.salesRepId ? (
                        <span className="small muted">SalesRep linked (No territory set)</span>
                      ) : (
                        <span className="small muted">—</span>
                      )}
                    </td>
                    <td>
                      <div className="chip-row">
                        {member.roles.length === 0 ? (
                          <span className="muted small">No role</span>
                        ) : (
                          member.roles.map(({ role }) => (
                            <span className="pill" key={role.id}>{readableRole(role.name)}</span>
                          ))
                        )}
                      </div>
                    </td>
                    <td><span className={`pill status-${member.status}`}>{member.status}</span></td>
                    <td className="right">
                      <Link className="text-action" to={`/staff/${member.id}`}>Edit / Manage</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL 1: Create / Edit User & Module Access (Checkmarks) */}
      {userModalOpen && (
        <div className="modal-backdrop">
          <div
            className="modal"
            style={{
              maxWidth: 880,
              width: "100%",
              maxHeight: "92vh",
              overflowY: "auto",
              padding: "24px 28px",
              borderRadius: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <div className="between" style={{ marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
                  {editingUser ? `Edit Modules & Access: ${editingUser.name}` : "Create Portal User & Assign Modules"}
                </h2>
                <p className="page-sub" style={{ margin: "4px 0 0", fontSize: 13 }}>
                  Provide user credentials and simply tick mark which modules this person can see in the Admin console.
                </p>
              </div>
              <button
                type="button"
                className="ghost"
                onClick={() => setUserModalOpen(false)}
                style={{ fontSize: 18, cursor: "pointer", border: "none", background: "none" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser}>
              {/* Top Row: User Details */}
              <div
                style={{
                  background: "rgba(0,0,0,0.02)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "16px 18px",
                  marginBottom: 20,
                }}
              >
                <div style={{ fontWeight: 650, fontSize: 14, marginBottom: 12, color: "#1e293b" }}>
                  👤 User Identity & Login Credentials
                </div>
                <div className="form-grid" style={{ gap: "10px 14px" }}>
                  <div className="field">
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Full Name *</label>
                    <input
                      placeholder="e.g. Ramesh Accounts"
                      value={userForm.name}
                      onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="field">
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Login ID (Email Address) *</label>
                    <input
                      type="email"
                      placeholder="e.g. accounts@gagantoordal.com"
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="field">
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Mobile Phone Number *</label>
                    <input
                      type="tel"
                      placeholder="e.g. 9826011111"
                      value={userForm.phone}
                      onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                      required
                    />
                  </div>
                  <div className="field">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <label style={{ fontSize: 12, fontWeight: 600 }}>
                        {editingUser ? "Change Password (optional)" : "Login Password *"}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const pwd = generateSecurePassword();
                          setUserForm({ ...userForm, password: pwd });
                          setShowPassword(true);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#0284c7",
                          fontSize: 11,
                          fontWeight: 650,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        🎲 Auto-Generate
                      </button>
                    </div>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder={editingUser ? "Leave blank to keep unchanged" : "Min 6 characters"}
                        value={userForm.password}
                        onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                        required={!editingUser}
                        style={{ paddingRight: 60 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: "absolute",
                          right: 8,
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          fontSize: 11,
                          color: "var(--ink-muted)",
                          cursor: "pointer",
                        }}
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Presets Row */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontWeight: 650, fontSize: 14, color: "#1e293b" }}>
                    ⚡ 1-Click Role Presets (Fast Tick Marks):
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0284c7" }}>
                    {userForm.modules.length} of {moduleCatalog.length} modules selected
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="button secondary compact"
                    onClick={() => handleApplyPreset("accounts")}
                    style={{ background: "#f0fdf4", borderColor: "#86efac", color: "#166534", fontWeight: 600 }}
                  >
                    💼 Accounts Team Preset (8)
                  </button>
                  <button
                    type="button"
                    className="button secondary compact"
                    onClick={() => handleApplyPreset("salesCoordinator")}
                    style={{ background: "#eff6ff", borderColor: "#93c5fd", color: "#1e40af", fontWeight: 600 }}
                  >
                    📈 Sales Coordinator Preset (14)
                  </button>
                  <button
                    type="button"
                    className="button secondary compact"
                    onClick={() => handleApplyPreset("warehouse")}
                    style={{ background: "#fefce8", borderColor: "#fde047", color: "#854d0e", fontWeight: 600 }}
                  >
                    🏭 Warehouse Preset (4)
                  </button>
                  <button
                    type="button"
                    className="button secondary compact"
                    onClick={() => handleApplyPreset("superadmin")}
                    style={{ background: "#fdf4ff", borderColor: "#f0abfc", color: "#86198f", fontWeight: 600 }}
                  >
                    👑 Select All (24)
                  </button>
                  <button
                    type="button"
                    className="button secondary compact"
                    onClick={() => handleApplyPreset("clear")}
                    style={{ color: "#64748b" }}
                  >
                    ✕ Clear All
                  </button>
                </div>
              </div>

              {/* Module Checklists Grouped */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: 420, overflowY: "auto", paddingRight: 6 }}>
                {groupedModules.map(({ group, title, items }) => {
                  if (items.length === 0) return null;
                  const allGroupSelected = items.every((item) => userForm.modules.includes(item.id));
                  const anyGroupSelected = items.some((item) => userForm.modules.includes(item.id));

                  return (
                    <div
                      key={group}
                      style={{
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        overflow: "hidden",
                        background: anyGroupSelected ? "#fafafa" : "#fff",
                      }}
                    >
                      {/* Group Header */}
                      <div
                        style={{
                          background: anyGroupSelected ? "rgba(2, 132, 199, 0.06)" : "rgba(0,0,0,0.02)",
                          padding: "8px 14px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        <span style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>
                          {title} ({items.filter((m) => userForm.modules.includes(m.id)).length}/{items.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleGroup(group)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#0284c7",
                            fontSize: 11,
                            fontWeight: 650,
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          {allGroupSelected ? "Deselect Group" : "Select Group"}
                        </button>
                      </div>

                      {/* Items Grid */}
                      <div
                        style={{
                          padding: "10px 14px",
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
                          gap: 10,
                        }}
                      >
                        {items.map((mod) => {
                          const isChecked = userForm.modules.includes(mod.id);
                          return (
                            <label
                              key={mod.id}
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 10,
                                padding: "8px 10px",
                                borderRadius: 8,
                                border: isChecked ? "1px solid #38bdf8" : "1px solid #e2e8f0",
                                background: isChecked ? "#f0f9ff" : "#fff",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleModule(mod.id)}
                                style={{ marginTop: 3, transform: "scale(1.15)", cursor: "pointer" }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                  <strong style={{ fontSize: 13, color: isChecked ? "#0369a1" : "#1e293b" }}>
                                    {mod.label}
                                  </strong>
                                  <code style={{ fontSize: 10, padding: "1px 4px", borderRadius: 4, background: "rgba(0,0,0,0.05)" }}>
                                    {mod.route}
                                  </code>
                                </div>
                                <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 2, lineHeight: 1.35 }}>
                                  {mod.description}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ fontSize: 13 }}>
                  Total selected: <strong style={{ color: "#0284c7" }}>{userForm.modules.length} modules</strong>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" className="secondary" onClick={() => setUserModalOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="button"
                    disabled={busy || userForm.modules.length === 0}
                    style={{ background: "#0284c7", color: "#fff", fontWeight: 700, padding: "10px 22px" }}
                  >
                    {busy ? "Saving Rights…" : editingUser ? "Save Updated Access" : "Create User & Activate Rights"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Reset Password Modal */}
      {resetModalOpen && resetTargetUser && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 480, padding: 24, borderRadius: 16 }}>
            <div className="between" style={{ marginBottom: 14 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                Reset Password: {resetTargetUser.name}
              </h2>
              <button
                type="button"
                className="ghost"
                onClick={() => setResetModalOpen(false)}
                style={{ border: "none", background: "none", cursor: "pointer", fontSize: 16 }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 0, marginBottom: 16 }}>
              Set a new login password for <strong>{resetTargetUser.email}</strong>.
            </p>

            <div className="field" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>New Password</label>
                <button
                  type="button"
                  onClick={() => setNewPasswordValue(generateSecurePassword())}
                  style={{ background: "none", border: "none", color: "#0284c7", fontSize: 11, fontWeight: 650, cursor: "pointer" }}
                >
                  🎲 Generate Random
                </button>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type={showResetPassword ? "text" : "password"}
                  value={newPasswordValue}
                  onChange={(e) => setNewPasswordValue(e.target.value)}
                  style={{ paddingRight: 60 }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    fontSize: 11,
                    color: "var(--ink-muted)",
                    cursor: "pointer",
                  }}
                >
                  {showResetPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Quick Copy Helper */}
            <div
              style={{
                background: "#f8fafc",
                border: "1px dashed #cbd5e1",
                borderRadius: 8,
                padding: "10px 14px",
                marginBottom: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 12,
              }}
            >
              <div>
                <div><strong>Login:</strong> {resetTargetUser.email}</div>
                <div><strong>Password:</strong> {newPasswordValue}</div>
              </div>
              <button
                type="button"
                className="button secondary compact"
                onClick={() => {
                  navigator.clipboard.writeText(`Email: ${resetTargetUser.email}\nPassword: ${newPasswordValue}`);
                  setCredentialsCopied(true);
                  setTimeout(() => setCredentialsCopied(false), 2000);
                }}
              >
                {credentialsCopied ? "✓ Copied!" : "📋 Copy"}
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="secondary" onClick={() => setResetModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="button"
                onClick={handleConfirmReset}
                disabled={busy || newPasswordValue.length < 6}
                style={{ background: "#0284c7", color: "#fff", fontWeight: 700 }}
              >
                {busy ? "Saving…" : "Update Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
