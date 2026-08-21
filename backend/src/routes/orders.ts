import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../lib/auth";
import { createOrderForRetailer } from "../lib/orders";
import { createRateLimiter } from "../platform/http/rateLimit";

const router = Router();

const createOrderSchema = z.object({
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

  const result = await createOrderForRetailer(req.retailerId!, parsed.data.items, "retailer", undefined, undefined, idempotencyKey);
  if (!result.ok) return res.status(result.status).json(result.body);

  res.status(201).json({
    order: result.order,
    creditDecision: result.decision,
    approvalRequest: result.approvalRequest ?? null,
    dispatchAuthorization: result.dispatchAuthorization ?? null,
  });
});

router.get("/orders", requireAuth, async (req: AuthedRequest, res) => {
  const orders = await prisma.order.findMany({
    where: { retailerId: req.retailerId },
    include: { items: { include: { variant: { include: { product: true } } } }, delivery: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ orders });
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
    },
  });
  if (!order) return res.status(404).json({ error: "Order not found" });

  const invoice = order.ledgerEntries[0] ?? null;

  res.json({
    order: {
      ...order,
      ledgerEntries: undefined,
      invoice: invoice
        ? {
            amount: Number(invoice.amount),
            createdAt: invoice.createdAt,
            variance: Number(invoice.amount) - Number(order.orderTotal),
          }
        : null,
    },
  });
});

export default router;
