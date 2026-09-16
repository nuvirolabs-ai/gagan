import type { PrismaClient } from "@prisma/client";
import { ROLE_DEFINITIONS } from "./roleCatalog";

// Explicit role selection; additive only. Never touches users, assignments,
// passwords, existing grants or business records. Dry-run is the default.
export async function syncRolePermissions(db: PrismaClient, roleName: string, apply = false) {
  const definition = ROLE_DEFINITIONS.find((role) => role.name === roleName);
  if (!definition) throw new Error("Unknown catalog role");
  return db.$transaction(async (tx) => {
    const role = await tx.role.findUniqueOrThrow({
      where: { name: roleName },
      include: { permissions: { include: { permission: true } } },
    });
    const existing = role.permissions.map((grant) => grant.permission.name);
    const missing = definition.permissions.filter((name) => !existing.includes(name));
    const catalog = new Set<string>(definition.permissions);
    const additional = existing.filter((name) => !catalog.has(name));
    if (apply) {
      for (const name of missing) {
        const permission = await tx.permission.upsert({ where: { name }, create: { name }, update: {} });
        await tx.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
          create: { roleId: role.id, permissionId: permission.id }, update: {},
        });
      }
    }
    return { role: roleName, apply, missing, additionalPreserved: additional };
  });
}
