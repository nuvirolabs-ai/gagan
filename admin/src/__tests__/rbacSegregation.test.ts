import { describe, expect, it } from "vitest";
import { ADMIN_NAV_GROUPS } from "../navigation";
import { canAccess } from "../adminSearch";

const FLAT = ADMIN_NAV_GROUPS.flatMap((group) => group.destinations);

// Fallback permissions for accounts
const ACCOUNTS_PERMISSIONS = [
  "collection.confirm",
  "financial.correct",
  "kyc.view",
  "recovery.view",
];

// Fallback permissions for sales_coordinator
const SALES_COORDINATOR_PERMISSIONS = [
  "approval.second_invoice",
  "commercial.status.view",
  "retailer.proposal_review",
  "catalog.manage",
  "performance.view_team",
  "org.view_all",
  "attendance.review",
  "collection.confirm",
  "survey.manage",
  "feedback.review",
  "issue.review",
  "route.manage",
  "visit.view",
];

// Fallback permissions for warehouse
const WAREHOUSE_PERMISSIONS = [
  "order.warehouse_process",
  "retailer.proposal_review",
];

describe("RBAC segregation of duties between Accounts, Sales Coordinator, and Warehouse", () => {
  it("grants accounts team access to collections, approvals, and financial modules while removing orders, retailers, and commercial", () => {
    const accessible = FLAT.filter((item) => item.route && canAccess(ACCOUNTS_PERMISSIONS, item.permissions)).map(
      (item) => item.id
    );

    // Permitted modules (Added: collection, approvals; plus financial suite)
    expect(accessible).toContain("collections");
    expect(accessible).toContain("approvals");
    expect(accessible).toContain("ledger");
    expect(accessible).toContain("billing-entities");
    expect(accessible).toContain("financial-statements");
    expect(accessible).toContain("corrections");
    expect(accessible).toContain("recovery");
    expect(accessible).toContain("kyc");

    // Strictly removed modules
    expect(accessible).not.toContain("orders");
    expect(accessible).not.toContain("retailers");
    expect(accessible).not.toContain("commercial");

    // Forbidden operational modules
    expect(accessible).not.toContain("warehouse-orders");
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
  });

  it("grants sales coordinator access to sales, approvals, and added field/operations modules", () => {
    const accessible = FLAT.filter(
      (item) => item.route && canAccess(SALES_COORDINATOR_PERMISSIONS, item.permissions)
    ).map((item) => item.id);

    // Standard modules
    expect(accessible).toContain("orders");
    expect(accessible).toContain("approvals");
    expect(accessible).toContain("retailers");
    expect(accessible).toContain("retailer-approvals");
    expect(accessible).toContain("catalog");
    expect(accessible).toContain("commercial");
    expect(accessible).toContain("sales-leader");
    expect(accessible).toContain("sales-organisation");

    // Added modules
    expect(accessible).toContain("collections");
    expect(accessible).toContain("market-surveys");
    expect(accessible).toContain("salesperson-feedback");
    expect(accessible).toContain("service-issues");
    expect(accessible).toContain("field-planning");
    expect(accessible).toContain("visits");

    // Strictly forbidden financial modules
    expect(accessible).not.toContain("ledger");
    expect(accessible).not.toContain("billing-entities");
    expect(accessible).not.toContain("financial-statements");
    expect(accessible).not.toContain("corrections");
    expect(accessible).not.toContain("recovery");
    expect(accessible).not.toContain("kyc");
    expect(accessible).not.toContain("warehouse-orders");
    expect(accessible).not.toContain("staff");
  });

  it("grants warehouse manager access to warehouse orders, hubs, and new retailer details", () => {
    const accessible = FLAT.filter(
      (item) => item.route && canAccess(WAREHOUSE_PERMISSIONS, item.permissions)
    ).map((item) => item.id);

    // Permitted modules
    expect(accessible).toContain("warehouse-orders");
    expect(accessible).toContain("warehouses");
    expect(accessible).toContain("retailer-approvals");
    expect(accessible).toContain("retailers");

    // Forbidden modules
    expect(accessible).not.toContain("orders");
    expect(accessible).not.toContain("collections");
    expect(accessible).not.toContain("approvals");
    expect(accessible).not.toContain("commercial");
    expect(accessible).not.toContain("ledger");
    expect(accessible).not.toContain("billing-entities");
    expect(accessible).not.toContain("financial-statements");
    expect(accessible).not.toContain("catalog");
    expect(accessible).not.toContain("staff");
  });

  it("enforces exact module filtering when user has explicit checkmarked modules", () => {
    const accountsExplicitModules = [
      "billing-entities",
      "financial-statements",
      "ledger",
      "collections",
      "corrections",
      "recovery",
      "kyc",
      "approvals",
    ];

    const accessibleAccounts = FLAT.filter(
      (item) => item.route && canAccess(ACCOUNTS_PERMISSIONS, item.permissions, item.id, accountsExplicitModules)
    ).map((item) => item.id);

    expect(accessibleAccounts).toEqual(expect.arrayContaining(accountsExplicitModules));
    expect(accessibleAccounts).not.toContain("orders");
    expect(accessibleAccounts).not.toContain("retailers");
    expect(accessibleAccounts).not.toContain("commercial");

    const coordinatorExplicitModules = [
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
    ];

    const accessibleCoordinator = FLAT.filter(
      (item) =>
        item.route &&
        canAccess(SALES_COORDINATOR_PERMISSIONS, item.permissions, item.id, coordinatorExplicitModules)
    ).map((item) => item.id);

    expect(accessibleCoordinator).toEqual(expect.arrayContaining(coordinatorExplicitModules));
    expect(accessibleCoordinator).not.toContain("ledger");
    expect(accessibleCoordinator).not.toContain("billing-entities");
    expect(accessibleCoordinator).not.toContain("financial-statements");
  });
});
