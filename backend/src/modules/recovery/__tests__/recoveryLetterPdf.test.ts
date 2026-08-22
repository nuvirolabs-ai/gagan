import { describe, expect, it } from "vitest";
import { renderRecoveryLetterPdf } from "../recoveryLetterPdf";

describe("recovery letter PDF", () => {
  it("contains deterministic amount, invoice, signatories, sent date, and seven-day deadline", () => {
    const pdf = renderRecoveryLetterPdf({
      retailerName: "Mahesh Store",
      retailerAddress: "12 Market Road",
      invoiceNumber: 1007,
      outstandingAmount: 12500,
      currency: "INR",
      sentAt: new Date("2026-08-21T00:00:00.000Z"),
      responseDueAt: new Date("2026-08-28T00:00:00.000Z"),
      signatories: ["Accounts", "Credit", "Founder/Director"],
    });

    expect(pdf.subarray(0, 8).toString()).toBe("%PDF-1.4");
    const text = pdf.toString("latin1");
    expect(text).toContain("Invoice 1007");
    expect(text).toContain("INR 12,500.00");
    expect(text).toContain("Accounts");
    expect(text).toContain("Credit");
    expect(text).toContain("Founder/Director");
    expect(text).toContain("21 August 2026");
    expect(text).toContain("28 August 2026");
    expect(text).toContain("Mahesh Store");
  });
});
