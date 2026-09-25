import { describe, expect, it } from "vitest";
import { entityAmountsMatchTotal, entityAttributionPresentation } from "../entityAttributionPresentation";

describe("Salesperson financial entity attribution", () => {
  it("keeps company balances separate and identifies the unallocated remainder", () => {
    expect(
      entityAttributionPresentation(
        { jainTraders: 40, padamInternational: 30, unattributed: 25 },
        "contains_unattributed"
      )
    ).toEqual({
      rows: [
        { key: "jainTraders", amount: 40 },
        { key: "padamInternational", amount: 30 },
        { key: "unattributed", amount: 25 },
      ],
      reviewRequired: false,
    });
  });

  it("does not assign a review-required balance to either company", () => {
    expect(
      entityAttributionPresentation(
        { jainTraders: 0, padamInternational: 0, unattributed: 55 },
        "review_required"
      )
    ).toEqual({
      rows: [{ key: "unattributed", amount: 55 }],
      reviewRequired: true,
    });
  });

  it("does not expose company amounts when the status requires review", () => {
    expect(
      entityAttributionPresentation(
        { jainTraders: 55, padamInternational: 0, unattributed: 0 },
        "review_required",
        55
      )
    ).toEqual({ rows: [{ key: "unattributed", amount: 55 }], reviewRequired: true });
  });

  it("keeps older responses without entity data compatible", () => {
    expect(entityAttributionPresentation(null, null)).toEqual({ rows: [], reviewRequired: false });
  });

  it("does not display entity values when they fail to reconcile to the consolidated total", () => {
    expect(
      entityAttributionPresentation(
        { jainTraders: 40, padamInternational: 30, unattributed: 24 },
        "complete",
        95
      )
    ).toEqual({ rows: [{ key: "unattributed", amount: 95 }], reviewRequired: true });
  });

  it("accepts overdue entity values only when they reconcile to consolidated overdue", () => {
    expect(entityAmountsMatchTotal({ jainTraders: 40, padamInternational: 30, unattributed: 0 }, 70)).toBe(true);
    expect(entityAmountsMatchTotal({ jainTraders: 40, padamInternational: 20, unattributed: 0 }, 70)).toBe(false);
  });
});
