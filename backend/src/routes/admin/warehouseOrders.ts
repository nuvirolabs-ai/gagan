import { Router } from "express";
import { CommercialStatusCode, OrderStatus } from "@prisma/client";
import { z } from "zod";
import { requireAnyAdminPermission, AdminRequest } from "../../lib/adminAuth";
import { prisma } from "../../lib/prisma";
import { Permissions } from "../../modules/identity/roleCatalog";
import { transitionOrder } from "./orders";
import { assignCompanyDispatch, companyOrderSummary, CompanySalesOrderError, dispatchAssignmentSchema } from "../../modules/orders/companySalesOrders";
import { ensureKycApprovedForDispatch, KycGateError } from "../../modules/kyc/kycGate";
import { createInvoiceForDelivery, InvoiceCreationError } from "../../modules/invoicing/invoiceService";
import { orderInvoiceSummary, sendOrderInvoicePdf } from "../../modules/invoicing/orderInvoicePdf";
import { DEFAULT_WAREHOUSE_CODE } from "../../modules/inventory/inventoryService";
import { deriveCurrentCommercialStatus } from "../../modules/commercialStatus/statusService";
import {
  orderAttribution,
  resolveWarehouse,
  STATIC_WAREHOUSES,
  ResolvedWarehouse,
  enrichOrderItems,
} from "../../modules/orders/orderAttribution";

const router = Router();
const defaultStatuses: OrderStatus[] = ["confirmed", "packed"];
const allEligibleStatuses: OrderStatus[] = ["confirmed", "packed", "out_for_delivery", "delivered"];

const warehouseOrderSelect = {
  companySalesOrders: companyOrderSummary,
  id: true,
  orderNo: true,
  status: true,
  isOnHold: true,
  holdReason: true,
  orderTotal: true,
  createdAt: true,
  expectedDeliveryAt: true,
  remarks: true,
  transportName: true,
  commercialSnapshot: true,
  placedBy: true,
  placedByRepId: true,
  cancellationRequestedAt: true,
  cancellationReason: true,
  cancellationRequestedByRepId: true,
  cancellationStatus: true,
  cancellationDecisionNote: true,
  cancellationDecidedAt: true,
  proposalOrderIntent: {
    select: {
      id: true,
      proposalId: true,
    },
  },
  retailer: {
    select: {
      id: true,
      name: true,
      phone: true,
      shopAddress: true,
      deliveryCity: true,
      salesRepId: true,
      createdAt: true,
      status: true,
      salesRep: { select: { id: true, name: true, phone: true } },
      kycCase: {
        select: {
          id: true,
          status: true,
        },
      },
      proposal: {
        select: {
          id: true,
          status: true,
        },
      },
      orders: {
        select: {
          id: true,
          orderNo: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" as const },
      },
      _count: {
        select: { orders: true },
      },
    },
  },
  delivery: {
    select: {
      routeId: true,
      deliverySlot: true,
    },
  },
  commercialStatusEvents: {
    orderBy: { createdAt: "desc" as const },
    take: 10,
    select: { code: true, createdAt: true, actorStaff: { select: { name: true } } },
  },
  items: {
    select: {
      id: true,
      qtyOrdered: true,
      companySalesOrderId: true,
      unitPrice: true,
      caseWeightKgSnapshot: true,
      commercialSnapshot: true,
      variant: {
        select: {
          id: true,
          unitSize: true,
          unit: true,
          unitsPerCase: true,
          unitWeightKg: true,
          listRate: true,
          listRateBasis: true,
          catalogIdentityMasterPack: true,
          product: { select: { name: true, category: true } },
          priceList: { select: { price: true, rateBasis: true, tierId: true } },
        },
      },
    },
  },
  invoices: {
    orderBy: { invoiceNumber: "asc" },
    select: {
      ...orderInvoiceSummary,
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

function computeIsNewRetailer(order: any): boolean {
  if (!order.retailer) return false;

  const retailerStatus = order.retailer.status;
  const kycStatus = order.retailer.kycCase?.status;
  const proposalStatus = order.retailer.proposal?.status;

  // 1. Verified retailers can NEVER be a new retailer
  const isVerified = retailerStatus === "active" || kycStatus === "approved";
  if (isVerified) return false;

  // 2. Verification or KYC must be pending from backend
  const isPendingVerification =
    retailerStatus === "pending_kyc" ||
    kycStatus === "draft" ||
    kycStatus === "submitted" ||
    kycStatus === "in_review" ||
    proposalStatus === "pending" ||
    order.commercialStatus === "ACCOUNT_OPENED";

  if (!isPendingVerification) return false;

  // 3. Must be onboarded via salesperson
  const onboardedViaSalesperson = Boolean(
    order.retailer.salesRepId ||
    order.retailer.salesRep ||
    order.placedBy === "rep" ||
    order.placedByRepId ||
    order.proposalOrderIntent ||
    order.retailer.proposal
  );
  if (!onboardedViaSalesperson) return false;

  // 4. Who never gave any order also before (this must be their first order on the platform)
  const allRetailerOrders = (order.retailer.orders ?? []) as Array<{ id: string; orderNo?: number; createdAt: Date | string }>;
  if (allRetailerOrders.length > 0) {
    const currentOrderTime = new Date(order.createdAt).getTime();
    const hasEarlierOrder = allRetailerOrders.some(
      (o) =>
        o.id !== order.id &&
        (new Date(o.createdAt).getTime() < currentOrderTime ||
          (new Date(o.createdAt).getTime() === currentOrderTime && (o.orderNo ?? 0) < (order.orderNo ?? 0)))
    );
    if (hasEarlierOrder) return false;
  }

  return true;
}

function projectWarehouseOrder(
  order: any,
  warehouses: ResolvedWarehouse[] = STATIC_WAREHOUSES,
  routings: any[] = []
) {
  const attribution = orderAttribution(order);
  const wh = resolveWarehouse(order, warehouses, routings);
  const isNewRetailer = computeIsNewRetailer(order);

  const invoices = (order.invoices ?? []).map((invoice: any) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      firmInvoiceNumber: invoice.firmInvoiceNumber,
      sellingEntity: invoice.sellingEntity,
      companySalesOrderId: invoice.companySalesOrderId,
      status: invoice.status,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      currency: invoice.currency ?? "INR",
      subtotal: Number(invoice.subtotal),
      taxTotal: Number(invoice.taxTotal),
      total: Number(invoice.total),
      outstandingAmount: Number(invoice.outstandingAmount),
      lines: (invoice.lines ?? []).map((l: any) => ({
        id: l.id,
        description: l.descriptionSnapshot,
        cases: l.deliveredCases,
        unitPrice: Number(l.unitPrice),
        lineTotal: Number(l.lineTotal),
      })),
    }));

  return {
    id: order.id,
    orderNo: order.orderNo,
    status: order.status,
    isOnHold: Boolean(order.isOnHold),
    holdReason: order.holdReason ?? null,
    commercialStatus: deriveCurrentCommercialStatus(order.commercialStatusEvents ?? [], Boolean(order.isOnHold), order.status),
    commercialStatusEvents: order.commercialStatusEvents ?? [],
    orderTotal: order.orderTotal ? Number(order.orderTotal) : 0,
    createdAt: order.createdAt,
    expectedDeliveryAt: order.expectedDeliveryAt,
    remarks: order.remarks,
    transportName: order.transportName,
    commercialSnapshot: order.commercialSnapshot,
    companySalesOrders: order.companySalesOrders ?? [],
    placedBy: order.placedBy,
    placedByRepId: order.placedByRepId,
    cancellationRequestedAt: order.cancellationRequestedAt,
    cancellationReason: order.cancellationReason,
    cancellationRequestedByRepId: order.cancellationRequestedByRepId,
    cancellationStatus: order.cancellationStatus,
    cancellationDecisionNote: order.cancellationDecisionNote,
    cancellationDecidedAt: order.cancellationDecidedAt,
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
    isNewRetailer,
    retailer: order.retailer ? {
      id: order.retailer.id,
      name: order.retailer.name,
      phone: order.retailer.phone,
      shopAddress: order.retailer.shopAddress,
      deliveryCity: order.retailer.deliveryCity,
      salesRepId: order.retailer.salesRepId,
      createdAt: order.retailer.createdAt,
      status: order.retailer.status,
      isVerified: order.retailer.status === "active" || order.retailer.kycCase?.status === "approved",
      isPendingVerification:
        order.retailer.status === "pending_kyc" ||
        ["draft", "submitted", "in_review"].includes(order.retailer.kycCase?.status) ||
        order.retailer.proposal?.status === "pending",
      ordersCount: order.retailer._count?.orders ?? 0,
      isNew: isNewRetailer,
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
    items: enrichOrderItems(order.items ?? [], order),
    invoices,
    invoice: invoices.length === 1 ? invoices[0] : null,
  };
}

router.use(
  "/warehouse-orders",
  requireAnyAdminPermission(Permissions.ORDER_WAREHOUSE_PROCESS, Permissions.DISPATCH_EXECUTE)
);

router.get("/warehouse-orders", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
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
      take: 1000,
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
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
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

const rejectOrderSchema = z.object({
  reason: z.string().trim().min(1, "Rejection remark is required").max(500),
});

router.post("/warehouse-orders/:id/reject", async (req: AdminRequest, res) => {
  const parsed = rejectOrderSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Rejection remark is required", details: parsed.error.flatten() });
  }

  const orderId = req.params.id;
  const reason = parsed.data.reason;
  const actorStaffId = req.staffAuth?.staffId ?? null;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return res.status(404).json({ error: "Order not found" });

  if (order.status === "rejected") {
    return res.status(400).json({ error: "Order is already rejected" });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.dispatchAuthorization.updateMany({
      where: { orderId, status: "active" },
      data: { status: "invalidated", invalidatedAt: new Date() },
    });

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "rejected",
        cancellationReason: reason,
        cancellationDecisionNote: reason,
        cancellationDecidedAt: new Date(),
        cancellationDecidedByStaffId: actorStaffId ?? undefined,
        remarks: order.remarks ? `${order.remarks} | Rejected: ${reason}` : `Rejected: ${reason}`,
      },
    });

    await tx.auditEvent.create({
      data: {
        actorStaffId,
        action: "order.rejected",
        subjectType: "order",
        subjectId: orderId,
        metadata: { from: order.status, to: "rejected", reason },
      },
    });

    return tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: warehouseOrderSelect,
    });
  });

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

  return res.json({
    order: projectWarehouseOrder(updated, dbWarehouses, dbRoutings),
    message: "Order has been rejected successfully",
  });
});

router.post("/warehouse-orders/:id/dispatch", async (req: AdminRequest, res) => {
  const parsed = dispatchAssignmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    select: { id: true, status: true, retailerId: true, expectedDeliveryAt: true, companySalesOrders: { select: { id: true } } },
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
    where: { orderId: order.id, status: "active", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    select: { id: true },
  });
  if (order.companySalesOrders.length && !authorization) {
    return res.status(409).json({ error: "dispatch_authorization_required" });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const claimed = await tx.order.updateMany({
      where: { id: order.id, status: "packed" },
      data: { status: "out_for_delivery", expectedDeliveryAt: slot ?? order.expectedDeliveryAt },
    });
    if (claimed.count !== 1) return null;
    if (authorization) {
      const consumed = await tx.dispatchAuthorization.updateMany({
        where: { id: authorization.id, status: "active", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        data: { status: "used", usedAt: now },
      });
      if (consumed.count !== 1 && order.companySalesOrders.length) throw new CompanySalesOrderError("dispatch_authorization_expired");
    }
    const routeId = await assignCompanyDispatch(tx, order.id, parsed.data, now);
    await tx.delivery.upsert({
      where: { orderId: order.id },
      update: { routeId, deliverySlot: slot },
      create: { orderId: order.id, routeId, deliverySlot: slot },
    });

    await tx.auditEvent.create({
      data: {
        actorStaffId: req.staffAuth?.staffId ?? null,
        action: "dispatch.assigned",
        subjectType: "order",
        subjectId: order.id,
        metadata: { from: "packed", to: "out_for_delivery", routeId, companyRoutes: parsed.data.companyRoutes ?? [] },
      },
    });

    return tx.order.findUniqueOrThrow({
      where: { id: order.id },
      select: warehouseOrderSelect,
    });
  }).catch(error => {
    if (error instanceof CompanySalesOrderError) return error;
    throw error;
  });

  if (updated instanceof CompanySalesOrderError) return res.status(409).json({ error: updated.code });
  if (!updated) return res.status(409).json({ error: "order_transition_conflict" });
  res.json({ order: projectWarehouseOrder(updated) });
});

const podSchema = z.object({
  podType: z.enum(["photo", "otp", "signature"]),
  transportationAmount: z.number().min(0).optional(),
  transportationEntity: z.enum(["jain_traders", "padam_international"]).optional(),
  companySalesOrderId: z.string().trim().min(1).max(100).optional(),
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
      idempotencyKey: parsed.data.companySalesOrderId ? `delivery:${order.id}:${parsed.data.companySalesOrderId}` : `delivery:${order.id}`,
      companySalesOrderId: parsed.data.companySalesOrderId,
      transportationAmount: parsed.data.transportationAmount,
      transportationEntity: parsed.data.transportationEntity,
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

    const projected = projectWarehouseOrder(updated);
    res.json({
      order: projected,
      invoices: projected.invoices,
      invoiceIds: invoice.invoices.map(document => document.id),
      invoiceId: invoice.invoices.length === 1 ? invoice.invoices[0].id : null,
    });
  } catch (error) {
    if (error instanceof InvoiceCreationError) {
      return res.status(error.code.endsWith("_not_found") ? 404 : 409).json({ error: error.code });
    }
    throw error;
  }
});

router.get("/warehouse-orders/:id/invoice-pdf", sendOrderInvoicePdf);

export default router;
