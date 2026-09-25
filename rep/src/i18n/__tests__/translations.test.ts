import { describe, expect, it } from "vitest";
import { translate } from "../translations";

describe("salesperson translations", () => {
  it("returns Hindi text for a known key", () => {
    expect(translate("hi", "language.chooseTitle")).toBe("भाषा चुनें");
  });

  it("falls back to English when a Hindi key is absent", () => {
    expect(translate("hi", "common.help")).toBe("Help");
  });

  it("translates approval and collection copy", () => {
    expect(translate("hi", "approvals.title")).toBe("अनुमोदन");
    expect(translate("hi", "collections.submit")).toBe("Accounts को भेजें");
  });

  it("keeps the closed-day greeting as a salutation without a name", () => {
    expect(translate("en", "today.niceWork")).toBe("Nice work");
    expect(translate("hi", "today.niceWork")).toBe("अच्छा काम");
  });

  it("labels company balances and unattributed review amounts", () => {
    expect(translate("en", "finance.companySplit")).toBe("Company-wise balance");
    expect(translate("hi", "finance.jainTraders")).toBe("Jain Traders");
    expect(translate("hi", "finance.unattributed")).toBe("असंबद्ध / पुराना बकाया");
  });

  it("translates check-in failures and active-visit recovery in Hindi", () => {
    const keys = [
      "visit.checkInAlreadyOpen",
      "visit.checkInLocationInvalid",
      "visit.checkInRetailerNotAssigned",
      "visit.checkInFailed",
      "visit.activeVisitElsewhere",
      "visit.finishBeforeAnother",
      "visit.resumeActiveVisit",
    ] as const;
    for (const key of keys) expect(translate("hi", key)).not.toBe(translate("en", key));
  });
});
