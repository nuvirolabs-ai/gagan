import { randomInt, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../../app";
import { prisma } from "../../../lib/prisma";
import { StaffManagementService } from "../staffManagementService";

const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const disposable = url && ["localhost", "127.0.0.1"].includes(url.hostname) && url.pathname.includes("test");
const staffIds: string[] = [];
const repIds: string[] = [];
const adminId = randomUUID();
const adminStaffId = randomUUID();
const password = randomUUID();
const app = createApp();
const service = new StaffManagementService();
let token: string;

function phone() {
  return `+919${randomInt(100000000, 999999999)}`;
}

async function staff(name: string, mobile = phone(), managerId?: string) {
  const id = randomUUID();
  staffIds.push(id);
  return prisma.staffUser.create({ data: { id, name, phone: mobile, email: `${id}@test.invalid`, managerId } });
}

async function rep(name: string, mobile: string) {
  const id = randomUUID();
  repIds.push(id);
  return prisma.salesRep.create({ data: { id, name, phone: mobile } });
}

describe.skipIf(!disposable)("ordinary salesperson setup on authenticated local PostgreSQL", () => {
  beforeAll(async () => {
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "platform_admin" } });
    await prisma.adminUser.create({ data: {
      id: adminId, name: "Setup admin", email: `${adminId}@test.invalid`, passwordHash: await bcrypt.hash(password, 10),
    } });
    await prisma.staffUser.create({ data: {
      id: adminStaffId, name: "Setup admin", phone: phone(), email: `${adminStaffId}@test.invalid`,
      adminUserId: adminId, roles: { create: { roleId: adminRole.id } },
    } });
    const login = await request(app).post("/admin/auth/login").send({ email: `${adminId}@test.invalid`, password });
    expect(login.status).toBe(200);
    token = login.body.accessToken;
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { OR: [
      { subjectId: { in: staffIds } }, { subjectId: adminStaffId },
    ] } });
    await prisma.deviceSession.deleteMany({ where: { subjectId: adminStaffId } });
    await prisma.staffRole.deleteMany({ where: { staffId: { in: [...staffIds, adminStaffId] } } });
    await prisma.staffUser.deleteMany({ where: { id: { in: staffIds } } });
    await prisma.staffUser.delete({ where: { id: adminStaffId } });
    await prisma.adminUser.delete({ where: { id: adminId } });
    await prisma.salesRep.deleteMany({ where: { id: { in: repIds } } });
  });

  it("links an exact phone match, changes only an explicit manager, and retains collector access", async () => {
    const manager = await staff("Manager");
    const seller = await staff("Seller");
    const candidate = await rep("Legacy book", seller.phone.slice(3));
    const collector = await prisma.role.findUniqueOrThrow({ where: { name: "field_collector" } });
    await prisma.staffRole.create({ data: { staffId: seller.id, roleId: collector.id } });

    const anonymous = await request(app).post(`/admin/staff/${seller.id}/salesperson-setup`).send({});
    expect(anonymous.status).toBe(401);

    const response = await request(app).post(`/admin/staff/${seller.id}/salesperson-setup`)
      .set("Authorization", `Bearer ${token}`).send({ managerId: manager.id });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ workspaceMode: "salesperson", staff: {
      id: seller.id, salesRepId: candidate.id, managerId: manager.id,
    } });
    expect(response.body.roles).toEqual(expect.arrayContaining(["salesperson", "field_collector"]));
    expect(response.body.roles).not.toContain("field_manager");
    expect(await prisma.auditEvent.count({ where: { subjectId: seller.id, action: "staff.manager_changed" } })).toBe(1);
    expect(await prisma.auditEvent.count({ where: { subjectId: seller.id, action: "staff.salesperson_setup", actorStaffId: adminStaffId } })).toBe(1);
    expect(await prisma.auditEvent.count({ where: { subjectId: seller.id, action: "staff.role_assigned", actorStaffId: adminStaffId } })).toBe(1);
    expect(await prisma.salesRep.count({ where: { id: candidate.id } })).toBe(1);

    const again = await request(app).post(`/admin/staff/${seller.id}/salesperson-setup`)
      .set("Authorization", `Bearer ${token}`).send({});
    expect(again.status).toBe(200);
    expect(again.body.staff.managerId).toBe(manager.id);
    expect(await prisma.staffRole.count({ where: { staffId: seller.id } })).toBe(2);
  });

  it("creates a staff and rep together and keeps the linked identity on retry", async () => {
    const id = randomUUID();
    const mobile = phone();
    const created = await request(app).post("/admin/staff/salesperson-setup")
      .set("Authorization", `Bearer ${token}`).send({ newStaff: {
        name: "New seller", phone: mobile, email: `${id}@test.invalid`,
      } });
    expect(created.status).toBe(201);
    staffIds.push(created.body.staff.id);
    repIds.push(created.body.staff.salesRepId);
    expect(created.body.roles).toContain("salesperson");
    expect(created.body.roles).not.toContain("field_collector");
    expect(await prisma.salesRep.count({ where: { phone: mobile } })).toBe(1);
    expect(await prisma.auditEvent.count({ where: { subjectId: created.body.staff.id, action: "staff.created" } })).toBe(1);
    const repeated = await service.setupSalesperson({ staffId: created.body.staff.id }, adminStaffId);
    expect(repeated.staff.salesRepId).toBe(created.body.staff.salesRepId);
  });

  it("keeps one rep link when the same staff setup runs concurrently", async () => {
    const seller = await staff("Concurrent seller");
    const results = await Promise.allSettled([
      service.setupSalesperson({ staffId: seller.id }, adminStaffId),
      service.setupSalesperson({ staffId: seller.id }, adminStaffId),
    ]);
    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
    const settled = await service.setupSalesperson({ staffId: seller.id }, adminStaffId);
    repIds.push(settled.staff.salesRepId!);
    expect(await prisma.salesRep.count({ where: { phone: seller.phone } })).toBe(1);
    expect(await prisma.staffRole.count({ where: { staffId: seller.id } })).toBe(1);
  });

  it("rejects name-only, duplicate-phone and claimed rep candidates without writes", async () => {
    const nameOnly = await staff("Same name");
    await rep("Same name", phone());
    await expect(service.setupSalesperson({ staffId: nameOnly.id }, adminStaffId))
      .rejects.toMatchObject({ code: "sales_rep_identity_ambiguous" });

    const duplicate = await staff("Duplicate phone");
    await rep("One", duplicate.phone);
    await rep("Two", duplicate.phone.slice(3));
    await expect(service.setupSalesperson({ staffId: duplicate.id }, adminStaffId))
      .rejects.toMatchObject({ code: "sales_rep_identity_ambiguous" });

    const owner = await staff("Owner");
    const claimedPhone = phone();
    const claimed = await rep("Claimed", claimedPhone);
    await prisma.staffUser.update({ where: { id: owner.id }, data: { salesRepId: claimed.id } });
    const other = await staff("Other", claimedPhone.slice(3));
    await expect(service.setupSalesperson({ staffId: other.id }, adminStaffId))
      .rejects.toMatchObject({ code: "sales_rep_link_conflict" });
    for (const id of [nameOnly.id, duplicate.id, other.id]) {
      expect((await prisma.staffUser.findUniqueOrThrow({ where: { id } })).salesRepId).toBeNull();
      expect(await prisma.staffRole.count({ where: { staffId: id } })).toBe(0);
      expect(await prisma.auditEvent.count({ where: { subjectId: id } })).toBe(0);
    }
  });

  it("rejects a second staff identity with the same canonical phone", async () => {
    const first = await staff("First identity");
    const second = await staff("Second identity", first.phone.slice(3));
    await expect(service.setupSalesperson({ staffId: second.id }, adminStaffId))
      .rejects.toMatchObject({ code: "staff_identity_ambiguous" });
    expect(await prisma.salesRep.count({ where: { phone: first.phone } })).toBe(0);
    expect(await prisma.staffRole.count({ where: { staffId: second.id } })).toBe(0);
  });

  it("does not turn an existing manager-only account into a selling leader", async () => {
    const manager = await staff("Manager only");
    const managerRole = await prisma.role.findUniqueOrThrow({ where: { name: "field_manager" } });
    await prisma.staffRole.create({ data: { staffId: manager.id, roleId: managerRole.id } });
    await expect(service.setupSalesperson({ staffId: manager.id }, adminStaffId))
      .rejects.toMatchObject({ code: "selling_leader_setup_required" });
    expect((await prisma.staffUser.findUniqueOrThrow({ where: { id: manager.id } })).salesRepId).toBeNull();
    expect(await prisma.staffRole.count({ where: { staffId: manager.id } })).toBe(1);
  });

  it("rolls back a new rep, role and audit when an explicit manager is invalid", async () => {
    const seller = await staff("Invalid manager");
    await expect(service.setupSalesperson({ staffId: seller.id, managerId: seller.id }, adminStaffId))
      .rejects.toMatchObject({ code: "self_management" });
    expect((await prisma.staffUser.findUniqueOrThrow({ where: { id: seller.id } })).salesRepId).toBeNull();
    expect(await prisma.salesRep.count({ where: { phone: seller.phone } })).toBe(0);
    expect(await prisma.staffRole.count({ where: { staffId: seller.id } })).toBe(0);
    expect(await prisma.auditEvent.count({ where: { subjectId: seller.id } })).toBe(0);
  });
});
