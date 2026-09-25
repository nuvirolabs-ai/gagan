import { afterEach, describe, expect, it, vi } from "vitest";
import { selectInventorySnapshot } from "../inventoryService";

const product = { id: "product", sapMaterialId: null };
const variant = { id: "variant", internalCode: "GAGAN-INT-V-exact" };
const stock = { productId: "product", variantId: "variant", sapMaterialId: null, internalMaterialId: "GAGAN-INT-V-exact", source: "staging_uat" };
afterEach(() => vi.unstubAllEnvs());

describe("separate internal staging inventory identity", () => {
  it("selects an exact internal variant in mock staging without an SAP identity", () => {
    vi.stubEnv("NODE_ENV", "staging"); vi.stubEnv("SAP_MODE", "mock");
    expect(selectInventorySnapshot(product, variant, [stock])).toBe(stock);
    expect(product.sapMaterialId).toBeNull();
  });
  it("rejects another pack, product, source and production use", () => {
    vi.stubEnv("NODE_ENV", "staging"); vi.stubEnv("SAP_MODE", "mock");
    for (const mismatch of [{ ...stock, variantId: "other" }, { ...stock, productId: "other" }, { ...stock, source: "sap" }]) {
      expect(selectInventorySnapshot(product, variant, [mismatch])).toBeUndefined();
    }
    vi.stubEnv("NODE_ENV", "production");
    expect(selectInventorySnapshot(product, variant, [stock])).toBeUndefined();
    vi.stubEnv("NODE_ENV", "staging"); vi.stubEnv("SAP_MODE", "service-layer");
    expect(selectInventorySnapshot(product, variant, [stock])).toBeUndefined();
  });
  it("preserves the existing SAP inventory mapping and never substitutes UAT stock", () => {
    vi.stubEnv("NODE_ENV", "staging"); vi.stubEnv("SAP_MODE", "mock");
    const sap = { ...stock, internalMaterialId: null, sapMaterialId: "actual-material", source: "sap" };
    expect(selectInventorySnapshot({ ...product, sapMaterialId: "actual-material" }, variant, [stock, sap])).toBe(sap);
  });
});
