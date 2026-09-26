import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  create: vi.fn(), productFind: vi.fn(), productFindMany: vi.fn(), productUpdate: vi.fn(),
  variantFind: vi.fn(), variantFindFirst: vi.fn(), variantUpdate: vi.fn(), variantCreate: vi.fn(), priceUpsert: vi.fn(),
}));
vi.mock("../../../lib/prisma", () => ({ prisma: {
  product: { create: mocks.create, findUnique: mocks.productFind, findMany: mocks.productFindMany, update: mocks.productUpdate },
  variant: { findUnique: mocks.variantFind, findFirst: mocks.variantFindFirst, update: mocks.variantUpdate, create: mocks.variantCreate },
  priceList: { upsert: mocks.priceUpsert },
} }));
vi.mock("../../../lib/adminAuth", () => ({ requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next() }));

import router from "../../../routes/admin/catalog";

const app = express();
app.use(express.json(), router);
const pack = { unitSize: "500 g", unit: "g", unitsPerCase: 12, unitWeightKg: 0.5 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue({ id: "p1", catalogStatus: "pending_review", variants: [{ id: "v1", catalogStatus: "pending_review" }] });
  mocks.productFindMany.mockResolvedValue([]);
  mocks.variantFindFirst.mockResolvedValue(null);
});

describe("admin catalogue drafts", () => {
  it("creates product and variants as drafts despite a requested active status", async () => {
    const response = await request(app).post("/products").send({ name: "Example", category: "Food", catalogStatus: "active", variants: [{ ...pack, catalogStatus: "active" }] });
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      catalogStatus: "pending_review", variants: { create: [expect.objectContaining({ catalogStatus: "pending_review" })] },
    }) }));
  });

  it("rejects changes to an active variant and product", async () => {
    mocks.variantFind.mockResolvedValue({ id: "v1", catalogStatus: "active" });
    mocks.productFind.mockResolvedValue({ id: "p1", catalogStatus: "active" });
    expect((await request(app).put("/variants/v1").send(pack)).status).toBe(409);
    expect((await request(app).put("/products/p1").send({ name: "New", category: "Food" })).status).toBe(409);
    expect(mocks.variantUpdate).not.toHaveBeenCalled();
    expect(mocks.productUpdate).not.toHaveBeenCalled();
  });

  it("updates only draft fields without activating", async () => {
    mocks.variantFind.mockResolvedValue({ id: "v1", catalogStatus: "pending_review" });
    mocks.variantUpdate.mockResolvedValue({ id: "v1", catalogStatus: "pending_review" });
    const response = await request(app).put("/variants/v1").send({ ...pack, catalogStatus: "active" });
    expect(response.status).toBe(200);
    expect(mocks.variantUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: pack }));
  });

  it("adds a variant only beneath a draft product", async () => {
    mocks.productFind.mockResolvedValueOnce({ id: "p1", catalogStatus: "active" }).mockResolvedValueOnce({ id: "p1", catalogStatus: "pending_review" });
    expect((await request(app).post("/products/p1/variants").send(pack)).status).toBe(409);
    mocks.variantCreate.mockResolvedValue({ id: "v2", catalogStatus: "pending_review" });
    const response = await request(app).post("/products/p1/variants").send({ ...pack, catalogStatus: "active" });
    expect(response.status).toBe(201);
    expect(mocks.variantCreate).toHaveBeenCalledWith({ data: { ...pack, productId: "p1", catalogStatus: "pending_review" } });
  });

  it("rejects duplicate packs and a duplicate product identity", async () => {
    const body = { name: "Example", category: "Food", variants: [pack, pack] };
    expect((await request(app).post("/products").send(body)).status).toBe(409);
    mocks.productFindMany.mockResolvedValue([{ id: "other" }]);
    expect((await request(app).post("/products").send({ ...body, variants: [pack] })).status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("allows the same pack size with different units per case", async () => {
    const response = await request(app).post("/products").send({ name: "Example", category: "Food", variants: [pack, { ...pack, unitsPerCase: 60 }] });
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledOnce();
  });

  it("returns a conflict when PostgreSQL wins a concurrent identity race", async () => {
    mocks.create.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" }));
    const response = await request(app).post("/products").send({ name: "Example", category: "Food", variants: [pack] });
    expect(response.status).toBe(409);
    expect(response.body.error).toBe("catalog_identity_exists");
  });

  it("edits a pending pack under an active product without touching active metadata", async () => {
    mocks.variantFind.mockResolvedValue({ id: "v1", productId: "p1", catalogStatus: "pending_review" });
    mocks.variantUpdate.mockResolvedValue({ id: "v1", catalogStatus: "pending_review" });
    const response = await request(app).put("/variants/v1").send(pack);
    expect(response.status).toBe(200);
    expect(mocks.productUpdate).not.toHaveBeenCalled();
  });

  it("rejects basis-free price writes on draft variants", async () => {
    mocks.variantFind.mockResolvedValue({ id: "v1", catalogStatus: "pending_review" });
    const response = await request(app).post("/price-list").send({ tierId: "gold", variantId: "v1", price: 100 });
    expect(response.status).toBe(409);
    expect(mocks.priceUpsert).not.toHaveBeenCalled();
  });
});
