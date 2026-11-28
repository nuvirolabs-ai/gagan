import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { orderAttribution, resolveWarehouse } from "../orders/orderAttribution";
import { renderInvoicePdf } from "./invoicePdf";

export const orderInvoiceSummary = {
  id: true,
  invoiceNumber: true,
  firmInvoiceNumber: true,
  sellingEntity: true,
  companySalesOrderId: true,
  invoiceDate: true,
  dueDate: true,
  currency: true,
  subtotal: true,
  taxTotal: true,
  total: true,
  outstandingAmount: true,
  status: true,
} as const;

const querySchema = z.object({ invoiceId: z.string().trim().min(1).max(100).optional() });
const billingSnapshotSchema = z.object({
  seller: z.object({ name: z.string(), address: z.string().nullable(), gstin: z.string().nullable() }),
  buyer: z.object({ name: z.string(), address: z.string(), gstin: z.string().nullable() }),
  delivery: z.object({ city: z.string(), address: z.string() }),
});

export async function sendOrderInvoicePdf(req: Request, res: Response) {
  const query = querySchema.safeParse(req.query);
  if (!query.success) return res.status(400).json({ error: "invalid_invoice_selection" });

  const { invoiceId } = query.data;
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      retailer: { include: { salesRep: true } },
      _count: { select: { companySalesOrders: true } },
      commercialStatusEvents: {
        where: { code: "SALES_ORDER_PUNCHED" },
        select: { code: true, actorStaff: { select: { name: true } } },
      },
      invoices: {
        where: invoiceId ? { id: invoiceId } : undefined,
        take: 2,
        orderBy: { invoiceNumber: "asc" },
        include: {
          lines: { orderBy: { id: "asc" } },
          companySalesOrder: { select: { reference: true } },
        },
      },
    },
  });
  if (!order || !order.invoices.length) return res.status(404).json({ error: "invoice_not_found" });
  const [invoice] = order.invoices;
  if (!invoiceId && (order.invoices.length > 1 || (invoice.sellingEntity && order._count.companySalesOrders > 1))) {
    return res.status(409).json({ error: "invoice_selection_required" });
  }
  const snapshot = billingSnapshotSchema.safeParse(invoice.billingSnapshot);
  const billing = snapshot.success ? snapshot.data : null;
  if (invoice.sellingEntity && !billing) return res.status(409).json({ error: "firm_billing_snapshot_missing" });
  const warehouse = invoice.sellingEntity ? null : resolveWarehouse(order);
  const invoiceReference = invoice.firmInvoiceNumber ?? `INV-${invoice.invoiceNumber}`;
  const pdf = renderInvoicePdf({
    invoiceNumber: invoice.invoiceNumber,
    invoiceReference,
    seller: billing?.seller,
    voided: invoice.status === "voided",
    companyOrderReference: invoice.companySalesOrder?.reference,
    orderNo: order.orderNo,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    subtotal: Number(invoice.subtotal),
    taxTotal: Number(invoice.taxTotal),
    total: Number(invoice.total),
    salespersonName: orderAttribution(order).salespersonName,
    warehouseName: warehouse ? `${warehouse.name} (${warehouse.code})` : null,
    retailer: billing ? billing.buyer : {
      name: order.retailer.name,
      address: order.retailer.shopAddress,
      deliveryCity: order.retailer.deliveryCity,
      phone: order.retailer.phone,
    },
    shipTo: billing?.delivery,
    lines: invoice.lines.map(line => ({
      description: line.descriptionSnapshot,
      cases: line.deliveredCases,
      weightKg: line.deliveredWeightKg == null ? null : Number(line.deliveredWeightKg),
      unitPrice: Number(line.unitPrice),
      lineTotal: Number(line.lineTotal),
      taxAmount: line.taxAmount == null ? null : Number(line.taxAmount),
    })),
  });

  res.setHeader("Cache-Control", "private, no-store");
  res.type("application/pdf");
  res.attachment(`Invoice-${invoiceReference.replace(/[^\w-]/g, "-")}.pdf`);
  return res.send(pdf);
}
