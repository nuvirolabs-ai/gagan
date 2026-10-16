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
      email: `adm-phase3-${run}@test.invalid`,
      name: "Phase 3 Test Admin",
      passwordHash: "test-only",
    },
  });
  await prisma.staffUser.create({
    data: {
      id: staffId,
      adminUserId,
      name: "Phase 3 Staff",
      phone: `89${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "3")}`,
      email: `adm-phase3-staff-${run}@test.invalid`,
      roles: { create: { roleId: adminRole.id } },
    },
  });
  const session = await lazyIdentitySessionService.createSession({
    realm: "admin",
    subjectId: staffId,
  });
  token = session.accessToken;
});

describe("Phase 3: Logistics & Field Force Endpoints", () => {
  // Gap 12: Inventory Stock Adjustments & Transfer Manager
  it("Gap 12: GET /admin/inventory/summary returns on-hand stock and low-stock alerts", async () => {
    const res = await request(app)
      .get("/admin/inventory/summary?warehouseCode=WH-001")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("metrics");
    expect(res.body.metrics).toHaveProperty("totalSkus");
    expect(res.body).toHaveProperty("inventory");
    expect(Array.isArray(res.body.inventory)).toBe(true);
  });

  it("Gap 12: GET /admin/inventory/movements returns stock movement history", async () => {
    const res = await request(app)
      .get("/admin/inventory/movements?warehouseCode=WH-001")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("movements");
    expect(Array.isArray(res.body.movements)).toBe(true);
  });

  it("Gap 12: GET /admin/inventory/transfers returns inter-warehouse transfer orders", async () => {
    const res = await request(app)
      .get("/admin/inventory/transfers")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("transfers");
    expect(Array.isArray(res.body.transfers)).toBe(true);
  });

  // Gap 13: Delivery Fleet & Vehicle Run Dispatcher
  it("Gap 13: GET /admin/fleet/vehicles returns registered delivery vehicles", async () => {
    const res = await request(app)
      .get("/admin/fleet/vehicles")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("vehicles");
    expect(Array.isArray(res.body.vehicles)).toBe(true);
  });

  it("Gap 13: GET /admin/fleet/runs returns active delivery runs", async () => {
    const res = await request(app)
      .get("/admin/fleet/runs?warehouseCode=WH-001")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("runs");
    expect(Array.isArray(res.body.runs)).toBe(true);
  });

  // Gap 14: Customer Schemes & Trade Promotion Engine
  it("Gap 14: GET /admin/promotions/schemes returns customer schemes and promotions", async () => {
    const res = await request(app)
      .get("/admin/promotions/schemes")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("schemes");
    expect(Array.isArray(res.body.schemes)).toBe(true);
    expect(res.body).toHaveProperty("stats");
  });

  // Gap 15: Market Surveys & Field Task Creator
  it("Gap 15: GET /admin/field-tasks returns field audit tasks and evidence", async () => {
    const res = await request(app)
      .get("/admin/field-tasks")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("tasks");
    expect(Array.isArray(res.body.tasks)).toBe(true);
  });

  // Gap 16: Salesperson Expense & Leave Approvals Portal
  it("Gap 16: GET /admin/field-approvals/expenses returns field expense claims", async () => {
    const res = await request(app)
      .get("/admin/field-approvals/expenses")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("expenses");
    expect(Array.isArray(res.body.expenses)).toBe(true);
    expect(res.body).toHaveProperty("metrics");
  });

  it("Gap 16: GET /admin/field-approvals/leaves returns staff leave requests", async () => {
    const res = await request(app)
      .get("/admin/field-approvals/leaves")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("leaves");
    expect(Array.isArray(res.body.leaves)).toBe(true);
    expect(res.body).toHaveProperty("metrics");
  });
});
