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

describe("immutable financial schema", () => {
  it("models explicit invoices, allocations, ledger events, evidence and corrections", () => {
    for (const name of [
      "Invoice",
      "InvoiceLine",
      "PaymentAllocation",
      "FinancialLedgerEntry",
      "PaymentEvidence",
      "CreditNote",
      "PaymentReversal",
      "PaymentReversalAllocation",
      "ReconciliationIssue",
    ]) {
      model(name);
    }
  });

  it("represents full reversal state and immutable allocation reversals", () => {
    const paymentStatus = Prisma.dmmf.datamodel.enums.find(
      (candidate) => candidate.name === "PaymentStatus"
    );
    expect(paymentStatus?.values.map((value) => value.name)).toContain("reversed");
    expect(field("PaymentReversalAllocation", "paymentAllocationId").type).toBe(
      "String"
    );
    expect(field("PaymentReversal", "unallocatedAmount").type).toBe("Decimal");
  });

  it("enforces one invoice per order and one settlement ledger event per payment", () => {
    expect(field("Invoice", "orderId").isUnique).toBe(true);
    expect(field("Invoice", "idempotencyKey").isUnique).toBe(true);
    expect(field("FinancialLedgerEntry", "paymentId").isUnique).toBe(true);
    expect(field("FinancialLedgerEntry", "idempotencyKey").isUnique).toBe(true);
    expect(field("Payment", "unallocatedAmount").type).toBe("Decimal");
  });

  it("uses production money and weight precision", () => {
    const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
    expect(schema).toMatch(/total\s+Decimal\s+@db\.Decimal\(14, 2\)/);
    expect(schema).toMatch(/deliveredWeightKg\s+Decimal\?\s+@db\.Decimal\(14, 3\)/);
    expect(schema).toMatch(/model PaymentAllocation[\s\S]*?amount\s+Decimal\s+@db\.Decimal\(14, 2\)/);
  });

  it("adds database checks for positive documents and bounded allocations", () => {
    const migrationsDir = join(process.cwd(), "prisma/migrations");
    const migrationDir = readdirSync(migrationsDir).find((entry) =>
      entry.endsWith("_financial_core")
    );
    expect(migrationDir).toBeDefined();
    const migration = readFileSync(
      join(migrationsDir, migrationDir!, "migration.sql"),
      "utf8"
    );
    expect(migration).toContain('CHECK ("total" >= 0)');
    expect(migration).toContain('CHECK ("outstandingAmount" >= 0 AND "outstandingAmount" <= "total")');
    expect(migration).toContain('CHECK ("amount" > 0)');
  });

  it("prevents a negative unallocated payment amount", () => {
    const migrationsDir = join(process.cwd(), "prisma/migrations");
    const migrationSql = readdirSync(migrationsDir)
      .map((entry) => join(migrationsDir, entry, "migration.sql"))
      .filter((path) => existsSync(path))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(migrationSql).toContain(
      'CONSTRAINT "Payment_unallocated_nonnegative_check" CHECK ("unallocatedAmount" >= 0)'
    );
    expect(migrationSql).toContain(
      'CONSTRAINT "PaymentReversal_unallocated_bounds_check" CHECK ("unallocatedAmount" >= 0 AND "unallocatedAmount" <= "amount")'
    );
    expect(migrationSql).toContain(
      'CONSTRAINT "PaymentReversalAllocation_amount_positive_check" CHECK ("amount" > 0)'
    );
  });
});
