import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SOP_V4_POLICY, serializePolicy } from "../policy";
import { REASON_CATALOG, ReasonCodes } from "../reasonCodes";

describe("approved SOP V4 policy", () => {
  it("captures the approved collection, rating and exposure values", () => {
    expect(SOP_V4_POLICY).toMatchObject({
      version: 4,
      targetDsoDays: 45,
      sapOverdueTriggerDays: 60,
      newCustomerOutstandingCap: 50_000,
      ratingCOutstandingCap: 100_000,
      ratingDOutstandingCap: 25_000,
      ratingCDOpenInvoiceCap: 3,
      thirdInvoiceSlaHours: 48,
      repeatedApprovalMonthlyCount: 2,
      cashDiscountPercent: 2,
    });
  });

  it("models the four active sales-order approval parameters", () => {
    expect(SOP_V4_POLICY.salesOrderApprovalParameters).toEqual([
      ReasonCodes.PRICE_LIST_VARIATION,
      ReasonCodes.INVOICE_OVERDUE_60_DAYS,
      ReasonCodes.PREVIOUS_INVOICE_PENDING,
      ReasonCodes.ONE_OR_MORE_OUTSTANDING,
    ]);
  });

  it("publishes human-readable reason codes for clients", () => {
    for (const code of SOP_V4_POLICY.salesOrderApprovalParameters) {
      expect(REASON_CATALOG[code]).toMatchObject({ title: expect.any(String), message: expect.any(String) });
    }
  });

  it("serializes to JSON-safe policy and reason-catalog records", () => {
    expect(() => JSON.stringify(serializePolicy(SOP_V4_POLICY))).not.toThrow();
    expect(() => JSON.stringify(REASON_CATALOG)).not.toThrow();
  });

  it("bootstraps policy and working days through production migrations", () => {
    const migration = readFileSync(
      join(process.cwd(), "prisma/migrations/20260820150500_credit_policy_bootstrap/migration.sql"),
      "utf8"
    );
    expect(migration).toContain('INSERT INTO "CreditPolicyVersion"');
    expect(migration).toContain('INSERT INTO "WorkingCalendar"');
  });
});
