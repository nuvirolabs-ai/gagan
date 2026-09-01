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
import Collections from "./pages/Collections";
import CreditReviews from "./pages/CreditReviews";
import Kyc from "./pages/Kyc";
import Recovery from "./pages/Recovery";
import Legal from "./pages/Legal";
import Locations from "./pages/Locations";
import Visits from "./pages/Visits";
import Dashboard from "./pages/Dashboard";
import Warehouses from "./pages/Warehouses";
import FieldTeam from "./pages/FieldTeam";
import FieldPlanning from "./pages/FieldPlanning";
import FieldExpenses from "./pages/FieldExpenses";
import ServiceIssues from "./pages/ServiceIssues";
import SalesLeader from "./pages/SalesLeader";
import RetailerApprovals from "./pages/RetailerApprovals";

const NAV = [
  { to: "/", label: "Overview", permissions: ["staff.manage", "dashboard.view"] },
  { to: "/approvals", label: "Approvals", permissions: ["approval.second_invoice", "approval.third_invoice", "legal.decide"] },
  { to: "/collections", label: "Collections", permissions: ["collection.confirm"] },
  { to: "/credit-reviews", label: "Credit reviews", permissions: ["credit.rating_confirm"] },
  { to: "/kyc", label: "KYC", permissions: ["kyc.view", "kyc.review"] },
  { to: "/recovery", label: "Recovery", permissions: ["recovery.view", "recovery.update"] },
  { to: "/legal", label: "Legal", permissions: ["staff.manage", "legal.decide"] },
  { to: "/orders", label: "Order queue", permissions: ["staff.manage"] },
  { to: "/retailers", label: "Retailers", permissions: ["staff.manage"] },
  { to: "/ledger", label: "Ledger", permissions: ["staff.manage"] },
  { to: "/catalog", label: "Catalog", permissions: ["staff.manage"] },
  { to: "/warehouses", label: "Warehouses", permissions: ["staff.manage", "dashboard.view"] },
  { to: "/corrections", label: "Corrections", permissions: ["financial.correct"] },
  { to: "/staff", label: "Staff access", permissions: ["staff.manage"] },
  { to: "/locations", label: "Store locations", permissions: ["location.view"] },
  { to: "/visits", label: "Sales visits", permissions: ["visit.view"] },
  { to: "/sales-leader", label: "Sales leader", permissions: ["performance.view_team"] },
  { to: "/retailer-approvals", label: "New retailers", permissions: ["retailer.proposal_review"] },
  { to: "/field-team", label: "Field team", permissions: ["attendance.review"] },
  { to: "/field-planning", label: "Routes & tasks", permissions: ["route.manage"] },
  { to: "/field-expenses", label: "Field expenses", permissions: ["expense.review"] },
  { to: "/service-issues", label: "Service issues", permissions: ["issue.review"] },
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
          <Route path="/" element={<Dashboard />} />
          <Route path="/warehouses" element={<Warehouses />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/credit-reviews" element={<CreditReviews />} />
          <Route path="/kyc" element={<Kyc />} />
          <Route path="/recovery" element={<Recovery />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/retailers" element={<Retailers />} />
          <Route path="/ledger" element={<Ledger />} />
          <Route path="/ledger/:retailerId" element={<Ledger />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/staff/:staffId" element={<StaffDetail />} />
          <Route path="/corrections" element={<Corrections />} />
          <Route path="/locations" element={<Locations />} />
          <Route path="/visits" element={<Visits />} />
          <Route path="/sales-leader" element={<SalesLeader />} />
          <Route path="/retailer-approvals" element={<RetailerApprovals />} />
          <Route path="/field-team" element={<FieldTeam />} />
          <Route path="/field-planning" element={<FieldPlanning />} />
          <Route path="/field-expenses" element={<FieldExpenses />} />
          <Route path="/service-issues" element={<ServiceIssues />} />
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
