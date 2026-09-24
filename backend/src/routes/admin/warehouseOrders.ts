import { Router } from "express";
import { OrderStatus } from "@prisma/client";
import { requireAdminPermission, AdminRequest } from "../../lib/adminAuth";
import { prisma } from "../../lib/prisma";
import { Permissions } from "../../modules/identity/roleCatalog";
import { transitionOrder } from "./orders";

const router = Router();
const eligibleStatuses: OrderStatus[] = ["confirmed", "packed"];
const warehouseOrderSelect = {
  id: true,
  orderNo: true,
  status: true,
  createdAt: true,
  retailer: { select: { id: true, name: true } },
  items: {
    select: {
      id: true,
      qtyOrdered: true,
      variant: {
        select: {
          unitSize: true,
          unit: true,
          unitsPerCase: true,
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
    retailer: order.retailer ? { id: order.retailer.id, name: order.retailer.name } : null,
    items: (order.items ?? []).map((item: any) => ({
      id: item.id,
      qtyOrdered: item.qtyOrdered,
      variant: item.variant ? {
        unitSize: item.variant.unitSize,
        unit: item.variant.unit,
        unitsPerCase: item.variant.unitsPerCase,
        product: item.variant.product ? { name: item.variant.product.name } : null,
      } : null,
    })),
  };
}

router.use("/warehouse-orders", requireAdminPermission(Permissions.ORDER_WAREHOUSE_PROCESS));

router.get("/warehouse-orders", async (req, res) => {
  const requestedStatus = typeof req.query.status === "string" ? req.query.status : undefined;
  if (requestedStatus && !eligibleStatuses.includes(requestedStatus as OrderStatus)) {
    return res.status(400).json({ error: "Invalid warehouse order status" });
  }

  const orders = await prisma.order.findMany({
    where: { status: requestedStatus ? requestedStatus as OrderStatus : { in: eligibleStatuses } },
    select: warehouseOrderSelect,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json({ orders });
});

router.get("/warehouse-orders/:id", async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, status: { in: eligibleStatuses } },
    select: warehouseOrderSelect,
  });
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json({ order });
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

export default router;
