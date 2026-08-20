import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function processApprovalEscalations({ now = new Date() } = {}) {
  const due = await prisma.approvalRequest.findMany({
    where: {
      status: "open",
      approvalType: "third_invoice",
      deadlineAt: { lte: now },
    },
    select: { id: true },
    take: 100,
  });
  let escalated = 0;
  for (const candidate of due) {
    const changed = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "ApprovalRequest" WHERE "id" = ${candidate.id} FOR UPDATE`;
      const request = await tx.approvalRequest.findUnique({ where: { id: candidate.id } });
      if (
        !request ||
        request.status !== "open" ||
        !request.deadlineAt ||
        request.deadlineAt > now
      ) return false;

      await tx.approvalEscalation.create({
        data: {
          approvalRequestId: request.id,
          fromPermission: request.requiredPermission,
          toPermission: "legal.decide",
          reasonCode: "third_invoice_sla_missed",
        },
      });
      await tx.approvalRequest.update({
        where: { id: request.id },
        data: {
          status: "escalated",
          requiredPermission: "legal.decide",
          escalatedAt: now,
        },
      });
      await tx.auditEvent.create({
        data: {
          action: "approval.escalated",
          subjectType: "approval_request",
          subjectId: request.id,
          metadata: json({ reasonCode: "third_invoice_sla_missed", toPermission: "legal.decide" }),
        },
      });
      return true;
    });
    if (changed) escalated++;
  }

  const nearCutoff = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const nearingRequests = await prisma.approvalRequest.findMany({
    where: {
      status: "open",
      deadlineAt: { gt: now, lte: nearCutoff },
    },
    select: { id: true, deadlineAt: true },
    take: 100,
  });
  let nearing = 0;
  for (const request of nearingRequests) {
    const exists = await prisma.auditEvent.findFirst({
      where: {
        action: "approval.nearing_sla",
        subjectType: "approval_request",
        subjectId: request.id,
      },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.auditEvent.create({
      data: {
        action: "approval.nearing_sla",
        subjectType: "approval_request",
        subjectId: request.id,
        metadata: json({ deadlineAt: request.deadlineAt }),
      },
    });
    nearing++;
  }

  return { escalated, nearing };
}
