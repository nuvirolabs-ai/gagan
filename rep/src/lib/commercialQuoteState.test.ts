import { describe, expect, it } from "vitest";
import { canSubmitQuote, classifyQuoteRefresh, type CommercialQuoteState } from "./commercialQuoteState";

const base: CommercialQuoteState = {
  revision: 1,
  expiresAt: "2030-01-01T00:00:00.000Z",
  freightConfirmedByStaffId: null,
  snapshot: { total: "3745.00" },
};

describe("salesperson commercial quote reconciliation policy", () => {
  it("keeps Place order disabled while freight is awaiting manager confirmation", () => {
    expect(canSubmitQuote({ lineCount: 2, quoteReady: true, placing: false, quote: base })).toBe(false);
  });

  it("enables only the newer manager-confirmed, unaccepted quote", () => {
    const refreshed = { ...base, revision: 2, freightConfirmedByStaffId: "staff-1", snapshot: { total: "3871.00", freight: { amount: "120.00", gst: "6.00" } } };
    expect(classifyQuoteRefresh(refreshed, Date.parse("2029-01-01T00:00:00.000Z"))).toMatchObject({ kind: "updated", quote: refreshed });
    expect(canSubmitQuote({ lineCount: 2, quoteReady: true, placing: false, quote: refreshed })).toBe(true);
  });

  it("does not block a backend-approved pre-tax quote solely because GST is pending", () => {
    const pendingTax = { ...base, freightConfirmedByStaffId: "staff-1", snapshot: { total: "3610.00", taxStatus: "PENDING" } };
    expect(canSubmitQuote({ lineCount: 1, quoteReady: true, placing: false, quote: pendingTax })).toBe(true);
  });

  it("does not enable a quote that another actor already accepted", () => {
    const accepted = { ...base, revision: 2, freightConfirmedByStaffId: "staff-1", acceptedAt: "2029-01-01T00:00:00.000Z" };
    expect(classifyQuoteRefresh(accepted, Date.parse("2028-01-01T00:00:00.000Z")).kind).toBe("accepted");
    expect(canSubmitQuote({ lineCount: 2, quoteReady: true, placing: false, quote: accepted })).toBe(false);
  });

  it("classifies expiry without treating it as a valid checkout state", () => {
    const expired = { ...base, expiresAt: "2028-01-01T00:00:00.000Z" };
    expect(classifyQuoteRefresh(expired, Date.parse("2029-01-01T00:00:00.000Z")).kind).toBe("expired");
    expect(canSubmitQuote({ lineCount: 2, quoteReady: true, placing: false, quote: expired })).toBe(false);
  });
});
