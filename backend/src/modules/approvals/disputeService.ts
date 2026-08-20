import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApprovalServiceError } from "./approvalService";
import { addWorkingHours } from "./slaService";
import { assessOrder } from "../credit/engine";
import type { CreditPolicy } from "../credit/policy";
import { buildCreditSnapshot } from "../credit/snapshotBuilder";
import { enqueueSalesOrder } from "../../lib/sap/outbox";

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function hasAny(permissions: string[], required: string[]) {
  return required.some((permission) => permissions.includes(permission));
}

export function isDisputablePermission(requiredPermission: string) {
  return ["approval.second_invoice", "approval.third_invoice"].includes(requiredPermission);
}

export function canResolveReassessment(
  requiredPermission: string,
  actorPermissions: string[],
  founderOnly: boolean
) {
  if (actorPermissions.includes(requiredPermission)) return true;
  if (
    requiredPermission === "approval.second_invoice" &&
    actorPermissions.includes("approval.third_invoice")
  ) return true;
  return founderOnly &&
    requiredPermission !== "collection.confirm" &&
    actorPermissions.includes("legal.decide");
}

function policyFrom(record: { version: number; name: string; rules: Prisma.JsonValue }): CreditPolicy {
  return { ...(record.rules as unknown as CreditPolicy), version: record.version, name: record.name };
}

export class DisputeService {
  async raise(
    approvalRequestId: string,
    input: { actorStaffId: string; actorPermissions: string[]; writtenPosition: string; now?: Date }
  ) {
    const request = await prisma.approvalRequest.findUnique({ where: { id: approvalRequestId } });
    if (!request) throw new ApprovalServiceError("approval_not_found", 404);
    if (
      !hasAny(input.actorPermissions, ["approval.second_invoice", "staff.manage"]) ||
      !isDisputablePermission(request.requiredPermission)
    ) {
      throw new ApprovalServiceError("permission_required", 403, {
        permission: "approval.second_invoice",
      });
    }
    if (request.status !== "rejected" && request.status !== "escalated") {
      throw new ApprovalServiceError("approval_not_disputable", 409);
    }
    const now = input.now ?? new Date();
    const acknowledgmentDueAt = await addWorkingHours(now, 4);
    return prisma.$transaction(async (tx) => {
      const dispute = await tx.approvalDispute.create({
        data: {
          approvalRequestId,
          raisedByStaffId: input.actorStaffId,
          writtenPosition: input.writtenPosition.trim(),
          acknowledgmentDueAt,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorStaffId: input.actorStaffId,
          action: "approval_dispute.raised",
          subjectType: "approval_dispute",
          subjectId: dispute.id,
          metadata: json({ approvalRequestId, acknowledgmentDueAt }),
        },
      });
      return dispute;
    });
  }

  async acknowledge(
    id: string,
    input: { actorStaffId: string; actorPermissions: string[]; now?: Date }
  ) {
    if (!hasAny(input.actorPermissions, ["approval.third_invoice", "legal.decide"])) {
      throw new ApprovalServiceError("permission_required", 403, {
        permission: "approval.third_invoice",
      });
    }
    const now = input.now ?? new Date();
    const dispute = await prisma.approvalDispute.findUnique({ where: { id } });
    if (!dispute) throw new ApprovalServiceError("dispute_not_found", 404);
    if (dispute.status === "resolved") throw new ApprovalServiceError("dispute_already_resolved", 409);
    return prisma.approvalDispute.update({
      where: { id },
      data: {
        acknowledgedAt: dispute.acknowledgedAt ?? now,
        decisionDueAt: dispute.decisionDueAt ?? new Date(now.getTime() + 24 * 60 * 60 * 1000),
      },
    });
  }

  async submitCounterPosition(
    id: string,
    input: { actorStaffId: string; actorPermissions: string[]; counterPosition: string }
  ) {
    if (!hasAny(input.actorPermissions, ["approval.third_invoice", "legal.decide"])) {
      throw new ApprovalServiceError("permission_required", 403);
    }
    const dispute = await prisma.approvalDispute.findUnique({ where: { id } });
    if (!dispute) throw new ApprovalServiceError("dispute_not_found", 404);
    if (dispute.status === "resolved") throw new ApprovalServiceError("dispute_already_resolved", 409);
    return prisma.approvalDispute.update({
      where: { id },
      data: { counterPosition: input.counterPosition.trim() },
    });
  }

  async resolve(
    id: string,
    input: {
      actorStaffId: string;
      actorPermissions: string[];
      outcome: "approved" | "rejected";
      resolution: string;
      now?: Date;
    }
  ) {
    const now = input.now ?? new Date();
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "ApprovalDispute" WHERE "id" = ${id} FOR UPDATE`;
      const dispute = await tx.approvalDispute.findUnique({
        where: { id },
        include: {
          approvalRequest: { include: { order: { include: { items: true } } } },
        },
      });
      if (!dispute) throw new ApprovalServiceError("dispute_not_found", 404);
      if (dispute.status === "resolved") throw new ApprovalServiceError("dispute_already_resolved", 409);
      const request = dispute.approvalRequest;
      const founderOnly = dispute.status === "escalated" || request.requiredPermission === "legal.decide";
      if (
        (founderOnly && !input.actorPermissions.includes("legal.decide")) ||
        (!founderOnly && !hasAny(input.actorPermissions, ["approval.third_invoice", "legal.decide"]))
      ) {
        throw new ApprovalServiceError("permission_required", 403, {
          permission: founderOnly ? "legal.decide" : "approval.third_invoice",
        });
      }
      const order = request.order;
      if (!order) throw new ApprovalServiceError("approval_order_missing", 409);

      let authorizationId: string | null = null;
      let assessmentId: string | null = null;
      if (input.outcome === "approved") {
        await tx.$queryRaw`SELECT 1 FROM "Retailer" WHERE "id" = ${request.retailerId} FOR UPDATE`;
        const policyRecord = await tx.creditPolicyVersion.findFirst({
          where: { active: true },
          orderBy: { version: "desc" },
        });
        if (!policyRecord) throw new ApprovalServiceError("credit_policy_unavailable", 503);
        const snapshot = await buildCreditSnapshot(tx, request.retailerId, now, order.id);
        const overrideCount = await tx.priceOverride.count({
          where: {
            retailerId: request.retailerId,
            variantId: { in: order.items.map((item) => item.variantId) },
          },
        });
        const reassessment = assessOrder(
          policyFrom(policyRecord),
          snapshot,
          { total: Number(order.orderTotal), hasPriceListVariation: overrideCount > 0 },
          now
        );
        if (reassessment.result === "blocked") {
          throw new ApprovalServiceError("credit_reassessment_blocked", 409, reassessment);
        }
        if (reassessment.result === "approval_required") {
          if (!canResolveReassessment(
            reassessment.requiredPermission,
            input.actorPermissions,
            founderOnly
          )) {
            throw new ApprovalServiceError("permission_required", 403, {
              permission: reassessment.requiredPermission,
            });
          }
        }
        const assessment = await tx.creditAssessment.create({
          data: {
            retailerId: request.retailerId,
            orderId: order.id,
            policyVersionId: policyRecord.id,
            result: reassessment.result,
            requiredPermission:
              reassessment.result === "approval_required" ? reassessment.requiredPermission : null,
            projectedExposure:
              snapshot.outstandingAmount + snapshot.pendingAuthorizedExposure + Number(order.orderTotal),
            snapshot: json(snapshot),
            reasons: json(reassessment.reasons),
          },
        });
        await tx.dispatchAuthorization.updateMany({
          where: { orderId: order.id, status: "active" },
          data: { status: "invalidated", invalidatedAt: now },
        });
        const latest = await tx.dispatchAuthorization.aggregate({
          where: { orderId: order.id },
          _max: { version: true },
        });
        const authorization = await tx.dispatchAuthorization.create({
          data: {
            orderId: order.id,
            version: (latest._max.version ?? 0) + 1,
            assessmentId: assessment.id,
            approvalRequestId: request.id,
            status: "active",
            issuedByStaffId: input.actorStaffId,
            reason: `dispute_approved: ${input.resolution.trim()}`,
          },
        });
        authorizationId = authorization.id;
        assessmentId = assessment.id;
        await tx.approvalRequest.update({
          where: { id: request.id },
          data: { status: "approved", decidedAt: now },
        });
        await tx.order.update({ where: { id: order.id }, data: { status: "placed" } });
        await enqueueSalesOrder(tx, order.id);
      } else {
        await tx.approvalRequest.update({
          where: { id: request.id },
          data: { status: "rejected", decidedAt: now },
        });
        await tx.order.update({ where: { id: order.id }, data: { status: "rejected" } });
      }

      const resolved = await tx.approvalDispute.update({
        where: { id },
        data: {
          status: "resolved",
          outcome: input.outcome,
          resolution: input.resolution.trim(),
          resolvedByStaffId: input.actorStaffId,
          resolvedAt: now,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorStaffId: input.actorStaffId,
          action: "approval_dispute.resolved",
          subjectType: "approval_dispute",
          subjectId: id,
          metadata: json({
            approvalRequestId: request.id,
            outcome: input.outcome,
            resolution: input.resolution.trim(),
            authorizationId,
            assessmentId,
          }),
        },
      });
      return resolved;
    });
  }
}
