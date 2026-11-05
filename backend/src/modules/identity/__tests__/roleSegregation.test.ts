import { describe, expect, it } from "vitest";
import { ROLE_DEFINITIONS, Permissions } from "../roleCatalog";

describe("Backend RBAC Role Definitions", () => {
  it("defines accounts role with only financial and verification permissions", () => {
    const accountsRole = ROLE_DEFINITIONS.find((r) => r.name === "accounts");
    expect(accountsRole).toBeDefined();

    // Must have
    expect(accountsRole?.permissions).toContain(Permissions.COLLECTION_CONFIRM);
    expect(accountsRole?.permissions).toContain(Permissions.FINANCIAL_CORRECT);
    expect(accountsRole?.permissions).toContain(Permissions.KYC_VIEW);
    expect(accountsRole?.permissions).toContain(Permissions.RECOVERY_VIEW);
    expect(accountsRole?.permissions).toContain(Permissions.COMMERCIAL_STATUS_VIEW);
    expect(accountsRole?.permissions).toContain(Permissions.COMMERCIAL_ADVANCE_VIEW);
    expect(accountsRole?.permissions).toContain(Permissions.COMMERCIAL_ADVANCE_CONFIRM);

    // Must NOT have
    expect(accountsRole?.permissions).not.toContain(Permissions.STAFF_MANAGE);
    expect(accountsRole?.permissions).not.toContain(Permissions.APPROVAL_SECOND_INVOICE);
    expect(accountsRole?.permissions).not.toContain(Permissions.ORDER_WAREHOUSE_PROCESS);
    expect(accountsRole?.permissions).not.toContain(Permissions.CATALOG_MANAGE);
    expect(accountsRole?.permissions).not.toContain(Permissions.DATA_IMPORT);
    expect(accountsRole?.permissions).not.toContain(Permissions.ROUTE_MANAGE);
    expect(accountsRole?.permissions).not.toContain(Permissions.EXPENSE_REVIEW);
  });

  it("defines sales coordinator role with orders, proposals, and approvals permissions", () => {
    const coordinatorRole = ROLE_DEFINITIONS.find((r) => r.name === "sales_coordinator");
    expect(coordinatorRole).toBeDefined();

    // Must have
    expect(coordinatorRole?.permissions).toContain(Permissions.APPROVAL_SECOND_INVOICE);
    expect(coordinatorRole?.permissions).toContain(Permissions.COMMERCIAL_STATUS_VIEW);
    expect(coordinatorRole?.permissions).toContain(Permissions.RETAILER_PROPOSAL_REVIEW);
    expect(coordinatorRole?.permissions).toContain(Permissions.CATALOG_MANAGE);

    // Must NOT have financial or system administrative powers
    expect(coordinatorRole?.permissions).not.toContain(Permissions.STAFF_MANAGE);
    expect(coordinatorRole?.permissions).not.toContain(Permissions.COLLECTION_CONFIRM);
    expect(coordinatorRole?.permissions).not.toContain(Permissions.FINANCIAL_CORRECT);
    expect(coordinatorRole?.permissions).not.toContain(Permissions.RECOVERY_VIEW);
    expect(coordinatorRole?.permissions).not.toContain(Permissions.DATA_IMPORT);
    expect(coordinatorRole?.permissions).not.toContain(Permissions.ROUTE_MANAGE);
    expect(coordinatorRole?.permissions).not.toContain(Permissions.EXPENSE_REVIEW);
  });
});
