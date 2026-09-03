import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
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

function allMigrationSql() {
  const migrationsDir = join(process.cwd(), "prisma/migrations");
  return readdirSync(migrationsDir)
    .map((entry) => join(migrationsDir, entry, "migration.sql"))
    .filter((path) => existsSync(path))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
}

describe("retailer form 24 schema", () => {
  it("adds group, transporter, beat and buyer category masters distinct from Tier", () => {
    for (const name of ["RetailerGroup", "Transporter", "Beat", "BuyerCategory", "BuyerSubCategory", "RetailerProposal"]) {
      model(name);
    }
    expect(model("RetailerGroup").fields.find((item) => item.name === "name")?.isUnique).toBe(true);
    expect(field("BuyerSubCategory", "categoryId").type).toBe("String");
  });

  it("stores the 24 commercial fields on Retailer and RetailerProposal", () => {
    for (const name of [
      "groupId",
      "contactPerson",
      "telephone",
      "transporterId",
      "pin",
      "tehsil",
      "district",
      "state",
      "deliveryCity",
      "beatId",
      "shopTenureYears",
      "gstin",
      "aadhaarNumber",
      "aadhaarPhotoAssetId",
      "grade",
      "buyerCategoryId",
      "buyerSubCategoryId",
      "upiId",
    ]) {
      field("Retailer", name);
    }
    expect(field("Retailer", "creditLimit").type).toBe("Decimal");
    expect(field("Retailer", "paymentTermDays").type).toBe("Int");
    expect(field("RetailerProposal", "partyName").type).toBe("String");
    expect(field("RetailerProposal", "creditLimit").type).toBe("Decimal");
    expect(field("RetailerProposal", "paymentTermDays").type).toBe("Int");
    expect(field("RetailerProposal", "grade").type).toBe("RetailerGrade");
    expect(field("RetailerProposal", "aadhaarPhotoAssetId").isUnique).toBe(true);
  });

  it("keeps one pending proposal per mobile in the migration", () => {
    const sql = allMigrationSql();
    expect(sql).toContain('"RetailerProposal_one_pending_mobile_idx"');
    expect(sql).toContain('WHERE "status" = \'pending\'');
    expect(sql).toContain("aadhaar_card");
  });
});
