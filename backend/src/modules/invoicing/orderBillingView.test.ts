import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { orderBillingView } from "./orderBillingView";

const invoiceDate = new Date("2026-11-28T08:00:00Z");
const dueDate = new Date("2026-12-12T08:00:00Z");

describe("customer and salesperson order billing readback", () => {
  const jain = {
    id: "invoice-jain",
    retailerId: "retailer",
    sellingEntity: "jain_traders" as const,
    firmInvoiceNumber: "JT/26-27/13",
    invoiceNumber: 100,
    invoiceDate,
    dueDate,
    total: new Prisma.Decimal("839.90"),
    outstandingAmount: new Prisma.Decimal("139.90"),
  };
  const padam = {
    id: "invoice-padam",
    retailerId: "retailer",
    sellingEntity: "padam_international" as const,
    firmInvoiceNumber: "PI/26-27/27",
    invoiceNumber: 101,
    invoiceDate,
    dueDate,
    total: new Prisma.Decimal("899.01"),
    outstandingAmount: new Prisma.Decimal("899.01"),
  };

  it("keeps distinct firm references and exact balances without choosing a single invoice", () => {
    const foreign = { ...jain, id: "foreign", retailerId: "another-retailer" };
    const result = orderBillingView([jain, padam, foreign], "retailer");
    expect(result.invoice).toBeNull();
    expect(result.invoices).toEqual([
      expect.objectContaining({ id: jain.id, firmInvoiceNumber: jain.firmInvoiceNumber, outstandingAmount: "139.90" }),
      expect.objectContaining({ id: padam.id, firmInvoiceNumber: padam.firmInvoiceNumber, outstandingAmount: "899.01" }),
    ]);
    expect(result.invoices[0]).not.toHaveProperty("retailerId");
    expect(result.billingSummary).toEqual({ invoiceCount: 2, total: "1738.91", outstandingAmount: "1038.91" });
  });

  it("continues to expose a single genuine invoice through the legacy field", () => {
    const legacy = { ...jain, sellingEntity: null, firmInvoiceNumber: null };
    const result = orderBillingView([legacy], "retailer");
    expect(result.invoice).toBe(result.invoices[0]);
    expect(result.invoice).toMatchObject({ invoiceNumber: legacy.invoiceNumber, firmInvoiceNumber: null });
    expect(orderBillingView([legacy], "another-retailer")).toEqual({ invoices: [], invoice: null, billingSummary: null });
  });
});
