import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import { useState, type ReactNode } from "react";
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
import Settings from "./pages/Settings";
import BillingEntitiesAudit from "./pages/BillingEntitiesAudit";
import FinancialStatements from "./pages/FinancialStatements";
import Broadcasts from "./pages/Broadcasts";
import RolesPermissions from "./pages/RolesPermissions";
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

function Guard({ anyOf, destinationId, children }: { anyOf: readonly string[]; destinationId?: string; children: ReactNode }) {
  const { permissions, modules } = useAuth();
  const available = FLAT.filter((item) => item.route && canAccess(permissions, item.permissions, item.id, modules));
  if (!canAccess(permissions, anyOf, destinationId, modules)) {
    return <Navigate to={available[0]?.route ?? "/no-access"} replace />;
  }
  return children;
}

function pageLabel(pathname: string) {
  const route = FLAT.find((item) => item.route === pathname) ?? FLAT.find((item) => item.route && item.route !== "/" && pathname.startsWith(`${item.route}/`));
  return route?.label ?? "Admin";
}

function TopBar({ onToggleSidebar, sidebarCollapsed }: { onToggleSidebar: () => void; sidebarCollapsed: boolean }) {
  const { admin } = useAuth();
  const location = useLocation();
  const initials = (admin?.name ?? "Ops Admin").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return (
    <header className="app-topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          className={`sidebar-hamburger-btn ${sidebarCollapsed ? "is-collapsed" : "is-expanded"}`}
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? "Expand navigation panel" : "Collapse navigation panel"}
          title={sidebarCollapsed ? "Expand navigation panel" : "Collapse navigation panel"}
        >
          ☰
        </button>
        <div className="app-crumb">
          <strong>Gagan</strong><span>/</span><span>{pageLabel(location.pathname)}</span>
        </div>
      </div>
      <div className="app-top-actions">
        <CommandPalette />
        <span className="environment-tag"><i /> {APP_ENVIRONMENT_LABEL}</span>
        <span className="app-avatar" aria-label={admin?.name ?? "Admin"}>{initials}</span>
      </div>
    </header>
  );
}

function LoadingWorkspace() {
  const isCollapsed = (() => {
    try {
      const explicit = localStorage.getItem("gagan_sidebar_explicit_state_v3");
      if (explicit !== null) return explicit === "collapsed";
      return true;
    } catch {
      return true;
    }
  })();
  return (
    <div className={`layout ${isCollapsed ? "sidebar-collapsed" : ""}`}>
      {!isCollapsed && (
        <aside className="sidebar">
          <div className="brand">Gagan</div>
          <div className="brand-sub">Operations console</div>
          <div className="sidebar-loading-lines"><span /><span /><span /><span /><span /></div>
          <div className="sidebar-foot"><div className="sidebar-user">Preparing workspace</div></div>
        </aside>
      )}
      <main className="main">
        <div className="app-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="button" className="sidebar-hamburger-btn" disabled>☰</button>
            <div className="app-crumb"><strong>Gagan</strong><span>/</span><span>Admin</span></div>
          </div>
          <span className="environment-tag"><i /> {APP_ENVIRONMENT_LABEL}</span>
        </div>
        <div className="route-stage instrument-loading"><div className="skeleton skeleton-label" /><div className="skeleton skeleton-title" /><div className="skeleton skeleton-copy" /><div className="skeleton skeleton-flow" /><div className="instrument-grid-skeleton"><div className="skeleton skeleton-panel" /><div className="skeleton skeleton-panel" /><div className="skeleton skeleton-panel" /></div></div>
      </main>
    </div>
  );
}

function Shell() {
  const { admin, permissions, modules, logout } = useAuth();
  // Left-Side Panel: Completely hidden by default with floating/topbar hamburger button (Requirement 8)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      localStorage.removeItem("gagan_sidebar_collapsed");
      const explicit = localStorage.getItem("gagan_sidebar_explicit_state_v3");
      if (explicit !== null) {
        return explicit === "collapsed";
      }
      return true; // Completely hidden by default as requested!
    } catch {
      return true;
    }
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("gagan_sidebar_explicit_state_v3", next ? "collapsed" : "expanded");
      } catch {}
      return next;
    });
  };

  const groups = NAV.map((group) => ({
    ...group,
    items: group.destinations.filter(
      (item): item is AdminDestination & { route: string } =>
        Boolean(item.route) && canAccess(permissions, item.permissions, item.id, modules)
    ),
  })).filter((group) => group.items.length > 0);
  // The base Admin URL is a deliberate product entry point: return operators
  // to Work/Home whenever they can see it, regardless of nav group ordering.
  const home = FLAT.find((item) => item.route === "/");
  const landingPath = home && canAccess(permissions, home.permissions, home.id, modules) ? "/" : groups[0]?.items[0]?.route ?? "/no-access";

  return (
    <div className={`layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div className="brand">Gagan</div>
            <div className="brand-sub">Operations console</div>
          </div>
          <button
            type="button"
            className="sidebar-toggle-close"
            onClick={toggleSidebar}
            aria-label="Collapse sidebar"
            title="Collapse sidebar (maximize workspace)"
          >
            ✕ Hide
          </button>
        </div>
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
        <TopBar onToggleSidebar={toggleSidebar} sidebarCollapsed={sidebarCollapsed} />
        <div className="route-stage"><Routes>
          <Route path="/" element={<Guard anyOf={permissionsFor("work")} destinationId="work"><Dashboard /></Guard>} />
          <Route path="/warehouses" element={<Guard anyOf={permissionsFor("warehouses")} destinationId="warehouses"><Warehouses /></Guard>} />
          <Route path="/settings" element={<Guard anyOf={permissionsFor("settings")} destinationId="settings"><Settings /></Guard>} />
          <Route path="/broadcasts" element={<Guard anyOf={permissionsFor("broadcasts")} destinationId="broadcasts"><Broadcasts /></Guard>} />
          <Route path="/roles" element={<Guard anyOf={permissionsFor("roles")} destinationId="roles"><RolesPermissions /></Guard>} />
          <Route path="/sap" element={<Guard anyOf={permissionsFor("sap")} destinationId="sap"><SapSync /></Guard>} />
          <Route path="/imports" element={<Guard anyOf={permissionsFor("imports")} destinationId="imports"><ImportCenter /></Guard>} />
          <Route path="/approvals" element={<Guard anyOf={permissionsFor("approvals")} destinationId="approvals"><Approvals /></Guard>} />
          <Route path="/collections" element={<Guard anyOf={permissionsFor("collections")} destinationId="collections"><Collections /></Guard>} />
          <Route path="/credit-reviews" element={<Guard anyOf={permissionsFor("credit-reviews")} destinationId="credit-reviews"><CreditReviews /></Guard>} />
          <Route path="/market-surveys" element={<Guard anyOf={permissionsFor("market-surveys")} destinationId="market-surveys"><MarketSurveys /></Guard>} />
          <Route path="/kyc" element={<Guard anyOf={permissionsFor("kyc")} destinationId="kyc"><Kyc /></Guard>} />
          <Route path="/recovery" element={<Guard anyOf={permissionsFor("recovery")} destinationId="recovery"><Recovery /></Guard>} />
          <Route path="/legal" element={<Guard anyOf={permissionsFor("legal")} destinationId="legal"><Legal /></Guard>} />
          <Route path="/orders" element={<Guard anyOf={permissionsFor("orders")} destinationId="orders"><Orders /></Guard>} />
          <Route path="/warehouse-orders" element={<Guard anyOf={permissionsFor("warehouse-orders")} destinationId="warehouse-orders"><Orders mode="warehouse" /></Guard>} />
          <Route path="/retailers" element={<Guard anyOf={permissionsFor("retailers")} destinationId="retailers"><Retailers /></Guard>} />
          <Route path="/ledger" element={<Guard anyOf={permissionsFor("ledger")} destinationId="ledger"><Ledger /></Guard>} />
          <Route path="/ledger/:retailerId" element={<Guard anyOf={permissionsFor("ledger")} destinationId="ledger"><Ledger /></Guard>} />
          <Route path="/billing-entities" element={<Guard anyOf={permissionsFor("billing-entities")} destinationId="billing-entities"><BillingEntitiesAudit /></Guard>} />
          <Route path="/financial-statements" element={<Guard anyOf={permissionsFor("financial-statements")} destinationId="financial-statements"><FinancialStatements /></Guard>} />
          <Route path="/catalog" element={<Guard anyOf={permissionsFor("catalog")} destinationId="catalog"><Catalog /></Guard>} />
          <Route path="/commercial" element={<Guard anyOf={permissionsFor("commercial")} destinationId="commercial"><Commercial /></Guard>} />
          <Route path="/staff" element={<Guard anyOf={permissionsFor("staff")} destinationId="staff"><Staff /></Guard>} />
          <Route path="/staff/:staffId" element={<Guard anyOf={permissionsFor("staff")} destinationId="staff"><StaffDetail /></Guard>} />
          <Route path="/corrections" element={<Guard anyOf={permissionsFor("corrections")} destinationId="corrections"><Corrections /></Guard>} />
          <Route path="/locations" element={<Guard anyOf={permissionsFor("locations")} destinationId="locations"><Locations /></Guard>} />
          <Route path="/visits" element={<Guard anyOf={permissionsFor("visits")} destinationId="visits"><Visits /></Guard>} />
          <Route path="/sales-leader" element={<Guard anyOf={permissionsFor("sales-leader")} destinationId="sales-leader"><SalesLeader /></Guard>} />
          <Route path="/sales-organisation" element={<Guard anyOf={permissionsFor("sales-organisation")} destinationId="sales-organisation"><SalesOrganisation /></Guard>} />
          <Route path="/retailer-approvals" element={<Guard anyOf={permissionsFor("retailer-approvals")} destinationId="retailer-approvals"><RetailerApprovals /></Guard>} />
          <Route path="/field-team" element={<Guard anyOf={permissionsFor("field-team")} destinationId="field-team"><FieldTeam /></Guard>} />
          <Route path="/field-planning" element={<Guard anyOf={permissionsFor("field-planning")} destinationId="field-planning"><FieldPlanning /></Guard>} />
          <Route path="/field-expenses" element={<Guard anyOf={permissionsFor("field-expenses")} destinationId="field-expenses"><FieldExpenses /></Guard>} />
          <Route path="/service-issues" element={<Guard anyOf={permissionsFor("service-issues")} destinationId="service-issues"><ServiceIssues /></Guard>} />
          <Route path="/salesperson-feedback" element={<Guard anyOf={permissionsFor("salesperson-feedback")} destinationId="salesperson-feedback"><SalespersonFeedback /></Guard>} />
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
