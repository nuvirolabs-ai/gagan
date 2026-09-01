import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { FieldServiceError } from "./attendanceService";
import { isWithinScope } from "./fieldDomain";

type Db = PrismaClient | any;

const OPEN_STATUSES = ["open", "in_progress"] as const;

/**
 * Operational tasks a salesperson is asked to do. Tasks are assigned by a
 * manager or admin; the field app can only move its own tasks forward.
 */
export class TaskService {
  constructor(private readonly prisma: Db = defaultPrisma) {}

  async forSalesperson(input: { salespersonId: string; includeClosed?: boolean; limit?: number }) {
    return this.prisma.fieldTask.findMany({
      where: {
        assignedToStaffId: input.salespersonId,
        ...(input.includeClosed ? {} : { status: { in: [...OPEN_STATUSES] } }),
      },
      include: { retailer: { select: { id: true, name: true, shopAddress: true } } },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      take: Math.min(input.limit ?? 100, 200),
    });
  }

  async updateStatus(input: {
    taskId: string;
    salespersonId: string;
    status: "in_progress" | "done";
    note?: string;
  }) {
    const task = await this.prisma.fieldTask.findUnique({ where: { id: input.taskId } });
    if (!task || task.assignedToStaffId !== input.salespersonId) {
      throw new FieldServiceError("task_not_found", 404);
    }
    if (task.status === "done" || task.status === "cancelled") {
      throw new FieldServiceError("task_already_closed", 409);
    }
    return this.prisma.fieldTask.update({
      where: { id: task.id },
      data: {
        status: input.status,
        completedAt: input.status === "done" ? new Date() : null,
        completionNote: input.note?.trim() || task.completionNote,
      },
    });
  }

  /* ------------------------------ management ------------------------------ */

  async assign(input: {
    assignedToStaffId: string;
    createdByStaffId: string;
    title: string;
    description?: string;
    retailerId?: string;
    routePlanId?: string;
    priority?: "low" | "normal" | "high" | "urgent";
    dueAt?: Date;
    scopeStaffIds?: string[] | null;
  }) {
    if (!input.title.trim()) throw new FieldServiceError("task_title_required", 400);
    // You may only task someone you manage.
    if (!isWithinScope(input.assignedToStaffId, input.scopeStaffIds)) {
      throw new FieldServiceError("outside_reporting_scope", 403);
    }
    const assignee = await this.prisma.staffUser.findUnique({
      where: { id: input.assignedToStaffId },
      select: { id: true, status: true, salesRepId: true },
    });
    if (!assignee || assignee.status !== "active") {
      throw new FieldServiceError("assignee_not_available", 404);
    }
    if (input.retailerId) {
      const retailer = await this.prisma.retailer.findUnique({
        where: { id: input.retailerId },
        select: { salesRepId: true },
      });
      if (!retailer) throw new FieldServiceError("retailer_not_found", 404);
      // A task about a store the assignee does not own would be unactionable.
      if (assignee.salesRepId && retailer.salesRepId !== assignee.salesRepId) {
        throw new FieldServiceError("retailer_not_assigned_to_salesperson", 422);
      }
    }
    return this.prisma.fieldTask.create({
      data: {
        assignedToStaffId: input.assignedToStaffId,
        createdByStaffId: input.createdByStaffId,
        retailerId: input.retailerId ?? null,
        routePlanId: input.routePlanId ?? null,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        priority: input.priority ?? "normal",
        dueAt: input.dueAt ?? null,
      },
    });
  }

  async cancel(input: { taskId: string; actorStaffId: string; scopeStaffIds?: string[] | null }) {
    const task = await this.prisma.fieldTask.findUnique({ where: { id: input.taskId } });
    if (!task) throw new FieldServiceError("task_not_found", 404);
    if (!isWithinScope(task.assignedToStaffId, input.scopeStaffIds)) {
      throw new FieldServiceError("outside_reporting_scope", 403);
    }
    if (task.status === "done") throw new FieldServiceError("task_already_closed", 409);
    return this.prisma.fieldTask.update({
      where: { id: task.id },
      data: { status: "cancelled", completionNote: `Cancelled by ${input.actorStaffId}` },
    });
  }

  async list(filters: {
    assignedToStaffId?: string;
    status?: string;
    retailerId?: string;
    scopeStaffIds?: string[] | null;
  }) {
    return this.prisma.fieldTask.findMany({
      where: {
        ...(filters.scopeStaffIds ? { assignedToStaffId: { in: filters.scopeStaffIds } } : {}),
        ...(filters.assignedToStaffId ? { assignedToStaffId: filters.assignedToStaffId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.retailerId ? { retailerId: filters.retailerId } : {}),
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
        retailer: { select: { id: true, name: true } },
      },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
      take: 200,
    });
  }
}

export const defaultTaskService = new TaskService();
