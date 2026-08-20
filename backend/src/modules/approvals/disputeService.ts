import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApprovalServiceError } from "./approvalService";
import { addWorkingHours } from "./slaService";

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function hasAny(permissions: string[], required: string[]) {
  return required.some((permission) => permissions.includes(permission));
}

export class DisputeService {
  async raise(
    approvalRequestId: string,
    input: { actorStaffId: string; actorPermissions: string[]; writtenPosition: string; now?: Date }
  ) {
    if (!hasAny(input.actorPermissions, ["approval.second_invoice", "staff.manage"])) {
      throw new ApprovalServiceError("permission_required", 403, {
        permission: "approval.second_invoice",
      });
    }
    const request = await prisma.approvalRequest.findUnique({ where: { id: approvalRequestId } });
    if (!request) throw new ApprovalServiceError("approval_not_found", 404);
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
    input: { actorStaffId: string; actorPermissions: string[]; resolution: string; now?: Date }
  ) {
    if (!hasAny(input.actorPermissions, ["approval.third_invoice", "legal.decide"])) {
      throw new ApprovalServiceError("permission_required", 403);
    }
    const now = input.now ?? new Date();
    const dispute = await prisma.approvalDispute.findUnique({ where: { id } });
    if (!dispute) throw new ApprovalServiceError("dispute_not_found", 404);
    if (dispute.status === "resolved") throw new ApprovalServiceError("dispute_already_resolved", 409);
    return prisma.approvalDispute.update({
      where: { id },
      data: {
        status: "resolved",
        resolution: input.resolution.trim(),
        resolvedByStaffId: input.actorStaffId,
        resolvedAt: now,
      },
    });
  }
}
