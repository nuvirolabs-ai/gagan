import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextFunction, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { prisma } from "../../../lib/prisma";
import { effectivePermissions, requirePermission, type StaffAuthedRequest } from "../permissions";

const databaseUrl = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolatedLocalDatabase = databaseUrl &&
  ["127.0.0.1", "localhost"].includes(databaseUrl.hostname) &&
  databaseUrl.pathname.includes("test");
const migrationPath = join(process.cwd(), "prisma/migrations/20260926130100_salesperson_own_beats_permission/migration.sql");

describe.runIf(isolatedLocalDatabase)("salesperson own-beat permission migration on isolated local PostgreSQL", () => {
  it("grants only the existing salesperson role and replays without changing route.execute", async () => {
    const migration = readFileSync(migrationPath, "utf8");
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('CREATE TEMP TABLE "Role" ("id" TEXT PRIMARY KEY, "name" TEXT UNIQUE NOT NULL) ON COMMIT DROP');
      await tx.$executeRawUnsafe('CREATE TEMP TABLE "Permission" ("id" TEXT PRIMARY KEY, "name" TEXT UNIQUE NOT NULL, "description" TEXT) ON COMMIT DROP');
      await tx.$executeRawUnsafe('CREATE TEMP TABLE "RolePermission" ("roleId" TEXT NOT NULL, "permissionId" TEXT NOT NULL, PRIMARY KEY ("roleId", "permissionId")) ON COMMIT DROP');
      await tx.$executeRawUnsafe("INSERT INTO \"Role\" (\"id\", \"name\") VALUES ('s', 'salesperson'), ('c', 'field_collector'), ('m', 'field_manager')");
      await tx.$executeRawUnsafe("INSERT INTO \"Permission\" (\"id\", \"name\") VALUES ('route.execute', 'route.execute')");
      await tx.$executeRawUnsafe("INSERT INTO \"RolePermission\" (\"roleId\", \"permissionId\") VALUES ('s', 'route.execute'), ('c', 'route.execute')");

      await tx.$executeRawUnsafe(migration);
      await tx.$executeRawUnsafe(migration);

      const grants = await tx.$queryRaw<Array<{ role: string; permission: string }>>`
        SELECT r."name" AS role, p."name" AS permission
        FROM "RolePermission" rp JOIN "Role" r ON r."id" = rp."roleId"
        JOIN "Permission" p ON p."id" = rp."permissionId"
        ORDER BY r."name", p."name"
      `;
      expect(grants).toEqual([
        { role: "field_collector", permission: "route.execute" },
        { role: "salesperson", permission: "route.execute" },
        { role: "salesperson", permission: "route.manage_self" },
      ]);

      for (const [role, allowed] of [["salesperson", true], ["field_collector", false]] as const) {
        const access = await effectivePermissions(role, new Date(), {
          load: async () => ({
            status: "active",
            roles: [{ permissions: grants.filter((grant) => grant.role === role).map((grant) => grant.permission) }],
            delegations: [],
          }),
        });
        const req = { staffAuth: { staffId: role, permissions: access.permissions, delegationIds: [] } } as unknown as StaffAuthedRequest;
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
        const next = vi.fn() as NextFunction;
        requirePermission("route.manage_self")(req, res, next);
        expect(next).toHaveBeenCalledTimes(allowed ? 1 : 0);
        if (!allowed) expect(res.status).toHaveBeenCalledWith(403);
      }
    });
  });

  it("does not create a grant when the salesperson role is absent", async () => {
    const migration = readFileSync(migrationPath, "utf8");
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('CREATE TEMP TABLE "Role" ("id" TEXT PRIMARY KEY, "name" TEXT UNIQUE NOT NULL) ON COMMIT DROP');
      await tx.$executeRawUnsafe('CREATE TEMP TABLE "Permission" ("id" TEXT PRIMARY KEY, "name" TEXT UNIQUE NOT NULL, "description" TEXT) ON COMMIT DROP');
      await tx.$executeRawUnsafe('CREATE TEMP TABLE "RolePermission" ("roleId" TEXT NOT NULL, "permissionId" TEXT NOT NULL, PRIMARY KEY ("roleId", "permissionId")) ON COMMIT DROP');
      await tx.$executeRawUnsafe("INSERT INTO \"Role\" (\"id\", \"name\") VALUES ('c', 'field_collector')");
      await tx.$executeRawUnsafe(migration);
      const grants = await tx.$queryRaw<Array<{ roleId: string }>>`SELECT "roleId" FROM "RolePermission"`;
      const permissions = await tx.$queryRaw<Array<{ name: string }>>`SELECT "name" FROM "Permission"`;
      expect(grants).toEqual([]);
      expect(permissions).toEqual([]);
    });
  });

  it("authorizes an existing salesperson after migration without granting field collectors", async () => {
    const salesperson = await prisma.staffRole.findFirst({
      where: { role: { name: "salesperson" }, staff: { status: "active" } },
      select: { staffId: true },
    });
    expect(salesperson, "seeded local salesperson is required").not.toBeNull();

    const access = await effectivePermissions(salesperson!.staffId);
    expect(access.permissions).toContain("route.manage_self");
    expect(access.permissions).toContain("route.execute");
    expect(access.permissions).not.toContain("route.manage");

    const collector = await prisma.role.findUnique({
      where: { name: "field_collector" },
      select: { permissions: { select: { permission: { select: { name: true } } } } },
    });
    expect(collector?.permissions.map(({ permission }) => permission.name)).toContain("route.execute");
    expect(collector?.permissions.map(({ permission }) => permission.name)).not.toContain("route.manage_self");
  });
});
