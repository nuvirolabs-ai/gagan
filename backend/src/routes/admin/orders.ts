import { Router } from "express";
import { z } from "zod";
import { OrderStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { requireAdmin } from "../../lib/adminAuth";
import {
  createInvoiceForDelivery,
  InvoiceCreationError,
} from "../../modules/invoicing/invoiceService";
import { ensureKycApprovedForDispatch, KycGateError } from "../../modules/kyc/kycGate";

const router = Router();
router.use(requireAdmin);

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
  retailer: { select: { id: true, name: true, phone: true, shopAddress: true } },
  items: { include: { variant: { include: { product: true } } } },
  delivery: true,
} as const;

router.get("/orders", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const valid = status && (Object.keys(ALLOWED_NEXT) as string[]).includes(status);

  const orders = await prisma.order.findMany({
    where: valid ? { status: status as OrderStatus } : undefined,
    include: orderInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json({ orders });
});

router.get("/orders/:id", async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: orderInclude });
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json({ order });
});

/** Generic forward transition used by approve / reject / pack. */
async function transition(orderId: string, to: OrderStatus, res: any) {
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

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: to },
    include: orderInclude,
  });
  res.json({ order: updated });
}

router.post("/orders/:id/approve", (req, res) => transition(req.params.id, "confirmed", res));
router.post("/orders/:id/reject", (req, res) => transition(req.params.id, "rejected", res));
router.post("/orders/:id/pack", (req, res) => transition(req.params.id, "packed", res));

const assignSchema = z.object({
  routeId: z.string().min(1),
  deliverySlot: z.string().datetime().optional(),
});

router.post("/dispatch/:orderId/assign", async (req, res) => {
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
    await tx.delivery.upsert({
      where: { orderId: order.id },
      update: { routeId: parsed.data.routeId, deliverySlot: slot },
      create: { orderId: order.id, routeId: parsed.data.routeId, deliverySlot: slot },
    });
    return tx.order.update({
      where: { id: order.id },
      data: { status: "out_for_delivery", expectedDeliveryAt: slot ?? order.expectedDeliveryAt },
      include: orderInclude,
    });
  });

  if (!updated) return res.status(409).json({ error: "dispatch_authorization_expired" });

  res.json({ order: updated });
});

const podSchema = z.object({
  podType: z.enum(["photo", "otp", "signature"]),
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
router.post("/dispatch/:orderId/pod", async (req, res) => {
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
      lines: parsed.data.items.map((item) => ({
        orderItemId: item.orderItemId,
        deliveredCases: item.qtyDelivered,
        deliveredWeightKg: item.weightDeliveredKg,
      })),
      proof: { podType: parsed.data.podType, capturedAt: occurredAt },
    });
    const updated = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: orderInclude,
    });
    res.json({
      order: updated,
      invoice,
      ledgerEntry: invoice.legacyLedgerEntry,
      balanceAfter: Number(invoice.ledgerEntry?.balanceAfter ?? 0),
    });
  } catch (error) {
    if (error instanceof InvoiceCreationError) {
      return res.status(error.code.endsWith("_not_found") ? 404 : 409).json({ error: error.code });
    }
    throw error;
  }
});

export default router;
