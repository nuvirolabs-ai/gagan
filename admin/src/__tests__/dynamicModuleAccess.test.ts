import { describe, expect, it } from "vitest";
import { canAccess, searchAdmin } from "../adminSearch";
import { ADMIN_NAV_GROUPS } from "../navigation";

const FLAT = ADMIN_NAV_GROUPS.flatMap((group) => group.destinations);

describe("Dynamic User Module Access Control (Checkmarks)", () => {
  const dummyPermissions = ["collection.confirm", "order.warehouse_process"];

  it("strictly allows only ticked modules when userModules is configured", () => {
    const customTickedModules = ["billing-entities", "financial-statements", "orders"];

    // Permitted modules
    expect(canAccess(dummyPermissions, ["collection.confirm"], "billing-entities", customTickedModules)).toBe(true);
    expect(canAccess(dummyPermissions, ["collection.confirm"], "financial-statements", customTickedModules)).toBe(true);
    expect(canAccess(dummyPermissions, ["approval.second_invoice"], "orders", customTickedModules)).toBe(true);

    // Unticked modules are strictly rejected even if user holds partial permission
    expect(canAccess(dummyPermissions, ["order.warehouse_process"], "warehouse-orders", customTickedModules)).toBe(false);
    expect(canAccess(dummyPermissions, ["catalog.manage"], "catalog", customTickedModules)).toBe(false);
    expect(canAccess(dummyPermissions, ["attendance.review"], "field-team", customTickedModules)).toBe(false);
    expect(canAccess(dummyPermissions, ["staff.manage"], "staff", customTickedModules)).toBe(false);
  });

  it("filters sidebar navigation items to exact ticked modules", () => {
    const customTickedModules = ["orders", "retailers", "sales-leader"];

    const accessible = FLAT.filter(
      (item) => item.route && canAccess(dummyPermissions, item.permissions, item.id, customTickedModules)
    ).map((item) => item.id);

    expect(accessible).toEqual(["work", "orders", "retailers", "sales-leader"]);
    expect(accessible).not.toContain("billing-entities");
    expect(accessible).not.toContain("warehouse-orders");
    expect(accessible).not.toContain("settings");
  });

  it("falls back to standard role permissions if userModules is null (e.g. Super Admin or legacy roles)", () => {
    const superAdminPermissions = ["staff.manage"];
    expect(canAccess(superAdminPermissions, ["staff.manage"], "staff", null)).toBe(true);
    expect(canAccess(superAdminPermissions, ["staff.manage", "catalog.manage"], "catalog", null)).toBe(true);
  });

  it("filters search results in Command Palette according to assigned modules", () => {
    const userModules = ["billing-entities", "financial-statements"];
    const results = searchAdmin("billing", {
      permissions: dummyPermissions,
      modules: userModules,
      pathname: "/",
    });

    const resultIds = results.map((r) => r.id);
    expect(resultIds).toContain("billing-entities");

    const searchOrders = searchAdmin("order", {
      permissions: dummyPermissions,
      modules: userModules,
      pathname: "/",
    });
    expect(searchOrders.map((r) => r.id)).not.toContain("orders");
    expect(searchOrders.map((r) => r.id)).not.toContain("warehouse-orders");
  });
});
