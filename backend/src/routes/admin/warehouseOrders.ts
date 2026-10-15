import { Router } from "express";
import { OrderStatus } from "@prisma/client";
import { z } from "zod";
import { requireAnyAdminPermission, AdminRequest } from "../../lib/adminAuth";
import { prisma } from "../../lib/prisma";
import { Permissions } from "../../modules/identity/roleCatalog";
import { transitionOrder } from "./orders";
import { ensureKycApprovedForDispatch, KycGateError } from "../../modules/kyc/kycGate";
import { createInvoiceForDelivery, InvoiceCreationError } from "../../modules/invoicing/invoiceService";

const router = Router();
const defaultStatuses: OrderStatus[] = ["confirmed", "packed"];
const allEligibleStatuses: OrderStatus[] = ["confirmed", "packed", "out_for_delivery", "delivered"];

const warehouseOrderSelect = {
  id: true,
  orderNo: true,
  status: true,
  createdAt: true,
  retailer: {
    select: {
      id: true,
      name: true,
      phone: true,
      shopAddress: true,
      deliveryCity: true,
    },
  },
  delivery: {
    select: {
      routeId: true,
      deliverySlot: true,
    },
  },
  items: {
    select: {
      id: true,
      qtyOrdered: true,
      caseWeightKgSnapshot: true,
      variant: {
        select: {
          unitSize: true,
          unit: true,
          unitsPerCase: true,
          unitWeightKg: true,
          product: { select: { name: true } },
        },
      },
    },
  },
} as const;

function projectWarehouseOrder(order: any) {
  return {
    id: order.id,
    orderNo: order.orderNo,
    status: order.status,
    createdAt: order.createdAt,
    retailer: order.retailer ? {
      id: order.retailer.id,
      name: order.retailer.name,
      phone: order.retailer.phone,
      shopAddress: order.retailer.shopAddress,
      deliveryCity: order.retailer.deliveryCity,
    } : null,
    delivery: order.delivery ? {
      routeId: order.delivery.routeId,
      deliverySlot: order.delivery.deliverySlot,
    } : null,
    items: (order.items ?? []).map((item: any) => ({
      id: item.id,
      qtyOrdered: item.qtyOrdered,
      caseWeightKg: Number(item.caseWeightKgSnapshot ?? (item.variant ? Number(item.variant.unitWeightKg ?? 0) * item.variant.unitsPerCase : 0)),
      variant: item.variant ? {
        unitSize: item.variant.unitSize,
        unit: item.variant.unit,
        unitsPerCase: item.variant.unitsPerCase,
        unitWeightKg: item.variant.unitWeightKg ? Number(item.variant.unitWeightKg) : undefined,
        product: item.variant.product ? { name: item.variant.product.name } : null,
      } : null,
    })),
  };
}

router.use(
  "/warehouse-orders",
  requireAnyAdminPermission(Permissions.ORDER_WAREHOUSE_PROCESS, Permissions.DISPATCH_EXECUTE)
);

router.get("/warehouse-orders", async (req, res) => {
  const requestedStatus = typeof req.query.status === "string" ? req.query.status : undefined;
  if (requestedStatus && requestedStatus !== "all" && !allEligibleStatuses.includes(requestedStatus as OrderStatus)) {
    return res.status(400).json({ error: "Invalid warehouse order status" });
  }

  const statusFilter = requestedStatus === "all"
    ? { in: allEligibleStatuses }
    : requestedStatus
      ? (requestedStatus as OrderStatus)
      : { in: defaultStatuses };

  const orders = await prisma.order.findMany({
    where: { status: statusFilter },
    select: warehouseOrderSelect,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json({ orders: orders.map(projectWarehouseOrder) });
});

router.get("/warehouse-orders/:id", async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, status: { in: allEligibleStatuses } },
    select: warehouseOrderSelect,
  });
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json({ order: projectWarehouseOrder(order) });
});

router.post("/warehouse-orders/:id/pack", (req: AdminRequest, res) =>
  transitionOrder(
    req.params.id,
    "packed",
    res,
    req.staffAuth?.staffId ?? null,
    projectWarehouseOrder
  )
);

const dispatchSchema = z.object({
  routeId: z.string().min(1),
  deliverySlot: z.string().datetime().optional(),
});

router.post("/warehouse-orders/:id/dispatch", async (req: AdminRequest, res) => {
  const parsed = dispatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    select: { id: true, status: true, retailerId: true, expectedDeliveryAt: true },
  });
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.status !== "packed") {
    return res.status(409).json({ error: `Cannot dispatch order with status ${order.status}` });
  }

  try {
    await ensureKycApprovedForDispatch(order.retailerId);
  } catch (error) {
    if (error instanceof KycGateError) return res.status(error.status).json({ error: error.code });
    throw error;
  }

  const slot = parsed.data.deliverySlot ? new Date(parsed.data.deliverySlot) : null;

  const authorization = await prisma.dispatchAuthorization.findFirst({
    where: { orderId: order.id, status: "active" },
    select: { id: true },
  });

  const updated = await prisma.$transaction(async (tx) => {
    if (authorization) {
      await tx.dispatchAuthorization.updateMany({
        where: { id: authorization.id, status: "active" },
        data: { status: "used", usedAt: new Date() },
      });
    }

    const claimed = await tx.order.updateMany({
      where: { id: order.id, status: "packed" },
      data: { status: "out_for_delivery", expectedDeliveryAt: slot ?? order.expectedDeliveryAt },
    });
    if (claimed.count !== 1) return null;

    await tx.delivery.upsert({
      where: { orderId: order.id },
      update: { routeId: parsed.data.routeId, deliverySlot: slot },
      create: { orderId: order.id, routeId: parsed.data.routeId, deliverySlot: slot },
    });

    await tx.auditEvent.create({
      data: {
        actorStaffId: req.staffAuth?.staffId ?? null,
        action: "dispatch.assigned",
        subjectType: "order",
        subjectId: order.id,
        metadata: { from: "packed", to: "out_for_delivery", routeId: parsed.data.routeId },
      },
    });

    return tx.order.findUniqueOrThrow({
      where: { id: order.id },
      select: warehouseOrderSelect,
    });
  });

  if (!updated) return res.status(409).json({ error: "order_transition_conflict" });
  res.json({ order: projectWarehouseOrder(updated) });
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

router.post("/warehouse-orders/:id/deliver", async (req: AdminRequest, res) => {
  const parsed = podSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { variant: true } }, retailer: true },
  });
  if (!order) return res.status(404).json({ error: "Order not found" });

  if (order.status !== "out_for_delivery" && order.status !== "delivered") {
    return res.status(409).json({ error: `Cannot deliver order with status ${order.status}` });
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
      ...(req.staffAuth?.staffId ? { actorStaffId: req.staffAuth.staffId } : {}),
    });

    const updated = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      select: warehouseOrderSelect,
    });

    res.json({
      order: projectWarehouseOrder(updated),
      invoiceId: invoice.id,
    });
  } catch (error) {
    if (error instanceof InvoiceCreationError) {
      return res.status(error.code.endsWith("_not_found") ? 404 : 409).json({ error: error.code });
    }
    throw error;
  }
});

export default router;
