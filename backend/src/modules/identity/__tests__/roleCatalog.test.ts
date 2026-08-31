import { describe, expect, it } from "vitest";
import { Permissions, ROLE_DEFINITIONS } from "../roleCatalog";

describe("identity role catalog", () => {
  it("defines the ten approved operational roles", () => {
    expect(ROLE_DEFINITIONS.map((role) => role.name)).toEqual([
      "salesperson",
      "field_collector",
      "credit_team",
      "sales_coordinator",
      "credit_team_lead",
      "accounts",
      "dispatch",
      "founder_director",
      "field_manager",
      "platform_admin",
    ]);
  });

  it("separates running your own field day from reviewing someone else's", () => {
    const selfService = [
      Permissions.ATTENDANCE_MANAGE_SELF,
      Permissions.ROUTE_EXECUTE,
      Permissions.ACTIVITY_LOG,
      Permissions.TASK_COMPLETE,
      Permissions.EXPENSE_SUBMIT,
      Permissions.ISSUE_RAISE,
    ];
    const review = [
      Permissions.ATTENDANCE_REVIEW,
      Permissions.ROUTE_MANAGE,
      Permissions.EXPENSE_REVIEW,
      Permissions.ISSUE_REVIEW,
    ];
    const fieldRoles = ROLE_DEFINITIONS.filter((role) =>
      ["salesperson", "field_collector"].includes(role.name)
    );

    for (const role of fieldRoles) {
      expect(selfService.every((permission) => role.permissions.includes(permission))).toBe(true);
      expect(review.some((permission) => role.permissions.includes(permission))).toBe(false);
    }

    const manager = ROLE_DEFINITIONS.find((role) => role.name === "field_manager")!;
    expect(review.every((permission) => manager.permissions.includes(permission))).toBe(true);
    expect(selfService.some((permission) => manager.permissions.includes(permission))).toBe(false);
  });

  it("does not grant operational roles broad staff-management authority", () => {
    const operationalRoles = ROLE_DEFINITIONS.filter(
      (role) => role.name !== "platform_admin"
    );
    expect(
      operationalRoles.every(
        (role) => !role.permissions.includes(Permissions.STAFF_MANAGE)
      )
    ).toBe(true);
    expect(
      ROLE_DEFINITIONS.find((role) => role.name === "platform_admin")?.permissions
    ).toContain(Permissions.STAFF_MANAGE);
  });

  it("limits financial corrections to Accounts and platform administrators", () => {
    const holders = ROLE_DEFINITIONS.filter((role) =>
      role.permissions.includes(Permissions.FINANCIAL_CORRECT)
    ).map((role) => role.name);

    expect(holders).toEqual(["accounts", "platform_admin"]);
  });
});
