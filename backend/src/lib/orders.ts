import { Prisma } from "@prisma/client";
import { asJson, snapshot as commercialSnapshot, normalizedLines } from "../modules/commercial/service";
import { assessOrder, CreditDecision } from "../modules/credit/engine";
import { ReasonCode } from "../modules/credit/reasonCodes";
import { CreditPolicy } from "../modules/credit/policy";
import { ReasonCodes } from "../modules/credit/reasonCodes";
import { buildCreditSnapshot } from "../modules/credit/snapshotBuilder";
import { resolveRolloutDecision } from "../modules/credit/rollout";
import { prisma } from "./prisma";
import { enqueueSalesOrder } from "./sap/outbox";
import { InventoryValidationError, validateOrderInventory } from "../modules/inventory/inventoryService";
import { recordCommercialStatusEvent } from "../modules/commercialStatus/statusService";
import { CommercialStatusCode } from "@prisma/client";

export interface OrderLineInput {
  variantId: string;
  qty: number;
}

/** Canonical case quantities: one row per SKU, within the database Int range. */
function normalizeItems(items: OrderLineInput[]): OrderLineInput[] | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  const quantities = new Map<string, number>();
  for (const item of items) {
    if (!item || typeof item.variantId !== "string" || !item.variantId.trim()
      || !Number.isSafeInteger(item.qty) || item.qty <= 0) return null;
    const quantity = (quantities.get(item.variantId) ?? 0) + item.qty;
    if (quantity > 2_147_483_647) return null;
    quantities.set(item.variantId, quantity);
  }
  return [...quantities].sort(([a], [b]) => a.localeCompare(b))
    .map(([variantId, qty]) => ({ variantId, qty }));
}

export type CreateOrderResult =
  | {
      ok: true;
      order: any;
      decision: CreditDecision;
      approvalRequest?: any;
      dispatchAuthorization?: any;
    }
  | { ok: false; status: number; body: Record<string, unknown> };

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function approvalType(decision: Extract<CreditDecision, { result: "approval_required" }>) {
  if (decision.reasons.includes(ReasonCodes.NEW_CUSTOMER_SECOND_INVOICE)) return "second_invoice";
  if (decision.reasons.includes(ReasonCodes.NEW_CUSTOMER_THIRD_INVOICE)) return "third_invoice";
  if (decision.reasons.includes(ReasonCodes.NEW_CUSTOMER_CAP)) return "credit_cap";
  if (decision.reasons.includes(ReasonCodes.PRICE_LIST_VARIATION)) return "price_variation";
  if (decision.reasons.includes(ReasonCodes.STALE_RATING)) return "rating_review";
  if (decision.reasons.includes(ReasonCodes.RATING_F_ADVANCE_REQUIRED)) return "advance_payment";
  return "outstanding";
}

function policyFromRecord(record: {
  version: number;
  name: string;
  rules: Prisma.JsonValue;
}): CreditPolicy {
  const rules = record.rules as unknown as CreditPolicy;
  return { ...rules, version: record.version, name: record.name };
}

function externalReferenceFor(orderNo: number): string {
  return `GGN-${String(orderNo).padStart(8, "0")}`;
}

async function replayExistingOrder(
  tx: Prisma.TransactionClient,
  retailerId: string,
  idempotencyKey: string,
  items: OrderLineInput[],
  placedBy: "retailer" | "rep",
  placedByRepId?: string
): Promise<CreateOrderResult | null> {
  const order = await tx.order.findUnique({
    where: { retailerId_idempotencyKey: { retailerId, idempotencyKey } },
    include: { items: true },
  });
  if (!order) return null;

  // Accepted rows are the durable request identity, including legacy orders.
  // Do not compare against today's price/master data on a lost-response retry.
  const acceptedItems = normalizeItems(order.items.map(item => ({ variantId: item.variantId, qty: item.qtyOrdered })));
  if (order.placedBy !== placedBy
    || order.placedByRepId !== (placedBy === "rep" ? placedByRepId ?? null : null)
    || JSON.stringify(acceptedItems) !== JSON.stringify(items)) {
    return { ok: false, status: 409, body: { error: "idempotency_key_conflict" } };
  }

  const [assessment, approvalRequest, dispatchAuthorization] = await Promise.all([
    tx.creditAssessment.findFirst({ where: { orderId: order.id }, orderBy: { createdAt: "desc" } }),
    tx.approvalRequest.findFirst({ where: { orderId: order.id }, orderBy: { createdAt: "desc" } }),
    tx.dispatchAuthorization.findFirst({ where: { orderId: order.id }, orderBy: { version: "desc" } }),
  ]);
  const reasons = Array.isArray(assessment?.reasons)
    ? (assessment.reasons as unknown as ReasonCode[])
    : [];
  const decision: CreditDecision = assessment?.result === "approval_required"
    ? {
        result: "approval_required",
        requiredPermission: assessment.requiredPermission ?? approvalRequest?.requiredPermission ?? "approval.third_invoice",
        ...(approvalRequest?.deadlineAt ? { deadline: approvalRequest.deadlineAt } : {}),
        reasons,
      }
    : assessment?.result === "blocked"
      ? { result: "blocked", reasons }
      : { result: "allowed", reasons };

  return {
    ok: true,
    order,
    decision,
    ...(approvalRequest ? { approvalRequest } : {}),
    ...(dispatchAuthorization ? { dispatchAuthorization } : {}),
  };
}

/**
 * One authoritative order path for retailer and salesperson clients. The
 * retailer row lock serializes exposure decisions, so parallel requests cannot
 * both assess against the same stale balance.
 */
export async function createOrderForRetailer(
  retailerId: string,
  items: OrderLineInput[],
  placedBy: "retailer" | "rep",
  placedByRepId?: string,
  placedByStaffId?: string,
  idempotencyKey?: string,
  commercial?: { quoteId: string; revision: number }
): Promise<CreateOrderResult> {
  const normalizedItems = normalizeItems(items);
  if (!normalizedItems) return { ok: false, status: 400, body: { error: "invalid_order_items" } };
  items = normalizedItems;
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "Retailer" WHERE "id" = ${retailerId} FOR UPDATE`;
    // Read only after acquiring the lock: a waiting request must see the latest
    // tier/balance/credit state, not a snapshot fetched before another commit.
    const retailer = await tx.retailer.findUnique({ where: { id: retailerId } });
    if (!retailer) return { ok: false, status: 404, body: { error: "Retailer not found" } };

    if (idempotencyKey) {
      const replay = await replayExistingOrder(tx, retailerId, idempotencyKey, items, placedBy, placedByRepId);
      if (replay) {
        if (replay.ok && (replay.order.commercialQuoteId ?? null) !== (commercial?.quoteId ?? null)) return {ok:false,status:409,body:{error:"idempotency_key_conflict"}};
        return replay;
      }
    }

    if (commercial) await tx.$queryRaw`SELECT "id" FROM "CommercialQuote" WHERE "id"=${commercial.quoteId} FOR UPDATE`;
    const quote = commercial ? await tx.commercialQuote.findFirst({where:{id:commercial.quoteId,retailerId}}) : null;
    const accepted = quote ? commercialSnapshot(quote.snapshot) : null;
    if (commercial && (!quote || !accepted || quote.acceptedAt || quote.expiresAt < new Date() || quote.revision !== commercial.revision)) return {ok:false,status:409,body:{error:"quote_changed_or_expired"}};
    if (accepted && JSON.stringify(normalizedLines(accepted.lines.map(l=>({variantId:l.variantId,qty:l.cases})))) !== JSON.stringify(items)) return {ok:false,status:409,body:{error:"quote_items_changed"}};
    if (quote && !quote.freightConfirmedByStaffId) return {ok:false,status:409,body:{error:"manager_freight_confirmation_required"}};

    const variantIds = [...new Set(items.map((item) => item.variantId))];
    const [priceList, overrides, policyRecord, appConfig, variants] = await Promise.all([
      tx.priceList.findMany({ where: { tierId: retailer.tierId, variantId: { in: variantIds } } }),
      tx.priceOverride.findMany({ where: { retailerId, variantId: { in: variantIds } } }),
      tx.creditPolicyVersion.findFirst({ where: { active: true }, orderBy: { version: "desc" } }),
      tx.appConfig.findUnique({ where: { id: "singleton" } }),
      tx.variant.findMany({
        where: {
          id: { in: variantIds },
          catalogStatus: "active",
          product: { catalogStatus: "active" },
        },
        select: {
          id: true,
          unitsPerCase: true,
          unitWeightKg: true,
          sellingEntity: true,
          routingClass: true,
          gstPendingOrderAllowed: true,
        },
      }),
    ]);
    if (variants.length !== variantIds.length) {
      return { ok: false, status: 409, body: { error: "catalog_item_not_orderable" } };
    }
    if (!policyRecord) {
      return { ok: false, status: 503, body: { error: "credit_policy_unavailable" } };
    }

    const tierPrice = new Map(priceList.map((price) => [price.variantId, price.price]));
    const overridePrice = new Map(overrides.map((override) => [override.variantId, override.price]));
    let orderAmount = new Prisma.Decimal(0);
    const conversionById = new Map(variants.map(variant => [variant.id, variant.unitWeightKg.mul(variant.unitsPerCase)]));
    // Routed rows and the explicit pending-GST staging exception must always
    // travel through the backend-authoritative quote path. Never let a direct
    // legacy case-price request bypass routing or create an order that cannot
    // later be invoiced safely.
    if (!accepted && variants.some(v => v.sellingEntity !== null || v.routingClass !== null || v.gstPendingOrderAllowed)) {
      return {ok:false,status:409,body:{error:"commercial_quote_required"}};
    }
    const lineItems: { variantId: string; qtyOrdered: number; unitPrice: number; caseWeightKgSnapshot: Prisma.Decimal; commercialSnapshot?:Prisma.InputJsonValue }[] = [];
    for (const item of items) {
      const commercialLine=accepted?.lines.find(l=>l.variantId===item.variantId);
      if (commercialLine) {
        const weight=new Prisma.Decimal(commercialLine.caseWeightKg);
        const equivalentCasePrice=new Prisma.Decimal(commercialLine.rate).mul(commercialLine.rateBasis==="quintal"?weight.div(100):1);
        lineItems.push({variantId:item.variantId,qtyOrdered:item.qty,unitPrice:equivalentCasePrice.toDecimalPlaces(2).toNumber(),caseWeightKgSnapshot:weight,commercialSnapshot:asJson(commercialLine)});
        continue;
      }
      const unitPrice = overridePrice.get(item.variantId) ?? tierPrice.get(item.variantId);
      if (unitPrice == null) {
        return {
          ok: false,
          status: 400,
          body: { error: "No price available for one of the items", variantId: item.variantId },
        };
      }
      const caseWeightKgSnapshot = conversionById.get(item.variantId);
      if (!caseWeightKgSnapshot || !caseWeightKgSnapshot.isPositive()) {
        return { ok: false, status: 409, body: { error: "invalid_case_conversion", variantId: item.variantId } };
      }
      orderAmount = orderAmount.add(unitPrice.mul(item.qty));
      lineItems.push({ variantId: item.variantId, qtyOrdered: item.qty, unitPrice: unitPrice.toNumber(), caseWeightKgSnapshot });
    }

    // Persisted prices have two decimal places. Keep multiplication/addition
    // decimal until the existing credit engine's numeric boundary.
    const orderTotal = accepted ? Number(accepted.total) : orderAmount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber();

    const minimumOrderValue = Number(appConfig?.minOrderValue ?? 0);
    if (minimumOrderValue > 0 && orderTotal < minimumOrderValue) {
      return {
        ok: false,
        status: 400,
        body: { error: "minimum_order_value", minimumOrderValue, orderTotal },
      };
    }

    try {
      await validateOrderInventory(tx, items);
    } catch (error) {
      if (error instanceof InventoryValidationError) {
        return { ok: false, status: 409, body: { error: error.code, ...error.details } };
      }
      throw error;
    }

    const now = new Date();
    const snapshot = await buildCreditSnapshot(tx, retailerId, now);
    const policy = policyFromRecord(policyRecord);
    const decision = assessOrder(
      policy,
      snapshot,
      { total: orderTotal, hasPriceListVariation: overrides.length > 0 },
      now
    );
    const projectedExposure =
      snapshot.outstandingAmount + snapshot.pendingAuthorizedExposure + orderTotal;
    const legacyResult = orderTotal <= Number(retailer.creditLimit) - Number(retailer.currentBalance)
      ? "allowed"
      : "blocked";
    const rollout = resolveRolloutDecision({
      mode: appConfig?.creditRolloutMode ?? "shadow",
      policySigned:
        appConfig?.creditPolicyApprovedAt != null &&
        appConfig.creditPolicyApprovedByStaffId != null &&
        appConfig.creditPolicyApprovedVersion === policyRecord.version,
      legacyResult,
      engineResult: decision.result,
    });
    const effectiveDecision: CreditDecision =
      rollout.effectiveResult === "allowed"
        ? { result: "allowed", reasons: [] }
        : rollout.effectiveResult === "blocked"
          ? { result: "blocked", reasons: decision.result === "blocked" ? decision.reasons : [] }
          : decision;

    if (effectiveDecision.result === "blocked") {
      const assessment = await tx.creditAssessment.create({
        data: {
          retailerId,
          policyVersionId: policyRecord.id,
          result: decision.result,
          projectedExposure,
          snapshot: json(snapshot),
          reasons: json(decision.reasons),
        },
      });
      await tx.creditDecisionComparison.create({
        data: {
          retailerId,
          assessmentId: assessment.id,
          rolloutMode: rollout.mode,
          legacyResult,
          engineResult: decision.result,
          effectiveResult: effectiveDecision.result,
          mismatch: rollout.mismatch,
        },
      });
      return {
        ok: false,
        status: 409,
        body: { error: "credit_blocked", decision: effectiveDecision, engineDecision: decision, rolloutMode: rollout.mode },
      };
    }

    const order = await tx.order.create({
      data: {
        retailerId,
        ...(idempotencyKey ? { idempotencyKey } : {}),
        ...(quote && accepted ? {commercialQuoteId:quote.id,commercialSnapshot:asJson(accepted)}:{}),
        placedBy,
        placedByRepId: placedBy === "rep" ? placedByRepId ?? null : null,
        status: "placed",
        orderTotal,
        items: { create: lineItems },
      },
      include: { items: true },
    });
    if (quote) await tx.commercialQuote.update({where:{id:quote.id},data:{acceptedAt:new Date()}});
    const orderWithIdentity = await tx.order.update({
      where: { id: order.id },
      data: { sapExternalReference: externalReferenceFor(order.orderNo) },
      include: { items: true },
    });
    await recordCommercialStatusEvent(tx, {
      code: CommercialStatusCode.SALES_ORDER_PUNCHED,
      retailerId,
      orderId: orderWithIdentity.id,
      actorStaffId: placedBy === "rep" ? placedByStaffId ?? null : null,
      metadata: {
        placedBy,
        orderNo: orderWithIdentity.orderNo,
        capturedOrderStatus: orderWithIdentity.status,
      },
      idempotencyKey: `sales-order-punched:${orderWithIdentity.id}`,
    });
    const assessment = await tx.creditAssessment.create({
      data: {
        retailerId,
        orderId: orderWithIdentity.id,
        policyVersionId: policyRecord.id,
        result: decision.result,
        requiredPermission:
          decision.result === "approval_required" ? decision.requiredPermission : null,
        projectedExposure,
        snapshot: json(snapshot),
        reasons: json(decision.reasons),
      },
    });
    await tx.creditDecisionComparison.create({
      data: {
        retailerId,
        orderId: orderWithIdentity.id,
        assessmentId: assessment.id,
        rolloutMode: rollout.mode,
        legacyResult,
        engineResult: decision.result,
        effectiveResult: effectiveDecision.result,
        mismatch: rollout.mismatch,
      },
    });

    if (effectiveDecision.result === "approval_required") {
      const request = await tx.approvalRequest.create({
        data: {
          retailerId,
            orderId: orderWithIdentity.id,
          assessmentId: assessment.id,
          subjectType: "order",
          subjectId: order.id,
          approvalType: approvalType(effectiveDecision),
          requiredPermission: effectiveDecision.requiredPermission,
          requestedByStaffId: placedBy === "rep" ? placedByStaffId ?? null : null,
          requestReason: effectiveDecision.reasons.join(","),
          deadlineAt: effectiveDecision.deadline,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorStaffId: placedBy === "rep" ? placedByStaffId ?? null : null,
          action: "approval.requested",
          subjectType: "approval_request",
          subjectId: request.id,
          metadata: json({
            orderId: order.id,
            retailerId,
            requiredPermission: effectiveDecision.requiredPermission,
            reasons: effectiveDecision.reasons,
          }),
        },
      });
      await recordCommercialStatusEvent(tx, {
        code: CommercialStatusCode.SALES_ORDER_APPROVAL_SENT,
        retailerId,
        orderId: orderWithIdentity.id,
        actorStaffId: placedBy === "rep" ? placedByStaffId ?? null : null,
        reason: effectiveDecision.reasons.join(","),
        metadata: {
          approvalStatus: request.status,
          approvalRequestId: request.id,
          approvalType: request.approvalType,
          requiredPermission: request.requiredPermission,
        },
        idempotencyKey: `order-approval:${request.id}`,
      });
      return { ok: true, order: orderWithIdentity, decision: effectiveDecision, approvalRequest: request };
    }

    const authorization = await tx.dispatchAuthorization.create({
      data: {
        orderId: orderWithIdentity.id,
        version: 1,
        assessmentId: assessment.id,
        status: "active",
        reason: rollout.mode === "shadow" ? "shadow_legacy_allowed" : "credit_engine_allowed",
      },
    });
    await enqueueSalesOrder(tx, orderWithIdentity.id);
    return { ok: true, order: orderWithIdentity, decision: effectiveDecision, dispatchAuthorization: authorization };
  });
}
