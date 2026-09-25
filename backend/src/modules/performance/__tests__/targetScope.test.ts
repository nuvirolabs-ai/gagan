import { describe, expect, it } from "vitest";
import { resolveTargetWriteScope } from "../targetScope";

const rep = {
  status: "active" as const,
  phone: "+919876543210",
  salesRepPhone: "9876543210",
  roles: ["salesperson"],
};

describe("target write scope", () => {
  it("maps an old unscoped request only for a verified ordinary salesperson", () => {
    expect(resolveTargetWriteScope(undefined, rep)).toBe("PERSONAL");
    expect(() => resolveTargetWriteScope(undefined, { ...rep, roles: ["salesperson", "field_manager"] })).toThrow("target_scope_required");
    expect(() => resolveTargetWriteScope(undefined, { ...rep, salesRepPhone: null })).toThrow("target_scope_required");
    expect(() => resolveTargetWriteScope(undefined, { ...rep, salesRepPhone: "9876543200" })).toThrow("target_scope_required");
  });

  it("allows explicit PERSONAL and TEAM only for their eligible owner", () => {
    expect(resolveTargetWriteScope("PERSONAL", { ...rep, roles: ["salesperson", "field_manager"] })).toBe("PERSONAL");
    expect(resolveTargetWriteScope("TEAM", { ...rep, roles: ["salesperson", "field_manager"] })).toBe("TEAM");
    expect(resolveTargetWriteScope("TEAM", { ...rep, roles: ["field_manager"], salesRepPhone: null })).toBe("TEAM");
    expect(() => resolveTargetWriteScope("TEAM", rep)).toThrow("team_owner_required");
    expect(() => resolveTargetWriteScope("PERSONAL", { ...rep, roles: ["field_manager"] })).toThrow("personal_owner_required");
    expect(() => resolveTargetWriteScope("PERSONAL", { ...rep, status: "suspended" })).toThrow("target_owner_inactive");
  });
});
