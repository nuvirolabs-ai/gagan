import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { ROLE_DEFINITIONS, Permissions } from "../roleCatalog";
import { syncRolePermissions } from "../roleSync";

describe("additive catalog role synchronization", () => {
  it("grants survey management only to catalog-authorized roles", () => {
    const admin = ROLE_DEFINITIONS.find((role) => role.name === "platform_admin")!;
    expect(admin.permissions).toContain(Permissions.SURVEY_MANAGE);
    expect(admin.permissions).toContain(Permissions.SURVEY_RESPONSES_VIEW);
    const salesperson = ROLE_DEFINITIONS.find((role) => role.name === "salesperson")!;
    expect(salesperson.permissions).not.toContain(Permissions.SURVEY_MANAGE);
    expect(salesperson.permissions).not.toContain(Permissions.SURVEY_RESPONSES_VIEW);
  });

  it("dry-runs, adds missing relationships, preserves extra grants and replays safely", async () => {
    const definition = ROLE_DEFINITIONS.find((role) => role.name === "platform_admin")!;
    const grants = new Set<string>(definition.permissions.filter((p) => p !== Permissions.SURVEY_MANAGE));
    grants.add("existing.custom.permission");
    const tx = {
      role: { findUniqueOrThrow: vi.fn(async () => ({ id: "role-1", permissions: [...grants].map((name) => ({ permission: { name } })) })) },
      permission: { upsert: vi.fn(async ({ where }: { where: { name: string } }) => ({ id: where.name })) },
      rolePermission: { upsert: vi.fn(async ({ create }: { create: { permissionId: string } }) => { grants.add(create.permissionId); }) },
    };
    const db = { $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx) } as unknown as PrismaClient;
    expect((await syncRolePermissions(db, "platform_admin")).missing).toEqual([Permissions.SURVEY_MANAGE]);
    expect(tx.permission.upsert).not.toHaveBeenCalled();
    const applied = await syncRolePermissions(db, "platform_admin", true);
    expect(applied.additionalPreserved).toEqual(["existing.custom.permission"]);
    expect(tx.rolePermission.upsert).toHaveBeenCalledOnce();
    expect((await syncRolePermissions(db, "platform_admin", true)).missing).toEqual([]);
    expect(tx.rolePermission.upsert).toHaveBeenCalledOnce();
    await expect(syncRolePermissions(db, "unknown", true)).rejects.toThrow("Unknown catalog role");
  });
});
