import { describe, expect, it } from "vitest";
import { inventoryIdentityForProduct } from "../inventoryService";

describe("inventory identity selection", () => {
  it("prefers the separated staging identity without pretending it is SAP", () => {
    expect(inventoryIdentityForProduct({ inventoryIdentity: "GAGAN-UAT-INV-V-1", sapMaterialId: null })).toEqual({
      kind: "internal",
      value: "GAGAN-UAT-INV-V-1",
    });
  });

  it("keeps existing SAP-linked products compatible", () => {
    expect(inventoryIdentityForProduct({ inventoryIdentity: null, sapMaterialId: "SAP-1" })).toEqual({
      kind: "sap",
      value: "SAP-1",
    });
  });

  it("does not invent an inventory identity", () => {
    expect(inventoryIdentityForProduct({ inventoryIdentity: null, sapMaterialId: null })).toBeNull();
  });
});
