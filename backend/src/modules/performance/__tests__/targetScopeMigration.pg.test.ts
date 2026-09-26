import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import express from "express";
import request from "supertest";
import { auditTargetRows } from "../targetScopeMigration";
import { backfillTargetScopes, getHistoricalTargetRows, setTargetWritesPaused } from "../targetScopeCutover";
import { createFieldAdminRouter } from "../../field/fieldAdminRoutes";

const prismaDir = resolve(__dirname, "../../../../prisma");
const expansion = join(prismaDir, "migrations/20260925150000_sales_target_scope_expand/migration.sql");
const contract = join(prismaDir, "migrations/20260925160000_sales_target_scope_constraints/migration.sql");
const base = process.env.DATABASE_URL;
const baseUrl = base ? new URL(base) : null;
const localTestDb = baseUrl && ["localhost", "127.0.0.1"].includes(baseUrl.hostname)
  && baseUrl.pathname.includes("test");
const maintenanceUrl = baseUrl ? new URL(baseUrl) : null;
maintenanceUrl?.searchParams.delete("schema");

function run(command: string, args: string[], url?: string): string {
  return execFileSync(command, args, {
    cwd: resolve(__dirname, "../../../../"),
    env: { ...process.env, ...(url ? { DATABASE_URL: url } : {}) },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
  }).trim();
}

function sql(url: string, statement: string): string {
  const cliUrl = new URL(url);
  cliUrl.searchParams.delete("schema");
  return run("psql", [cliUrl.toString(), "-X", "-v", "ON_ERROR_STOP=1", "-Atc", statement]);
}

describe.skipIf(!localTestDb)("SalesTarget scope PostgreSQL transition", () => {
  const name = `gagan_scope_test_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const url = new URL(base!);
  url.pathname = `/${name}`;
  const dbUrl = url.toString();
  const baseline = mkdtempSync(join(tmpdir(), "gagan-scope-baseline-"));

  beforeAll(() => {
    expect(existsSync(expansion)).toBe(true);
    expect(existsSync(contract)).toBe(true);
    expect(readdirSync(join(prismaDir, "migrations")).filter((entry) => entry !== "migration_lock.toml")).toHaveLength(54);
    run("createdb", ["--maintenance-db", maintenanceUrl!.toString(), name]);
    cpSync(prismaDir, baseline, { recursive: true, filter: (source) => !source.includes("20260925150000_sales_target_scope_expand") && !source.includes("20260925160000_sales_target_scope_constraints") && !source.includes("held_migrations") });
    run("npx", ["prisma", "migrate", "deploy", "--schema", join(baseline, "schema.prisma")], dbUrl);
    expect(sql(dbUrl, 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL')).toBe("52");
  }, 120_000);

  afterAll(() => {
    try { run("dropdb", ["--if-exists", "--maintenance-db", maintenanceUrl!.toString(), name]); } finally { rmSync(baseline, { recursive: true, force: true }); }
  }, 120_000);

  it("retains old uniqueness through nullable expansion and blocks paused writes", () => {
    sql(dbUrl, `INSERT INTO "StaffUser" (id, name, phone, email, "updatedAt") VALUES ('scope-owner', 'Scope Owner', '9090909000', 'scope@test.invalid', NOW())`);
    sql(dbUrl, `INSERT INTO "SalesTarget" (id, "salespersonId", metric, "periodStart", "periodEnd", "targetValue", "updatedAt") VALUES ('legacy-target', 'scope-owner', 'order_value', '2026-09-01', '2026-09-30', 400000, NOW())`);
    const cliUrl = new URL(dbUrl);
    cliUrl.searchParams.delete("schema");
    run("psql", [cliUrl.toString(), "-X", "-v", "ON_ERROR_STOP=1", "-f", expansion]);
    run("npx", ["prisma", "migrate", "resolve", "--applied", "20260925150000_sales_target_scope_expand", "--schema", join(prismaDir, "schema.prisma")], dbUrl);
    expect(sql(dbUrl, 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL')).toBe("53");
    expect(sql(dbUrl, `SELECT COALESCE(scope::text, 'NULL') FROM "SalesTarget" WHERE id = 'legacy-target'`)).toBe("NULL");
    expect(() => sql(dbUrl, `INSERT INTO "SalesTarget" (id, "salespersonId", metric, "periodStart", "periodEnd", "targetValue", "updatedAt") VALUES ('duplicate', 'scope-owner', 'order_value', '2026-09-01', '2026-09-30', 1, NOW())`)).toThrow();
    sql(dbUrl, `BEGIN; LOCK TABLE "SalesTarget" IN SHARE ROW EXCLUSIVE MODE; UPDATE "TargetWriteGate" SET paused = true WHERE name = 'sales_target_writes'; COMMIT;`);
    expect(() => sql(dbUrl, `UPDATE "SalesTarget" SET "targetValue" = 1 WHERE id = 'legacy-target'`)).toThrow(/target_writes_paused/);
    sql(dbUrl, `UPDATE "TargetWriteGate" SET paused = false WHERE name = 'sales_target_writes'`);
  }, 120_000);

  it("waits for an in-flight target write before activating the gate", async () => {
    const writer = new PrismaClient({ datasources: { db: { url: dbUrl } } });
    const controller = new PrismaClient({ datasources: { db: { url: dbUrl } } });
    let release!: () => void;
    let started!: () => void;
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const startedWriting = new Promise<void>((resolve) => { started = resolve; });
    try {
      const inFlight = writer.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`UPDATE "SalesTarget" SET "targetValue" = 400000 WHERE id = 'legacy-target'`);
        started();
        await hold;
      }, { timeout: 10_000 });
      await startedWriting;
      let gateActive = false;
      const pause = setTargetWritesPaused(controller, true).then(() => { gateActive = true; });
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(gateActive).toBe(false);
      release();
      await inFlight;
      await pause;
      expect(gateActive).toBe(true);
      expect(() => sql(dbUrl, `DELETE FROM "SalesTarget" WHERE id = 'legacy-target'`)).toThrow(/target_writes_paused/);
      await setTargetWritesPaused(controller, false);
    } finally {
      release();
      await writer.$disconnect();
      await controller.$disconnect();
    }
  }, 120_000);

  it("quiesces writes, rejects stale mappings, and retries a scope-only backfill", async () => {
    const client = new PrismaClient({ datasources: { db: { url: dbUrl } } });
    try {
      const original = await getHistoricalTargetRows(client);
      const stale = auditTargetRows(original, { "legacy-target": { scope: "PERSONAL", evidence: "Approved disposable fixture" } });
      sql(dbUrl, `UPDATE "SalesTarget" SET "targetValue" = 400001 WHERE id = 'legacy-target'`);
      await setTargetWritesPaused(client, true);
      await expect(backfillTargetScopes(client, stale, { apply: true })).rejects.toThrow("target_scope_mapping_drift");
      expect(sql(dbUrl, `SELECT "targetValue"::text, COALESCE(scope::text, 'NULL') FROM "SalesTarget" WHERE id = 'legacy-target'`)).toBe("400001.00|NULL");
      const approved = auditTargetRows(await getHistoricalTargetRows(client), { "legacy-target": { scope: "PERSONAL", evidence: "Approved disposable fixture" } });
      await expect(backfillTargetScopes(client, approved, { apply: false })).resolves.toMatchObject({ changed: 1 });
      await expect(backfillTargetScopes(client, approved, { apply: true })).resolves.toMatchObject({ changed: 1 });
      await expect(backfillTargetScopes(client, approved, { apply: true })).resolves.toMatchObject({ changed: 0 });
      expect(sql(dbUrl, `SELECT "targetValue"::text, scope::text FROM "SalesTarget" WHERE id = 'legacy-target'`)).toBe("400001.00|PERSONAL");
      await setTargetWritesPaused(client, false);
      sql(dbUrl, `UPDATE "SalesTarget" SET "targetValue" = 400000 WHERE id = 'legacy-target'`);
    } finally {
      await client.$disconnect();
    }
  }, 120_000);

  it("contracts only after all rows are classified and keeps both scopes unique", () => {
    const cliUrl = new URL(dbUrl);
    cliUrl.searchParams.delete("schema");
    sql(dbUrl, `INSERT INTO "SalesTarget" (id, "salespersonId", metric, "periodStart", "periodEnd", "targetValue", "updatedAt") VALUES ('unclassified-target', 'scope-owner', 'visits', '2026-09-01', '2026-09-30', 12, NOW())`);
    expect(() => run("psql", [cliUrl.toString(), "-X", "-v", "ON_ERROR_STOP=1", "-f", contract])).toThrow();
    sql(dbUrl, `UPDATE "SalesTarget" SET scope = 'PERSONAL' WHERE id = 'unclassified-target'`);
    run("psql", [cliUrl.toString(), "-X", "-v", "ON_ERROR_STOP=1", "-f", contract]);
    run("npx", ["prisma", "migrate", "resolve", "--applied", "20260925160000_sales_target_scope_constraints", "--schema", join(prismaDir, "schema.prisma")], dbUrl);
    expect(sql(dbUrl, `SELECT scope::text || ':' || "targetValue"::text FROM "SalesTarget" WHERE id = 'legacy-target'`)).toBe("PERSONAL:400000.00");
    sql(dbUrl, `INSERT INTO "SalesTarget" (id, "salespersonId", scope, metric, "periodStart", "periodEnd", "targetValue", "updatedAt") VALUES ('team-target', 'scope-owner', 'TEAM', 'order_value', '2026-09-01', '2026-09-30', 500000, NOW())`);
    expect(() => sql(dbUrl, `INSERT INTO "SalesTarget" (id, "salespersonId", scope, metric, "periodStart", "periodEnd", "targetValue", "updatedAt") VALUES ('duplicate-team', 'scope-owner', 'TEAM', 'order_value', '2026-09-01', '2026-09-30', 1, NOW())`)).toThrow();
    expect(() => sql(dbUrl, `INSERT INTO "SalesTarget" (id, "salespersonId", metric, "periodStart", "periodEnd", "targetValue", "updatedAt") VALUES ('unscoped', 'scope-owner', 'visits', '2026-09-01', '2026-09-30', 1, NOW())`)).toThrow();
  }, 120_000);

  it("keeps PERSONAL and TEAM target writes separate through an authenticated Admin route", async () => {
    const client = new PrismaClient({ datasources: { db: { url: dbUrl } } });
    const ownerId = randomUUID();
    const repId = randomUUID();
    const actorId = randomUUID();
    try {
      const salesRole = await client.role.create({ data: { name: "salesperson" } });
      const managerRole = await client.role.create({ data: { name: "field_manager" } });
      await client.salesRep.create({ data: { id: repId, name: "Leader Rep", phone: "9876543210" } });
      await client.staffUser.create({ data: {
        id: ownerId, name: "Leader", phone: "+919876543210", email: `${ownerId}@test.invalid`, salesRepId: repId,
        roles: { create: [{ roleId: salesRole.id }, { roleId: managerRole.id }] },
      } });
      const app = express();
      app.use(express.json());
      app.use(createFieldAdminRouter({
        db: client,
        authenticate: (req: any, _res: any, next: any) => {
          (req as any).staffAuth = { staffId: actorId, permissions: ["route.manage"], delegationIds: [] };
          next();
        },
        scopes: { resolveFor: async () => ({ staffIds: [ownerId] }) } as any,
      } as any));
      const input = { salespersonId: ownerId, metric: "order_value", periodStart: "2026-09-01", periodEnd: "2026-09-30", targetValue: 1000 };
      const personal = await request(app).post("/field/targets").send({ ...input, scope: "PERSONAL" });
      const team = await request(app).post("/field/targets").send({ ...input, scope: "TEAM", targetValue: 2000 });
      const zeroTeam = await request(app).post("/field/targets").send({ ...input, scope: "TEAM", targetValue: 0 });
      const legacy = await request(app).post("/field/targets").send(input);
      expect(personal.status).toBe(201);
      expect(team.status).toBe(201);
      expect(zeroTeam.status).toBe(201);
      expect(legacy.status).toBe(409);
      expect(legacy.body.error).toBe("target_scope_required");
      const personalRead = await request(app).get(`/field/targets?salespersonId=${ownerId}`);
      const allRead = await request(app).get(`/field/targets?salespersonId=${ownerId}&scope=all`);
      expect(personalRead.body.targets.map((target: any) => target.scope)).toEqual(["PERSONAL"]);
      expect(allRead.body.targets.map((target: any) => target.scope).sort()).toEqual(["PERSONAL", "TEAM"]);
      expect(await client.salesTarget.count({ where: { salespersonId: ownerId } })).toBe(2);
      expect((await client.salesTarget.findFirstOrThrow({ where: { salespersonId: ownerId, scope: "TEAM" } })).targetValue.toNumber()).toBe(0);
    } finally {
      await client.salesTarget.deleteMany({ where: { salespersonId: ownerId } });
      await client.staffUser.deleteMany({ where: { id: ownerId } });
      await client.salesRep.deleteMany({ where: { id: repId } });
      await client.$disconnect();
    }
  }, 120_000);

  it("migrates a fresh disposable database through the scoped contract", () => {
    const freshName = `gagan_scope_test_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const freshUrl = new URL(base!);
    freshUrl.pathname = `/${freshName}`;
    run("createdb", ["--maintenance-db", maintenanceUrl!.toString(), freshName]);
    try {
      run("npx", ["prisma", "migrate", "deploy", "--schema", join(prismaDir, "schema.prisma")], freshUrl.toString());
      expect(sql(freshUrl.toString(), 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL')).toBe("54");
      expect(sql(freshUrl.toString(), `SELECT is_nullable FROM information_schema.columns WHERE table_name = 'SalesTarget' AND column_name = 'scope'`)).toBe("NO");
    } finally {
      run("dropdb", ["--if-exists", "--maintenance-db", maintenanceUrl!.toString(), freshName]);
    }
  }, 120_000);
});
