import { Prisma, CommercialStatusCode } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export class CommercialStatusError extends Error {
  constructor(public readonly code: string, public readonly status = 409, public readonly details?: unknown) {
    super(code);
  }
}

export const COMMERCIAL_STATUS_LABELS: Record<CommercialStatusCode, string> = {
  ACCOUNT_OPENED: "#️⃣ New Account Opened",
  RATE_APPROVAL_SENT: "🍓 Rate Sent for Approval",
  SALES_ORDER_APPROVAL_SENT: "❤️ Sales Order Sent for Approval",
  SALES_ORDER_CREATED: "👍 Sales Order Created",
  SALES_ORDER_ON_HOLD: "❌ Sales Order On Hold",
  SALES_ORDER_HOLD_RELEASED: "↩️ Sales Order Hold Released",
  ADVANCE_PAYMENT_RECEIVED: "✍️ Advance Payment Received",
};

const CURRENT_STATUS_CODES = new Set<CommercialStatusCode>([
  CommercialStatusCode.ACCOUNT_OPENED,
  CommercialStatusCode.RATE_APPROVAL_SENT,
  CommercialStatusCode.SALES_ORDER_APPROVAL_SENT,
  CommercialStatusCode.SALES_ORDER_CREATED,
]);

type StatusDb = Prisma.TransactionClient | typeof prisma;

function inputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function decimalValue(value: Prisma.Decimal | number | string | null | undefined) {
  return value == null ? undefined : new Prisma.Decimal(value);
}

function normalizedAmount(value: Prisma.Decimal | number | string | null | undefined) {
  return value == null ? null : new Prisma.Decimal(value);
}

function normalizedMetadata(value: unknown) {
  return JSON.stringify(value ?? null);
}

function sameEventRequest(event: any, input: RecordCommercialStatusInput, actorStaffId: string | null) {
  const eventAmount = normalizedAmount(event.amount);
  const inputAmount = normalizedAmount(input.amount);
  return event.code === input.code
    && event.retailerId === input.retailerId
    && (event.orderId ?? null) === (input.orderId ?? null)
    && (event.commercialQuoteId ?? null) === (input.commercialQuoteId ?? null)
    && (event.actorStaffId ?? null) === actorStaffId
    && (event.reason ?? null) === (input.reason?.trim() || null)
    && (event.reference ?? null) === (input.reference?.trim() || null)
    && (eventAmount === null ? inputAmount === null : inputAmount !== null && eventAmount.eq(inputAmount))
    && normalizedMetadata(event.metadata) === normalizedMetadata(input.metadata);
}

async function replayActionEvent(
  db: StatusDb,
  key: string | undefined,
  expected: { code: CommercialStatusCode; retailerId: string; orderId: string; actorStaffId?: string | null; reason?: string | null },
) {
  if (!key) return false;
  const existing = await db.commercialStatusEvent.findUnique({ where: { idempotencyKey: key } });
  if (!existing) return false;
  if (existing.code !== expected.code
    || existing.retailerId !== expected.retailerId
    || existing.orderId !== expected.orderId
    || (existing.actorStaffId ?? null) !== (expected.actorStaffId ?? null)
    || (existing.reason ?? null) !== (expected.reason?.trim() || null)) {
    throw new CommercialStatusError("commercial_status_idempotency_conflict", 409);
  }
  return true;
}

export interface RecordCommercialStatusInput {
  code: CommercialStatusCode;
  retailerId: string;
  orderId?: string | null;
  commercialQuoteId?: string | null;
  actorStaffId?: string | null;
  reason?: string | null;
  amount?: Prisma.Decimal | number | string | null;
  reference?: string | null;
  metadata?: unknown;
  idempotencyKey?: string | null;
}

/**
 * Writes one immutable internal event. An idempotency key is optional because
 * some automatic boundaries are already naturally unique, but every retryable
 * user action supplies one (or is reconciled by its current state).
 */
export async function recordCommercialStatusEvent(db: StatusDb, input: RecordCommercialStatusInput) {
  const key = input.idempotencyKey?.trim() || null;
  let actorStaffId = input.actorStaffId ?? null;
  // A few legacy/system boundaries pass a nullable actor and some old tests
  // use a synthetic actor reference. Preserve the event while only linking an
  // actor that exists; real authenticated callers always resolve to a staff
  // row and retain the audit attribution.
  if (actorStaffId && "staffUser" in db) {
    const actor = await db.staffUser.findUnique({ where: { id: actorStaffId }, select: { id: true } });
    if (!actor) actorStaffId = null;
  }
  if (key) {
    const existing = await db.commercialStatusEvent.findUnique({ where: { idempotencyKey: key } });
    if (existing) {
      if (!sameEventRequest(existing, input, actorStaffId)) {
        throw new CommercialStatusError("commercial_status_idempotency_conflict", 409);
      }
      return existing;
    }
  }

  try {
    return await db.commercialStatusEvent.create({
      data: {
        code: input.code,
        retailerId: input.retailerId,
        orderId: input.orderId ?? null,
        commercialQuoteId: input.commercialQuoteId ?? null,
        actorStaffId,
        reason: input.reason?.trim() || null,
        amount: decimalValue(input.amount),
        reference: input.reference?.trim() || null,
        metadata: input.metadata === undefined ? undefined : inputJson(input.metadata),
        idempotencyKey: key,
      },
    });
  } catch (error) {
    // Two request workers may race before either sees the unique key. Re-read
    // the winner and only return it when the business identity also matches.
    if (key && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.commercialStatusEvent.findUnique({ where: { idempotencyKey: key } });
      if (existing && sameEventRequest(existing, input, actorStaffId)) return existing;
      throw new CommercialStatusError("commercial_status_idempotency_conflict", 409);
    }
    throw error;
  }
}

export function statusLabel(code: CommercialStatusCode) {
  return COMMERCIAL_STATUS_LABELS[code];
}

export function deriveCurrentCommercialStatus(
  events: Array<{ code: CommercialStatusCode; createdAt: Date }>,
  isOnHold: boolean
) {
  if (isOnHold) return CommercialStatusCode.SALES_ORDER_ON_HOLD;
  return events.find((event) => CURRENT_STATUS_CODES.has(event.code))?.code ?? null;
}

export function serializeCommercialStatusEvent(event: any) {
  return {
    id: event.id,
    code: event.code,
    label: statusLabel(event.code),
    retailerId: event.retailerId,
    orderId: event.orderId,
    commercialQuoteId: event.commercialQuoteId,
    actor: event.actorStaff ? { id: event.actorStaff.id, name: event.actorStaff.name } : null,
    reason: event.reason,
    amount: event.amount == null ? null : Number(event.amount),
    reference: event.reference,
    metadata: event.metadata ?? null,
    createdAt: event.createdAt,
  };
}

const eventInclude = {
  actorStaff: { select: { id: true, name: true } },
} as const;

export async function internalStatusForOrder(orderId: string, db: StatusDb = prisma) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      retailerId: true,
      isOnHold: true,
      holdReason: true,
      heldAt: true,
      heldBy: { select: { id: true, name: true } },
      commercialStatusEvents: { orderBy: { createdAt: "desc" }, include: eventInclude },
    },
  });
  if (!order) throw new CommercialStatusError("order_not_found", 404);
  const events = order.commercialStatusEvents;
  const currentCode = deriveCurrentCommercialStatus(events, order.isOnHold);
  const advance = events.find((event) => event.code === CommercialStatusCode.ADVANCE_PAYMENT_RECEIVED) ?? null;
  return {
    currentCode,
    currentLabel: currentCode ? statusLabel(currentCode) : null,
    isOnHold: order.isOnHold,
    holdReason: order.holdReason,
    heldAt: order.heldAt,
    heldBy: order.heldBy,
    latestAdvancePayment: advance ? serializeCommercialStatusEvent(advance) : null,
    timeline: events.slice().reverse().map(serializeCommercialStatusEvent),
  };
}

export async function internalStatusForRetailer(retailerId: string, db: StatusDb = prisma) {
  const events = await db.commercialStatusEvent.findMany({
    where: { retailerId },
    orderBy: { createdAt: "asc" },
    include: { ...eventInclude, order: { select: { id: true, orderNo: true } } },
  });
  const current = events.slice().reverse().find((event) => CURRENT_STATUS_CODES.has(event.code)) ?? null;
  return {
    retailerId,
    currentCode: current?.code ?? null,
    currentLabel: current ? statusLabel(current.code) : null,
    timeline: events.map(serializeCommercialStatusEvent),
  };
}

export async function internalStatusForQuote(quoteId: string, db: StatusDb = prisma) {
  const quote = await db.commercialQuote.findUnique({
    where: { id: quoteId },
    select: {
      id: true,
      retailerId: true,
      commercialStatusEvents: { orderBy: { createdAt: "asc" }, include: eventInclude },
    },
  });
  if (!quote) throw new CommercialStatusError("commercial_quote_not_found", 404);
  const events = quote.commercialStatusEvents;
  const current = events.slice().reverse().find((event) => event.code === CommercialStatusCode.RATE_APPROVAL_SENT) ?? null;
  return {
    quoteId: quote.id,
    retailerId: quote.retailerId,
    currentCode: current?.code ?? null,
    currentLabel: current ? statusLabel(current.code) : null,
    timeline: events.map(serializeCommercialStatusEvent),
  };
}

export async function requestRateApproval(input: {
  quoteId: string;
  retailerId: string;
  actorStaffId: string;
  reason?: string;
  reference?: string;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "CommercialQuote" WHERE "id" = ${input.quoteId} FOR UPDATE`;
    const quote = await tx.commercialQuote.findFirst({ where: { id: input.quoteId, retailerId: input.retailerId } });
    if (!quote) throw new CommercialStatusError("commercial_quote_not_found", 404);
    if (!quote.snapshot || quote.expiresAt <= new Date()) throw new CommercialStatusError("commercial_quote_expired", 409);
    return recordCommercialStatusEvent(tx, {
      code: CommercialStatusCode.RATE_APPROVAL_SENT,
      retailerId: input.retailerId,
      commercialQuoteId: quote.id,
      actorStaffId: input.actorStaffId,
      reason: input.reason,
      reference: input.reference,
      metadata: {
        approvalStatus: "pending",
        quoteId: quote.id,
        revision: quote.revision,
        pricingSnapshot: quote.snapshot,
      },
      idempotencyKey: `rate-approval:${quote.id}:${quote.revision}`,
    });
  });
}

export async function recordOrderApprovalRequest(input: {
  orderId: string;
  retailerId: string;
  actorStaffId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const approval = await tx.approvalRequest.findFirst({
      where: { orderId: input.orderId, status: { in: ["open", "escalated"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!approval) throw new CommercialStatusError("approval_request_not_found", 409);
    return recordCommercialStatusEvent(tx, {
      code: CommercialStatusCode.SALES_ORDER_APPROVAL_SENT,
      retailerId: input.retailerId,
      orderId: input.orderId,
      actorStaffId: input.actorStaffId,
      reason: approval.requestReason,
      metadata: {
        approvalStatus: approval.status,
        approvalRequestId: approval.id,
        approvalType: approval.approvalType,
        requiredPermission: approval.requiredPermission,
      },
      idempotencyKey: `order-approval:${approval.id}`,
    });
  });
}

export async function setOrderHold(input: {
  orderId: string;
  actorStaffId: string;
  reason: string;
  idempotencyKey?: string;
}) {
  const reason = input.reason.trim();
  if (reason.length < 3) throw new CommercialStatusError("hold_reason_required", 400);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${input.orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: input.orderId } });
    if (!order) throw new CommercialStatusError("order_not_found", 404);
    if (await replayActionEvent(tx, input.idempotencyKey, {
      code: CommercialStatusCode.SALES_ORDER_ON_HOLD,
      retailerId: order.retailerId,
      orderId: order.id,
      actorStaffId: input.actorStaffId,
      reason,
    })) return internalStatusForOrder(order.id, tx);
    if (order.isOnHold) {
      if (order.holdReason === reason) return internalStatusForOrder(order.id, tx);
      throw new CommercialStatusError("order_already_on_hold", 409);
    }
    const heldAt = new Date();
    await tx.order.update({
      where: { id: order.id },
      data: { isOnHold: true, holdReason: reason, heldAt, heldByStaffId: input.actorStaffId },
    });
    await recordCommercialStatusEvent(tx, {
      code: CommercialStatusCode.SALES_ORDER_ON_HOLD,
      retailerId: order.retailerId,
      orderId: order.id,
      actorStaffId: input.actorStaffId,
      reason,
      metadata: { underlyingOrderStatus: order.status },
      idempotencyKey: input.idempotencyKey || `order-hold:${order.id}:${heldAt.toISOString()}`,
    });
    return internalStatusForOrder(order.id, tx);
  });
}

export async function releaseOrderHold(input: {
  orderId: string;
  actorStaffId: string;
  reason?: string;
  idempotencyKey?: string;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${input.orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: input.orderId } });
    if (!order) throw new CommercialStatusError("order_not_found", 404);
    if (await replayActionEvent(tx, input.idempotencyKey, {
      code: CommercialStatusCode.SALES_ORDER_HOLD_RELEASED,
      retailerId: order.retailerId,
      orderId: order.id,
      actorStaffId: input.actorStaffId,
      reason: input.reason,
    })) return internalStatusForOrder(order.id, tx);
    if (!order.isOnHold) return internalStatusForOrder(order.id, tx);
    await tx.order.update({
      where: { id: order.id },
      data: { isOnHold: false, holdReason: null, heldAt: null, heldByStaffId: null },
    });
    await recordCommercialStatusEvent(tx, {
      code: CommercialStatusCode.SALES_ORDER_HOLD_RELEASED,
      retailerId: order.retailerId,
      orderId: order.id,
      actorStaffId: input.actorStaffId,
      reason: input.reason,
      metadata: { underlyingOrderStatus: order.status },
      idempotencyKey: input.idempotencyKey || `order-hold-release:${order.id}:${order.heldAt?.toISOString() ?? "unknown"}`,
    });
    return internalStatusForOrder(order.id, tx);
  });
}
