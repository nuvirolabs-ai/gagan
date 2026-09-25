import { describe, expect, it } from "vitest";
import { staffAppAccess, staffWorkspaceState } from "../staffAppAccess";

describe("staff app access policy", () => {
  it("allows field collectors into the app without opening salesperson routes", () => {
    expect(staffAppAccess(["collection.submit"], null)).toEqual({
      canEnterApp: true,
      canUseSalesWorkspace: false,
    });
  });

  it("requires both sales permission and a linked sales record for sales routes", () => {
    expect(staffAppAccess(["order.create_for_retailer"], "rep-1").canUseSalesWorkspace).toBe(true);
    expect(staffAppAccess(["order.create_for_retailer"], null).canUseSalesWorkspace).toBe(false);
    expect(staffAppAccess([], "rep-1").canUseSalesWorkspace).toBe(false);
  });
});

describe("server-derived staff workspace", () => {
  const permissions = ["order.create_for_retailer", "route.execute", "attendance.manage_self", "performance.view_team"];
  const base = {
    status: "active" as const,
    roles: ["salesperson", "field_manager"],
    permissions,
    staffPhone: "+919876543210",
    salesRepId: "rep-1",
    salesRepPhone: "9876543210",
  };

  it("separates salesperson, selling leader and explicit manager-only states", () => {
    expect(staffWorkspaceState({ ...base, roles: ["salesperson"] }).workspaceMode).toBe("sales");
    expect(staffWorkspaceState(base).workspaceMode).toBe("sales_leader");
    expect(staffWorkspaceState({ ...base, roles: ["field_manager"], salesRepId: null, salesRepPhone: null }).workspaceMode).toBe("manager_only");
  });

  it("fails closed on missing, broken or mismatched links", () => {
    for (const identity of [
      { salesRepId: null, salesRepPhone: null },
      { salesRepId: "rep-1", salesRepPhone: null },
      { salesRepId: "rep-1", salesRepPhone: "9876543211" },
    ]) {
      expect(staffWorkspaceState({ ...base, ...identity })).toMatchObject({
        workspaceMode: "setup_required",
        setupCode: "sales_rep_link_invalid",
        canUseSalesWorkspace: false,
      });
    }
  });

  it("requires current direct roles, current permissions and active status", () => {
    expect(staffWorkspaceState({ ...base, roles: [] }).workspaceMode).toBe("access_only");
    expect(staffWorkspaceState({ ...base, permissions: [] }).workspaceMode).toBe("setup_required");
    expect(staffWorkspaceState({ ...base, permissions: permissions.filter((permission) => permission !== "route.execute") }).workspaceMode).toBe("setup_required");
    expect(staffWorkspaceState({ ...base, status: "suspended" }).canEnterApp).toBe(false);
  });
});
