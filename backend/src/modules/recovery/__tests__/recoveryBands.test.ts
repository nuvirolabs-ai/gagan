import { describe, expect, it } from "vitest";
import { recoveryBandFor, recoveryActionKey } from "../scheduler";

describe("invoice-age recovery bands", () => {
  it.each([
    [34, null],
    [35, "day_35_sales_call"],
    [40, "day_40_joint_call"],
    [45, "days_45_48_collection_visit"],
    [48, "days_45_48_collection_visit"],
    [49, "days_49_52_accounts_escalation"],
    [52, "days_49_52_accounts_escalation"],
    [53, "days_53_56_credit_review"],
    [56, "days_53_56_credit_review"],
    [60, "days_60_69_hold_escalation"],
    [69, "days_60_69_hold_escalation"],
    [70, "days_70_89_legal_preparation"],
    [89, "days_70_89_legal_preparation"],
    [90, "day_90_legal_referral"],
  ])("maps day %i to %s", (days, expected) => {
    expect(recoveryBandFor(days)).toBe(expected);
  });

  it("uses a stable invoice-and-band key for idempotent actions", () => {
    expect(recoveryActionKey("invoice-1", "day_35_sales_call")).toBe("invoice-1:day_35_sales_call");
  });
});
