import { Router } from "express";
import { z } from "zod";
import { OrderStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { requireAdmin } from "../../lib/adminAuth";
import { buildInvoice } from "../../lib/invoicing";
import { paymentTermDays, addDays, recomputeOverdue } from "../../lib/ageing";
import { enqueueInvoice } from "../../lib/sap/outbox";

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

  const slot = parsed.data.deliverySlot ? new Date(parsed.data.deliverySlot) : null;

  const updated = await prisma.$transaction(async (tx) => {
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

  const problem = assertTransition(order.status, "delivered");
  if (problem) return res.status(409).json({ error: problem });

  const knownItemIds = new Set(order.items.map((i) => i.id));
  const unknown = parsed.data.items.filter((i) => !knownItemIds.has(i.orderItemId));
  if (unknown.length > 0) {
    return res.status(400).json({
      error: "Some line items do not belong to this order",
      orderItemIds: unknown.map((u) => u.orderItemId),
    });
  }

  const byId = new Map(parsed.data.items.map((i) => [i.orderItemId, i]));

  const result = await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      const captured = byId.get(item.id);
      if (!captured) continue;
      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          qtyDelivered: captured.qtyDelivered,
          weightDelivered: captured.weightDeliveredKg ?? null,
        },
      });
    }

    const items = await tx.orderItem.findMany({
      where: { orderId: order.id },
      include: { variant: { select: { unitsPerCase: true, unitWeightKg: true } } },
    });
    const invoice = buildInvoice(items);

    const totalWeight = invoice.lines.reduce((sum, l) => sum + (l.billedWeightKg ?? 0), 0);
    await tx.delivery.upsert({
      where: { orderId: order.id },
      update: { podType: parsed.data.podType, podCapturedAt: new Date(), actualWeight: totalWeight },
      create: {
        orderId: order.id,
        podType: parsed.data.podType,
        podCapturedAt: new Date(),
        actualWeight: totalWeight,
      },
    });

    const balanceAfter = Number(order.retailer.currentBalance) + invoice.total;
    // The credit clock starts at delivery, since that's when the invoice exists.
    const termDays = await paymentTermDays(tx, order.retailerId);
    const ledgerEntry = await tx.ledgerEntry.create({
      data: {
        retailerId: order.retailerId,
        orderId: order.id,
        type: "invoice",
        amount: invoice.total,
        balanceAfter,
        dueDate: addDays(new Date(), termDays),
      },
    });
    await tx.retailer.update({
      where: { id: order.retailerId },
      data: { currentBalance: balanceAfter },
    });
    await recomputeOverdue(tx, order.retailerId);
    await enqueueInvoice(tx, ledgerEntry.id);

    const updated = await tx.order.update({
      where: { id: order.id },
      data: { status: "delivered" },
      include: orderInclude,
    });

    return { order: updated, invoice, ledgerEntry, balanceAfter };
  });

  res.json(result);
});

export default router;
