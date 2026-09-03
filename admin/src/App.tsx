import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
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
import SapSync from "./pages/SapSync";
import FieldTeam from "./pages/FieldTeam";
import FieldPlanning from "./pages/FieldPlanning";
import FieldExpenses from "./pages/FieldExpenses";
import ServiceIssues from "./pages/ServiceIssues";
import SalesLeader from "./pages/SalesLeader";
import SalesOrganisation from "./pages/SalesOrganisation";
import RetailerApprovals from "./pages/RetailerApprovals";

type NavItem = { to: string; label: string; permissions: string[] };
type NavGroup = { id: string; label: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    id: "home",
    label: "Home",
    items: [
      {
        to: "/",
        label: "Work",
        permissions: [
          "staff.manage",
          "dashboard.view",
          "approval.second_invoice",
          "collection.confirm",
          "credit.rating_confirm",
          "route.manage",
          "attendance.review",
          "performance.view_team",
          "retailer.proposal_review",
          "expense.review",
          "issue.review",
          "kyc.view",
          "recovery.view",
          "financial.correct",
          "org.view_all",
          "location.view",
          "visit.view",
        ],
      },
    ],
  },
  {
    id: "work",
    label: "Work",
    items: [
      { to: "/approvals", label: "Approvals", permissions: ["approval.second_invoice", "approval.third_invoice", "legal.decide"] },
      { to: "/collections", label: "Collections", permissions: ["collection.confirm"] },
      { to: "/credit-reviews", label: "Credit reviews", permissions: ["credit.rating_confirm"] },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    items: [
      { to: "/orders", label: "Orders", permissions: ["staff.manage"] },
      { to: "/retailers", label: "Retailers", permissions: ["staff.manage"] },
      { to: "/retailer-approvals", label: "New retailers", permissions: ["retailer.proposal_review"] },
      { to: "/sales-organisation", label: "Organisation", permissions: ["org.view_all"] },
      { to: "/sales-leader", label: "Sales leader", permissions: ["performance.view_team"] },
      { to: "/catalog", label: "Catalog", permissions: ["staff.manage"] },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      { to: "/ledger", label: "Ledger", permissions: ["staff.manage"] },
      { to: "/corrections", label: "Corrections", permissions: ["financial.correct"] },
      { to: "/recovery", label: "Recovery", permissions: ["recovery.view", "recovery.update"] },
      { to: "/legal", label: "Legal", permissions: ["staff.manage", "legal.decide"] },
      { to: "/kyc", label: "KYC", permissions: ["kyc.view", "kyc.review"] },
    ],
  },
  {
    id: "field",
    label: "Field",
    items: [
      { to: "/field-team", label: "Team & leave", permissions: ["attendance.review"] },
      { to: "/field-planning", label: "Routes & tasks", permissions: ["route.manage"] },
      { to: "/field-expenses", label: "Expenses", permissions: ["expense.review"] },
      { to: "/service-issues", label: "Issues", permissions: ["issue.review"] },
      { to: "/locations", label: "Store locations", permissions: ["location.view"] },
      { to: "/visits", label: "Visits", permissions: ["visit.view"] },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { to: "/staff", label: "Users & roles", permissions: ["staff.manage"] },
      { to: "/sap", label: "SAP sync", permissions: ["staff.manage"] },
    ],
  },
];

const FLAT = NAV.flatMap((group) => group.items);

const NAV_GLYPHS: Record<string, string> = {
  home: "⌂",
  work: "◷",
  sales: "↗",
  finance: "₹",
  field: "⌖",
  system: "·",
};

function canSee(permissions: string[], needed: string[]) {
  return needed.some((permission) => permissions.includes(permission));
}

function Guard({ anyOf, children }: { anyOf: string[]; children: ReactNode }) {
  const { permissions } = useAuth();
  const available = FLAT.filter((item) => canSee(permissions, item.permissions));
  if (!canSee(permissions, anyOf)) {
    return <Navigate to={available[0]?.to ?? "/no-access"} replace />;
  }
  return children;
}

function pageLabel(pathname: string) {
  const route = FLAT.find((item) => item.to === pathname) ?? FLAT.find((item) => item.to !== "/" && pathname.startsWith(`${item.to}/`));
  return route?.label ?? "Admin";
}

function TopBar() {
  const { admin } = useAuth();
  const location = useLocation();
  const initials = (admin?.name ?? "Ops Admin").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <header className="app-topbar"><div className="app-crumb"><strong>Gagan</strong><span>/</span><span>{pageLabel(location.pathname)}</span></div><div className="app-top-actions"><span className="environment-tag"><i /> staging · read-only</span><span className="app-avatar" aria-label={admin?.name ?? "Admin"}>{initials}</span></div></header>;
}

function LoadingWorkspace() {
  return <div className="layout"><aside className="sidebar"><div className="brand">Gagan</div><div className="brand-sub">Operations console</div><div className="sidebar-loading-lines"><span /><span /><span /><span /><span /></div><div className="sidebar-foot"><div className="sidebar-user">Preparing workspace</div></div></aside><main className="main"><div className="app-topbar"><div className="app-crumb"><strong>Gagan</strong><span>/</span><span>Admin</span></div><span className="environment-tag"><i /> staging</span></div><div className="route-stage instrument-loading"><div className="skeleton skeleton-label" /><div className="skeleton skeleton-title" /><div className="skeleton skeleton-copy" /><div className="skeleton skeleton-flow" /><div className="instrument-grid-skeleton"><div className="skeleton skeleton-panel" /><div className="skeleton skeleton-panel" /><div className="skeleton skeleton-panel" /></div></div></main></div>;
}

function Shell() {
  const { admin, permissions, logout } = useAuth();
  const groups = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => canSee(permissions, item.permissions)),
  })).filter((group) => group.items.length > 0);
  const landingPath = groups[0]?.items[0]?.to ?? "/no-access";

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
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
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
          <Route path="/" element={<Guard anyOf={FLAT.find((item) => item.to === "/")!.permissions}><Dashboard /></Guard>} />
          <Route path="/warehouses" element={<Warehouses />} />
          <Route path="/sap" element={<Guard anyOf={["staff.manage"]}><SapSync /></Guard>} />
          <Route path="/approvals" element={<Guard anyOf={["approval.second_invoice", "approval.third_invoice", "legal.decide"]}><Approvals /></Guard>} />
          <Route path="/collections" element={<Guard anyOf={["collection.confirm"]}><Collections /></Guard>} />
          <Route path="/credit-reviews" element={<Guard anyOf={["credit.rating_confirm"]}><CreditReviews /></Guard>} />
          <Route path="/kyc" element={<Guard anyOf={["kyc.view", "kyc.review"]}><Kyc /></Guard>} />
          <Route path="/recovery" element={<Guard anyOf={["recovery.view", "recovery.update"]}><Recovery /></Guard>} />
          <Route path="/legal" element={<Guard anyOf={["staff.manage", "legal.decide"]}><Legal /></Guard>} />
          <Route path="/orders" element={<Guard anyOf={["staff.manage"]}><Orders /></Guard>} />
          <Route path="/retailers" element={<Guard anyOf={["staff.manage"]}><Retailers /></Guard>} />
          <Route path="/ledger" element={<Guard anyOf={["staff.manage"]}><Ledger /></Guard>} />
          <Route path="/ledger/:retailerId" element={<Guard anyOf={["staff.manage"]}><Ledger /></Guard>} />
          <Route path="/catalog" element={<Guard anyOf={["staff.manage"]}><Catalog /></Guard>} />
          <Route path="/staff" element={<Guard anyOf={["staff.manage"]}><Staff /></Guard>} />
          <Route path="/staff/:staffId" element={<Guard anyOf={["staff.manage"]}><StaffDetail /></Guard>} />
          <Route path="/corrections" element={<Guard anyOf={["financial.correct"]}><Corrections /></Guard>} />
          <Route path="/locations" element={<Guard anyOf={["location.view"]}><Locations /></Guard>} />
          <Route path="/visits" element={<Guard anyOf={["visit.view"]}><Visits /></Guard>} />
          <Route path="/sales-leader" element={<Guard anyOf={["performance.view_team"]}><SalesLeader /></Guard>} />
          <Route path="/sales-organisation" element={<Guard anyOf={["org.view_all"]}><SalesOrganisation /></Guard>} />
          <Route path="/retailer-approvals" element={<Guard anyOf={["retailer.proposal_review"]}><RetailerApprovals /></Guard>} />
          <Route path="/field-team" element={<Guard anyOf={["attendance.review"]}><FieldTeam /></Guard>} />
          <Route path="/field-planning" element={<Guard anyOf={["route.manage"]}><FieldPlanning /></Guard>} />
          <Route path="/field-expenses" element={<Guard anyOf={["expense.review"]}><FieldExpenses /></Guard>} />
          <Route path="/service-issues" element={<Guard anyOf={["issue.review"]}><ServiceIssues /></Guard>} />
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
