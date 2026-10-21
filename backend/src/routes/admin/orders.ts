import { Router } from "express";
import { z } from "zod";
import { CommercialStatusCode, OrderStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AdminRequest, requireAdmin } from "../../lib/adminAuth";
import {
  createInvoiceForDelivery,
  InvoiceCreationError,
} from "../../modules/invoicing/invoiceService";
import { renderInvoicePdf } from "../../modules/invoicing/invoicePdf";
import { ensureKycApprovedForDispatch, KycGateError } from "../../modules/kyc/kycGate";
import {
  attributeOrders,
  attributeOrdersWithWarehouses,
  orderAttribution,
  resolveWarehouse,
} from "../../modules/orders/orderAttribution";

const router = Router();
router.use(["/orders", "/dispatch"], requireAdmin);
class OrderTransitionConflict extends Error {}

// Orders move forward only, one step at a time. Anything else is a bad request
// rather than a silent no-op, so a double-clicked button can't skip a stage.
const ALLOWED_NEXT: Record<OrderStatus, OrderStatus[]> = {
  placed: ["confirmed", "rejected"],
  confirmed: ["packed", "rejected"],
  packed: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
  delivered: [],
  rejected: [],
};

function assertTransition(from: OrderStatus, to: OrderStatus): string | null {
  if (from === to) return `Order is already ${to}`;
  if (!ALLOWED_NEXT[from].includes(to)) return `Cannot move an order from ${from} to ${to}`;
  return null;
}

const orderInclude = {
  retailer: {
    select: {
      id: true,
      name: true,
      phone: true,
      shopAddress: true,
      deliveryCity: true,
      salesRepId: true,
      salesRep: { select: { id: true, name: true, phone: true } },
    },
  },
  items: { include: { variant: { include: { product: true, priceList: true } } } },
  delivery: true,
  invoice: {
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      dueDate: true,
      currency: true,
      subtotal: true,
      taxTotal: true,
      total: true,
      outstandingAmount: true,
    },
  },
  commercialStatusEvents: {
    where: { code: CommercialStatusCode.SALES_ORDER_PUNCHED },
    select: { code: true, actorStaff: { select: { name: true } } },
  },
} as const;

// Prisma's financial ledger sequence is a BigInt. Keep the API response
// JSON-safe without changing the stored value or the financial calculation.
function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, nested) =>
      typeof nested === "bigint" ? nested.toString() : nested
    )
  ) as T;
}

router.get("/orders", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const valid = status && (Object.keys(ALLOWED_NEXT) as string[]).includes(status);
  const warehouseCode = typeof req.query.warehouseCode === "string" && req.query.warehouseCode !== "all"
    ? req.query.warehouseCode.trim()
    : undefined;
  const salesperson = typeof req.query.salesperson === "string" && req.query.salesperson !== "all"
    ? req.query.salesperson.trim()
    : undefined;

  const orders = await prisma.order.findMany({
    where: valid ? { status: status as OrderStatus } : undefined,
    include: orderInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const { attributed, warehouses } = await attributeOrdersWithWarehouses(orders);
  let filtered = warehouseCode
    ? attributed.filter((o) => o.warehouseCode.toLowerCase() === warehouseCode.toLowerCase())
    : attributed;

  if (salesperson) {
    if (salesperson === "retailer_direct") {
      filtered = filtered.filter((o) => o.punchedByRole === "Retailer" || (!o.placedByRepId && !o.salespersonName));
    } else {
      const q = salesperson.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.salespersonName?.toLowerCase() === q ||
          o.punchedByName?.toLowerCase() === q ||
          o.creatorName?.toLowerCase() === q
      );
    }
  }

  res.json({ orders: filtered, warehouses });
});

router.get("/orders/:id", async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: orderInclude });
  if (!order) return res.status(404).json({ error: "Order not found" });
  const { attributed } = await attributeOrdersWithWarehouses([order]);
  res.json({ order: attributed[0] });
});

/** Generic forward transition used by approve / reject / pack. */
export async function transitionOrder(
  orderId: string,
  to: OrderStatus,
  res: any,
  actorStaffId: string | null,
  projectOrder: (order: any) => unknown = (order) => order
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return res.status(404).json({ error: "Order not found" });

  const problem = assertTransition(order.status, to);
  if (problem) return res.status(409).json({ error: problem });

  if (to !== "rejected") {
    const authorization = await prisma.dispatchAuthorization.findFirst({
      where: { orderId, status: "active" },
      select: { id: true },
    });
    if (!authorization) return res.status(409).json({ error: "dispatch_authorization_required" });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: { status: to },
    });
    if(claimed.count!==1) return null;
    const next=await tx.order.findUniqueOrThrow({where:{id:orderId},include:orderInclude});
    await tx.auditEvent.create({
      data: {
        actorStaffId,
        action: `order.${to}`,
        subjectType: "order",
        subjectId: orderId,
        metadata: { from: order.status, to },
      },
    });
    return next;
  });
  if(!updated) return res.status(409).json({error:"order_transition_conflict"});
  const [attributedOrder] = await attributeOrders([updated]);
  res.json({ order: projectOrder(attributedOrder) });
}

router.post("/orders/:id/approve", (req: AdminRequest, res) => transitionOrder(req.params.id, "confirmed", res, req.staffAuth?.staffId ?? null));
router.post("/orders/:id/reject", (req: AdminRequest, res) => transitionOrder(req.params.id, "rejected", res, req.staffAuth?.staffId ?? null));
router.post("/orders/:id/pack", (req: AdminRequest, res) => transitionOrder(req.params.id, "packed", res, req.staffAuth?.staffId ?? null));

const assignSchema = z.object({
  routeId: z.string().min(1),
  deliverySlot: z.string().datetime().optional(),
});

router.post("/dispatch/:orderId/assign", async (req: AdminRequest, res) => {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const order = await prisma.order.findUnique({ where: { id: req.params.orderId } });
  if (!order) return res.status(404).json({ error: "Order not found" });

  const problem = assertTransition(order.status, "out_for_delivery");
  if (problem) return res.status(409).json({ error: problem });
  try {
    await ensureKycApprovedForDispatch(order.retailerId);
  } catch (error) {
    if (error instanceof KycGateError) return res.status(error.status).json({ error: error.code });
    throw error;
  }
  const authorization = await prisma.dispatchAuthorization.findFirst({
    where: { orderId: order.id, status: "active" },
    select: { id: true },
  });
  if (!authorization) return res.status(409).json({ error: "dispatch_authorization_required" });

  const slot = parsed.data.deliverySlot ? new Date(parsed.data.deliverySlot) : null;

  const updated = await prisma.$transaction(async (tx) => {
    const consumed = await tx.dispatchAuthorization.updateMany({
      where: { id: authorization.id, status: "active" },
      data: { status: "used", usedAt: new Date() },
    });
    if (consumed.count !== 1) return null;
    const claimed=await tx.order.updateMany({
      where:{id:order.id,status:order.status},
      data:{status:"out_for_delivery",expectedDeliveryAt:slot??order.expectedDeliveryAt},
    });
    // Throw rather than return: failed state ownership must roll back consumed authorization.
    if(claimed.count!==1) throw new OrderTransitionConflict("order_transition_conflict");
    await tx.delivery.upsert({
      where: { orderId: order.id },
      update: { routeId: parsed.data.routeId, deliverySlot: slot },
      create: { orderId: order.id, routeId: parsed.data.routeId, deliverySlot: slot },
    });
    const next = await tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: orderInclude,
    });
    await tx.auditEvent.create({
      data: {
        actorStaffId: req.staffAuth?.staffId ?? null,
        action: "dispatch.assigned",
        subjectType: "order",
        subjectId: order.id,
        metadata: { from:order.status,to:"out_for_delivery",routeId: parsed.data.routeId, authorizationId: authorization.id },
      },
    });
    return next;
  }).catch(error=>{if(error instanceof OrderTransitionConflict) return null;throw error;});

  if (!updated) return res.status(409).json({ error: "dispatch_authorization_expired" });

  const [attributedOrder] = await attributeOrders([updated]);
  res.json({ order: attributedOrder });
});

const podSchema = z.object({
  podType: z.enum(["photo", "otp", "signature"]),
  transportationAmount: z.number().min(0).optional(),
  items: z
    .array(
      z.object({
        orderItemId: z.string(),
        qtyDelivered: z.number().int().min(0),
        weightDeliveredKg: z.number().min(0).optional(),
      })
    )
    .min(1),
});

/**
 * Completing delivery is the point where money is created: it captures proof of
 * delivery, prices the invoice off actual delivered weight, posts the ledger
 * entry and moves the retailer's balance. All of it in one transaction so a
 * failure can't leave an invoice without a balance change, or vice versa.
 */
router.post("/dispatch/:orderId/pod", async (req: AdminRequest, res) => {
  const parsed = podSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const order = await prisma.order.findUnique({
    where: { id: req.params.orderId },
    include: { items: { include: { variant: true } }, retailer: true },
  });
  if (!order) return res.status(404).json({ error: "Order not found" });

  // A provider or mobile client may retry after the first request committed.
  // Let the invoice service return the existing document for delivered orders.
  const problem =
    order.status === "delivered" ? null : assertTransition(order.status, "delivered");
  if (problem) return res.status(409).json({ error: problem });
  const authorization = await prisma.dispatchAuthorization.findFirst({
    where: { orderId: order.id, status: { in: ["active", "used"] } },
    select: { id: true },
  });
  if (!authorization) return res.status(409).json({ error: "dispatch_authorization_required" });

  const knownItemIds = new Set(order.items.map((i) => i.id));
  const unknown = parsed.data.items.filter((i) => !knownItemIds.has(i.orderItemId));
  if (unknown.length > 0) {
    return res.status(400).json({
      error: "Some line items do not belong to this order",
      orderItemIds: unknown.map((u) => u.orderItemId),
    });
  }

  if (parsed.data.items.length !== order.items.length) {
    return res.status(400).json({ error: "Every order line needs a delivery result" });
  }

  const occurredAt = new Date();
  try {
    const invoice = await createInvoiceForDelivery({
      orderId: order.id,
      occurredAt,
      idempotencyKey: `delivery:${order.id}`,
      transportationAmount: parsed.data.transportationAmount,
      lines: parsed.data.items.map((item) => ({
        orderItemId: item.orderItemId,
        deliveredCases: item.qtyDelivered,
        deliveredWeightKg: item.weightDeliveredKg,
      })),
      proof: { podType: parsed.data.podType, capturedAt: occurredAt },
      ...(req.staffAuth?.staffId ? { actorStaffId: req.staffAuth.staffId } : {}),
    });
    const updated = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: orderInclude,
    });
    res.json({
      order: updated,
      invoice: jsonSafe(invoice),
      ledgerEntry: jsonSafe(invoice.legacyLedgerEntry),
      balanceAfter: Number(invoice.ledgerEntry?.balanceAfter ?? 0),
    });
  } catch (error) {
    if (error instanceof InvoiceCreationError) {
      return res.status(error.code.endsWith("_not_found") ? 404 : 409).json({ error: error.code });
    }
    throw error;
  }
});

router.get("/orders/:id/invoice-pdf", async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      retailer: {
        include: {
          salesRep: true,
        },
      },
      commercialStatusEvents: {
        where: { code: CommercialStatusCode.SALES_ORDER_PUNCHED },
        select: { code: true, actorStaff: { select: { name: true } } },
      },
      invoice: {
        include: {
          lines: true,
        },
      },
    },
  });

  if (!order || !order.invoice) {
    return res.status(404).json({ error: "Invoice not found for this order" });
  }

  const freightLine = order.invoice.lines.find(
    (l) => l.descriptionSnapshot.toLowerCase().includes("freight") || l.descriptionSnapshot.toLowerCase().includes("transport")
  );

  const attribution = orderAttribution(order);
  const warehouse = resolveWarehouse(order);

  const pdfBuffer = renderInvoicePdf({
    invoiceNumber: order.invoice.invoiceNumber,
    orderNo: order.orderNo,
    invoiceDate: order.invoice.invoiceDate,
    dueDate: order.invoice.dueDate,
    currency: order.invoice.currency,
    subtotal: Number(order.invoice.subtotal),
    taxTotal: Number(order.invoice.taxTotal),
    total: Number(order.invoice.total),
    transportationAmount: freightLine ? Number(freightLine.lineTotal) : undefined,
    salespersonName: attribution.salespersonName,
    warehouseName: `${warehouse.name} (${warehouse.code})`,
    retailer: {
      name: order.retailer.name,
      shopAddress: order.retailer.shopAddress,
      deliveryCity: order.retailer.deliveryCity,
      phone: order.retailer.phone,
    },
    lines: order.invoice.lines.map((l) => ({
      description: l.descriptionSnapshot,
      cases: l.deliveredCases,
      weightKg: l.deliveredWeightKg ? Number(l.deliveredWeightKg) : undefined,
      unitPrice: Number(l.unitPrice),
      lineTotal: Number(l.lineTotal),
      sellingEntity: l.sellingEntity,
    })),
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="Invoice-INV-${order.invoice.invoiceNumber}.pdf"`
  );
  res.send(pdfBuffer);
});

export default router;
