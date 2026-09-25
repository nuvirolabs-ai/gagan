import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildInvoice } from "../lib/invoicing";

describe("buildInvoice", () => {
  it("rounds a delivered-weight half-paise upward without binary floating point loss", () => {
    const result = buildInvoice([{
      id: "half-paise", unitPrice: new Prisma.Decimal("2.01"),
      qtyOrdered: 1, qtyDelivered: 1, weightDelivered: new Prisma.Decimal("0.5"),
      caseWeightKgSnapshot: new Prisma.Decimal(1),
      variant: { unitsPerCase: 1, unitWeightKg: new Prisma.Decimal(1) },
    }]);
    expect(result.lines[0].lineTotal).toBe(1.01);
    expect(result.total).toBe(1.01);
  });

  it("rounds each billed line before summing and uses frozen conversion", () => {
    const result = buildInvoice(["a", "b"].map(id => ({
      id, unitPrice: new Prisma.Decimal("2.01"), qtyOrdered: 1, qtyDelivered: 1,
      weightDelivered: new Prisma.Decimal("0.5"), caseWeightKgSnapshot: new Prisma.Decimal(1),
      variant: { unitsPerCase: 1, unitWeightKg: new Prisma.Decimal(2) },
    })));
    expect(result.total).toBe(2.02);
    expect(result.lines.map(line => line.pricePerKg)).toEqual([2.01, 2.01]);
  });
  it("prices delivered weight instead of ordered cases", () => {
    const result = buildInvoice([
      {
        id: "line-1",
        unitPrice: new Prisma.Decimal(5400),
        qtyOrdered: 1,
        qtyDelivered: 1,
        weightDelivered: new Prisma.Decimal(11.4),
        variant: { unitsPerCase: 12, unitWeightKg: new Prisma.Decimal(1) },
      },
    ]);

    expect(result.total).toBe(5130);
    expect(result.lines[0].basis).toBe("delivered_weight");
  });

  it("falls back to delivered cases when weight is absent", () => {
    const result = buildInvoice([
      {
        id: "line-1",
        unitPrice: new Prisma.Decimal(3150),
        qtyOrdered: 3,
        qtyDelivered: 2,
        weightDelivered: null,
        variant: { unitsPerCase: 30, unitWeightKg: new Prisma.Decimal(1) },
      },
    ]);

    expect(result.total).toBe(6300);
    expect(result.lines[0].basis).toBe("delivered_cases");
  });

  it("falls back to ordered cases when delivery data is absent", () => {
    const result = buildInvoice([
      {
        id: "line-1",
        unitPrice: new Prisma.Decimal(2850),
        qtyOrdered: 3,
        qtyDelivered: null,
        weightDelivered: null,
        variant: { unitsPerCase: 30, unitWeightKg: new Prisma.Decimal(1) },
      },
    ]);

    expect(result.total).toBe(8550);
    expect(result.lines[0].basis).toBe("ordered_cases");
  });
});
