import { Prisma } from "@prisma/client";
import { assessOrder, CreditDecision } from "../modules/credit/engine";
import { CreditPolicy } from "../modules/credit/policy";
import { ReasonCodes } from "../modules/credit/reasonCodes";
import { buildCreditSnapshot } from "../modules/credit/snapshotBuilder";
import { resolveRolloutDecision } from "../modules/credit/rollout";
import { prisma } from "./prisma";
import { enqueueSalesOrder } from "./sap/outbox";

export interface OrderLineInput {
  variantId: string;
  qty: number;
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
  placedByStaffId?: string
): Promise<CreateOrderResult> {
  return prisma.$transaction(async (tx) => {
    const retailer = await tx.retailer.findUnique({ where: { id: retailerId } });
    if (!retailer) return { ok: false, status: 404, body: { error: "Retailer not found" } };

    await tx.$queryRaw`SELECT 1 FROM "Retailer" WHERE "id" = ${retailerId} FOR UPDATE`;

    const variantIds = [...new Set(items.map((item) => item.variantId))];
    const [priceList, overrides, policyRecord, appConfig] = await Promise.all([
      tx.priceList.findMany({ where: { tierId: retailer.tierId, variantId: { in: variantIds } } }),
      tx.priceOverride.findMany({ where: { retailerId, variantId: { in: variantIds } } }),
      tx.creditPolicyVersion.findFirst({ where: { active: true }, orderBy: { version: "desc" } }),
      tx.appConfig.findUnique({ where: { id: "singleton" } }),
    ]);
    if (!policyRecord) {
      return { ok: false, status: 503, body: { error: "credit_policy_unavailable" } };
    }

    const tierPrice = new Map(priceList.map((price) => [price.variantId, Number(price.price)]));
    const overridePrice = new Map(overrides.map((override) => [override.variantId, Number(override.price)]));
    let orderTotal = 0;
    const lineItems: { variantId: string; qtyOrdered: number; unitPrice: number }[] = [];
    for (const item of items) {
      const unitPrice = overridePrice.get(item.variantId) ?? tierPrice.get(item.variantId);
      if (unitPrice == null) {
        return {
          ok: false,
          status: 400,
          body: { error: "No price available for one of the items", variantId: item.variantId },
        };
      }
      orderTotal += unitPrice * item.qty;
      lineItems.push({ variantId: item.variantId, qtyOrdered: item.qty, unitPrice });
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
        placedBy,
        placedByRepId: placedBy === "rep" ? placedByRepId ?? null : null,
        status: "placed",
        orderTotal,
        items: { create: lineItems },
      },
      include: { items: true },
    });
    const assessment = await tx.creditAssessment.create({
      data: {
        retailerId,
        orderId: order.id,
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
        orderId: order.id,
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
          orderId: order.id,
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
      return { ok: true, order, decision: effectiveDecision, approvalRequest: request };
    }

    const authorization = await tx.dispatchAuthorization.create({
      data: {
        orderId: order.id,
        version: 1,
        assessmentId: assessment.id,
        status: "active",
        reason: rollout.mode === "shadow" ? "shadow_legacy_allowed" : "credit_engine_allowed",
      },
    });
    await enqueueSalesOrder(tx, order.id);
    return { ok: true, order, decision: effectiveDecision, dispatchAuthorization: authorization };
  });
}
