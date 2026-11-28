import { Router } from "express";
import { z } from "zod";
import { CommercialStatusCode, OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AdminRequest, requireAdmin, requireAnyAdminPermission } from "../../lib/adminAuth";
import { Permissions } from "../../modules/identity/roleCatalog";
import {
  createInvoiceForDelivery,
  InvoiceCreationError,
} from "../../modules/invoicing/invoiceService";
import { enqueueSalesOrder } from "../../lib/sap/outbox";
import { orderInvoiceSummary, sendOrderInvoicePdf } from "../../modules/invoicing/orderInvoicePdf";
import { ensureKycApprovedForDispatch, KycGateError } from "../../modules/kyc/kycGate";
import { assignCompanyDispatch, companyOrderSummary, CompanySalesOrderError, dispatchAssignmentSchema } from "../../modules/orders/companySalesOrders";
import {
  attributeOrders,
  attributeOrdersWithWarehouses,
} from "../../modules/orders/orderAttribution";

const router = Router();
router.use(
  ["/orders", "/dispatch"],
  requireAnyAdminPermission(
    Permissions.STAFF_MANAGE,
    Permissions.APPROVAL_SECOND_INVOICE,
    Permissions.ORDER_WAREHOUSE_PROCESS,
    Permissions.COLLECTION_CONFIRM
  )
);
class OrderTransitionConflict extends Error {}

// Orders move forward only, one step at a time. Anything else is a bad request
// rather than a silent no-op, so a double-clicked button can't skip a stage.
const ALLOWED_NEXT: Record<OrderStatus, OrderStatus[]> = {
  placed: ["confirmed", "rejected"],
  confirmed: ["packed", "rejected"],
  packed: ["out_for_delivery", "rejected"],
  out_for_delivery: ["delivered", "rejected"],
  delivered: [],
  rejected: [],
};

function assertTransition(from: OrderStatus, to: OrderStatus): string | null {
  if (from === to) return `Order is already ${to}`;
  if (!ALLOWED_NEXT[from].includes(to)) return `Cannot move an order from ${from} to ${to}`;
  return null;
}

const orderInclude = {
  companySalesOrders: companyOrderSummary,
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
  invoices: {
    orderBy: { invoiceNumber: "asc" },
    select: orderInvoiceSummary,
  },
  commercialStatusEvents: {
    where: { code: CommercialStatusCode.SALES_ORDER_PUNCHED },
    select: { code: true, actorStaff: { select: { name: true } } },
  },
  cancellationRequestedByRep: { select: { id: true, name: true, phone: true } },
  cancellationDecidedByStaff: { select: { id: true, name: true } },
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
  const isCancellationQueue = status === "cancellation_requests" || req.query.cancellationStatus === "pending";
  const valid = status && (Object.keys(ALLOWED_NEXT) as string[]).includes(status);
  const warehouseCode = typeof req.query.warehouseCode === "string" && req.query.warehouseCode !== "all"
    ? req.query.warehouseCode.trim()
    : undefined;
  const salesperson = typeof req.query.salesperson === "string" && req.query.salesperson !== "all"
    ? req.query.salesperson.trim()
    : undefined;

  const orders = await prisma.order.findMany({
    where: isCancellationQueue
      ? { cancellationStatus: "pending" }
      : valid
        ? { status: status as OrderStatus }
        : undefined,
    include: orderInclude,
    orderBy: { createdAt: "desc" },
    take: 1000,
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

router.get("/orders/counts", async (req, res) => {
  const [groups, pendingCancellations] = await Promise.all([
    prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { orderTotal: true },
    }),
    prisma.order.aggregate({
      where: { cancellationStatus: "pending" },
      _count: { _all: true },
      _sum: { orderTotal: true },
    }),
  ]);

  const counts: Record<string, { count: number; value: number }> = {};
  for (const key of Object.keys(ALLOWED_NEXT)) {
    counts[key] = { count: 0, value: 0 };
  }
  for (const g of groups) {
    counts[g.status] = {
      count: g._count._all,
      value: Number(g._sum.orderTotal ?? 0),
    };
  }

  counts["cancellation_requests"] = {
    count: pendingCancellations._count._all,
    value: Number(pendingCancellations._sum.orderTotal ?? 0),
  };

  const { warehouses } = await attributeOrdersWithWarehouses([]);
  res.json({ counts, warehouses });
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
    if (to === "rejected") {
      await tx.dispatchAuthorization.updateMany({
        where: { orderId, status: "active" },
        data: { status: "invalidated", invalidatedAt: new Date() },
      });
    }

    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: {
        status: to,
        ...(to === "rejected" && order.cancellationStatus === "pending"
          ? {
              cancellationStatus: "approved",
              cancellationDecidedAt: new Date(),
              cancellationDecidedByStaffId: actorStaffId ?? undefined,
            }
          : {}),
      },
    });
    if(claimed.count!==1) return null;
    if (to === "packed") {
      await enqueueSalesOrder(tx, orderId);
    }
    await tx.auditEvent.create({
      data: {
        actorStaffId,
        action: `order.${to}`,
        subjectType: "order",
        subjectId: orderId,
        metadata: { from: order.status, to },
      },
    });
    return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
  }).catch(error => {
    if (error instanceof CompanySalesOrderError) return error;
    throw error;
  });
  if (updated instanceof CompanySalesOrderError) return res.status(409).json({ error: updated.code });
  if(!updated) return res.status(409).json({error:"order_transition_conflict"});
  const [attributedOrder] = await attributeOrders([updated]);
  res.json({ order: projectOrder(attributedOrder) });
}

router.post("/orders/:id/approve", (req: AdminRequest, res) => transitionOrder(req.params.id, "confirmed", res, req.staffAuth?.staffId ?? null));
router.post("/orders/:id/reject", (req: AdminRequest, res) => transitionOrder(req.params.id, "rejected", res, req.staffAuth?.staffId ?? null));
router.post("/orders/:id/pack", (req: AdminRequest, res) => transitionOrder(req.params.id, "packed", res, req.staffAuth?.staffId ?? null));

const orderEditSchema = z.object({
  remarks: z.string().trim().max(1000).optional(),
  freightAmount: z.number().min(0).optional(),
  items: z.array(
    z.object({
      orderItemId: z.string().optional(),
      variantId: z.string().optional(),
      qtyOrdered: z.number().int().positive(),
      unitPrice: z.number().positive().optional(),
    })
  ).optional(),
});

router.put(
  "/orders/:id",
  requireAnyAdminPermission(
    Permissions.STAFF_MANAGE,
    Permissions.COLLECTION_CONFIRM,
    Permissions.APPROVAL_SECOND_INVOICE,
    Permissions.FINANCIAL_CORRECT
  ),
  async (req: AdminRequest, res) => {
    const parsed = orderEditSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error });
    const orderId = req.params.id;
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: orderInclude,
      });
      if (!order) return { status: 404, error: "Order not found" } as const;

      const hasFinancialChanges = Boolean(parsed.data.items?.length) || parsed.data.freightAmount !== undefined;
      if (hasFinancialChanges && (order.commercialSnapshot !== null || order.invoices.length > 0)) {
        return { status: 409, error: "accepted_order_amendment_required" } as const;
      }
      if (!hasFinancialChanges) {
        const orderWithRemarks = parsed.data.remarks === undefined ? order : await tx.order.update({
          where: { id: order.id },
          data: { remarks: parsed.data.remarks },
          include: orderInclude,
        });
        return { order: orderWithRemarks } as const;
      }

      let newOrderTotal = Number(order.orderTotal);
      const snap = ((order.commercialSnapshot as any) || {}) as Record<string, any>;

      if (parsed.data.items && parsed.data.items.length > 0) {
        let subtotal = 0;

        for (const item of parsed.data.items) {
          const existingItem = item.orderItemId
            ? order.items.find((it) => it.id === item.orderItemId)
            : item.variantId
            ? order.items.find((it) => it.variantId === item.variantId)
            : undefined;

          if (existingItem) {
            const price = item.unitPrice ?? Number(existingItem.unitPrice);
            const lineTotal = item.qtyOrdered * price;
            await tx.orderItem.update({
              where: { id: existingItem.id },
              data: {
                qtyOrdered: item.qtyOrdered,
                unitPrice: price,
              },
            });
            subtotal += lineTotal;
          }
        }

        const freightAmt = parsed.data.freightAmount !== undefined
          ? parsed.data.freightAmount
          : Number(snap.freight?.amount ?? 0);

        const prevSubtotal = Number(snap.subtotal ?? (Number(order.orderTotal) - Number(snap.freight?.amount ?? 0)));
        const gstRatio = prevSubtotal > 0 ? Number(snap.gstTotal ?? 0) / prevSubtotal : 0.05;
        const totalGst = Math.round(subtotal * gstRatio * 100) / 100;

        newOrderTotal = Math.round((subtotal + totalGst + freightAmt) * 100) / 100;

        if (snap.lines && Array.isArray(snap.lines)) {
          for (const snapLine of snap.lines) {
            const matchingEdit = parsed.data.items.find(
              (it) => it.variantId === snapLine.variantId || (it.orderItemId && order.items.find((oi) => oi.id === it.orderItemId)?.variantId === snapLine.variantId)
            );
            if (matchingEdit) {
              snapLine.cases = matchingEdit.qtyOrdered;
              if (matchingEdit.unitPrice) snapLine.rate = matchingEdit.unitPrice;
              snapLine.base = Math.round(matchingEdit.qtyOrdered * (snapLine.rate || 0) * 100) / 100;
              snapLine.total = Math.round((snapLine.base + (snapLine.gst || 0)) * 100) / 100;
            }
          }
        }
        snap.subtotal = subtotal;
        snap.gstTotal = totalGst;
        if (snap.freight) snap.freight.amount = freightAmt;
        snap.total = newOrderTotal;
      } else if (parsed.data.freightAmount !== undefined) {
        const prevFreight = Number(snap.freight?.amount ?? 0);
        newOrderTotal = Math.round((newOrderTotal - prevFreight + parsed.data.freightAmount) * 100) / 100;
        if (snap.freight) snap.freight.amount = parsed.data.freightAmount;
        snap.total = newOrderTotal;
      }

      if (parsed.data.remarks !== undefined) {
        snap.accountingRemarks = parsed.data.remarks;
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          orderTotal: newOrderTotal,
          ...(parsed.data.remarks !== undefined ? { remarks: parsed.data.remarks } : {}),
          commercialSnapshot: snap,
        },
        include: orderInclude,
      });

      return { order: updated } as const;
    });
    if ("error" in result) return res.status(result.status!).json({ error: result.error });
    const updated = result.order;
    const { attributed } = await attributeOrdersWithWarehouses([updated]);
    res.json({ success: true, order: attributed[0] });
  }
);

const accountingNotes = z.string().trim().max(1000).optional();
const accountingClosePermissions = requireAnyAdminPermission(
  Permissions.STAFF_MANAGE,
  Permissions.COLLECTION_CONFIRM,
  Permissions.FINANCIAL_CORRECT
);

async function closeBilledOrders(ids: string[], actorStaffId?: string, notes?: string) {
  return prisma.$transaction(async tx => {
    const orderIds = [...new Set(ids)].sort();
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Order" WHERE "id" IN (${Prisma.join(orderIds)}) ORDER BY "id" FOR UPDATE
    `;
    if (locked.length !== orderIds.length) return { error: "order_not_found", status: 404 } as const;

    const billed = await tx.order.count({
      where: { id: { in: orderIds }, status: "delivered", invoices: { some: { status: { not: "voided" } } } },
    });
    if (billed !== orderIds.length) return { error: "accounting_requires_issued_invoice", status: 409 } as const;

    const actor = actorStaffId
      ? await tx.staffUser.findUnique({ where: { id: actorStaffId }, select: { name: true } })
      : null;
    const prior = await tx.auditEvent.findMany({
      where: { action: "order.accounting_closed", subjectType: "order", subjectId: { in: orderIds } },
      select: { subjectId: true },
    });
    const alreadyClosed = new Set(prior.map(event => event.subjectId));
    const pending = orderIds.filter(id => !alreadyClosed.has(id));
    if (pending.length) {
      await tx.auditEvent.createMany({
        data: pending.map(subjectId => ({
          action: "order.accounting_closed", subjectType: "order", subjectId, actorStaffId,
          metadata: { closedBy: actor?.name ?? null, notes: notes ?? null },
        })),
      });
    }
    return { count: orderIds.length } as const;
  });
}

router.post("/orders/:id/close-accounting", accountingClosePermissions, async (req: AdminRequest, res) => {
  const parsed = z.object({ notes: accountingNotes }).safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  const result = await closeBilledOrders([req.params.id], req.staffAuth?.staffId, parsed.data.notes);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({ success: true, count: result.count });
});

router.post("/orders/bulk-close-accounting", accountingClosePermissions, async (req: AdminRequest, res) => {
  const parsed = z.object({ orderIds: z.array(z.string().min(1)).min(1).max(300), notes: accountingNotes }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  const result = await closeBilledOrders(parsed.data.orderIds, req.staffAuth?.staffId, parsed.data.notes);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({ success: true, count: result.count });
});

const cancellationReviewSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

router.post("/orders/:id/cancellation/approve", async (req: AdminRequest, res) => {
  const parsed = cancellationReviewSchema.safeParse(req.body ?? {});
  const orderId = req.params.id;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: orderInclude,
  });

  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.cancellationStatus !== "pending") {
    return res.status(400).json({ error: "No pending cancellation request for this order" });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.dispatchAuthorization.updateMany({
      where: { orderId, status: "active" },
      data: { status: "invalidated", invalidatedAt: new Date() },
    });

    const claimed = await tx.order.updateMany({
      where: { id: orderId, cancellationStatus: "pending" },
      data: {
        status: "rejected",
        cancellationStatus: "approved",
        cancellationDecisionNote: (parsed.success && parsed.data.note) ? parsed.data.note : "Approved by dispatch coordinator",
        cancellationDecidedAt: new Date(),
        cancellationDecidedByStaffId: req.staffAuth?.staffId ?? null,
      },
    });

    if (claimed.count !== 1) return null;

    const next = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: orderInclude,
    });

    await tx.auditEvent.create({
      data: {
        actorStaffId: req.staffAuth?.staffId ?? null,
        action: "order.cancellation_approved",
        subjectType: "order",
        subjectId: orderId,
        metadata: {
          from: order.status,
          to: "rejected",
          cancellationReason: order.cancellationReason,
          decisionNote: (parsed.success && parsed.data.note) ? parsed.data.note : null,
          orderRef: `GGN-${String(order.orderNo).padStart(8, "0")}`,
        },
      },
    });

    return next;
  });

  if (!updated) return res.status(409).json({ error: "cancellation_review_conflict" });
  const [attributedOrder] = await attributeOrders([updated]);
  res.json({ ok: true, order: attributedOrder });
});

const cancellationRejectSchema = z.object({
  note: z.string().trim().min(3, "Please provide a reason of at least 3 characters").max(500),
});

router.post("/orders/:id/cancellation/reject", async (req: AdminRequest, res) => {
  const parsed = cancellationRejectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid note" });
  }

  const orderId = req.params.id;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: orderInclude,
  });

  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.cancellationStatus !== "pending") {
    return res.status(400).json({ error: "No pending cancellation request for this order" });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: orderId, cancellationStatus: "pending" },
      data: {
        cancellationStatus: "declined",
        cancellationDecisionNote: parsed.data.note,
        cancellationDecidedAt: new Date(),
        cancellationDecidedByStaffId: req.staffAuth?.staffId ?? null,
      },
    });

    if (claimed.count !== 1) return null;

    const next = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: orderInclude,
    });

    await tx.auditEvent.create({
      data: {
        actorStaffId: req.staffAuth?.staffId ?? null,
        action: "order.cancellation_declined",
        subjectType: "order",
        subjectId: orderId,
        metadata: {
          cancellationReason: order.cancellationReason,
          decisionNote: parsed.data.note,
          orderRef: `GGN-${String(order.orderNo).padStart(8, "0")}`,
        },
      },
    });

    return next;
  });

  if (!updated) return res.status(409).json({ error: "cancellation_review_conflict" });
  const [attributedOrder] = await attributeOrders([updated]);
  res.json({ ok: true, order: attributedOrder });
});

router.post("/dispatch/:orderId/assign", async (req: AdminRequest, res) => {
  const parsed = dispatchAssignmentSchema.safeParse(req.body);
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
    where: { orderId: order.id, status: "active", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    select: { id: true },
  });
  if (!authorization) return res.status(409).json({ error: "dispatch_authorization_required" });

  const slot = parsed.data.deliverySlot ? new Date(parsed.data.deliverySlot) : null;

  const updated = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const claimed=await tx.order.updateMany({
      where:{id:order.id,status:order.status},
      data:{status:"out_for_delivery",expectedDeliveryAt:slot??order.expectedDeliveryAt},
    });
    if(claimed.count!==1) throw new OrderTransitionConflict("order_transition_conflict");
    const consumed = await tx.dispatchAuthorization.updateMany({
      where: { id: authorization.id, status: "active", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      data: { status: "used", usedAt: now },
    });
    if (consumed.count !== 1) throw new OrderTransitionConflict("dispatch_authorization_expired");
    const routeId = await assignCompanyDispatch(tx, order.id, parsed.data, now);
    await tx.delivery.upsert({
      where: { orderId: order.id },
      update: { routeId, deliverySlot: slot },
      create: { orderId: order.id, routeId, deliverySlot: slot },
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
        metadata: { from:order.status,to:"out_for_delivery",routeId, companyRoutes: parsed.data.companyRoutes ?? [], authorizationId: authorization.id },
      },
    });
    return next;
  }).catch(error => {
    if (error instanceof CompanySalesOrderError) return error;
    if (error instanceof OrderTransitionConflict) return null;
    throw error;
  });

  if (updated instanceof CompanySalesOrderError) return res.status(409).json({ error: updated.code });
  if (!updated) return res.status(409).json({ error: "dispatch_authorization_expired" });

  const [attributedOrder] = await attributeOrders([updated]);
  res.json({ order: attributedOrder });
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

  if (!parsed.data.companySalesOrderId && parsed.data.items.length !== order.items.length) {
    return res.status(400).json({ error: "Every order line needs a delivery result" });
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
      include: orderInclude,
    });
    res.json({
      order: updated,
      invoices: jsonSafe(invoice.invoices),
      invoice: invoice.invoices.length === 1 ? jsonSafe(invoice.invoices[0]) : null,
      ledgerEntry: invoice.invoices.length === 1 ? jsonSafe(invoice.legacyLedgerEntry) : null,
      balanceAfter: Number(invoice.invoices.at(-1)?.ledgerEntry?.balanceAfter ?? 0),
    });
  } catch (error) {
    if (error instanceof InvoiceCreationError) {
      return res.status(error.code.endsWith("_not_found") ? 404 : 409).json({ error: error.code });
    }
    throw error;
  }
});

router.get("/orders/:id/invoice-pdf", sendOrderInvoicePdf);

export default router;
