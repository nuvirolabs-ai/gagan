INSERT INTO "Permission" ("id", "name", "description")
VALUES ('feedback.review', 'feedback.review', 'Review retailer feedback within reporting scope')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r CROSS JOIN "Permission" p
WHERE r."name" IN ('field_manager', 'platform_admin') AND p."name" = 'feedback.review'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
