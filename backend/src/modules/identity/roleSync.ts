import type { PrismaClient } from "@prisma/client";
import { ROLE_DEFINITIONS, type PermissionName } from "./roleCatalog";

export interface RoleSyncOptions {
  /**
   * Optional explicit subset of the selected role's source-catalog
   * permissions. Omitting this preserves the existing full-role behavior.
   */
  permissionNames?: readonly PermissionName[];
}

function targetPermissions(
  definition: (typeof ROLE_DEFINITIONS)[number],
  permissionNames?: readonly PermissionName[]
) {
  if (permissionNames === undefined) return definition.permissions;

  const invalid = permissionNames.filter((name) => !definition.permissions.includes(name));
  if (invalid.length > 0) {
    throw new Error(`Requested permissions are not in the ${definition.name} catalog role: ${invalid.join(", ")}`);
  }

  return [...new Set(permissionNames)];
}

// Explicit role selection; additive only. Never touches users, assignments,
// passwords, existing grants or business records. Dry-run is the default.
export async function syncRolePermissions(
  db: PrismaClient,
  roleName: string,
  apply = false,
  options: RoleSyncOptions = {}
) {
  const definition = ROLE_DEFINITIONS.find((role) => role.name === roleName);
  if (!definition) throw new Error("Unknown catalog role");
  const desired = targetPermissions(definition, options.permissionNames);
  return db.$transaction(async (tx) => {
    const role = await tx.role.findUniqueOrThrow({
      where: { name: roleName },
      include: { permissions: { include: { permission: true } } },
    });
    const existing = role.permissions.map((grant) => grant.permission.name);
    const missing = desired.filter((name) => !existing.includes(name));
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
    return {
      role: roleName,
      apply,
      targetPermissions: desired,
      missing,
      additionalPreserved: additional,
    };
  });
}
