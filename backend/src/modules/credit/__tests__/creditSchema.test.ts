import { Prisma } from "@prisma/client";
import { existsSync, readFileSync, readdirSync } from "node:fs";
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

function allMigrationSql() {
  const migrationsDir = join(process.cwd(), "prisma/migrations");
  return readdirSync(migrationsDir)
    .map((entry) => join(migrationsDir, entry, "migration.sql"))
    .filter((path) => existsSync(path))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
}

describe("credit and approval schema", () => {
  it("persists policy, profile, assessment, approval and authorization records", () => {
    for (const name of [
      "CreditPolicyVersion",
      "CreditProfile",
      "RatingHistory",
      "CreditAssessment",
      "ApprovalRequest",
      "ApprovalDecision",
      "ApprovalEscalation",
      "ApprovalDispute",
      "DispatchAuthorization",
      "WorkingCalendar",
    ]) {
      model(name);
    }
  });

  it("keeps one profile per retailer and ordered rating history", () => {
    expect(field("CreditProfile", "retailerId").isUnique).toBe(true);
    expect(field("RatingHistory", "sequence").isUnique).toBe(true);
    expect(field("CreditAssessment", "snapshot").type).toBe("Json");
    expect(field("CreditAssessment", "reasons").type).toBe("Json");
  });

  it("enforces one active policy and one open request per approval subject", () => {
    const sql = allMigrationSql();
    expect(sql).toContain('"CreditPolicyVersion_one_active_idx"');
    expect(sql).toContain('WHERE "active" = true');
    expect(sql).toContain('"ApprovalRequest_one_open_subject_idx"');
    expect(sql).toContain('WHERE "status" IN (\'open\', \'escalated\')');
  });

  it("allows only one final decision and versions dispatch authorization", () => {
    expect(field("ApprovalDecision", "approvalRequestId").isUnique).toBe(true);
    const authorization = model("DispatchAuthorization");
    expect(
      authorization.uniqueFields.some(
        (fields) => fields.includes("orderId") && fields.includes("version")
      )
    ).toBe(true);
  });

  it("binds enforcement to a policy version and records dispute outcomes", () => {
    expect(field("AppConfig", "creditPolicyApprovedVersion").type).toBe("Int");
    expect(field("ApprovalDispute", "outcome").type).toBe("ApprovalDecisionResult");
    const sql = allMigrationSql();
    expect(sql).toContain("protect_used_credit_policy_facts");
    expect(sql).toContain('INSERT INTO "CreditProfile"');
  });

  it("supports a dated working calendar for deterministic SLA calculations", () => {
    expect(field("WorkingCalendar", "date").isUnique).toBe(true);
    expect(field("WorkingCalendar", "isWorkingDay").type).toBe("Boolean");
  });
});
