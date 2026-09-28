import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { AuthProvider } from "./AuthContext";
import { useAuth } from "./useAuth";
import Login from "./pages/Login";
import Orders from "./pages/Orders";
import Retailers from "./pages/Retailers";
import Ledger from "./pages/Ledger";
import Catalog from "./pages/Catalog";
import Commercial from "./pages/Commercial";
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
import SapSync from "./pages/SapSync";
import FieldTeam from "./pages/FieldTeam";
import FieldPlanning from "./pages/FieldPlanning";
import FieldExpenses from "./pages/FieldExpenses";
import ServiceIssues from "./pages/ServiceIssues";
import SalespersonFeedback from "./pages/SalespersonFeedback";
import SalesLeader from "./pages/SalesLeader";
import SalesOrganisation from "./pages/SalesOrganisation";
import RetailerApprovals from "./pages/RetailerApprovals";
import ImportCenter from "./pages/ImportCenter";
import MarketSurveys from "./pages/MarketSurveys";
import CommandPalette from "./components/CommandPalette";
import { canAccess, permissionsFor } from "./adminSearch";
import { ADMIN_NAV_GROUPS, type AdminDestination } from "./navigation";
import { APP_ENVIRONMENT_LABEL } from "./environmentLabel";

const NAV = ADMIN_NAV_GROUPS;
const FLAT = NAV.flatMap((group) => group.destinations);

const NAV_GLYPHS: Record<string, string> = {
  home: "⌂",
  work: "◷",
  sales: "↗",
  finance: "₹",
  field: "⌖",
  system: "·",
};

function Guard({ anyOf, children }: { anyOf: readonly string[]; children: ReactNode }) {
  const { permissions } = useAuth();
  const available = FLAT.filter((item) => item.route && canAccess(permissions, item.permissions));
  if (!canAccess(permissions, anyOf)) {
    return <Navigate to={available[0]?.route ?? "/no-access"} replace />;
  }
  return children;
}

function pageLabel(pathname: string) {
  const route = FLAT.find((item) => item.route === pathname) ?? FLAT.find((item) => item.route && item.route !== "/" && pathname.startsWith(`${item.route}/`));
  return route?.label ?? "Admin";
}

function TopBar() {
  const { admin } = useAuth();
  const location = useLocation();
  const initials = (admin?.name ?? "Ops Admin").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <header className="app-topbar"><div className="app-crumb"><strong>Gagan</strong><span>/</span><span>{pageLabel(location.pathname)}</span></div><div className="app-top-actions"><CommandPalette /><span className="environment-tag"><i /> {APP_ENVIRONMENT_LABEL}</span><span className="app-avatar" aria-label={admin?.name ?? "Admin"}>{initials}</span></div></header>;
}

function LoadingWorkspace() {
  return <div className="layout"><aside className="sidebar"><div className="brand">Gagan</div><div className="brand-sub">Operations console</div><div className="sidebar-loading-lines"><span /><span /><span /><span /><span /></div><div className="sidebar-foot"><div className="sidebar-user">Preparing workspace</div></div></aside><main className="main"><div className="app-topbar"><div className="app-crumb"><strong>Gagan</strong><span>/</span><span>Admin</span></div><span className="environment-tag"><i /> {APP_ENVIRONMENT_LABEL}</span></div><div className="route-stage instrument-loading"><div className="skeleton skeleton-label" /><div className="skeleton skeleton-title" /><div className="skeleton skeleton-copy" /><div className="skeleton skeleton-flow" /><div className="instrument-grid-skeleton"><div className="skeleton skeleton-panel" /><div className="skeleton skeleton-panel" /><div className="skeleton skeleton-panel" /></div></div></main></div>;
}

function Shell() {
  const { admin, permissions, logout } = useAuth();
  const groups = NAV.map((group) => ({
    ...group,
    items: group.destinations.filter((item): item is AdminDestination & { route: string } => Boolean(item.route) && canAccess(permissions, item.permissions)),
  })).filter((group) => group.items.length > 0);
  // The base Admin URL is a deliberate product entry point: return operators
  // to Work/Home whenever they can see it, regardless of nav group ordering.
  const home = FLAT.find((item) => item.route === "/");
  const landingPath = home && canAccess(permissions, home.permissions) ? "/" : groups[0]?.items[0]?.route ?? "/no-access";

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">Gagan</div>
        <div className="brand-sub">Operations console</div>
        <nav className="nav-groups">
          {groups.map((group) => (
            <div key={group.id} className="nav-group">
              <div className="nav-group-label"><span className="nav-group-glyph" aria-hidden="true">{NAV_GLYPHS[group.id] ?? "·"}</span>{group.label}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.route}
                  end={item.route === "/"}
                  className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                >
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="sidebar-user">{admin?.name}</div>
          <button className="ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <TopBar />
        <div className="route-stage"><Routes>
          <Route path="/" element={<Guard anyOf={permissionsFor("work")}><Dashboard /></Guard>} />
          <Route path="/warehouses" element={<Warehouses />} />
          <Route path="/sap" element={<Guard anyOf={permissionsFor("sap")}><SapSync /></Guard>} />
          <Route path="/imports" element={<Guard anyOf={permissionsFor("imports")}><ImportCenter /></Guard>} />
          <Route path="/approvals" element={<Guard anyOf={permissionsFor("approvals")}><Approvals /></Guard>} />
          <Route path="/collections" element={<Guard anyOf={permissionsFor("collections")}><Collections /></Guard>} />
          <Route path="/credit-reviews" element={<Guard anyOf={permissionsFor("credit-reviews")}><CreditReviews /></Guard>} />
          <Route path="/market-surveys" element={<Guard anyOf={permissionsFor("market-surveys")}><MarketSurveys /></Guard>} />
          <Route path="/kyc" element={<Guard anyOf={permissionsFor("kyc")}><Kyc /></Guard>} />
          <Route path="/recovery" element={<Guard anyOf={permissionsFor("recovery")}><Recovery /></Guard>} />
          <Route path="/legal" element={<Guard anyOf={permissionsFor("legal")}><Legal /></Guard>} />
          <Route path="/orders" element={<Guard anyOf={permissionsFor("orders")}><Orders /></Guard>} />
          <Route path="/warehouse-orders" element={<Guard anyOf={permissionsFor("warehouse-orders")}><Orders mode="warehouse" /></Guard>} />
          <Route path="/retailers" element={<Guard anyOf={permissionsFor("retailers")}><Retailers /></Guard>} />
          <Route path="/ledger" element={<Guard anyOf={permissionsFor("ledger")}><Ledger /></Guard>} />
          <Route path="/ledger/:retailerId" element={<Guard anyOf={permissionsFor("ledger")}><Ledger /></Guard>} />
          <Route path="/catalog" element={<Guard anyOf={permissionsFor("catalog")}><Catalog /></Guard>} />
          <Route path="/commercial" element={<Guard anyOf={permissionsFor("commercial")}><Commercial /></Guard>} />
          <Route path="/staff" element={<Guard anyOf={permissionsFor("staff")}><Staff /></Guard>} />
          <Route path="/staff/:staffId" element={<Guard anyOf={permissionsFor("staff")}><StaffDetail /></Guard>} />
          <Route path="/corrections" element={<Guard anyOf={permissionsFor("corrections")}><Corrections /></Guard>} />
          <Route path="/locations" element={<Guard anyOf={permissionsFor("locations")}><Locations /></Guard>} />
          <Route path="/visits" element={<Guard anyOf={permissionsFor("visits")}><Visits /></Guard>} />
          <Route path="/sales-leader" element={<Guard anyOf={permissionsFor("sales-leader")}><SalesLeader /></Guard>} />
          <Route path="/sales-organisation" element={<Guard anyOf={permissionsFor("sales-organisation")}><SalesOrganisation /></Guard>} />
          <Route path="/retailer-approvals" element={<Guard anyOf={permissionsFor("retailer-approvals")}><RetailerApprovals /></Guard>} />
          <Route path="/field-team" element={<Guard anyOf={permissionsFor("field-team")}><FieldTeam /></Guard>} />
          <Route path="/field-planning" element={<Guard anyOf={permissionsFor("field-planning")}><FieldPlanning /></Guard>} />
          <Route path="/field-expenses" element={<Guard anyOf={permissionsFor("field-expenses")}><FieldExpenses /></Guard>} />
          <Route path="/service-issues" element={<Guard anyOf={permissionsFor("service-issues")}><ServiceIssues /></Guard>} />
          <Route path="/salesperson-feedback" element={<Guard anyOf={permissionsFor("salesperson-feedback")}><SalespersonFeedback /></Guard>} />
          <Route
            path="/no-access"
            element={<div className="empty-state">No portal permissions are assigned.</div>}
          />
          <Route path="*" element={<Navigate to={landingPath} replace />} />
        </Routes></div>
      </main>
    </div>
  );
}

function Root() {
  const { admin, loading } = useAuth();
  if (loading) {
    return <LoadingWorkspace />;
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
