import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import { lazyIdentitySessionService } from "../../modules/identity/sessionRuntime";

const run = randomUUID();
const adminUserId = randomUUID();
const staffId = randomUUID();
const app = createApp();
let token = "";

beforeAll(async () => {
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "platform_admin" } });
  await prisma.adminUser.create({
    data: {
      id: adminUserId,
      email: `adm-phase2-${run}@test.invalid`,
      name: "Phase 2 Integration Test",
      passwordHash: "test-only",
    },
  });
  await prisma.staffUser.create({
    data: {
      id: staffId,
      adminUserId,
      name: "Phase 2 Staff",
      phone: `89${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "2")}`,
      email: `adm-phase2-staff-${run}@test.invalid`,
      roles: { create: { roleId: adminRole.id } },
    },
  });
  const session = await lazyIdentitySessionService.createSession({
    realm: "admin",
    subjectId: staffId,
  });
  token = session.accessToken;
});

describe("Phase 2: Commercial & Catalog Gaps Endpoints", () => {
  it("Gap 6: GET /admin/commercial/tiers returns pricing tiers with quantity slabs", async () => {
    const res = await request(app)
      .get("/admin/commercial/tiers")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("tiers");
    expect(Array.isArray(res.body.tiers)).toBe(true);
    if (res.body.tiers.length > 0) {
      expect(res.body.tiers[0]).toHaveProperty("slabs");
    }
  });

  it("Gap 7: GET /admin/credit/policy returns credit mode and exposure metrics", async () => {
    const res = await request(app)
      .get("/admin/credit/policy")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("mode");
    expect(["shadow", "enforce"]).toContain(res.body.mode);
    expect(res.body).toHaveProperty("stats");
    expect(res.body.stats).toHaveProperty("totalRetailers");
    expect(res.body.stats).toHaveProperty("totalCreditLimit");
  });

  it("Gap 7: POST /admin/credit/policy/mode updates credit mode", async () => {
    const res = await request(app)
      .post("/admin/credit/policy/mode")
      .set("Authorization", `Bearer ${token}`)
      .send({ mode: "shadow" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, mode: "shadow" });
  });

  it("Gap 8: GET /admin/retailers/:id/full-profile returns retailer kyc and profile", async () => {
    const retailer = await prisma.retailer.findFirst({ select: { id: true } });
    if (!retailer) return;
    const res = await request(app)
      .get(`/admin/retailers/${retailer.id}/full-profile`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("retailer");
    expect(res.body.retailer).toHaveProperty("id", retailer.id);
    expect(res.body.retailer).toHaveProperty("name");
  });

  it("Gap 9: GET /admin/catalog/categories returns catalog taxonomy categories", async () => {
    const res = await request(app)
      .get("/admin/catalog/categories")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("categories");
    expect(Array.isArray(res.body.categories)).toBe(true);
  });

  it("Gap 9: GET /admin/catalog/brands returns catalog brands", async () => {
    const res = await request(app)
      .get("/admin/catalog/brands")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("brands");
    expect(Array.isArray(res.body.brands)).toBe(true);
  });

  it("Gap 10: GET /admin/catalog/media returns media asset health statistics", async () => {
    const res = await request(app)
      .get("/admin/catalog/media")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("metrics");
    expect(res.body.metrics).toHaveProperty("totalProducts");
    expect(res.body.metrics).toHaveProperty("totalVariants");
    expect(res.body).toHaveProperty("products");
    expect(Array.isArray(res.body.products)).toBe(true);
  });

  it("Gap 11: GET /admin/tax/hsn-codes returns HSN directory with GST rates", async () => {
    const res = await request(app)
      .get("/admin/tax/hsn-codes")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("hsnCodes");
    expect(Array.isArray(res.body.hsnCodes)).toBe(true);
  });
});
