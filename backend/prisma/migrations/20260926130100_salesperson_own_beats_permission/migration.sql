DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Role" WHERE "name" = 'salesperson') THEN
    INSERT INTO "Permission" ("id", "name", "description")
    VALUES ('route.manage_self', 'route.manage_self', 'Create and edit own reusable route beats')
    ON CONFLICT ("name") DO NOTHING;

    INSERT INTO "RolePermission" ("roleId", "permissionId")
    SELECT r."id", p."id"
    FROM "Role" r CROSS JOIN "Permission" p
    WHERE r."name" = 'salesperson' AND p."name" = 'route.manage_self'
    ON CONFLICT ("roleId", "permissionId") DO NOTHING;
  END IF;
END $$;
