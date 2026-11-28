import { Prisma } from "@prisma/client";

export const orderInvoiceSummarySelect = {
  id: true,
  retailerId: true,
  sellingEntity: true,
  firmInvoiceNumber: true,
  invoiceNumber: true,
  invoiceDate: true,
  dueDate: true,
  total: true,
  outstandingAmount: true,
} satisfies Prisma.InvoiceSelect;

export const orderInvoiceDetailSelect = {
  ...orderInvoiceSummarySelect,
  commercialSnapshot: true,
} satisfies Prisma.InvoiceSelect;

export const orderInvoiceOrderBy: Prisma.InvoiceOrderByWithRelationInput[] = [
  { invoiceDate: "asc" },
  { invoiceNumber: "asc" },
];

type OrderInvoice = Prisma.InvoiceGetPayload<{ select: typeof orderInvoiceSummarySelect }> & {
  commercialSnapshot?: Prisma.JsonValue;
};

export function orderBillingView(records: readonly OrderInvoice[], retailerId: string) {
  const invoices = records.filter((record) => record.retailerId === retailerId).map((record) => ({
    id: record.id,
    sellingEntity: record.sellingEntity,
    firmInvoiceNumber: record.firmInvoiceNumber,
    invoiceNumber: record.invoiceNumber,
    invoiceDate: record.invoiceDate,
    dueDate: record.dueDate,
    total: record.total.toFixed(2),
    outstandingAmount: record.outstandingAmount.toFixed(2),
    ...(record.commercialSnapshot === undefined ? {} : { commercialSnapshot: record.commercialSnapshot }),
  }));

  return {
    invoices,
    invoice: invoices.length === 1 ? invoices[0] : null,
    billingSummary: invoices.length ? {
      invoiceCount: invoices.length,
      total: invoices.reduce((sum, invoice) => sum.plus(invoice.total), new Prisma.Decimal(0)).toFixed(2),
      outstandingAmount: invoices.reduce((sum, invoice) => sum.plus(invoice.outstandingAmount), new Prisma.Decimal(0)).toFixed(2),
    } : null,
  };
}
