import { describe, expect, it } from "vitest";
import { normalizeVisitOutcomes, validateVisitExplanation } from "../visitOutcome";

describe("structured Visit Out policy", () => {
  it("accepts the legacy single outcome without dropping it", () => {
    expect(normalizeVisitOutcomes({ outcome: "payment_collected" })).toEqual({ outcome: "payment_collected", outcomes: ["payment_collected"] });
  });
  it("retains multiple activities and one legacy primary outcome", () => {
    expect(normalizeVisitOutcomes({ outcomes: ["task_completed", "order_placed", "payment_collected", "task_completed"] })).toEqual({ outcome: "order_placed", outcomes: ["order_placed", "payment_collected", "task_completed"] });
  });
  it.each([{}, { outcomes: [] }, { outcomes: ["unknown"] }, { outcomes: ["order_placed", "no_order"] }, { outcome: "order_placed", outcomes: ["payment_collected"] }])("rejects missing or contradictory selections %j", input => {
    expect(() => normalizeVisitOutcomes(input)).toThrow();
  });
  it("other activities cannot bypass a sales visit explanation", () => {
    expect(() => validateVisitExplanation({ purpose: "sales_call", outcomes: ["payment_collected"] })).toThrow("no_order_reason_required");
  });
  it("a collection-only visit does not force an invented lost sale", () => {
    expect(() => validateVisitExplanation({ purpose: "collection", outcomes: ["payment_collected"] })).not.toThrow();
  });
  it("requires an explanation for Other and rejects inconsistent reasons", () => {
    expect(() => validateVisitExplanation({ purpose: "sales_call", outcomes: ["no_order"], noOrderReason: "other", notes: " " })).toThrow("no_order_note_required");
    expect(() => validateVisitExplanation({ purpose: "sales_call", outcomes: ["order_placed"], noOrderReason: "price_issue" })).toThrow("visit_outcome_conflict");
  });
});
