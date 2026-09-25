import { describe, expect, it } from "vitest";
import { translate } from "../translations";

describe("salesperson translations", () => {
  it("returns Hindi text for a known key", () => {
    expect(translate("hi", "language.chooseTitle")).toBe("भाषा चुनें");
  });

  it("falls back to English when a Hindi key is absent", () => {
    expect(translate("hi", "common.help")).toBe("Help");
  });

  it("shows method-specific collection references and optional remarks in both languages", () => {
    expect(translate("en", "work.collectionReferenceCash")).toBe("Cash receipt or reference");
    expect(translate("en", "work.collectionReferenceCheque")).toBe("Cheque number / bank reference");
    expect(translate("en", "work.collectionReferenceNeft")).toBe("UTR or bank reference");
    expect(translate("en", "work.collectionReferenceUpi")).toBe("UPI transaction reference");
    expect(translate("en", "work.collectionNotes")).toBe("Remarks (optional)");
    expect(translate("hi", "work.collectionReferenceNeft")).toBe("UTR या बैंक संदर्भ");
    expect(translate("hi", "work.collectionNotes")).toBe("टिप्पणी (वैकल्पिक)");
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

  it("labels the team-performance destination and summary in both languages", () => {
    expect(translate("en", "team.title")).toBe("Team performance");
    expect(translate("hi", "team.title")).toBe("टीम प्रदर्शन");
    expect(translate("en", "team.target")).toBe("Team target");
    expect(translate("hi", "team.target")).toBe("टीम लक्ष्य");
    expect(translate("en", "team.projectionNote")).toBe("Projected values use current run rate.");
    expect(translate("hi", "team.projectionNote")).toBe("अनुमान मौजूदा गति के आधार पर है।");
  });

  it("provides distinct Hindi copy for structured team facts and actions", () => {
    const keys = [
      "team.attendance.present",
      "team.attendance.leave",
      "team.attendance.absent",
      "team.attendance.holiday",
      "team.attendance.notDue",
      "team.attendance.unknown",
      "team.metric.orderValue",
      "team.metric.targetAchievement",
      "team.rankByMetric",
      "team.noMemberTarget",
      "team.projection.unavailable",
      "team.projection.noTeamSales",
      "team.projection.noSellingDays",
      "team.projection.notStarted",
      "team.projection.tooEarly",
      "team.risk.projectedAchievement",
      "team.risk.routeProgress",
      "team.risk.attendanceAbsent",
      "team.action.coach",
      "team.action.review",
      "team.reason.orderDue",
      "team.reason.highValueRetailerMissed",
      "team.reason.orderValueBelowNormal",
      "team.reason.lineItemsBelowNormal",
      "team.reason.categoryReorder",
      "team.reason.visitOverdue",
      "team.reason.collectionDue",
    ] as const;

    for (const key of keys) {
      expect(translate("hi", key), key).not.toBe(translate("en", key));
    }
    expect(translate("hi", "team.projection.tooEarly", { elapsed: 3, total: 31 })).toContain("3");
    expect(translate("hi", "team.risk.projectedAchievement", { pct: 31 })).toContain("31");
  });
});
