import { Router } from "express";
import { CommercialStatusCode, OrderStatus } from "@prisma/client";
import { z } from "zod";
import { requireAnyAdminPermission, AdminRequest } from "../../lib/adminAuth";
import { prisma } from "../../lib/prisma";
import { Permissions } from "../../modules/identity/roleCatalog";
import { transitionOrder } from "./orders";
import { ensureKycApprovedForDispatch, KycGateError } from "../../modules/kyc/kycGate";
import { createInvoiceForDelivery, InvoiceCreationError } from "../../modules/invoicing/invoiceService";
import { renderInvoicePdf } from "../../modules/invoicing/invoicePdf";
import { DEFAULT_WAREHOUSE_CODE } from "../../modules/inventory/inventoryService";
import {
  orderAttribution,
  resolveWarehouse,
  STATIC_WAREHOUSES,
  ResolvedWarehouse,
} from "../../modules/orders/orderAttribution";

const router = Router();
const defaultStatuses: OrderStatus[] = ["confirmed", "packed"];
const allEligibleStatuses: OrderStatus[] = ["confirmed", "packed", "out_for_delivery", "delivered"];

const warehouseOrderSelect = {
  id: true,
  orderNo: true,
  status: true,
  orderTotal: true,
  createdAt: true,
  expectedDeliveryAt: true,
  remarks: true,
  transportName: true,
  commercialSnapshot: true,
  placedBy: true,
  placedByRepId: true,
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
  delivery: {
    select: {
      routeId: true,
      deliverySlot: true,
    },
  },
  commercialStatusEvents: {
    where: { code: CommercialStatusCode.SALES_ORDER_PUNCHED },
    select: { code: true, actorStaff: { select: { name: true } } },
  },
  items: {
    select: {
      id: true,
      qtyOrdered: true,
      unitPrice: true,
      caseWeightKgSnapshot: true,
      commercialSnapshot: true,
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
      lines: {
        select: {
          id: true,
          descriptionSnapshot: true,
          deliveredCases: true,
          unitPrice: true,
          lineTotal: true,
          taxAmount: true,
        },
      },
    },
  },
} as const;

function projectWarehouseOrder(
  order: any,
  warehouses: ResolvedWarehouse[] = STATIC_WAREHOUSES,
  routings: any[] = []
) {
  const attribution = orderAttribution(order);
  const wh = resolveWarehouse(order, warehouses, routings);

  return {
    id: order.id,
    orderNo: order.orderNo,
    status: order.status,
    orderTotal: order.orderTotal ? Number(order.orderTotal) : 0,
    createdAt: order.createdAt,
    expectedDeliveryAt: order.expectedDeliveryAt,
    remarks: order.remarks,
    transportName: order.transportName,
    commercialSnapshot: order.commercialSnapshot,
    placedBy: order.placedBy,
    placedByRepId: order.placedByRepId,
    salespersonName: attribution.salespersonName,
    salespersonPhone: attribution.salespersonPhone,
    punchedByName: attribution.punchedByName,
    punchedByRole: attribution.punchedByRole,
    punchedByLabel: attribution.punchedByLabel,
    source: attribution.source,
    creatorName: attribution.creatorName,
    warehouseCode: wh.code,
    warehouseName: wh.name,
    warehouseCity: wh.city,
    warehouse: wh,
    retailer: order.retailer ? {
      id: order.retailer.id,
      name: order.retailer.name,
      phone: order.retailer.phone,
      shopAddress: order.retailer.shopAddress,
      deliveryCity: order.retailer.deliveryCity,
      salesRepId: order.retailer.salesRepId,
      salesRep: order.retailer.salesRep ? {
        id: order.retailer.salesRep.id,
        name: order.retailer.salesRep.name,
        phone: order.retailer.salesRep.phone,
      } : null,
    } : null,
    delivery: order.delivery ? {
      routeId: order.delivery.routeId,
      deliverySlot: order.delivery.deliverySlot,
    } : null,
    items: (order.items ?? []).map((item: any) => ({
      id: item.id,
      qtyOrdered: item.qtyOrdered,
      unitPrice: Number(item.unitPrice ?? 0),
      commercialSnapshot: item.commercialSnapshot,
      caseWeightKg: Number(item.caseWeightKgSnapshot ?? (item.variant ? Number(item.variant.unitWeightKg ?? 0) * item.variant.unitsPerCase : 0)),
      variant: item.variant ? {
        unitSize: item.variant.unitSize,
        unit: item.variant.unit,
        unitsPerCase: item.variant.unitsPerCase,
        unitWeightKg: item.variant.unitWeightKg ? Number(item.variant.unitWeightKg) : undefined,
        product: item.variant.product ? { name: item.variant.product.name } : null,
      } : null,
    })),
    invoice: order.invoice ? {
      id: order.invoice.id,
      invoiceNumber: order.invoice.invoiceNumber,
      invoiceDate: order.invoice.invoiceDate,
      dueDate: order.invoice.dueDate,
      currency: order.invoice.currency ?? "INR",
      subtotal: Number(order.invoice.subtotal),
      taxTotal: Number(order.invoice.taxTotal),
      total: Number(order.invoice.total),
      outstandingAmount: Number(order.invoice.outstandingAmount),
      lines: (order.invoice.lines ?? []).map((l: any) => ({
        id: l.id,
        description: l.descriptionSnapshot,
        cases: l.deliveredCases,
        unitPrice: Number(l.unitPrice),
        lineTotal: Number(l.lineTotal),
      })),
    } : null,
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

  const warehouseCode = typeof req.query.warehouseCode === "string" && req.query.warehouseCode !== "all"
    ? req.query.warehouseCode.trim()
    : undefined;
  const salesperson = typeof req.query.salesperson === "string" && req.query.salesperson !== "all"
    ? req.query.salesperson.trim()
    : undefined;

  const [orders, dbWarehouses, dbRoutings] = await Promise.all([
    prisma.order.findMany({
      where: { status: statusFilter },
      select: warehouseOrderSelect,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.warehouse.findMany({
      where: { isActive: true },
      select: { code: true, name: true, city: true, address: true },
    }).catch(() => STATIC_WAREHOUSES),
    prisma.cityRouting.findMany({
      where: { isActive: true },
      select: { city: true, primaryWarehouseCode: true },
    }).catch(() => []),
  ]);

  const activeWarehouses = dbWarehouses.length > 0 ? dbWarehouses : STATIC_WAREHOUSES;
  const projected = orders.map((o) => projectWarehouseOrder(o, activeWarehouses, dbRoutings));

  let filtered = warehouseCode
    ? projected.filter((o) => o.warehouseCode.toLowerCase() === warehouseCode.toLowerCase())
    : projected;

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

  res.json({ orders: filtered, warehouses: activeWarehouses });
});

router.get("/warehouse-orders/routes", async (_req, res) => {
  const configuredRoutes = process.env.DELIVERY_ROUTES
    ? process.env.DELIVERY_ROUTES.split(",").map((r) => r.trim()).filter(Boolean)
    : [
        "ROUTE-INDORE-CENTRAL",
        "ROUTE-MALWAMILL-PATNIPURA",
        "ROUTE-VIJAYNAGAR-SCHEME78",
        "ROUTE-EXPRESS",
      ];

  const dbWarehouses = await prisma.warehouse.findMany({
    where: { isActive: true },
    select: { code: true, name: true, city: true, address: true },
  }).catch(() => STATIC_WAREHOUSES);

  const activeWarehouses = dbWarehouses.length > 0 ? dbWarehouses : STATIC_WAREHOUSES;

  try {
    const pastDeliveries = await prisma.delivery.findMany({
      where: { routeId: { not: null } },
      select: { routeId: true },
      distinct: ["routeId"],
      take: 20,
    });
    const discoveredRoutes = pastDeliveries.map((d) => d.routeId).filter(Boolean) as string[];
    const merged = Array.from(new Set([...configuredRoutes, ...discoveredRoutes]));

    res.json({
      routes: merged,
      defaultRoute: configuredRoutes[0] ?? "ROUTE-INDORE-CENTRAL",
      warehouseCode: process.env.WAREHOUSE_CODE ?? DEFAULT_WAREHOUSE_CODE,
      warehouseCity: process.env.WAREHOUSE_CITY ?? "Indore",
      warehouses: activeWarehouses,
    });
  } catch {
    res.json({
      routes: configuredRoutes,
      defaultRoute: configuredRoutes[0] ?? "ROUTE-INDORE-CENTRAL",
      warehouseCode: process.env.WAREHOUSE_CODE ?? DEFAULT_WAREHOUSE_CODE,
      warehouseCity: process.env.WAREHOUSE_CITY ?? "Indore",
      warehouses: activeWarehouses,
    });
  }
});

router.get("/warehouse-orders/:id", async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, status: { in: allEligibleStatuses } },
    select: warehouseOrderSelect,
  });
  if (!order) return res.status(404).json({ error: "Order not found" });

  const [dbWarehouses, dbRoutings] = await Promise.all([
    prisma.warehouse.findMany({
      where: { isActive: true },
      select: { code: true, name: true, city: true, address: true },
    }).catch(() => STATIC_WAREHOUSES),
    prisma.cityRouting.findMany({
      where: { isActive: true },
      select: { city: true, primaryWarehouseCode: true },
    }).catch(() => []),
  ]);

  res.json({ order: projectWarehouseOrder(order, dbWarehouses, dbRoutings) });
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

router.get("/warehouse-orders/:id/invoice-pdf", async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      retailer: true,
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
