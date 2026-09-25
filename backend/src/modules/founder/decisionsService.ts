import type { Prisma, PrismaClient } from "@prisma/client";
import { ApprovalService, ApprovalServiceError } from "../approvals/approvalService";
import { Permissions } from "../identity/roleCatalog";
import type { FounderDecision, FounderDecisionStatus, FounderDecisionType, FounderDecisions } from "./types";

type Db = PrismaClient | Prisma.TransactionClient;

const ASK_OWNER_REASON = "No last-escalation owner sits above Founder in Gagan V1.";

export const UNAVAILABLE_DECISION_TYPES = [
  { type: "LARGE_PURCHASE", reason: "No canonical purchase-approval workflow exists in Gagan V1." },
  { type: "EXCEPTIONAL_DISCOUNT", reason: "No exceptional-discount approval workflow exists in Gagan V1." },
] as const;

function isFounderDecision(row: { requiredPermission: string; status: string }): boolean {
  return row.requiredPermission === "legal.decide" || row.status === "escalated";
}

export class FounderDecisionError extends Error {
  constructor(
    public code: string,
    public status: number,
    public details?: unknown
  ) {
    super(code);
  }
}

export class DecisionsService {
  constructor(
    private readonly db: Db,
    private readonly approvals = new ApprovalService()
  ) {}

  async list(input: {
    segment?: string;
    permissions: string[];
    now?: Date;
  }): Promise<FounderDecisions> {
    const segment = input.segment === "history" ? "history" : "open";
    const now = input.now ?? new Date();
    const rows = await this.db.approvalRequest.findMany({
      where:
        segment === "open"
          ? {
              status: { in: ["open", "escalated"] },
              OR: [{ requiredPermission: "legal.decide" }, { status: "escalated" }],
            }
          : {
              status: { in: ["approved", "rejected"] },
              OR: [{ requiredPermission: "legal.decide" }, { escalatedAt: { not: null } }],
              decidedAt: { gte: new Date(now.getTime() - 90 * 86_400_000) },
            },
      include: {
        retailer: { select: { name: true } },
        order: { select: { orderNo: true, orderTotal: true } },
        assessment: { select: { reasons: true, projectedExposure: true } },
      },
      orderBy: [{ deadlineAt: "asc" }, { createdAt: "asc" }],
    });

    const requesterIds = [
      ...new Set(rows.map((row) => (row as { requestedByStaffId?: string | null }).requestedByStaffId).filter(Boolean)),
    ] as string[];
    const requesters = requesterIds.length
      ? await this.db.staffUser.findMany({
          where: { id: { in: requesterIds } },
          select: { id: true, name: true },
        })
      : [];
    const requesterNames = new Map(requesters.map((row) => [row.id, row.name]));

    const overdueByRetailer = await this.overdueByRetailer(now, rows.map((row) => row.retailerId));

    const canDecide = input.permissions.includes(Permissions.FOUNDER_DECIDE);
    const decisions = rows
      .filter(isFounderDecision)
      .map((row) =>
        this.toDecision(row, {
          canDecide,
          requesterName: requesterNames.get((row as { requestedByStaffId?: string | null }).requestedByStaffId ?? "") ?? "Credit",
          overdue: overdueByRetailer.get(row.retailerId) ?? 0,
        })
      );

    return {
      asOf: now.toISOString(),
      segment,
      decisions,
      unavailableTypes: [...UNAVAILABLE_DECISION_TYPES],
    };
  }

  async detail(id: string, permissions: string[], now = new Date()): Promise<FounderDecision> {
    const row = await this.db.approvalRequest.findUnique({
      where: { id },
      include: {
        retailer: { select: { name: true } },
        order: { select: { orderNo: true, orderTotal: true } },
        assessment: { select: { reasons: true, projectedExposure: true } },
      },
    });
    if (!row || !isFounderDecision(row)) {
      throw new FounderDecisionError("decision_not_found", 404);
    }
    const requester = row.requestedByStaffId
      ? await this.db.staffUser.findUnique({ where: { id: row.requestedByStaffId }, select: { name: true } })
      : null;
    const overdue = (await this.overdueByRetailer(now, [row.retailerId])).get(row.retailerId) ?? 0;
    return this.toDecision(row, {
      canDecide: permissions.includes(Permissions.FOUNDER_DECIDE),
      requesterName: requester?.name ?? "Credit",
      overdue,
    });
  }

  async decide(input: {
    id: string;
    result: "approved" | "rejected";
    reason?: string;
    actorStaffId: string;
    permissions: string[];
  }): Promise<FounderDecision> {
    if (!input.permissions.includes(Permissions.FOUNDER_DECIDE)) {
      throw new FounderDecisionError("permission_required", 403, { permission: Permissions.FOUNDER_DECIDE });
    }
    const existing = await this.db.approvalRequest.findUnique({ where: { id: input.id } });
    if (!existing || !isFounderDecision(existing)) {
      throw new FounderDecisionError("decision_not_found", 404);
    }

    try {
      await this.approvals.decide(input.id, {
        actorStaffId: input.actorStaffId,
        actorPermissions: input.permissions,
        result: input.result,
        reason: input.reason ?? (input.result === "rejected" ? "Declined by founder." : undefined),
        stepUpSessionId: "founder_app",
      });
      await this.db.auditEvent.create({
        data: {
          actorStaffId: input.actorStaffId,
          action: "founder.decided",
          subjectType: "approval_request",
          subjectId: input.id,
          metadata: { result: input.result, via: "founder_app" },
        },
      });
    } catch (error) {
      if (error instanceof ApprovalServiceError && error.code === "approval_already_decided") {
        return this.detail(input.id, input.permissions);
      }
      if (error instanceof ApprovalServiceError) {
        throw new FounderDecisionError(error.code, error.status, error.details);
      }
      throw error;
    }
    return this.detail(input.id, input.permissions);
  }

  askOwner(): never {
    throw new FounderDecisionError("action_unavailable", 400, { reason: ASK_OWNER_REASON });
  }

  private toDecision(
    row: {
      id: string;
      approvalType: string;
      status: string;
      requiredPermission: string;
      requestReason: string | null;
      createdAt: Date;
      deadlineAt: Date | null;
      retailer: { name: string };
      order: { orderNo: number; orderTotal: unknown } | null;
      assessment: { reasons: unknown; projectedExposure: unknown } | null;
    },
    ctx: { canDecide: boolean; requesterName: string; overdue: number }
  ): FounderDecision {
    const amount = row.order ? Number(row.order.orderTotal) : null;
    const type: FounderDecisionType = row.status === "escalated" ? "EXECUTIVE_ESCALATION" : "CREDIT_EXCEPTION";
    const reasons = Array.isArray(row.assessment?.reasons)
      ? (row.assessment!.reasons as string[])
      : [];
    const status: FounderDecisionStatus =
      row.status === "approved" ? "approved" : row.status === "rejected" ? "declined" : "open";
    const recommendation = ctx.overdue > 0 || reasons.includes("new_customer_cap") ? "REVIEW" : "APPROVE";
    const open = status === "open";
    return {
      id: row.id,
      type,
      title:
        type === "EXECUTIVE_ESCALATION"
          ? `Escalated credit exception · ${row.retailer.name}`
          : `Credit exception · ${row.retailer.name}`,
      amount,
      requester: ctx.requesterName,
      owner: "Credit",
      context: [
        row.retailer.name,
        row.order ? formatOrderRef(row.order.orderNo) : "No linked order",
        amount != null ? `Order value ${amount}` : "Amount unavailable",
        row.requestReason ?? "Credit policy exception",
        ...reasons.map((reason) => reason.replace(/_/g, " ")),
        ctx.overdue > 0 ? `Overdue on account ${ctx.overdue}` : "No overdue on the local ledger",
      ].filter(Boolean),
      recommendation,
      recommendedBy: "Credit policy",
      recommendationReason:
        ctx.overdue > 0
          ? "Overdue sits on this retailer."
          : reasons.includes("new_customer_cap")
            ? "New-customer cap requires an exception."
            : "Credit policy can clear this exception.",
      availableActions: open && ctx.canDecide ? ["approve", "decline"] : [],
      unavailableActions: [{ id: "askOwner", reason: ASK_OWNER_REASON }],
      createdAt: row.createdAt.toISOString(),
      dueAt: row.deadlineAt?.toISOString() ?? null,
      status,
      auditRequired: true,
    };
  }

  private async overdueByRetailer(now: Date, retailerIds: string[]): Promise<Map<string, number>> {
    const unique = [...new Set(retailerIds)];
    if (unique.length === 0) return new Map();
    const invoices = await this.db.invoice.findMany({
      where: {
        retailerId: { in: unique },
        status: { in: ["open", "partially_paid"] },
        outstandingAmount: { gt: 0 },
        dueDate: { lt: now },
      },
      select: { retailerId: true, outstandingAmount: true },
    });
    const map = new Map<string, number>();
    for (const invoice of invoices) {
      map.set(invoice.retailerId, (map.get(invoice.retailerId) ?? 0) + Number(invoice.outstandingAmount));
    }
    return map;
  }
}

function formatOrderRef(orderNo: number): string {
  return `GGN-${String(orderNo).padStart(8, "0")}`;
}
