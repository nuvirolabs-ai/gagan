import { describe, expect, it } from "vitest";
import { staffAppAccess } from "../staffAppAccess";

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
