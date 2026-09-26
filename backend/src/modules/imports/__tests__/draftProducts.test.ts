import { describe, expect, it, vi } from "vitest";
import { applyImport, validateRows } from "../importService";

const product = { id: "p1", name: "Existing", category: "Food", catalogStatus: "active", sapMaterialId: null,
  variants: [{ id: "v1", unitSize: "1 kg", unitsPerCase: 12, catalogStatus: "active" }] };
const db = { tier: { findMany: async () => [] }, retailer: { findMany: async () => [] },
  staffUser: { findMany: async () => [] }, product: { findMany: async () => [product] },
  inventorySnapshot: { findMany: async () => [] }, priceList: { findMany: async () => [] } } as any;
const values = { product_name: "Fresh", category: "Food", unit_size: "500 g", unit: "g", units_per_case: "12", unit_weight_kg: "0.5" };
const row = (rowNumber: number, value: Record<string, string>) => ({ rowNumber, values: value });

describe("draft product import preview", () => {
  it("blocks an active match instead of overwriting it", async () => {
    const [result] = await validateRows(db, "products", [row(2, { ...values, product_name: "Existing", unit_size: "1 kg", unit: "kg", unit_weight_kg: "1" })], "upsert");
    expect(result.action).toBe("blocked");
    expect(result.errors).toContain("Existing active catalogue rows cannot be edited by import.");
  });

  it("blocks duplicate product packs within the same file", async () => {
    const results = await validateRows(db, "products", [row(2, values), row(3, values)], "create_only");
    expect(results[1].errors).toContain("Duplicate product pack in this file.");
  });

  it("treats case count as part of pack identity", async () => {
    const results = await validateRows(db, "products", [row(2, values), row(3, { ...values, units_per_case: "60" })], "create_only");
    expect(results.map((item) => item.errors)).toEqual([[], []]);
  });

  it("matches the correct existing pack when sizes coincide", async () => {
    const withPacks = { ...product, catalogStatus: "pending_review", variants: [
      { id: "v20", unitSize: "500 g", unitsPerCase: 20, catalogStatus: "pending_review" },
      { id: "v60", unitSize: "500 g", unitsPerCase: 60, catalogStatus: "pending_review" },
    ] };
    const lookup = { ...db, product: { findMany: async () => [withPacks] } } as any;
    const [result] = await validateRows(lookup, "products", [row(2, { ...values, product_name: "Existing", units_per_case: "60", product_id: "p1", variant_id: "v60" })], "upsert");
    expect(result.errors).toEqual([]);
    expect(result.resolved?.variantId).toBe("v60");
  });

  it("blocks ambiguous pricing and inventory variant matches without a discriminator", async () => {
    const withPacks = { ...product, sapMaterialId: "MAT-1", variants: [
      { id: "v20", unitSize: "500 GM", unitsPerCase: 20, catalogStatus: "active" },
      { id: "v60", unitSize: "500 GM", unitsPerCase: 60, catalogStatus: "active" },
    ] };
    const lookup = { ...db, product: { findMany: async () => [withPacks] }, tier: { findMany: async () => [{ id: "gold", name: "Gold" }] } } as any;
    const [pricing] = await validateRows(lookup, "pricing", [row(2, { tier: "Gold", product_name: "Existing", unit_size: "500 GM", price: "100" })], "upsert");
    const [inventory] = await validateRows(lookup, "inventory", [row(2, { warehouse_code: "WH-1", sap_material_id: "MAT-1", product_name: "Existing", unit_size: "500 GM", on_hand: "10" })], "upsert");
    expect(pricing.errors).toContain("Ambiguous existing pack; supply units_per_case or variant_id.");
    expect(inventory.errors).toContain("Ambiguous existing pack; supply units_per_case or variant_id.");
    const [resolved] = await validateRows(lookup, "pricing", [row(2, { tier: "Gold", product_name: "Existing", unit_size: "500 GM", units_per_case: "60", price: "100" })], "upsert");
    expect(resolved.resolved?.variantId).toBe("v60");
    expect(resolved.errors).toEqual([]);
  });

  it("uses the same mass and piece validation as manual creation", async () => {
    const results = await validateRows(db, "products", [row(2, { ...values, unit_weight_kg: "1" }), row(3, { ...values, product_name: "Pieces", unit_size: "6 pcs", unit: "pcs", unit_weight_kg: "0.25" })], "create_only");
    expect(results[0].errors).toContain("unitWeightKg must equal the mass in unitSize.");
    expect(results[1].errors).toEqual([]);
    expect(results[1].warnings).toContain("Count-only pack remains draft-only; no piece conversion or activation is inferred.");
  });

  it("applies a new bulk row with draft status on both records", async () => {
    const createProduct = vi.fn().mockResolvedValue({ id: "new-p", catalogStatus: "pending_review" });
    const createVariant = vi.fn().mockResolvedValue({ id: "new-v", catalogStatus: "pending_review" });
    const job = { id: "job", importType: "products", status: "preview", mode: "create_only", result: {}, preview: { rawRows: [row(2, values)] } };
    const fakeDb: any = {
      $transaction: async (work: (tx: any) => Promise<unknown>) => work(fakeDb),
      $queryRaw: async () => 1, $executeRaw: async () => 1,
      tier: { findMany: async () => [] }, retailer: { findMany: async () => [] }, staffUser: { findMany: async () => [] },
      product: { findMany: async () => [], create: createProduct },
      variant: { findFirst: async () => null, create: createVariant },
      inventorySnapshot: { findMany: async () => [] }, priceList: { findMany: async () => [] },
      importJob: { findUnique: async () => job, update: async ({ data }: any) => ({ ...job, ...data }) },
      auditEvent: { create: async () => ({}) },
    };
    const result = await applyImport(fakeDb, "job", "staff", true);
    expect(result.job.createdRows).toBe(1);
    expect(createProduct).toHaveBeenCalledWith({ data: expect.objectContaining({ catalogStatus: "pending_review" }) });
    expect(createVariant).toHaveBeenCalledWith({ data: expect.objectContaining({ productId: "new-p", catalogStatus: "pending_review" }) });
  });

  it("does not attach a default-case pricing import to a draft", async () => {
    const draftDb = { ...db, product: { findMany: async () => [{ ...product, name: "Draft", catalogStatus: "pending_review", variants: [{ id: "dv", unitSize: "1 kg", catalogStatus: "pending_review" }] }] } } as any;
    const [result] = await validateRows(draftDb, "pricing", [row(2, { tier: "Gold", product_name: "Draft", unit_size: "1 kg", price: "100" })], "upsert");
    expect(result.errors).toContain("Draft packs cannot receive a default-case pricing import.");
  });

  it("rejects a supplied material ID that belongs to another product", async () => {
    const materialDb = { ...db, product: { findMany: async () => [{ ...product, sapMaterialId: "MAT-1" }] } } as any;
    const [result] = await validateRows(materialDb, "products", [row(2, { ...values, sap_material_id: "MAT-1" })], "create_only");
    expect(result.errors).toContain("sap_material_id belongs to another product.");
  });

  it("groups two new packs under one draft product during apply", async () => {
    let createdProduct: { id: string; catalogStatus: string } | null = null;
    const createProduct = vi.fn(async () => (createdProduct = { id: "new-p", catalogStatus: "pending_review" }));
    const createVariant = vi.fn(async (_args: { data: { productId: string } }) => ({ id: `v-${createVariant.mock.calls.length}`, catalogStatus: "pending_review" }));
    const rawRows = [row(2, values), row(3, { ...values, unit_size: "1 kg", unit: "kg", unit_weight_kg: "1" })];
    const job = { id: "job", importType: "products", status: "preview", mode: "create_only", result: {}, preview: { rawRows } };
    const fakeDb: any = {
      $transaction: async (work: (tx: any) => Promise<unknown>) => work(fakeDb),
      $queryRaw: async () => 1, $executeRaw: async () => 1,
      tier: { findMany: async () => [] }, retailer: { findMany: async () => [] }, staffUser: { findMany: async () => [] },
      product: { findMany: async () => createdProduct ? [{ ...createdProduct, name: "Fresh", category: "Food", sapMaterialId: null, variants: [] }] : [], create: createProduct, update: async () => createdProduct },
      variant: { findFirst: async () => null, create: createVariant },
      inventorySnapshot: { findMany: async () => [] }, priceList: { findMany: async () => [] },
      importJob: { findUnique: async () => job, update: async ({ data }: any) => ({ ...job, ...data }) },
      auditEvent: { create: async () => ({}) },
    };
    const result = await applyImport(fakeDb, "job", "staff", true);
    expect(result.job.createdRows).toBe(2);
    expect(createProduct).toHaveBeenCalledTimes(1);
    expect(createVariant).toHaveBeenCalledTimes(2);
    expect(createVariant).toHaveBeenNthCalledWith(2, { data: expect.objectContaining({ productId: "new-p", catalogStatus: "pending_review" }) });
  });
});
