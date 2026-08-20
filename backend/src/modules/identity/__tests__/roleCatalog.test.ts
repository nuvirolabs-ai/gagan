import { describe, expect, it } from "vitest";
import { Permissions, ROLE_DEFINITIONS } from "../roleCatalog";

describe("identity role catalog", () => {
  it("defines the nine approved operational roles", () => {
    expect(ROLE_DEFINITIONS.map((role) => role.name)).toEqual([
      "salesperson",
      "field_collector",
      "credit_team",
      "sales_coordinator",
      "credit_team_lead",
      "accounts",
      "dispatch",
      "founder_director",
      "platform_admin",
    ]);
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
});
