import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { PLATFORM_ADMIN_SURVEY_PERMISSIONS, ROLE_DEFINITIONS, Permissions, STAFF_SURVEY_RESPOND_PERMISSIONS } from "../roleCatalog";
import { syncRolePermissions } from "../roleSync";

describe("additive catalog role synchronization", () => {
  it("keeps the global catalog broad while defining a narrow hosted Survey scope", () => {
    const admin = ROLE_DEFINITIONS.find((role) => role.name === "platform_admin")!;
    expect(admin.permissions).toContain(Permissions.DATA_IMPORT);
    expect(admin.permissions).toContain(Permissions.SURVEY_RESPOND);
    expect(admin.permissions).toContain(Permissions.SURVEY_MANAGE);
    expect(admin.permissions).toContain(Permissions.SURVEY_RESPONSES_VIEW);
    expect(PLATFORM_ADMIN_SURVEY_PERMISSIONS).toEqual([
      Permissions.SURVEY_MANAGE,
      Permissions.SURVEY_RESPONSES_VIEW,
    ]);
    const salesperson = ROLE_DEFINITIONS.find((role) => role.name === "salesperson")!;
    expect(salesperson.permissions).not.toContain(Permissions.SURVEY_MANAGE);
    expect(salesperson.permissions).not.toContain(Permissions.SURVEY_RESPONSES_VIEW);
  });

  it("defines the staff repair as only survey.respond", () => {
    expect(STAFF_SURVEY_RESPOND_PERMISSIONS).toEqual([Permissions.SURVEY_RESPOND]);
    expect(ROLE_DEFINITIONS.find((role) => role.name === "salesperson")?.permissions).toContain(Permissions.SURVEY_RESPOND);
    expect(ROLE_DEFINITIONS.find((role) => role.name === "field_collector")?.permissions).toContain(Permissions.SURVEY_RESPOND);
  });

  it("scoped dry-run proposes exactly the two Survey permissions and no unrelated permissions", async () => {
    const { db, tx, state } = makeFakeDatabase();
    const result = await syncRolePermissions(db, "platform_admin", false, {
      permissionNames: PLATFORM_ADMIN_SURVEY_PERMISSIONS,
    });

    expect(result.targetPermissions).toEqual([...PLATFORM_ADMIN_SURVEY_PERMISSIONS]);
    expect(result.missing).toEqual([...PLATFORM_ADMIN_SURVEY_PERMISSIONS]);
    expect(result.missing).not.toContain(Permissions.DATA_IMPORT);
    expect(result.missing).not.toContain(Permissions.SURVEY_RESPOND);
    expect(tx.permission.upsert).not.toHaveBeenCalled();
    expect(tx.rolePermission.upsert).not.toHaveBeenCalled();
    expect(state.protected).toEqual(state.protectedBefore);
  });

  it("applies only Survey catalog rows and mappings, preserves state, and replays idempotently", async () => {
    const { db, tx, state } = makeFakeDatabase();
    const grantsBefore = new Set(state.roleGrants);
    const catalogBefore = new Set(state.catalogPermissions);
    const applied = await syncRolePermissions(db, "platform_admin", true, {
      permissionNames: PLATFORM_ADMIN_SURVEY_PERMISSIONS,
    });

    expect(applied.missing).toEqual([...PLATFORM_ADMIN_SURVEY_PERMISSIONS]);
    expect(tx.permission.upsert.mock.calls.map(([call]) => call.where.name)).toEqual([
      Permissions.SURVEY_MANAGE,
      Permissions.SURVEY_RESPONSES_VIEW,
    ]);
    expect(tx.rolePermission.upsert.mock.calls.map(([call]) => call.create.permissionId)).toEqual([
      Permissions.SURVEY_MANAGE,
      Permissions.SURVEY_RESPONSES_VIEW,
    ]);
    expect([...state.catalogPermissions].filter((name) => !catalogBefore.has(name))).toEqual([
      Permissions.SURVEY_MANAGE,
      Permissions.SURVEY_RESPONSES_VIEW,
    ]);
    expect([...state.roleGrants].filter((name) => !grantsBefore.has(name))).toEqual([
      Permissions.SURVEY_MANAGE,
      Permissions.SURVEY_RESPONSES_VIEW,
    ]);
    expect([...state.roleGrants]).toEqual(expect.arrayContaining([...grantsBefore]));
    expect([...state.catalogPermissions]).toEqual(expect.arrayContaining([...catalogBefore]));
    expect(state.roleGrants).not.toContain(Permissions.DATA_IMPORT);
    expect(state.roleGrants).not.toContain(Permissions.SURVEY_RESPOND);
    expect(state.protected).toEqual(state.protectedBefore);

    expect((await syncRolePermissions(db, "platform_admin", true, {
      permissionNames: PLATFORM_ADMIN_SURVEY_PERMISSIONS,
    })).missing).toEqual([]);
    expect(applied.additionalPreserved).toEqual(["existing.custom.permission"]);
    expect(tx.permission.upsert).toHaveBeenCalledTimes(2);
    expect(tx.rolePermission.upsert).toHaveBeenCalledTimes(2);
    expect(tx.permission.deleteMany).not.toHaveBeenCalled();
    expect(tx.permission.updateMany).not.toHaveBeenCalled();
    expect(tx.rolePermission.deleteMany).not.toHaveBeenCalled();
    expect(tx.rolePermission.updateMany).not.toHaveBeenCalled();
    expect(tx.adminUser.update).not.toHaveBeenCalled();
    expect(tx.adminUser.deleteMany).not.toHaveBeenCalled();
    expect(tx.staffUser.update).not.toHaveBeenCalled();
    expect(tx.staffUser.deleteMany).not.toHaveBeenCalled();
    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(tx.order.deleteMany).not.toHaveBeenCalled();
  });

  it("still supports the existing full-role mode and rejects invalid scopes", async () => {
    const { db } = makeFakeDatabase();
    expect((await syncRolePermissions(db, "platform_admin")).missing).toEqual([
      Permissions.DATA_IMPORT,
      Permissions.SURVEY_RESPOND,
      Permissions.SURVEY_MANAGE,
      Permissions.SURVEY_RESPONSES_VIEW,
    ]);
    await expect(syncRolePermissions(db, "platform_admin", false, {
      permissionNames: [Permissions.DATA_IMPORT, "not-a-catalog-permission" as never],
    })).rejects.toThrow("not in the platform_admin catalog role");
    await expect(syncRolePermissions(db, "unknown", true)).rejects.toThrow("Unknown catalog role");
  });
});

function makeFakeDatabase() {
  const definition = ROLE_DEFINITIONS.find((role) => role.name === "platform_admin")!;
  const surveyPermissions = new Set<string>([
    Permissions.SURVEY_MANAGE,
    Permissions.SURVEY_RESPONSES_VIEW,
  ]);
  const roleGrants = new Set<string>(
    definition.permissions.filter(
      (permission) =>
        !surveyPermissions.has(permission) &&
        permission !== Permissions.DATA_IMPORT &&
        permission !== Permissions.SURVEY_RESPOND
    )
  );
  roleGrants.add("existing.custom.permission");
  const catalogPermissions = new Set(roleGrants);
  const protectedState = {
    users: [{ id: "admin-1", passwordHash: "opaque-password-hash" }],
    roleAssignments: [{ staffId: "staff-1", roleId: "role-1" }],
    businessRecords: [{ id: "order-1", status: "approved" }],
  };
  const state = {
    roleGrants,
    catalogPermissions,
    protected: structuredClone(protectedState),
    protectedBefore: structuredClone(protectedState),
  };
  const tx = {
    role: {
      findUniqueOrThrow: vi.fn(async () => ({
        id: "role-1",
        permissions: [...state.roleGrants].map((name) => ({ permission: { name } })),
      })),
    },
    permission: {
      upsert: vi.fn(async ({ where }: { where: { name: string } }) => {
        state.catalogPermissions.add(where.name);
        return { id: where.name };
      }),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    rolePermission: {
      upsert: vi.fn(async ({ create }: { create: { permissionId: string } }) => {
        state.roleGrants.add(create.permissionId);
      }),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    adminUser: { update: vi.fn(), deleteMany: vi.fn() },
    staffUser: { update: vi.fn(), deleteMany: vi.fn() },
    order: { updateMany: vi.fn(), deleteMany: vi.fn() },
  };
  const db = {
    $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx),
  } as unknown as PrismaClient;
  return { db, tx, state };
}
