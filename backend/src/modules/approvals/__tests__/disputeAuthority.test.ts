import { describe, expect, it } from "vitest";
import { canResolveReassessment, isDisputablePermission } from "../disputeService";

describe("dispute authority", () => {
  it("limits sales disputes to credit approval types", () => {
    expect(isDisputablePermission("approval.second_invoice")).toBe(true);
    expect(isDisputablePermission("approval.third_invoice")).toBe(true);
    expect(isDisputablePermission("collection.confirm")).toBe(false);
  });

  it("never lets Credit Lead or Founder replace Accounts confirmation", () => {
    expect(canResolveReassessment("collection.confirm", ["approval.third_invoice"], false)).toBe(false);
    expect(canResolveReassessment("collection.confirm", ["legal.decide"], true)).toBe(false);
    expect(canResolveReassessment("collection.confirm", ["collection.confirm"], false)).toBe(true);
  });

  it("allows Founder to resolve escalated credit authority only", () => {
    expect(canResolveReassessment("approval.third_invoice", ["legal.decide"], true)).toBe(true);
    expect(canResolveReassessment("approval.third_invoice", ["approval.third_invoice"], true)).toBe(true);
  });
});
