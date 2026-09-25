import { Router } from "express";
import { z } from "zod";
import { CommercialStatusCode } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { requireAdminIdentity, AdminRequest } from "../../lib/adminAuth";
import { assignedRetailer, requireRep, RepRequest } from "../../lib/repAuth";
import { Permissions } from "../identity/roleCatalog";
import {
  CommercialStatusError,
  deriveCurrentCommercialStatus,
  internalStatusForOrder,
  internalStatusForRetailer,
  requestRateApproval,
  recordOrderApprovalRequest,
  setOrderHold,
  releaseOrderHold,
  serializeCommercialStatusEvent,
  statusLabel,
} from "./statusService";

const router = Router();

function hasPermission(permissions: string[], permission: string) {
  return permissions.includes(permission) || permissions.includes(Permissions.STAFF_MANAGE);
}

function denyUnless(req: { staffAuth?: { permissions: string[] }; permissions?: string[] }, res: any, permission: string) {
  if (!hasPermission(req.staffAuth?.permissions ?? req.permissions ?? [], permission)) {
    res.status(403).json({ error: "permission_required", permission });
    return false;
  }
  return true;
}

function sendError(error: unknown, res: any) {
  if (error instanceof CommercialStatusError) return res.status(error.status).json({ error: error.code, details: error.details });
  throw error;
}

const eventInclude = {
  actorStaff: { select: { id: true, name: true } },
} as const;

router.get("/rep/commercial-status/orders/:id", requireRep, async (req: RepRequest, res) => {
  if (!denyUnless(req, res, Permissions.COMMERCIAL_STATUS_VIEW)) return;
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, retailer: { salesRepId: req.repId } },
    select: { id: true },
  });
  if (!order) return res.status(404).json({ error: "order_not_found" });
  try {
    res.json({ status: await internalStatusForOrder(order.id) });
  } catch (error) {
    return sendError(error, res);
  }
});

router.get("/rep/commercial-status/retailers/:id", requireRep, async (req: RepRequest, res) => {
  if (!denyUnless(req, res, Permissions.COMMERCIAL_STATUS_VIEW)) return;
  if (!await assignedRetailer(req.repId!, req.params.id)) return res.status(404).json({ error: "retailer_not_found" });
  try {
    res.json({ status: await internalStatusForRetailer(req.params.id) });
  } catch (error) {
    return sendError(error, res);
  }
});

router.post("/rep/commercial-status/quotes/:id/rate-approval", requireRep, async (req: RepRequest, res) => {
  if (!denyUnless(req, res, Permissions.COMMERCIAL_RATE_APPROVAL_REQUEST)) return;
  const body = z.object({ reason: z.string().trim().max(500).optional(), reference: z.string().trim().max(200).optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_commercial_status_input", details: body.error.flatten() });
  const quote = await prisma.commercialQuote.findUnique({ where: { id: req.params.id }, select: { retailerId: true } });
  if (!quote || !await assignedRetailer(req.repId!, quote.retailerId)) return res.status(404).json({ error: "commercial_quote_not_found" });
  try {
    const event = await requestRateApproval({ quoteId: req.params.id, retailerId: quote.retailerId, actorStaffId: req.staffId!, ...body.data });
    res.status(201).json({ event: { ...event, label: statusLabel(event.code) } });
  } catch (error) {
    return sendError(error, res);
  }
});

router.post("/rep/commercial-status/orders/:id/order-approval", requireRep, async (req: RepRequest, res) => {
  if (!denyUnless(req, res, Permissions.COMMERCIAL_ORDER_APPROVAL_REQUEST)) return;
  const order = await prisma.order.findFirst({ where: { id: req.params.id, retailer: { salesRepId: req.repId } }, select: { id: true, retailerId: true } });
  if (!order) return res.status(404).json({ error: "order_not_found" });
  try {
    const event = await recordOrderApprovalRequest({ orderId: order.id, retailerId: order.retailerId, actorStaffId: req.staffId });
    res.status(201).json({ event: { ...event, label: statusLabel(event.code) } });
  } catch (error) {
    return sendError(error, res);
  }
});

router.get("/admin/commercial-status/orders", requireAdminIdentity, async (req: AdminRequest, res) => {
  if (!denyUnless(req, res, Permissions.COMMERCIAL_STATUS_VIEW)) return;
  const code = typeof req.query.code === "string" ? req.query.code : undefined;
  if (code && !Object.values(CommercialStatusCode).includes(code as CommercialStatusCode)) {
    return res.status(400).json({ error: "invalid_commercial_status_code" });
  }
  const orders = await prisma.order.findMany({
    where: code ? { commercialStatusEvents: { some: { code: code as CommercialStatusCode } } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      orderNo: true,
      retailerId: true,
      orderTotal: true,
      status: true,
      isOnHold: true,
      holdReason: true,
      heldAt: true,
      retailer: { select: { id: true, name: true } },
      commercialStatusEvents: { orderBy: { createdAt: "desc" }, include: eventInclude },
    },
  });
  res.json({
    orders: orders.map((order) => ({
      ...order,
      internalStatus: {
        currentCode: deriveCurrentCommercialStatus(order.commercialStatusEvents, order.isOnHold),
        currentLabel: (() => {
          const current = deriveCurrentCommercialStatus(order.commercialStatusEvents, order.isOnHold);
          return current ? statusLabel(current) : null;
        })(),
        isOnHold: order.isOnHold,
        holdReason: order.holdReason,
        heldAt: order.heldAt,
        timeline: order.commercialStatusEvents.map(serializeCommercialStatusEvent),
      },
    })),
  });
});

router.get("/admin/commercial-status/orders/:id", requireAdminIdentity, async (req: AdminRequest, res) => {
  if (!denyUnless(req, res, Permissions.COMMERCIAL_STATUS_VIEW)) return;
  try {
    res.json({ status: await internalStatusForOrder(req.params.id) });
  } catch (error) {
    return sendError(error, res);
  }
});

router.post("/admin/commercial-status/orders/:id/hold", requireAdminIdentity, async (req: AdminRequest, res) => {
  if (!denyUnless(req, res, Permissions.COMMERCIAL_ORDER_HOLD_MANAGE)) return;
  const body = z.object({ reason: z.string().trim().min(3).max(240) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "hold_reason_required", details: body.error.flatten() });
  try {
    res.json({ status: await setOrderHold({ orderId: req.params.id, actorStaffId: req.staffAuth!.staffId, reason: body.data.reason, idempotencyKey: req.header("idempotency-key") ?? undefined }) });
  } catch (error) {
    return sendError(error, res);
  }
});

router.post("/admin/commercial-status/orders/:id/release-hold", requireAdminIdentity, async (req: AdminRequest, res) => {
  if (!denyUnless(req, res, Permissions.COMMERCIAL_ORDER_HOLD_MANAGE)) return;
  const body = z.object({ reason: z.string().trim().max(240).optional() }).safeParse(req.body ?? {});
  if (!body.success) return res.status(400).json({ error: "invalid_commercial_status_input", details: body.error.flatten() });
  try {
    res.json({ status: await releaseOrderHold({ orderId: req.params.id, actorStaffId: req.staffAuth!.staffId, reason: body.data.reason, idempotencyKey: req.header("idempotency-key") ?? undefined }) });
  } catch (error) {
    return sendError(error, res);
  }
});

router.get("/admin/commercial-status/retailers/:id", requireAdminIdentity, async (req: AdminRequest, res) => {
  if (!denyUnless(req, res, Permissions.COMMERCIAL_STATUS_VIEW)) return;
  try {
    res.json({ status: await internalStatusForRetailer(req.params.id) });
  } catch (error) {
    return sendError(error, res);
  }
});

export default router;
