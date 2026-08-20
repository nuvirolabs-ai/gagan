import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildInvoice } from "../lib/invoicing";

describe("buildInvoice", () => {
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
