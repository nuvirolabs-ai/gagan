import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import { useAuth } from "./useAuth";
import Login from "./pages/Login";
import Orders from "./pages/Orders";
import Retailers from "./pages/Retailers";
import Ledger from "./pages/Ledger";
import Catalog from "./pages/Catalog";
import Staff from "./pages/Staff";
import StaffDetail from "./pages/StaffDetail";
import Corrections from "./pages/Corrections";
import Approvals from "./pages/Approvals";

const NAV = [
  { to: "/approvals", label: "Approvals", permissions: ["approval.second_invoice", "approval.third_invoice", "collection.confirm"] },
  { to: "/orders", label: "Order queue", permissions: ["staff.manage"] },
  { to: "/retailers", label: "Retailers", permissions: ["staff.manage"] },
  { to: "/ledger", label: "Ledger", permissions: ["staff.manage"] },
  { to: "/catalog", label: "Catalog", permissions: ["staff.manage"] },
  { to: "/corrections", label: "Corrections", permissions: ["financial.correct"] },
  { to: "/staff", label: "Staff access", permissions: ["staff.manage"] },
];

function Shell() {
  const { admin, permissions, logout } = useAuth();
  const availableNav = NAV.filter((item) =>
    item.permissions.some((permission) => permissions.includes(permission))
  );
  const landingPath = availableNav[0]?.to ?? "/no-access";

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">GAGAN</div>
        <div className="brand-sub">NUTRITION. DELIVERED.</div>
        {availableNav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            {n.label}
          </NavLink>
        ))}
        <div className="sidebar-foot">
          <div style={{ color: "#b9c9be", fontSize: 12, padding: "0 12px 8px" }}>{admin?.name}</div>
          <button className="ghost" style={{ color: "#b9c9be" }} onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <Routes>
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/retailers" element={<Retailers />} />
          <Route path="/ledger" element={<Ledger />} />
          <Route path="/ledger/:retailerId" element={<Ledger />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/staff/:staffId" element={<StaffDetail />} />
          <Route path="/corrections" element={<Corrections />} />
          <Route
            path="/no-access"
            element={<div className="card empty-state">No portal permissions are assigned.</div>}
          />
          <Route path="*" element={<Navigate to={landingPath} replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Root() {
  const { admin, loading } = useAuth();
  if (loading) {
    return <div style={{ padding: 40 }} className="muted">Loading…</div>;
  }
  return admin ? <Shell /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Root />
      </BrowserRouter>
    </AuthProvider>
  );
}
