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

const NAV = [
  { to: "/orders", label: "Order queue" },
  { to: "/retailers", label: "Retailers" },
  { to: "/ledger", label: "Ledger" },
  { to: "/catalog", label: "Catalog" },
  { to: "/staff", label: "Staff access" },
];

function Shell() {
  const { admin, logout } = useAuth();

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">GAGAN</div>
        <div className="brand-sub">NUTRITION. DELIVERED.</div>
        {NAV.map((n) => (
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
          <Route path="/orders" element={<Orders />} />
          <Route path="/retailers" element={<Retailers />} />
          <Route path="/ledger" element={<Ledger />} />
          <Route path="/ledger/:retailerId" element={<Ledger />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/staff/:staffId" element={<StaffDetail />} />
          <Route path="*" element={<Navigate to="/orders" replace />} />
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
