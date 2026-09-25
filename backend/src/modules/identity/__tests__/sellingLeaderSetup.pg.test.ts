import { randomInt, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { StaffManagementService } from "../staffManagementService";

const localUrl = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const disposable = localUrl && ["localhost", "127.0.0.1"].includes(localUrl.hostname)
  && localUrl.pathname.includes("test");
const ownedStaff: string[] = [];
const ownedReps: string[] = [];
const service = new StaffManagementService();

function phone() {
  return `+919${randomInt(100000000, 999999999)}`;
}

async function staff(name: string, mobile = phone(), managerId?: string) {
  const id = randomUUID();
  ownedStaff.push(id);
  return prisma.staffUser.create({ data: {
    id, name, phone: mobile, email: `${id}@test.invalid`, managerId,
  } });
}

async function rep(name: string, mobile: string) {
  const id = randomUUID();
  ownedReps.push(id);
  return prisma.salesRep.create({ data: { id, name, phone: mobile } });
}

describe.skipIf(!disposable)("selling Sales Leader atomic setup on PostgreSQL", () => {
  beforeAll(async () => {
    const names = await prisma.role.findMany({ where: { name: { in: ["salesperson", "field_manager"] } } });
    expect(names).toHaveLength(2);
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { subjectId: { in: ownedStaff } } });
    await prisma.staffUser.deleteMany({ where: { id: { in: ownedStaff } } });
    await prisma.salesRep.deleteMany({ where: { id: { in: ownedReps } } });
  });

  it("reuses one canonical rep, assigns both roles and audits hierarchy in one transaction", async () => {
    const leader = await staff("Leader");
    const candidate = await rep("Different name is not evidence", leader.phone.slice(3));
    const report = await staff("Report");
    const result = await service.setupSellingLeader({ staffId: leader.id, reportIds: [report.id] }, "admin-test");
    expect(result).toMatchObject({ workspaceMode: "sales_leader", staff: { id: leader.id, salesRepId: candidate.id } });
    expect(result.roles).toEqual(expect.arrayContaining(["salesperson", "field_manager"]));
    expect((await prisma.staffUser.findUniqueOrThrow({ where: { id: report.id } })).managerId).toBe(leader.id);
    expect(await prisma.auditEvent.count({ where: { subjectId: report.id, action: "staff.manager_changed", subjectType: "staff_user" } })).toBe(1);
    await service.setupSellingLeader({ staffId: leader.id, reportIds: [report.id] }, "admin-test");
    expect(await prisma.salesRep.count({ where: { phone: candidate.phone } })).toBe(1);
  });

  it("creates exactly one rep for an unmatched identity and preserves it on repeat", async () => {
    const leader = await staff("New leader");
    const first = await service.setupSellingLeader({ staffId: leader.id }, "admin-test");
    ownedReps.push(first.staff.salesRepId!);
    const second = await service.setupSellingLeader({ staffId: leader.id }, "admin-test");
    expect(second.staff.salesRepId).toBe(first.staff.salesRepId);
    expect(await prisma.salesRep.count({ where: { phone: leader.phone } })).toBe(1);
  });

  it("rejects two canonical matches without any role/link/audit write", async () => {
    const leader = await staff("Ambiguous");
    await rep("First", leader.phone);
    await rep("Second", leader.phone.slice(3));
    await expect(service.setupSellingLeader({ staffId: leader.id }, "admin-test"))
      .rejects.toMatchObject({ code: "sales_rep_identity_ambiguous" });
    const current = await prisma.staffUser.findUniqueOrThrow({ where: { id: leader.id }, include: { roles: true } });
    expect(current.salesRepId).toBeNull();
    expect(current.roles).toHaveLength(0);
    expect(await prisma.auditEvent.count({ where: { subjectId: leader.id } })).toBe(0);
  });

  it("does not create or reuse on an exact-name, conflicting-phone identity", async () => {
    const leader = await staff("Same Person Name");
    const unrelated = await rep("Same Person Name", phone());
    await expect(service.setupSellingLeader({ staffId: leader.id }, "admin-test"))
      .rejects.toMatchObject({ code: "sales_rep_identity_ambiguous" });
    expect((await prisma.staffUser.findUniqueOrThrow({ where: { id: leader.id } })).salesRepId).toBeNull();
    expect(await prisma.salesRep.count({ where: { name: "Same Person Name" } })).toBe(1);
    expect(unrelated.id).toBeTruthy();
  });

  it("rolls back role/link changes if hierarchy would cycle", async () => {
    const report = await staff("Would-be report");
    const leader = await staff("Would-be leader", phone(), report.id);
    await rep("Contact match", leader.phone);
    await expect(service.setupSellingLeader({ staffId: leader.id, reportIds: [report.id] }, "admin-test"))
      .rejects.toMatchObject({ code: "cycle" });
    const current = await prisma.staffUser.findUniqueOrThrow({ where: { id: leader.id }, include: { roles: true } });
    expect(current.salesRepId).toBeNull();
    expect(current.roles).toHaveLength(0);
    expect(await prisma.auditEvent.count({ where: { subjectId: leader.id } })).toBe(0);
  });

  it("keeps one rep identity through concurrent setup and a later retry", async () => {
    const leader = await staff("Concurrent leader");
    const outcomes = await Promise.allSettled([
      service.setupSellingLeader({ staffId: leader.id }, "admin-test"),
      service.setupSellingLeader({ staffId: leader.id }, "admin-test"),
    ]);
    expect(outcomes.some((outcome) => outcome.status === "fulfilled")).toBe(true);
    const settled = await service.setupSellingLeader({ staffId: leader.id }, "admin-test");
    ownedReps.push(settled.staff.salesRepId!);
    expect(await prisma.salesRep.count({ where: { phone: leader.phone } })).toBe(1);
    expect(await prisma.staffRole.count({ where: { staffId: leader.id } })).toBe(2);
  });

  it("creates a new staff and rep atomically, and manager-only is an explicit later choice", async () => {
    const mobile = phone();
    const id = randomUUID();
    const result = await service.setupSellingLeader({ newStaff: {
      name: "New selling leader", phone: mobile, email: `${id}@test.invalid`,
    } }, "admin-test");
    ownedStaff.push(result.staff.id);
    ownedReps.push(result.staff.salesRepId!);
    expect(result.roles).toEqual(expect.arrayContaining(["salesperson", "field_manager"]));
    const manager = await service.setupManagerOnly(result.staff.id, "admin-test");
    expect(manager.workspaceMode).toBe("manager_only");
    expect(manager.staff.salesRepId).toBe(result.staff.salesRepId);
    expect(manager.roles).toContain("field_manager");
    expect(manager.roles).not.toContain("salesperson");
  });
});
