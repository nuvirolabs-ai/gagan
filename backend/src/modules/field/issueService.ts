import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { FieldServiceError } from "./attendanceService";
import { isWithinScope } from "./fieldDomain";

type Db = PrismaClient | any;

const OPEN_STATUSES = ["open", "in_progress"];

/**
 * Customer-facing service issues raised from the field: a damaged carton, a
 * short delivery, a disputed invoice line. Debt recovery is a separate module
 * and stays there — this is the store's complaint, not the store's arrears.
 */
export class IssueService {
  constructor(private readonly prisma: Db = defaultPrisma) {}

  private async assertAssigned(salespersonId: string, retailerId: string) {
    const [staff, retailer] = await Promise.all([
      this.prisma.staffUser.findUnique({ where: { id: salespersonId }, select: { salesRepId: true } }),
      this.prisma.retailer.findUnique({ where: { id: retailerId }, select: { salesRepId: true } }),
    ]);
    if (!staff?.salesRepId || !retailer?.salesRepId || staff.salesRepId !== retailer.salesRepId) {
      throw new FieldServiceError("retailer_not_assigned", 404);
    }
  }

  async raise(input: {
    salespersonId: string;
    retailerId: string;
    type: string;
    description: string;
    priority?: "low" | "normal" | "high" | "urgent";
    orderId?: string;
    invoiceId?: string;
    visitId?: string;
  }) {
    if (!input.description.trim()) throw new FieldServiceError("issue_description_required", 400);
    await this.assertAssigned(input.salespersonId, input.retailerId);

    // An issue may only reference documents belonging to the same customer.
    if (input.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: input.orderId },
        select: { retailerId: true },
      });
      if (!order || order.retailerId !== input.retailerId) {
        throw new FieldServiceError("order_not_found_for_retailer", 404);
      }
    }
    if (input.invoiceId) {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: input.invoiceId },
        select: { retailerId: true },
      });
      if (!invoice || invoice.retailerId !== input.retailerId) {
        throw new FieldServiceError("invoice_not_found_for_retailer", 404);
      }
    }

    return this.prisma.$transaction(async (tx: Db) => {
      const issue = await tx.serviceIssue.create({
        data: {
          retailerId: input.retailerId,
          raisedByStaffId: input.salespersonId,
          type: input.type as any,
          description: input.description.trim(),
          priority: (input.priority ?? "normal") as any,
          orderId: input.orderId ?? null,
          invoiceId: input.invoiceId ?? null,
          visitId: input.visitId ?? null,
        },
      });
      // The issue is also part of what happened with this customer, so it
      // shows up on the customer's activity timeline without a second write
      // from the client.
      await tx.customerActivity.create({
        data: {
          retailerId: input.retailerId,
          salespersonId: input.salespersonId,
          visitId: input.visitId ?? null,
          type: "complaint_raised",
          notes: input.description.trim().slice(0, 500),
          serviceIssueId: issue.id,
        },
      });
      return issue;
    });
  }

  async list(filters: {
    salespersonId?: string;
    retailerId?: string;
    status?: string;
    openOnly?: boolean;
    scopeStaffIds?: string[] | null;
  }) {
    return this.prisma.serviceIssue.findMany({
      where: {
        // An issue belongs to the team that raised it, so a manager's queue is
        // their tree's issues — not every open issue in the company.
        ...(filters.scopeStaffIds ? { raisedByStaffId: { in: filters.scopeStaffIds } } : {}),
        ...(filters.salespersonId ? { raisedByStaffId: filters.salespersonId } : {}),
        ...(filters.retailerId ? { retailerId: filters.retailerId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.openOnly ? { status: { in: OPEN_STATUSES } } : {}),
      },
      include: {
        retailer: { select: { id: true, name: true } },
        raisedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
  }

  async updateStatus(input: {
    issueId: string;
    actorStaffId: string;
    status: "in_progress" | "resolved" | "closed" | "rejected";
    assignedTeam?: string;
    resolutionNote?: string;
    scopeStaffIds?: string[] | null;
  }) {
    const issue = await this.prisma.serviceIssue.findUnique({ where: { id: input.issueId } });
    if (!issue) throw new FieldServiceError("issue_not_found", 404);
    if (!isWithinScope(issue.raisedByStaffId, input.scopeStaffIds)) {
      throw new FieldServiceError("outside_reporting_scope", 403);
    }
    if (["resolved", "closed", "rejected"].includes(issue.status)) {
      throw new FieldServiceError("issue_already_closed", 409);
    }
    const resolving = ["resolved", "closed", "rejected"].includes(input.status);
    if (resolving && !input.resolutionNote?.trim()) {
      throw new FieldServiceError("issue_resolution_note_required", 400);
    }
    return this.prisma.$transaction(async (tx: Db) => {
      const updated = await tx.serviceIssue.update({
        where: { id: issue.id },
        data: {
          status: input.status,
          assignedTeam: input.assignedTeam?.trim() || issue.assignedTeam,
          resolutionNote: input.resolutionNote?.trim() || issue.resolutionNote,
          resolvedAt: resolving ? new Date() : null,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorStaffId: input.actorStaffId,
          action: `service_issue.${input.status}`,
          subjectType: "service_issue",
          subjectId: issue.id,
          metadata: { retailerId: issue.retailerId },
        },
      });
      return updated;
    });
  }
}

export const defaultIssueService = new IssueService();
