import { Prisma, type StaffStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type {
  DelegationInput,
  StaffCreateInput,
  StaffManagement,
} from "./adminStaffRoutes";
import { normalizeIndianPhone } from "./otpService";

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
  constructor(private readonly store: StaffManagementStore = prismaStaffManagementStore) {}

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
