import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/prisma";
import {
  ASSIGNMENT_ERROR_MESSAGES,
  MAX_HIERARCHY_DEPTH,
  buildTree,
  flattenTree,
  validateManagerAssignment,
  type HierarchyNode,
  type ManagerAssignmentError,
} from "./hierarchyDomain";

type Db = PrismaClient | any;

export class HierarchyError extends Error {
  constructor(readonly code: ManagerAssignmentError, readonly status = 400) {
    super(ASSIGNMENT_ERROR_MESSAGES[code]);
  }
}

export interface TeamMember {
  id: string;
  depth: number;
}

/**
 * The one place the reporting tree is walked.
 *
 * Every module that needs "who is on this manager's team" calls this service
 * rather than re-deriving it, which is what keeps a scope change in one file
 * instead of nine. Descendants and ancestors are each a single recursive CTE:
 * depth is unbounded but query count is not, so a national head with 300 people
 * underneath costs the same one round trip as a manager with two.
 */
export class HierarchyService {
  constructor(private readonly prisma: Db = defaultPrisma) {}

  async getDirectReports(managerId: string): Promise<Array<{ id: string; name: string; status: string }>> {
    return this.prisma.staffUser.findMany({
      where: { managerId },
      select: { id: true, name: true, status: true },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Every descendant of `managerId`, at any depth, excluding the manager.
   *
   * The `path` accumulator makes the recursion terminate even on a cyclic edge
   * that reached the table some other way — a dashboard degrading to a partial
   * team is recoverable, a query that never returns is not.
   */
  async getAllReports(managerId: string, maxDepth = MAX_HIERARCHY_DEPTH): Promise<TeamMember[]> {
    const rows = (await this.prisma.$queryRaw(Prisma.sql`
      WITH RECURSIVE tree AS (
        SELECT s."id", 1 AS depth, ARRAY[s."id"] AS path
          FROM "StaffUser" s
         WHERE s."managerId" = ${managerId}
        UNION ALL
        SELECT s."id", t.depth + 1, t.path || s."id"
          FROM "StaffUser" s
          JOIN tree t ON s."managerId" = t."id"
         WHERE NOT (s."id" = ANY(t.path))
           AND t.depth < ${maxDepth}
      )
      SELECT "id", depth FROM tree
    `)) as Array<{ id: string; depth: number }>;
    return rows.map((row) => ({ id: row.id, depth: Number(row.depth) }));
  }

  /** Managers above `employeeId`, nearest first. */
  async getManagementChain(employeeId: string): Promise<Array<{ id: string; name: string; depth: number }>> {
    const rows = (await this.prisma.$queryRaw(Prisma.sql`
      WITH RECURSIVE chain AS (
        SELECT m."id", m."name", m."managerId", 1 AS depth, ARRAY[m."id"] AS path
          FROM "StaffUser" s
          JOIN "StaffUser" m ON m."id" = s."managerId"
         WHERE s."id" = ${employeeId}
        UNION ALL
        SELECT m."id", m."name", m."managerId", c.depth + 1, c.path || m."id"
          FROM chain c
          JOIN "StaffUser" m ON m."id" = c."managerId"
         WHERE NOT (m."id" = ANY(c.path))
           AND c.depth < ${MAX_HIERARCHY_DEPTH}
      )
      SELECT "id", "name", depth FROM chain ORDER BY depth ASC
    `)) as Array<{ id: string; name: string; depth: number }>;
    return rows.map((row) => ({ id: row.id, name: row.name, depth: Number(row.depth) }));
  }

  /** Does `employeeId` sit anywhere beneath `managerId`? Self is deliberately false. */
  async isInReportingTree(managerId: string, employeeId: string): Promise<boolean> {
    if (managerId === employeeId) return false;
    const chain = await this.getManagementChain(employeeId);
    return chain.some((link) => link.id === managerId);
  }

  /**
   * The staff ids a manager may act on: themselves plus everyone below.
   *
   * Callers pass this list down into domain queries. They never pass a manager
   * id for a module to re-resolve, so no module can accidentally widen scope.
   */
  async teamStaffIds(managerId: string): Promise<string[]> {
    const reports = await this.getAllReports(managerId);
    return [managerId, ...reports.map((member) => member.id)];
  }

  /**
   * The retailers a manager's team owns.
   *
   * Derived, never stored: ownership is `Retailer.salesRepId` and nothing else,
   * so moving a salesperson between managers changes both managers' books on the
   * next read with no backfill and no second assignment table to drift.
   */
  async getManagerTeamRetailers(managerId: string): Promise<string[]> {
    const staffIds = await this.teamStaffIds(managerId);
    const staff = await this.prisma.staffUser.findMany({
      where: { id: { in: staffIds }, salesRepId: { not: null } },
      select: { salesRepId: true },
    });
    const repIds = staff.map((row: any) => row.salesRepId).filter(Boolean) as string[];
    if (repIds.length === 0) return [];
    const retailers = await this.prisma.retailer.findMany({
      where: { salesRepId: { in: repIds } },
      select: { id: true },
    });
    return retailers.map((row: any) => row.id);
  }

  /** Every employee, shaped as an indented list for the org admin screen. */
  async tree(): Promise<Array<HierarchyNode & { depth: number; reportCount: number }>> {
    const staff: HierarchyNode[] = await this.prisma.staffUser.findMany({
      select: { id: true, name: true, managerId: true, status: true },
      orderBy: { name: "asc" },
    });
    return flattenTree(buildTree(staff));
  }

  /** Active employees with no manager — the work list for whoever owns the org chart. */
  async unassigned() {
    return this.prisma.staffUser.findMany({
      where: { managerId: null, status: "active" },
      select: { id: true, name: true, phone: true, status: true },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Move an employee under a new manager, or to the top of the tree.
   *
   * Validation and the audit write are one transaction, so a rejected move
   * leaves no trace and an accepted one can never lose its history.
   */
  async setManager(input: {
    employeeId: string;
    managerId: string | null;
    actorStaffId: string;
    reason?: string;
  }) {
    const [employee, manager] = await Promise.all([
      this.prisma.staffUser.findUnique({
        where: { id: input.employeeId },
        select: { id: true, name: true, status: true, managerId: true },
      }),
      input.managerId
        ? this.prisma.staffUser.findUnique({
            where: { id: input.managerId },
            select: { id: true, name: true, status: true },
          })
        : Promise.resolve(null),
    ]);

    // The ancestor map only needs the chain above the proposed manager, and a
    // full adjacency read is the cheaper way to get it correct at this size.
    const all: Array<{ id: string; managerId: string | null }> = await this.prisma.staffUser.findMany({
      select: { id: true, managerId: true },
    });
    const managerOf = new Map(all.map((row) => [row.id, row.managerId]));

    const error = validateManagerAssignment({
      employeeId: input.employeeId,
      proposedManagerId: input.managerId,
      employee: employee ?? undefined,
      manager: manager ?? undefined,
      managerOf,
    });
    if (error) {
      throw new HierarchyError(error, error === "employee_not_found" ? 404 : 400);
    }

    const previousManagerId = employee!.managerId ?? null;
    if (previousManagerId === input.managerId) {
      return { changed: false, employee: employee! };
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.staffUser.update({
        where: { id: input.employeeId },
        data: { managerId: input.managerId },
        select: { id: true, name: true, managerId: true, status: true },
      }),
      // Append-only. A reassignment never overwrites the row that recorded the
      // previous one, so "who moved this person, and when" survives every later move.
      this.prisma.auditEvent.create({
        data: {
          actorStaffId: input.actorStaffId,
          action: MANAGER_CHANGED_ACTION,
          subjectType: SUBJECT_TYPE,
          subjectId: input.employeeId,
          metadata: {
            previousManagerId,
            newManagerId: input.managerId,
            reason: input.reason ?? null,
          },
        },
      }),
    ]);

    return { changed: true, employee: updated };
  }

  /** The reassignment history for one employee, newest first, with names resolved. */
  async managerHistory(employeeId: string) {
    const events = await this.prisma.auditEvent.findMany({
      where: { subjectType: SUBJECT_TYPE, subjectId: employeeId, action: MANAGER_CHANGED_ACTION },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const ids = new Set<string>();
    for (const event of events) {
      const meta = (event.metadata ?? {}) as Record<string, unknown>;
      for (const key of ["previousManagerId", "newManagerId"]) {
        const value = meta[key];
        if (typeof value === "string") ids.add(value);
      }
      if (event.actorStaffId) ids.add(event.actorStaffId);
    }

    const people = ids.size
      ? await this.prisma.staffUser.findMany({
          where: { id: { in: [...ids] } },
          select: { id: true, name: true },
        })
      : [];
    const nameOf = new Map(people.map((person: any) => [person.id, person.name]));

    return events.map((event: any) => {
      const meta = (event.metadata ?? {}) as Record<string, unknown>;
      const previousManagerId = typeof meta.previousManagerId === "string" ? meta.previousManagerId : null;
      const newManagerId = typeof meta.newManagerId === "string" ? meta.newManagerId : null;
      return {
        id: event.id,
        changedAt: event.createdAt,
        changedById: event.actorStaffId,
        changedByName: event.actorStaffId ? nameOf.get(event.actorStaffId) ?? null : null,
        previousManagerId,
        previousManagerName: previousManagerId ? nameOf.get(previousManagerId) ?? null : null,
        newManagerId,
        newManagerName: newManagerId ? nameOf.get(newManagerId) ?? null : null,
        reason: typeof meta.reason === "string" ? meta.reason : null,
      };
    });
  }
}

export const SUBJECT_TYPE = "staff_user";
export const MANAGER_CHANGED_ACTION = "staff.manager_changed";

export const hierarchyService = new HierarchyService();
