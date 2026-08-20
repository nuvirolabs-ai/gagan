import { Prisma } from "@prisma/client";
import { assessOrder } from "../credit/engine";
import type { CreditPolicy } from "../credit/policy";
import { buildCreditSnapshot } from "../credit/snapshotBuilder";
import { prisma } from "../../lib/prisma";
import { enqueueSalesOrder } from "../../lib/sap/outbox";

export class ApprovalServiceError extends Error {
  constructor(public code: string, public status: number, public details?: unknown) {
    super(code);
  }
}

export interface ApprovalDecisionInput {
  actorStaffId: string;
  actorPermissions: string[];
  result: "approved" | "rejected";
  reason?: string;
  stepUpSessionId?: string;
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function policyFrom(record: { version: number; name: string; rules: Prisma.JsonValue }): CreditPolicy {
  return { ...(record.rules as unknown as CreditPolicy), version: record.version, name: record.name };
}

const detailInclude = {
  retailer: { select: { id: true, name: true, phone: true } },
  order: {
    include: { items: { include: { variant: { include: { product: true } } } } },
  },
  assessment: { include: { policyVersion: { select: { version: true, name: true } } } },
  decision: true,
  escalations: { orderBy: { createdAt: "asc" as const } },
  disputes: { orderBy: { createdAt: "asc" as const } },
} as const;

export class ApprovalService {
  async list(permissions: string[]) {
    if (permissions.length === 0) return [];
    const canRaiseDispute = permissions.includes("approval.second_invoice");
    const canResolveDispute = permissions.some((permission) =>
      ["approval.third_invoice", "legal.decide"].includes(permission)
    );
    const recent = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return prisma.approvalRequest.findMany({
      where: {
        OR: [
          {
            status: { in: ["open", "escalated"] },
            requiredPermission: { in: permissions },
          },
          ...(canRaiseDispute
            ? [{ status: "rejected" as const, createdAt: { gte: recent } }]
            : []),
          ...(canResolveDispute
            ? [{
                status: "rejected" as const,
                disputes: { some: { status: { in: ["open" as const, "escalated" as const] } } },
              }]
            : []),
        ],
      },
      include: {
        retailer: { select: { id: true, name: true } },
        order: { select: { id: true, orderNo: true, orderTotal: true, createdAt: true } },
        assessment: { select: { reasons: true, projectedExposure: true } },
      },
      orderBy: [{ deadlineAt: "asc" }, { createdAt: "asc" }],
    });
  }

  async detail(id: string, permissions: string[]) {
    const request = await prisma.approvalRequest.findUnique({ where: { id }, include: detailInclude });
    if (!request) throw new ApprovalServiceError("approval_not_found", 404);
    const canReviewRejected =
      request.status === "rejected" && (
        permissions.includes("approval.second_invoice") ||
        (
          request.disputes.some((dispute) => dispute.status !== "resolved") &&
          permissions.some((permission) => ["approval.third_invoice", "legal.decide"].includes(permission))
        )
      );
    if (!permissions.includes(request.requiredPermission) && !canReviewRejected) {
      throw new ApprovalServiceError("permission_required", 403, {
        permission: request.requiredPermission,
      });
    }
    return request;
  }

  async decide(id: string, input: ApprovalDecisionInput) {
    if (input.result === "rejected" && !input.reason?.trim()) {
      throw new ApprovalServiceError("rejection_reason_required", 400);
    }

    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "ApprovalRequest" WHERE "id" = ${id} FOR UPDATE`;
      const request = await tx.approvalRequest.findUnique({
        where: { id },
        include: { order: { include: { items: true } } },
      });
      if (!request) throw new ApprovalServiceError("approval_not_found", 404);
      if (
        !input.actorPermissions.includes(request.requiredPermission) &&
        !(request.status === "escalated" && input.actorPermissions.includes("legal.decide"))
      ) {
        throw new ApprovalServiceError("permission_required", 403, {
          permission: request.requiredPermission,
        });
      }
      if (request.status !== "open" && request.status !== "escalated") {
        throw new ApprovalServiceError("approval_already_decided", 409);
      }
      if (!request.order) throw new ApprovalServiceError("approval_order_missing", 409);

      await tx.$queryRaw`SELECT 1 FROM "Retailer" WHERE "id" = ${request.retailerId} FOR UPDATE`;

      if (input.result === "rejected") {
        const [, updated] = await Promise.all([
          tx.approvalDecision.create({
            data: {
              approvalRequestId: id,
              result: "rejected",
              actorStaffId: input.actorStaffId,
              reason: input.reason!.trim(),
              stepUpSessionId: input.stepUpSessionId ?? "unknown",
            },
          }),
          tx.approvalRequest.update({
            where: { id },
            data: { status: "rejected", decidedAt: new Date() },
          }),
          tx.order.update({ where: { id: request.order.id }, data: { status: "rejected" } }),
          tx.auditEvent.create({
            data: {
              actorStaffId: input.actorStaffId,
              action: "approval.rejected",
              subjectType: "approval_request",
              subjectId: id,
              metadata: json({ reason: input.reason }),
            },
          }),
        ]);
        return updated;
      }

      const policyRecord = await tx.creditPolicyVersion.findFirst({
        where: { active: true },
        orderBy: { version: "desc" },
      });
      if (!policyRecord) throw new ApprovalServiceError("credit_policy_unavailable", 503);
      const now = new Date();
      const snapshot = await buildCreditSnapshot(tx, request.retailerId, now, request.order.id);
      const variantIds = request.order.items.map((item) => item.variantId);
      const overrideCount = await tx.priceOverride.count({
        where: { retailerId: request.retailerId, variantId: { in: variantIds } },
      });
      const reassessment = assessOrder(
        policyFrom(policyRecord),
        snapshot,
        {
          total: Number(request.order.orderTotal),
          hasPriceListVariation: overrideCount > 0,
        },
        now
      );
      if (reassessment.result === "blocked") {
        throw new ApprovalServiceError("credit_reassessment_blocked", 409, reassessment);
      }
      if (
        reassessment.result === "approval_required" &&
        !input.actorPermissions.includes(reassessment.requiredPermission) &&
        !(request.status === "escalated" && input.actorPermissions.includes("legal.decide"))
      ) {
        throw new ApprovalServiceError("permission_required", 403, {
          permission: reassessment.requiredPermission,
        });
      }

      const assessment = await tx.creditAssessment.create({
        data: {
          retailerId: request.retailerId,
          orderId: request.order.id,
          policyVersionId: policyRecord.id,
          result: reassessment.result,
          requiredPermission:
            reassessment.result === "approval_required" ? reassessment.requiredPermission : null,
          projectedExposure:
            snapshot.outstandingAmount +
            snapshot.pendingAuthorizedExposure +
            Number(request.order.orderTotal),
          snapshot: json(snapshot),
          reasons: json(reassessment.reasons),
        },
      });
      await tx.dispatchAuthorization.updateMany({
        where: { orderId: request.order.id, status: "active" },
        data: { status: "invalidated", invalidatedAt: now },
      });
      const latest = await tx.dispatchAuthorization.aggregate({
        where: { orderId: request.order.id },
        _max: { version: true },
      });
      const authorization = await tx.dispatchAuthorization.create({
        data: {
          orderId: request.order.id,
          version: (latest._max.version ?? 0) + 1,
          assessmentId: assessment.id,
          approvalRequestId: id,
          status: "active",
          issuedByStaffId: input.actorStaffId,
          reason: input.reason?.trim() || "approved_after_credit_reassessment",
        },
      });
      await tx.approvalDecision.create({
        data: {
          approvalRequestId: id,
          result: "approved",
          actorStaffId: input.actorStaffId,
          reason: input.reason?.trim(),
          stepUpSessionId: input.stepUpSessionId ?? "unknown",
        },
      });
      const updated = await tx.approvalRequest.update({
        where: { id },
        data: { status: "approved", decidedAt: now },
      });
      await tx.auditEvent.create({
        data: {
          actorStaffId: input.actorStaffId,
          action: "approval.approved",
          subjectType: "approval_request",
          subjectId: id,
          metadata: json({ authorizationId: authorization.id, assessmentId: assessment.id }),
        },
      });
      await enqueueSalesOrder(tx, request.order.id);
      return updated;
    });
  }
}
