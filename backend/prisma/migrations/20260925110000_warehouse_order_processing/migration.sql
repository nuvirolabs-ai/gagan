INSERT INTO "Permission" ("id", "name", "description", "createdAt")
VALUES (
  gen_random_uuid()::text,
  'order.warehouse_process',
  'Read eligible warehouse orders and mark confirmed orders packed.',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "Role" ("id", "name", "description", "createdAt")
VALUES (
  gen_random_uuid()::text,
  'warehouse_operator',
  'Processes confirmed orders through the existing warehouse packing step.',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "Role" role
CROSS JOIN "Permission" permission
WHERE role."name" = 'warehouse_operator'
  AND permission."name" = 'order.warehouse_process'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "Role" role
CROSS JOIN "Permission" permission
WHERE role."name" = 'platform_admin'
  AND permission."name" = 'order.warehouse_process'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
