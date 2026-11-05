import { describe, expect, it } from "vitest";
import { ADMIN_NAV_GROUPS, type AdminDestination } from "../navigation";
import { canAccess } from "../adminSearch";

const FLAT = ADMIN_NAV_GROUPS.flatMap((group) => group.destinations);

// Permissions defined in roleCatalog.ts for accounts
const ACCOUNTS_PERMISSIONS = [
  "collection.confirm",
  "financial.correct",
  "kyc.view",
  "recovery.view",
  "commercial.status.view",
  "commercial.advance.view",
  "commercial.advance.confirm",
];

// Permissions defined in roleCatalog.ts for sales_coordinator
const SALES_COORDINATOR_PERMISSIONS = [
  "approval.second_invoice",
  "commercial.status.view",
  "retailer.proposal_review",
  "catalog.manage",
  "performance.view_team",
  "org.view_all",
  "attendance.review",
];

describe("RBAC segregation of duties between Accounts and Sales Coordinator", () => {
  it("grants accounts team access to financial, accounts, and order visibility modules", () => {
    const accessible = FLAT.filter((item) => item.route && canAccess(ACCOUNTS_PERMISSIONS, item.permissions)).map(
      (item) => item.id
    );

    // Permitted modules
    expect(accessible).toContain("collections");
    expect(accessible).toContain("ledger");
    expect(accessible).toContain("billing-entities");
    expect(accessible).toContain("corrections");
    expect(accessible).toContain("recovery");
    expect(accessible).toContain("kyc");
    expect(accessible).toContain("commercial");
    expect(accessible).toContain("retailers");
    expect(accessible).toContain("orders");

    // Strictly forbidden modules
    expect(accessible).not.toContain("warehouse-orders");
    expect(accessible).not.toContain("approvals");
    expect(accessible).not.toContain("catalog");
    expect(accessible).not.toContain("retailer-approvals");
    expect(accessible).not.toContain("field-team");
    expect(accessible).not.toContain("field-planning");
    expect(accessible).not.toContain("field-expenses");
    expect(accessible).not.toContain("service-issues");
    expect(accessible).not.toContain("salesperson-feedback");
    expect(accessible).not.toContain("locations");
    expect(accessible).not.toContain("visits");
    expect(accessible).not.toContain("staff");
    expect(accessible).not.toContain("sap");
    expect(accessible).not.toContain("imports");
    expect(accessible).not.toContain("warehouses");
    expect(accessible).not.toContain("settings");
    expect(accessible).not.toContain("broadcasts");
    expect(accessible).not.toContain("roles");
  });

  it("grants sales coordinator access to sales, orders, approvals, and team performance modules", () => {
    const accessible = FLAT.filter(
      (item) => item.route && canAccess(SALES_COORDINATOR_PERMISSIONS, item.permissions)
    ).map((item) => item.id);

    // Permitted modules
    expect(accessible).toContain("orders");
    expect(accessible).toContain("approvals");
    expect(accessible).toContain("retailers");
    expect(accessible).toContain("retailer-approvals");
    expect(accessible).toContain("catalog");
    expect(accessible).toContain("sales-leader");
    expect(accessible).toContain("sales-organisation");
    expect(accessible).toContain("field-team");

    // Strictly forbidden modules
    expect(accessible).not.toContain("ledger");
    expect(accessible).not.toContain("billing-entities");
    expect(accessible).not.toContain("collections");
    expect(accessible).not.toContain("corrections");
    expect(accessible).not.toContain("recovery");
    expect(accessible).not.toContain("kyc");
    expect(accessible).not.toContain("legal");
    expect(accessible).not.toContain("commercial");
    expect(accessible).not.toContain("credit-reviews");
    expect(accessible).not.toContain("market-surveys");
    expect(accessible).not.toContain("warehouse-orders");
    expect(accessible).not.toContain("field-planning");
    expect(accessible).not.toContain("field-expenses");
    expect(accessible).not.toContain("service-issues");
    expect(accessible).not.toContain("salesperson-feedback");
    expect(accessible).not.toContain("locations");
    expect(accessible).not.toContain("visits");
    expect(accessible).not.toContain("staff");
    expect(accessible).not.toContain("sap");
    expect(accessible).not.toContain("imports");
    expect(accessible).not.toContain("warehouses");
    expect(accessible).not.toContain("settings");
    expect(accessible).not.toContain("broadcasts");
    expect(accessible).not.toContain("roles");
  });

  it("filters sidebar navigation groups so unpermitted categories are completely hidden", () => {
    const buildVisibleGroups = (permissions: string[]) =>
      ADMIN_NAV_GROUPS.map((group) => ({
        ...group,
        items: group.destinations.filter(
          (item): item is AdminDestination & { route: string } =>
            Boolean(item.route) && canAccess(permissions, item.permissions)
        ),
      })).filter((group) => group.items.length > 0);

    const accountsGroups = buildVisibleGroups(ACCOUNTS_PERMISSIONS).map((g) => g.id);
    expect(accountsGroups).not.toContain("field");
    expect(accountsGroups).not.toContain("system");
    expect(accountsGroups).toContain("finance");

    const coordinatorGroups = buildVisibleGroups(SALES_COORDINATOR_PERMISSIONS).map((g) => g.id);
    expect(coordinatorGroups).not.toContain("finance");
    expect(coordinatorGroups).toContain("field");
    expect(coordinatorGroups).not.toContain("system");
    expect(coordinatorGroups).toContain("sales");
  });
});
