import { describe, expect, it } from "vitest";
import { calculateCommercialQuote } from "../../../lib/commercialQuote";

describe("Commercial Quote Discount & Quintal Calculation", () => {
  it("calculates exact quote for quintal rate with flat discount (e.g. Gagan Toor Dal 30kg)", () => {
    // List rate: 15,150 / quintal
    // Flat discount: 200 OFF -> Net rate: 14,950 / quintal (= 149.50 / kg)
    // 3 cases x 30 kg = 90 kg = 0.9 quintal
    // Expected total: 0.9 * 14,950 = 13,455.00 (not 13,635.00)
    const baseRate = 15150;
    const discount = 200;
    const effectiveRate = baseRate - discount; // 14,950

    const quote = calculateCommercialQuote({
      lines: [
        {
          variantId: "toor-dal-30kg",
          entity: "jain_traders",
          cases: 3,
          caseWeightKg: "30",
          rate: effectiveRate.toFixed(2),
          rateBasis: "quintal",
          gstPercent: "0",
        },
      ],
    });

    expect(quote.lines[0].weightKg).toBe("90");
    expect(quote.lines[0].quintals).toBe("0.9");
    expect(quote.lines[0].base).toBe("13455.00");
    expect(quote.lines[0].gst).toBe("0.00");
    expect(quote.lines[0].total).toBe("13455.00");
    expect(quote.total).toBe("13455.00");
  });

  it("calculates exact quote for quintal rate with percentage discount", () => {
    // List rate: 10,000 / quintal
    // 5% discount -> Net rate: 9,500 / quintal
    // 2 cases x 50 kg = 100 kg = 1.0 quintal
    // Expected total: 1.0 * 9,500 = 9,500.00
    const baseRate = 10000;
    const pct = 5;
    const effectiveRate = baseRate * (1 - pct / 100);

    const quote = calculateCommercialQuote({
      lines: [
        {
          variantId: "sample-50kg",
          entity: "jain_traders",
          cases: 2,
          caseWeightKg: "50",
          rate: effectiveRate.toFixed(2),
          rateBasis: "quintal",
          gstPercent: "5",
        },
      ],
    });

    expect(quote.lines[0].weightKg).toBe("100");
    expect(quote.lines[0].quintals).toBe("1");
    expect(quote.lines[0].base).toBe("9500.00");
    expect(quote.lines[0].gst).toBe("475.00"); // 5% of 9500
    expect(quote.lines[0].total).toBe("9975.00");
    expect(quote.total).toBe("9975.00");
  });

  it("calculates exact quote for case basis with flat discount", () => {
    // Case rate: 500 / case
    // Flat discount: 50 OFF -> Net rate: 450 / case
    // 10 cases
    // Expected total: 10 * 450 = 4,500.00
    const baseRate = 500;
    const discount = 50;
    const effectiveRate = baseRate - discount;

    const quote = calculateCommercialQuote({
      lines: [
        {
          variantId: "sample-case",
          entity: "jain_traders",
          cases: 10,
          caseWeightKg: "10",
          rate: effectiveRate.toFixed(2),
          rateBasis: "case",
          gstPercent: "0",
        },
      ],
    });

    expect(quote.lines[0].base).toBe("4500.00");
    expect(quote.lines[0].total).toBe("4500.00");
    expect(quote.total).toBe("4500.00");
  });
});
