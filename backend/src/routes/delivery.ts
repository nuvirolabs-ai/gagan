import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../lib/auth";

const router = Router();

// Order status doubles as delivery status for MVP (no dispatch/admin module yet).
router.get("/delivery/:orderId/status", requireAuth, async (req: AuthedRequest, res) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.orderId, retailerId: req.retailerId },
    include: { delivery: true },
  });
  if (!order) return res.status(404).json({ error: "Order not found" });

  res.json({
    status: order.status,
    delivery: order.delivery,
  });
});

export default router;
