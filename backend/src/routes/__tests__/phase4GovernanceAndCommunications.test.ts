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
      email: `adm-phase4-${run}@test.invalid`,
      name: "Phase 4 Test Admin",
      passwordHash: "test-only",
    },
  });
  await prisma.staffUser.create({
    data: {
      id: staffId,
      adminUserId,
      name: "Phase 4 Staff",
      phone: `88${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "4")}`,
      email: `adm-phase4-staff-${run}@test.invalid`,
      roles: { create: { roleId: adminRole.id } },
    },
  });
  const session = await lazyIdentitySessionService.createSession({
    realm: "admin",
    subjectId: staffId,
  });
  token = session.accessToken;
});

describe("Phase 4: Governance & Communications Endpoints", () => {
  let createdBroadcastId = "";
  let createdRoleId = "";

  // Gap 17: Notification & Broadcast Center
  it("Gap 17: GET /admin/broadcasts returns broadcast list and metrics", async () => {
    const res = await request(app)
      .get("/admin/broadcasts")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("broadcasts");
    expect(Array.isArray(res.body.broadcasts)).toBe(true);
    expect(res.body).toHaveProperty("metrics");
    expect(res.body.metrics).toHaveProperty("totalBroadcasts");
    expect(res.body.metrics).toHaveProperty("activeBroadcasts");
    expect(res.body.metrics).toHaveProperty("deliveredPushAlerts");
  });

  it("Gap 17: POST /admin/broadcasts creates an urgent broadcast announcement", async () => {
    const res = await request(app)
      .post("/admin/broadcasts")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Test Emergency Price Revision Broadcast",
        body: "All pulses and grains pricing adjusted by +2% due to APMC market rates.",
        priority: "urgent",
        audience: "all_retailers",
        channels: ["in_app", "push"],
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("broadcast");
    expect(res.body.broadcast.title).toBe("Test Emergency Price Revision Broadcast");
    expect(res.body.broadcast.priority).toBe("urgent");
    expect(res.body.broadcast.status).toBe("sent");
    createdBroadcastId = res.body.broadcast.id;
  });

  it("Gap 17: PATCH /admin/broadcasts/:id/cancel cancels a broadcast", async () => {
    expect(createdBroadcastId).toBeTruthy();
    const res = await request(app)
      .patch(`/admin/broadcasts/${createdBroadcastId}/cancel`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.broadcast.status).toBe("cancelled");
  });

  it("Gap 17: POST /admin/broadcasts/:id/resend re-dispatches a broadcast", async () => {
    expect(createdBroadcastId).toBeTruthy();
    const res = await request(app)
      .post(`/admin/broadcasts/${createdBroadcastId}/resend`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.broadcast.status).toBe("sent");
  });

  // Gap 18: Role-Based Access Control (RBAC) & Permissions Editor
  it("Gap 18: GET /admin/rbac/roles returns roles directory with metrics", async () => {
    const res = await request(app)
      .get("/admin/rbac/roles")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("roles");
    expect(Array.isArray(res.body.roles)).toBe(true);
    expect(res.body).toHaveProperty("metrics");
    expect(res.body.metrics).toHaveProperty("totalRoles");
    expect(res.body.metrics.totalRoles).toBeGreaterThanOrEqual(10);
  });

  it("Gap 18: GET /admin/rbac/permissions returns categorized permissions", async () => {
    const res = await request(app)
      .get("/admin/rbac/permissions")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("permissions");
    expect(res.body).toHaveProperty("categories");
    expect(res.body.total).toBeGreaterThanOrEqual(40);
  });

  it("Gap 18: POST /admin/rbac/roles creates a custom role", async () => {
    const permsRes = await request(app)
      .get("/admin/rbac/permissions")
      .set("Authorization", `Bearer ${token}`);
    const sampleIds = permsRes.body.permissions.slice(0, 3).map((p: any) => p.id);

    const res = await request(app)
      .post("/admin/rbac/roles")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `test_auditor_${run.slice(0, 8)}`,
        description: "Test Custom Security Auditor",
        color: "#0284c7",
        permissionIds: sampleIds,
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("role");
    expect(res.body.role.name).toBe(`test_auditor_${run.slice(0, 8)}`);
    createdRoleId = res.body.role.id;
  });

  it("Gap 18: PUT /admin/rbac/roles/:id updates role description and color", async () => {
    expect(createdRoleId).toBeTruthy();
    const res = await request(app)
      .put(`/admin/rbac/roles/${createdRoleId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        description: "Updated Auditor Description",
        color: "#059669",
      });
    expect(res.status).toBe(200);
    expect(res.body.role.description).toBe("Updated Auditor Description");
    expect(res.body.role.color).toBe("#059669");
  });

  it("Gap 18: PUT /admin/rbac/roles/:id/permissions updates assigned permissions", async () => {
    expect(createdRoleId).toBeTruthy();
    const permsRes = await request(app)
      .get("/admin/rbac/permissions")
      .set("Authorization", `Bearer ${token}`);
    const newSampleIds = permsRes.body.permissions.slice(0, 5).map((p: any) => p.id);

    const res = await request(app)
      .put(`/admin/rbac/roles/${createdRoleId}/permissions`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        permissionIds: newSampleIds,
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(5);
  });

  it("Gap 18: GET /admin/rbac/audit-trail returns RBAC audit records", async () => {
    const res = await request(app)
      .get("/admin/rbac/audit-trail")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("events");
    expect(Array.isArray(res.body.events)).toBe(true);
  });
});
