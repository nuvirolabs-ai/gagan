import { Prisma, type StaffStatus, type StaffUser } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type {
  DelegationInput,
  SellingLeaderSetupInput,
  StaffCreateInput,
  StaffManagement,
} from "./adminStaffRoutes";
import { normalizeIndianPhone } from "./otpService";
import { validateManagerAssignment } from "../org/hierarchyDomain";
import { SUBJECT_TYPE as HIERARCHY_SUBJECT_TYPE } from "../org/hierarchyService";
import { Permissions } from "./roleCatalog";

export class StaffManagementError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number
  ) {
    super(code);
  }
}

export interface AuditInput {
  actorStaffId: string;
  action: string;
  subjectType: string;
  subjectId: string;
  metadata?: Record<string, unknown>;
}

export interface StaffManagementTransaction {
  createStaff(input: StaffCreateInput): Promise<any>;
  setStatus(id: string, status: StaffStatus): Promise<any>;
  assignRole(staffId: string, roleId: string): Promise<void>;
  removeRole(staffId: string, roleId: string): Promise<void>;
  hasRole(staffId: string, roleId: string): Promise<boolean>;
  isActiveStaff(staffId: string): Promise<boolean>;
  getRoleName(roleId: string): Promise<string | null>;
  getStaffSalesIdentity(staffId: string): Promise<{
    phone: string;
    salesRepId: string | null;
    salesRepPhone: string | null;
    roleNames: string[];
  } | null>;
  createDelegation(input: DelegationInput): Promise<any>;
  revokeDelegation(id: string, at: Date): Promise<boolean>;
  revokeSubjectSessions(subjectId: string, at: Date): Promise<void>;
  appendAudit(event: AuditInput): Promise<void>;
}

export interface StaffManagementStore {
  listStaff(): Promise<any[]>;
  listRoles(): Promise<any[]>;
  transaction<T>(work: (transaction: StaffManagementTransaction) => Promise<T>): Promise<T>;
}

function prismaTransactionAdapter(tx: Prisma.TransactionClient): StaffManagementTransaction {
  return {
    createStaff(input) {
      return tx.staffUser.create({ data: input });
    },
    setStatus(id, status) {
      return tx.staffUser.update({ where: { id }, data: { status } });
    },
    async assignRole(staffId, roleId) {
      await tx.staffRole.upsert({
        where: { staffId_roleId: { staffId, roleId } },
        update: {},
        create: { staffId, roleId },
      });
    },
    async removeRole(staffId, roleId) {
      await tx.staffRole.deleteMany({ where: { staffId, roleId } });
    },
    async hasRole(staffId, roleId) {
      return Boolean(
        await tx.staffRole.findUnique({ where: { staffId_roleId: { staffId, roleId } } })
      );
    },
    async isActiveStaff(staffId) {
      return Boolean(
        await tx.staffUser.findFirst({ where: { id: staffId, status: "active" } })
      );
    },
    async getRoleName(roleId) {
      return (await tx.role.findUnique({ where: { id: roleId }, select: { name: true } }))?.name ?? null;
    },
    async getStaffSalesIdentity(staffId) {
      const staff = await tx.staffUser.findUnique({
        where: { id: staffId },
        select: { phone: true, salesRepId: true,
          salesRep: { select: { phone: true } },
          roles: { select: { role: { select: { name: true } } } },
        },
      });
      return staff && {
        phone: staff.phone, salesRepId: staff.salesRepId,
        salesRepPhone: staff.salesRep?.phone ?? null,
        roleNames: staff.roles.map(({ role }) => role.name),
      };
    },
    createDelegation(input) {
      return tx.roleDelegation.create({ data: input });
    },
    async revokeDelegation(id, at) {
      const result = await tx.roleDelegation.updateMany({
        where: { id, revokedAt: null },
        data: { revokedAt: at },
      });
      return result.count === 1;
    },
    async revokeSubjectSessions(subjectId, at) {
      await tx.deviceSession.updateMany({
        where: { subjectId, realm: { in: ["staff", "admin"] }, revokedAt: null },
        data: { revokedAt: at },
      });
    },
    async appendAudit(event) {
      await tx.auditEvent.create({
        data: {
          ...event,
          metadata: event.metadata as Prisma.InputJsonValue | undefined,
        },
      });
    },
  };
}

export const prismaStaffManagementStore: StaffManagementStore = {
  listStaff() {
    return prisma.staffUser.findMany({
      orderBy: { name: "asc" },
      include: {
        roles: { include: { role: true } },
        directReports: { select: { id: true, name: true, status: true } },
        delegationsHeld: {
          where: { revokedAt: null },
          include: { role: true, delegator: { select: { id: true, name: true } } },
        },
      },
    });
  },
  listRoles() {
    return prisma.role.findMany({
      orderBy: { name: "asc" },
      include: {
        permissions: { include: { permission: true } },
      },
    });
  },
  transaction(work) {
    return prisma.$transaction((tx) => work(prismaTransactionAdapter(tx)));
  },
};

export class StaffManagementService implements StaffManagement {
  constructor(
    private readonly store: StaffManagementStore = prismaStaffManagementStore,
    private readonly db: typeof prisma = prisma
  ) {}

  async setupSellingLeader(input: SellingLeaderSetupInput, actorStaffId: string) {
    if (Boolean(input.staffId) === Boolean(input.newStaff)) {
      throw new StaffManagementError("staff_identity_required", 400);
    }
    if (input.reportIds && new Set(input.reportIds).size !== input.reportIds.length) {
      throw new StaffManagementError("duplicate_report", 400);
    }
    try {
      return await this.db.$transaction(async (tx) => {
        let staff: StaffUser;
        if (input.staffId) {
          await tx.$queryRaw(Prisma.sql`SELECT id FROM "StaffUser" WHERE id = ${input.staffId} FOR UPDATE`);
          const existingStaff = await tx.staffUser.findUnique({ where: { id: input.staffId } });
          if (!existingStaff) throw new StaffManagementError("staff_not_found", 404);
          staff = existingStaff;
        } else {
          const details = input.newStaff!;
          staff = await tx.staffUser.create({ data: {
            name: details.name.trim(),
            phone: normalizeIndianPhone(details.phone),
            email: details.email.trim().toLowerCase(),
            employeeRef: details.employeeRef?.trim(),
          } });
          await tx.auditEvent.create({ data: {
            actorStaffId, action: "staff.created", subjectType: "StaffUser", subjectId: staff.id,
          } });
        }
        if (staff.status !== "active") throw new StaffManagementError("active_staff_required", 409);
        const canonicalPhone = normalizeIndianPhone(staff.phone);
        // SalesRep has no phone uniqueness constraint. Locking its table keeps
        // candidate resolution and a possible create indivisible for this setup.
        await tx.$executeRawUnsafe('LOCK TABLE "SalesRep" IN SHARE ROW EXCLUSIVE MODE');
        const reps = await tx.salesRep.findMany({ select: { id: true, name: true, phone: true } });
        const matching = reps.filter((rep) => {
          try { return normalizeIndianPhone(rep.phone) === canonicalPhone; } catch { return false; }
        });
        if (matching.length > 1) throw new StaffManagementError("sales_rep_identity_ambiguous", 409);
        let repId = staff.salesRepId;
        if (repId) {
          if (matching.length !== 1 || matching[0].id !== repId) {
            throw new StaffManagementError("sales_rep_link_conflict", 409);
          }
        } else if (matching.length === 1) {
          const owner = await tx.staffUser.findFirst({ where: { salesRepId: matching[0].id }, select: { id: true } });
          if (owner && owner.id !== staff.id) throw new StaffManagementError("sales_rep_link_conflict", 409);
          repId = matching[0].id;
        } else {
          const sameName = reps.some((rep) => rep.name.trim().toLocaleLowerCase("en-IN") === staff.name.trim().toLocaleLowerCase("en-IN"));
          if (sameName) throw new StaffManagementError("sales_rep_identity_ambiguous", 409);
          const created = await tx.salesRep.create({ data: {
            name: staff.name, phone: canonicalPhone, territory: input.territory ?? null,
          } });
          repId = created.id;
        }
        if (staff.salesRepId !== repId) {
          staff = await tx.staffUser.update({ where: { id: staff.id }, data: { salesRepId: repId } });
        }
        const roles = await tx.role.findMany({
          where: { name: { in: ["salesperson", "field_manager"] } },
          include: { permissions: { include: { permission: true } } },
        });
        const salesRole = roles.find((role) => role.name === "salesperson");
        const managerRole = roles.find((role) => role.name === "field_manager");
        const salesPermissions = new Set(salesRole?.permissions.map((row) => row.permission.name) ?? []);
        if (!salesRole || !managerRole || ![Permissions.ORDER_CREATE_FOR_RETAILER, Permissions.ROUTE_EXECUTE, Permissions.ATTENDANCE_MANAGE_SELF]
          .every((permission) => salesPermissions.has(permission)) ||
            !managerRole.permissions.some((row) => row.permission.name === Permissions.PERFORMANCE_VIEW_TEAM)) {
          throw new StaffManagementError("role_permission_mismatch", 409);
        }
        for (const role of [salesRole, managerRole]) {
          const existing = await tx.staffRole.findUnique({ where: { staffId_roleId: { staffId: staff.id, roleId: role.id } } });
          if (!existing) {
            await tx.staffRole.create({ data: { staffId: staff.id, roleId: role.id } });
            await tx.auditEvent.create({ data: {
              actorStaffId, action: "staff.role_assigned", subjectType: "StaffUser", subjectId: staff.id,
              metadata: { roleId: role.id },
            } });
          }
        }
        const people = await tx.staffUser.findMany({ select: { id: true, name: true, status: true, managerId: true } });
        const byId = new Map(people.map((person) => [person.id, person]));
        const managerOf = new Map(people.map((person) => [person.id, person.managerId]));
        const moves = [
          ...(input.managerId !== undefined ? [{ employeeId: staff.id, managerId: input.managerId }] : []),
          ...(input.reportIds ?? []).map((employeeId) => ({ employeeId, managerId: staff.id })),
        ];
        for (const move of moves) {
          const employee = byId.get(move.employeeId);
          const manager = move.managerId ? byId.get(move.managerId) : undefined;
          const error = validateManagerAssignment({
            employeeId: move.employeeId, proposedManagerId: move.managerId,
            employee, manager, managerOf,
          });
          if (error) throw new StaffManagementError(error, error === "employee_not_found" ? 404 : 409);
          const previousManagerId = managerOf.get(move.employeeId) ?? null;
          if (previousManagerId === move.managerId) continue;
          await tx.staffUser.update({ where: { id: move.employeeId }, data: { managerId: move.managerId } });
          await tx.auditEvent.create({ data: {
            actorStaffId, action: "staff.manager_changed", subjectType: HIERARCHY_SUBJECT_TYPE, subjectId: move.employeeId,
            metadata: { previousManagerId, newManagerId: move.managerId, reason: "selling_leader_setup" },
          } });
          managerOf.set(move.employeeId, move.managerId);
        }
        await tx.auditEvent.create({ data: {
          actorStaffId, action: "staff.selling_leader_setup", subjectType: "StaffUser", subjectId: staff.id,
          metadata: { salesRepId: repId, reportIds: input.reportIds ?? [] },
        } });
        const final = await tx.staffUser.findUniqueOrThrow({
          where: { id: staff.id },
          select: { id: true, name: true, phone: true, salesRepId: true, managerId: true,
            directReports: { select: { id: true, name: true } },
            roles: { select: { role: { select: { name: true } } } },
          },
        });
        return { staff: final, roles: final.roles.map(({ role }) => role.name), workspaceMode: "sales_leader" as const };
      }, { isolationLevel: "Serializable", timeout: 15_000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        throw new StaffManagementError("setup_conflict_retry", 409);
      }
      throw error;
    }
  }

  async setupManagerOnly(staffId: string, actorStaffId: string) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "StaffUser" WHERE id = ${staffId} FOR UPDATE`);
      const staff = await tx.staffUser.findUnique({ where: { id: staffId } });
      if (!staff) throw new StaffManagementError("staff_not_found", 404);
      if (staff.status !== "active") throw new StaffManagementError("active_staff_required", 409);
      const roles = await tx.role.findMany({
        where: { name: { in: ["salesperson", "field_manager"] } },
        include: { permissions: { include: { permission: true } } },
      });
      const managerRole = roles.find((role) => role.name === "field_manager");
      if (!managerRole?.permissions.some((row) => row.permission.name === Permissions.PERFORMANCE_VIEW_TEAM)) {
        throw new StaffManagementError("role_permission_mismatch", 409);
      }
      const salespersonRole = roles.find((role) => role.name === "salesperson");
      await tx.staffRole.upsert({
        where: { staffId_roleId: { staffId, roleId: managerRole.id } },
        update: {}, create: { staffId, roleId: managerRole.id },
      });
      if (salespersonRole) {
        await tx.staffRole.deleteMany({ where: { staffId, roleId: salespersonRole.id } });
      }
      await tx.auditEvent.create({ data: {
        actorStaffId, action: "staff.manager_only_setup", subjectType: "StaffUser", subjectId: staffId,
        metadata: { salesRepLinkPreserved: Boolean(staff.salesRepId) },
      } });
      const final = await tx.staffUser.findUniqueOrThrow({
        where: { id: staffId },
        select: { id: true, name: true, phone: true, salesRepId: true, managerId: true,
          roles: { select: { role: { select: { name: true } } } },
        },
      });
      return { staff: final, roles: final.roles.map(({ role }) => role.name), workspaceMode: "manager_only" as const };
    }, { isolationLevel: "Serializable" });
  }

  listStaff() {
    return this.store.listStaff();
  }

  listRoles() {
    return this.store.listRoles();
  }

  createStaff(input: StaffCreateInput, actorStaffId: string) {
    return this.store.transaction(async (tx) => {
      const staff = await tx.createStaff({
        name: input.name.trim(),
        phone: normalizeIndianPhone(input.phone),
        email: input.email.trim().toLowerCase(),
        employeeRef: input.employeeRef?.trim(),
      });
      await tx.appendAudit({
        actorStaffId,
        action: "staff.created",
        subjectType: "StaffUser",
        subjectId: staff.id,
      });
      return staff;
    });
  }

  setStatus(
    id: string,
    status: "active" | "suspended" | "revoked",
    actorStaffId: string
  ) {
    return this.store.transaction(async (tx) => {
      const staff = await tx.setStatus(id, status);
      if (status !== "active") await tx.revokeSubjectSessions(id, new Date());
      await tx.appendAudit({
        actorStaffId,
        action: "staff.status_changed",
        subjectType: "StaffUser",
        subjectId: id,
        metadata: { status },
      });
      return staff;
    });
  }

  assignRole(staffId: string, roleId: string, actorStaffId: string) {
    return this.store.transaction(async (tx) => {
      const name = await tx.getRoleName(roleId);
      if (name === "salesperson" || name === "field_manager") {
        const identity = await tx.getStaffSalesIdentity(staffId);
        if (!identity) throw new StaffManagementError("staff_not_found", 404);
        const dualRole = (name === "salesperson" && identity.roleNames.includes("field_manager")) ||
          (name === "field_manager" && identity.roleNames.includes("salesperson"));
        let validRep = false;
        try {
          validRep = Boolean(identity.salesRepId && identity.salesRepPhone) &&
            normalizeIndianPhone(identity.phone) === normalizeIndianPhone(identity.salesRepPhone!);
        } catch {
          validRep = false;
        }
        if (dualRole || (name === "salesperson" && !validRep)) {
          throw new StaffManagementError("selling_leader_setup_required", 409);
        }
      }
      await tx.assignRole(staffId, roleId);
      await tx.appendAudit({
        actorStaffId,
        action: "staff.role_assigned",
        subjectType: "StaffUser",
        subjectId: staffId,
        metadata: { roleId },
      });
    });
  }

  removeRole(staffId: string, roleId: string, actorStaffId: string) {
    return this.store.transaction(async (tx) => {
      await tx.removeRole(staffId, roleId);
      await tx.appendAudit({
        actorStaffId,
        action: "staff.role_removed",
        subjectType: "StaffUser",
        subjectId: staffId,
        metadata: { roleId },
      });
    });
  }

  createDelegation(input: DelegationInput, actorStaffId: string) {
    if (input.endsAt <= input.startsAt) {
      throw new StaffManagementError("invalid_delegation_window", 400);
    }
    return this.store.transaction(async (tx) => {
      if (!(await tx.hasRole(input.delegatorStaffId, input.roleId))) {
        throw new StaffManagementError("delegator_role_required", 409);
      }
      if (
        !(await tx.isActiveStaff(input.delegatorStaffId)) ||
        !(await tx.isActiveStaff(input.delegateeStaffId))
      ) {
        throw new StaffManagementError("active_staff_required", 409);
      }
      const delegation = await tx.createDelegation(input);
      await tx.appendAudit({
        actorStaffId,
        action: "staff.delegation_created",
        subjectType: "RoleDelegation",
        subjectId: delegation.id,
        metadata: {
          delegatorStaffId: input.delegatorStaffId,
          delegateeStaffId: input.delegateeStaffId,
          roleId: input.roleId,
          startsAt: input.startsAt.toISOString(),
          endsAt: input.endsAt.toISOString(),
        },
      });
      return delegation;
    });
  }

  revokeDelegation(id: string, actorStaffId: string) {
    return this.store.transaction(async (tx) => {
      if (!(await tx.revokeDelegation(id, new Date()))) {
        throw new StaffManagementError("delegation_not_found", 404);
      }
      await tx.appendAudit({
        actorStaffId,
        action: "staff.delegation_revoked",
        subjectType: "RoleDelegation",
        subjectId: id,
      });
    });
  }
}
