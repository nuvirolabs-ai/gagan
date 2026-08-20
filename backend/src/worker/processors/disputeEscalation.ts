import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function processDisputeEscalations({ now = new Date() } = {}) {
  const due = await prisma.approvalDispute.findMany({
    where: {
      status: "open",
      OR: [
        { acknowledgedAt: null, acknowledgmentDueAt: { lte: now } },
        { decisionDueAt: { not: null, lte: now } },
      ],
    },
    select: { id: true },
    take: 100,
  });
  let escalated = 0;
  for (const candidate of due) {
    const changed = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "ApprovalDispute" WHERE "id" = ${candidate.id} FOR UPDATE`;
      const dispute = await tx.approvalDispute.findUnique({
        where: { id: candidate.id },
        include: { approvalRequest: true },
      });
      if (!dispute || dispute.status !== "open") return false;
      const acknowledgmentMissed = !dispute.acknowledgedAt && dispute.acknowledgmentDueAt <= now;
      const decisionMissed = dispute.decisionDueAt != null && dispute.decisionDueAt <= now;
      if (!acknowledgmentMissed && !decisionMissed) return false;
      const reasonCode = acknowledgmentMissed
        ? "dispute_acknowledgment_sla_missed"
        : "dispute_decision_sla_missed";
      await tx.approvalDispute.update({
        where: { id: dispute.id },
        data: { status: "escalated" },
      });
      await tx.approvalEscalation.create({
        data: {
          approvalRequestId: dispute.approvalRequestId,
          fromPermission: dispute.approvalRequest.requiredPermission,
          toPermission: "legal.decide",
          reasonCode,
        },
      });
      await tx.approvalRequest.update({
        where: { id: dispute.approvalRequestId },
        data: { status: "rejected", requiredPermission: "legal.decide", escalatedAt: now },
      });
      await tx.auditEvent.create({
        data: {
          action: "approval_dispute.escalated",
          subjectType: "approval_dispute",
          subjectId: dispute.id,
          metadata: json({ reasonCode, approvalRequestId: dispute.approvalRequestId }),
        },
      });
      return true;
    });
    if (changed) escalated++;
  }
  return { escalated };
}
