import { Prisma } from "@prisma/client";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function model(name: string) {
  const found = Prisma.dmmf.datamodel.models.find((candidate) => candidate.name === name);
  expect(found, `Expected Prisma model ${name}`).toBeDefined();
  return found!;
}

function field(modelName: string, fieldName: string) {
  const found = model(modelName).fields.find((candidate) => candidate.name === fieldName);
  expect(found, `Expected ${modelName}.${fieldName}`).toBeDefined();
  return found!;
}

describe("identity schema", () => {
  it("keeps staff phone, staff email, role name, permission name and refresh hashes unique", () => {
    expect(field("StaffUser", "phone").isUnique).toBe(true);
    expect(field("StaffUser", "email").isUnique).toBe(true);
    expect(field("Role", "name").isUnique).toBe(true);
    expect(field("Permission", "name").isUnique).toBe(true);
    expect(field("DeviceSession", "refreshTokenHash").isUnique).toBe(true);
  });

  it("stores bounded role delegation dates and enforces their order in the migration", () => {
    expect(field("RoleDelegation", "startsAt").type).toBe("DateTime");
    expect(field("RoleDelegation", "endsAt").type).toBe("DateTime");

    const migrationsDir = join(process.cwd(), "prisma/migrations");
    const identityMigration = readdirSync(migrationsDir).find((entry) =>
      entry.endsWith("_identity_rbac")
    );
    expect(identityMigration).toBeDefined();
    const migration = readFileSync(
      join(migrationsDir, identityMigration!, "migration.sql"),
      "utf8"
    );
    expect(migration).toContain('CHECK ("endsAt" > "startsAt")');
  });
});
