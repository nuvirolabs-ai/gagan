import { describe, expect, it } from "vitest";
import { validateRows } from "../importService";

function dbWithRetailers(retailers: { id: string; name: string; phone: string }[]) {
  return {
    tier: { findMany: async () => [{ id: "gold", name: "Gold" }] },
    retailer: { findMany: async () => retailers },
    staffUser: { findMany: async () => [] },
    product: { findMany: async () => [] },
    inventorySnapshot: { findMany: async () => [] },
    priceList: { findMany: async () => [] },
  } as any;
}

const row = {
  rowNumber: 2,
  values: { name: "Mahesh Store", phone: "9999999999", shop_address: "12 Market Road, Pune", tier: "Gold" },
};

describe("retailer import phone identity", () => {
  it("matches a legacy ten-digit retailer in update-only mode", async () => {
    const [result] = await validateRows(dbWithRetailers([{ id: "existing", name: "Mahesh Store", phone: "9999999999" }]), "retailers", [row], "update_only");
    expect(result.action).toBe("update");
    expect(result.match).toEqual({ id: "existing", label: "Mahesh Store" });
    expect(result.errors).toEqual([]);
  });

  it("blocks a create-only import when the legacy phone already exists", async () => {
    const [result] = await validateRows(dbWithRetailers([{ id: "existing", name: "Mahesh Store", phone: "9999999999" }]), "retailers", [row], "create_only");
    expect(result.action).toBe("blocked");
    expect(result.errors).toContain("A matching record already exists (create-only mode).");
  });

  it("blocks an ambiguous canonical and legacy duplicate instead of choosing one", async () => {
    const [result] = await validateRows(dbWithRetailers([
      { id: "legacy", name: "Legacy", phone: "9999999999" },
      { id: "canonical", name: "Canonical", phone: "+919999999999" },
    ]), "retailers", [row], "upsert");
    expect(result.action).toBe("blocked");
    expect(result.errors).toContain("Multiple retailer records share this phone after normalization.");
  });
});
