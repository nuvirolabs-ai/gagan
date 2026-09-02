import { describe, expect, it } from "vitest";
import {
  fillVsComparable,
  largestRisk,
  moneyVsComparable,
  pendingDecisionLine,
  teamConcern,
} from "../briefDomain";

describe("brief sentences", () => {
  it("sounds executive and omits unavailable values", () => {
    expect(moneyVsComparable("Orders", 108, 100)).toBe("Orders finished 8% above the recent weekday average.");
    expect(moneyVsComparable("Orders", 100, 100)).toBe("Orders finished in line with the recent weekday average.");
    expect(moneyVsComparable("Orders", null, 100)).toBeNull();
    expect(fillVsComparable(90, 90)).toBe("Fulfilment held at 90%.");
    expect(fillVsComparable(null, 90)).toBeNull();
    expect(largestRisk([])).toBeNull();
    expect(largestRisk([{ title: "Orders waiting on credit approval", businessImpact: { amount: 78_000 } }])).toBe(
      "Largest risk: Orders waiting on credit approval."
    );
    expect(teamConcern("Coverage is thin versus the roster.", "WATCH")).toBe("Coverage is thin versus the roster.");
    expect(teamConcern("ok", "HEALTHY")).toBeNull();
    expect(pendingDecisionLine(0)).toBe("No decisions are waiting.");
    expect(pendingDecisionLine(1)).toBe("One decision needs your attention.");
  });
});
