import { describe, expect, it } from "vitest";
import { calculateRatingProposal } from "../ratingLifecycle";

const clean = (daysToPay: number) => ({ daysToPay, fullyPaid: true, hadPartialPayment: false });

describe("rating lifecycle", () => {
  it("keeps an irregular customer with DSO below 45 at rating B", () => {
    expect(calculateRatingProposal({ currentRating: "N", billingPattern: "irregular", accountAgeDays: 190, invoices: [clean(40), clean(41), clean(39)], checkpointDue: true }))
      .toMatchObject({ proposedRating: "B", cleanInvoiceCount: 3, requiresConfirmation: true });
  });

  it("rates a regular customer A at 30 days and E once DSO reaches 60", () => {
    expect(calculateRatingProposal({ currentRating: "B", billingPattern: "regular", accountAgeDays: 400, invoices: [clean(28), clean(30), clean(29)], checkpointDue: true }).proposedRating).toBe("A");
    expect(calculateRatingProposal({ currentRating: "A", billingPattern: "regular", accountAgeDays: 400, invoices: [clean(60)], checkpointDue: false }))
      .toMatchObject({ proposedRating: "E", trigger: "immediate_60_day_review" });
  });

  it("permanently proposes F at 90 days", () => {
    expect(calculateRatingProposal({ currentRating: "A", billingPattern: "regular", accountAgeDays: 400, invoices: [clean(90)], checkpointDue: false }))
      .toMatchObject({ proposedRating: "F", trigger: "legal_90_day_lock" });
  });

  it("resets the clean sequence after late or partial payment", () => {
    const proposal = calculateRatingProposal({
      currentRating: "N",
      billingPattern: "regular",
      accountAgeDays: 120,
      invoices: [clean(20), clean(25), { daysToPay: 10, fullyPaid: true, hadPartialPayment: true }],
      checkpointDue: true,
    });
    expect(proposal).toMatchObject({ proposedRating: "N", cleanInvoiceCount: 0, trigger: "not_eligible" });
  });

  it("requires a manual C/D proposal at six months when N exit evidence is incomplete", () => {
    expect(calculateRatingProposal({ currentRating: "N", billingPattern: "irregular", accountAgeDays: 183, invoices: [clean(20)], checkpointDue: false }))
      .toMatchObject({ proposedRating: "D", trigger: "six_month_manual_exit", requiresConfirmation: true });
  });

  it("restarts an E account at N after every outstanding invoice is cleared", () => {
    expect(calculateRatingProposal({
      currentRating: "E",
      billingPattern: "regular",
      accountAgeDays: 400,
      invoices: [clean(70)],
      checkpointDue: false,
      hasOutstanding: false,
    })).toMatchObject({
      proposedRating: "N",
      trigger: "e_clearance_restart",
      requiresConfirmation: true,
    });
  });
});
