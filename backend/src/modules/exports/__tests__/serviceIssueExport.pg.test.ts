import { randomUUID } from "node:crypto";
import request from "supertest";
import * as XLSX from "xlsx";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../../app";
import { prisma } from "../../../lib/prisma";
import { lazyIdentitySessionService } from "../../identity/sessionRuntime";
import { ServiceIssueExportService } from "../serviceIssueExportService";

const ids = {
  tier: randomUUID(), manager: randomUUID(), outsider: randomUUID(), repA: randomUUID(), repB: randomUUID(),
  salesRepA: randomUUID(), salesRepB: randomUUID(), retailerA: randomUUID(), retailerB: randomUUID(),
  managerAdmin: randomUUID(), outsiderAdmin: randomUUID(), role: randomUUID(),
};
let managerToken = "";
let outsiderToken = "";
const app = createApp();

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  const disposableDatabases = new Set([
    "/gagan_feedback_slice_test_review_20260926",
    "/gagan_feedback_slice_test_20260926_integrated",
  ]);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || !disposableDatabases.has(url.pathname)) {
    throw new Error("export_test_requires_isolated_local_database");
  }
  await prisma.tier.create({ data: { id: ids.tier, name: `Export ${ids.tier}` } });
  await prisma.salesRep.createMany({ data: [
    { id: ids.salesRepA, name: "Rep A", phone: ids.salesRepA },
    { id: ids.salesRepB, name: "Rep B", phone: ids.salesRepB },
  ] });
  await prisma.adminUser.createMany({ data: [
    { id: ids.managerAdmin, email: `${ids.manager}@example.test`, name: "Manager", passwordHash: "test" },
    { id: ids.outsiderAdmin, email: `${ids.outsider}@example.test`, name: "Outsider", passwordHash: "test" },
  ] });
  await prisma.staffUser.createMany({ data: [
    { id: ids.manager, name: "Manager", phone: ids.manager, email: `${ids.manager}@example.test`, adminUserId: ids.managerAdmin },
    { id: ids.outsider, name: "Outsider", phone: ids.outsider, email: `${ids.outsider}@example.test`, adminUserId: ids.outsiderAdmin },
    { id: ids.repA, name: "Rep A", phone: ids.repA, email: `${ids.repA}@example.test`, salesRepId: ids.salesRepA, managerId: ids.manager },
    { id: ids.repB, name: "Rep B", phone: ids.repB, email: `${ids.repB}@example.test`, salesRepId: ids.salesRepB },
  ] });
  await prisma.retailer.createMany({ data: [
    { id: ids.retailerA, name: "In Scope Store", phone: ids.retailerA, shopAddress: "Local", tierId: ids.tier, salesRepId: ids.salesRepA },
    { id: ids.retailerB, name: "Outside Store", phone: ids.retailerB, shopAddress: "Local", tierId: ids.tier, salesRepId: ids.salesRepB },
  ] });
  await prisma.serviceIssue.createMany({ data: [
    { retailerId: ids.retailerA, raisedByStaffId: ids.repA, type: "service_request", description: "In scope open", status: "open", createdAt: new Date("2026-09-01T00:00:00.000Z") },
    { retailerId: ids.retailerA, type: "service_request", description: "Retailer open", status: "open", createdAt: new Date("2026-09-20T23:59:59.999Z") },
    { retailerId: ids.retailerA, raisedByStaffId: ids.repA, type: "service_request", description: "In scope resolved", status: "resolved", createdAt: new Date("2026-08-01T00:00:00.000Z") },
    { retailerId: ids.retailerB, raisedByStaffId: ids.repB, type: "service_request", description: "Outside open", status: "open", createdAt: new Date("2026-09-20T12:00:00.000Z") },
  ] });
  await prisma.role.create({ data: { id: ids.role, name: `export-review-${ids.role}` } });
  const permission = await prisma.permission.upsert({
    where: { name: "issue.review" }, update: {},
    create: { name: "issue.review", description: "Review scoped service issues" },
  });
  await prisma.rolePermission.create({ data: { roleId: ids.role, permissionId: permission.id } });
  await prisma.staffRole.create({ data: { staffId: ids.manager, roleId: ids.role } });
  const sessions = await Promise.all([
    lazyIdentitySessionService.createSession({ realm: "admin", subjectId: ids.manager }),
    lazyIdentitySessionService.createSession({ realm: "admin", subjectId: ids.outsider }),
  ]);
  [managerToken, outsiderToken] = sessions.map((session) => session.accessToken);
});

afterAll(async () => {
  await prisma.deviceSession.deleteMany({ where: { subjectId: { in: [ids.manager, ids.outsider] } } });
  await prisma.serviceIssue.deleteMany({ where: { retailerId: { in: [ids.retailerA, ids.retailerB] } } });
  await prisma.retailer.deleteMany({ where: { id: { in: [ids.retailerA, ids.retailerB] } } });
  await prisma.staffRole.deleteMany({ where: { staffId: ids.manager, roleId: ids.role } });
  await prisma.rolePermission.deleteMany({ where: { roleId: ids.role } });
  await prisma.role.delete({ where: { id: ids.role } });
  await prisma.staffUser.deleteMany({ where: { id: { in: [ids.repA, ids.repB, ids.manager, ids.outsider] } } });
  await prisma.adminUser.deleteMany({ where: { id: { in: [ids.managerAdmin, ids.outsiderAdmin] } } });
  await prisma.salesRep.deleteMany({ where: { id: { in: [ids.salesRepA, ids.salesRepB] } } });
  await prisma.tier.delete({ where: { id: ids.tier } });
  await prisma.$disconnect();
});

describe("service issue Excel export on isolated local PostgreSQL", () => {
  it("requires issue.review and rejects an out-of-tree salesperson filter", async () => {
    await request(app).get("/admin/exports/service-issues.xlsx").expect(401);
    await request(app).get("/admin/exports/service-issues.xlsx").set("Authorization", `Bearer ${outsiderToken}`).expect(403);
    await request(app).get(`/admin/exports/service-issues.xlsx?salespersonId=${ids.repB}`)
      .set("Authorization", `Bearer ${managerToken}`).expect(403);
    await request(app).get("/admin/exports/service-issues.xlsx?status=not-a-status")
      .set("Authorization", `Bearer ${managerToken}`).expect(400);
    await request(app).get("/admin/exports/service-issues.xlsx?from=2026-09-21&through=2026-09-20")
      .set("Authorization", `Bearer ${managerToken}`).expect(400);
    await request(app).get("/admin/exports/service-issues.xlsx?from=2026-02-30")
      .set("Authorization", `Bearer ${managerToken}`).expect(400);
  });

  it("exports only matching status, retailer, and reporting-tree rows", async () => {
    const response = await request(app).get(`/admin/exports/service-issues.xlsx?status=open&retailerId=${ids.retailerA}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .buffer(true).parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      }).expect(200);
    expect(response.headers["content-type"]).toMatch(/spreadsheetml/);
    expect(response.headers["content-disposition"]).toMatch(/attachment/);
    expect(response.headers["cache-control"]).toBe("no-store");
    const workbook = XLSX.read(response.body, { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets[workbook.SheetNames[0]]);
    expect(rows.map((row) => row.Description).sort()).toEqual(["In scope open", "Retailer open"]);
    expect(rows.every((row) => row.Retailer === "In Scope Store" && row.Status === "open")).toBe(true);
    expect(rows.some((row) => row.Description === "Outside open")).toBe(false);
  });

  it("uses an inclusive UTC date range and never widens scope through retailer or salesperson filters", async () => {
    const download = async (query: string) => {
      const response = await request(app).get(`/admin/exports/service-issues.xlsx?${query}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .buffer(true).parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        }).expect(200);
      const workbook = XLSX.read(response.body, { type: "buffer" });
      return XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets[workbook.SheetNames[0]]);
    };
    expect((await download("from=2026-09-20&through=2026-09-20")).map((row) => row.Description))
      .toEqual(["Retailer open"]);
    expect(await download(`retailerId=${ids.retailerB}`)).toEqual([]);
    expect(await download(`salespersonId=${ids.repA}&retailerId=${ids.retailerB}`)).toEqual([]);
    expect((await download(`salespersonId=${ids.repA}&retailerId=${ids.retailerA}`)).map((row) => row.Description).sort())
      .toEqual(["In scope open", "In scope resolved"]);
  });

  it("exports more than the 200-row queue limit and keeps untrusted descriptions as text", async () => {
    const risky = ['=HYPERLINK("https://example.test")', "+SUM(1,1)", "-2+3", "@SUM(1,1)", "  =1+1", "\t=1+1"];
    await prisma.serviceIssue.createMany({ data: Array.from({ length: 201 }, (_, index) => ({
      retailerId: ids.retailerA, raisedByStaffId: ids.repA, type: "service_request" as const,
      description: risky[index] ?? `Batch issue ${index}`,
      status: "resolved" as const,
      assignedTeam: index === 0 ? "@external" : null,
    })) });
    const file = await new ServiceIssueExportService(prisma).excel({
      status: "resolved", retailerId: ids.retailerA, scopeStaffIds: [ids.manager, ids.repA],
    });
    const workbook = XLSX.read(file, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
    expect(rows).toHaveLength(202);
    for (const value of risky) {
      const rowIndex = rows.findIndex((row) => row.Description === `'${value}`);
      expect(rowIndex).toBeGreaterThanOrEqual(0);
      expect(sheet[`G${rowIndex + 2}`]).toMatchObject({ t: "s", v: `'${value}` });
      expect(sheet[`G${rowIndex + 2}`].f).toBeUndefined();
    }
    expect(rows.find((row) => row.Description === `'${risky[0]}`)?.["Assigned team"]).toBe("'@external");
  });
});
