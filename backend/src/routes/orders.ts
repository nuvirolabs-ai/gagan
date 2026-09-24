import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../lib/auth";
import { createOrderForRetailer } from "../lib/orders";
import { createRateLimiter } from "../platform/http/rateLimit";
import { invoiceBalances } from "../modules/commercial/service";
import { CommercialStatusCode } from "@prisma/client";

const router = Router();

/**
 * Internal commercial events/holds are staff-only. Keep the customer DTO
 * explicit so adding a new internal scalar to Order cannot accidentally leak
 * it through a broad Prisma spread.
 */
export type RetailerSalesOrderState = "punched" | "created";

export function retailerOrderView(order: any, stateOverride?: RetailerSalesOrderState) {
  const {
    isOnHold: _isOnHold,
    holdReason: _holdReason,
    heldAt: _heldAt,
    heldByStaffId: _heldByStaffId,
    commercialStatusEvents,
    commercialStatus: _commercialStatus,
    salesOrderState: _salesOrderState,
    ...publicOrder
  } = order;
  const events = Array.isArray(commercialStatusEvents) ? commercialStatusEvents : [];
  const salesOrderState = stateOverride ?? (
    events.some((event: any) => event.code === CommercialStatusCode.SALES_ORDER_CREATED)
      ? "created"
      : events.some((event: any) => event.code === CommercialStatusCode.SALES_ORDER_PUNCHED)
        ? "punched"
        : null
  );
  return salesOrderState ? { ...publicOrder, salesOrderState } : publicOrder;
}

/**
 * The retailer checkout only needs the customer-facing order. Credit
 * decisions, approval requests and dispatch authorizations belong to the
 * protected staff/Admin workflow and must not cross this API boundary.
 */
export function retailerOrderCreatedResponse(result: { order: any; dispatchAuthorization?: unknown }) {
  return {
    order: retailerOrderView(result.order, result.dispatchAuthorization ? "created" : "punched"),
  };
}

const retailerLifecycleEvents = {
  where: {
    code: { in: [CommercialStatusCode.SALES_ORDER_PUNCHED, CommercialStatusCode.SALES_ORDER_CREATED] },
  },
  select: { code: true },
};

const createOrderSchema = z.object({
  commercial: z.object({quoteId:z.string(),revision:z.number().int().positive()}).optional(),
  items: z
    .array(z.object({ variantId: z.string(), qty: z.number().int().positive() }))
    .min(1),
});

router.post("/orders", requireAuth, createRateLimiter({ name: "retailer-order", limit: 20, windowMs: 60_000 }), async (req: AuthedRequest, res) => {
  const idempotencyKey = req.header("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length > 120) {
    return res.status(400).json({ error: "idempotency_key_required" });
  }
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const result = await createOrderForRetailer(req.retailerId!, parsed.data.items, "retailer", undefined, undefined, idempotencyKey,parsed.data.commercial);
  if (!result.ok) return res.status(result.status).json(result.body);

  res.status(201).json(retailerOrderCreatedResponse(result));
});

router.get("/orders", requireAuth, async (req: AuthedRequest, res) => {
  const orders = await prisma.order.findMany({
    where: { retailerId: req.retailerId },
    include: {
      items: { include: { variant: { include: { product: true } } } },
      delivery: true,
      commercialStatusEvents: retailerLifecycleEvents,
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ orders: orders.map((order) => retailerOrderView(order)) });
});

router.get("/orders/:id", requireAuth, async (req: AuthedRequest, res) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, retailerId: req.retailerId },
    include: {
      items: { include: { variant: { include: { product: true } } } },
      delivery: true,
      // The invoice is priced off delivered weight, so it can differ from the
      // ordered total. Send it alongside so the retailer can see why.
      ledgerEntries: { where: { type: "invoice" }, take: 1 },
      invoice: true,
      commercialStatusEvents: retailerLifecycleEvents,
    },
  });
  if (!order) return res.status(404).json({ error: "Order not found" });

  const invoice = order.ledgerEntries[0] ?? null;
  const financialInvoice = order.invoice;
  const entityBalances = financialInvoice?.commercialSnapshot ? await prisma.$transaction(tx=>invoiceBalances(tx,financialInvoice.id)) : null;

  res.json({
    order: {
      ...retailerOrderView(order),
      ledgerEntries: undefined,
      invoice: invoice
        ? {
            amount: Number(invoice.amount),
            createdAt: invoice.createdAt,
            variance: Number(invoice.amount) - Number(order.orderTotal),
            invoiceNumber: financialInvoice?.invoiceNumber,
            commercialSnapshot: financialInvoice?.commercialSnapshot,
            outstandingAmount: financialInvoice?.outstandingAmount,
            entityOutstanding: entityBalances ? {jain:entityBalances.jain.toFixed(2),padam:entityBalances.padam.toFixed(2)} : null,
          }
        : null,
    },
  });
});

export default router;
