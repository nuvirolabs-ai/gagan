import { describe, expect, it } from "vitest";
import {
  StaffManagementError,
  StaffManagementService,
  type AuditInput,
  type StaffManagementStore,
  type StaffManagementTransaction,
} from "../staffManagementService";

function setup() {
  const audits: AuditInput[] = [];
  const calls: string[] = [];
  let delegatorHasRole = true;
  const transaction: StaffManagementTransaction = {
    createStaff: async (input) => ({ id: "staff-2", ...input, status: "active" }),
    setStatus: async (id, status) => ({ id, status }),
    assignRole: async () => undefined,
    removeRole: async () => undefined,
    hasRole: async () => delegatorHasRole,
    isActiveStaff: async () => true,
    createDelegation: async (input) => ({ id: "delegation-1", ...input }),
    revokeDelegation: async () => true,
    revokeSubjectSessions: async () => {
      calls.push("sessions.revoked");
    },
    appendAudit: async (event) => {
      audits.push(event);
    },
  };
  const store: StaffManagementStore = {
    listStaff: async () => [],
    listRoles: async () => [],
    transaction: async (work) => work(transaction),
  };
  return {
    audits,
    calls,
    service: new StaffManagementService(store),
    withoutDelegatorRole() {
      delegatorHasRole = false;
    },
  };
}

describe("StaffManagementService", () => {
  it("normalizes identity and audits staff creation", async () => {
    const { service, audits } = setup();
    const result = await service.createStaff(
      {
        name: " Meera Shah ",
        phone: "09876543210",
        email: "MEERA@EXAMPLE.COM",
        employeeRef: " COLL-001 ",
      },
      "admin-1"
    );
    expect(result).toMatchObject({
      phone: "+919876543210",
      email: "meera@example.com",
      employeeRef: "COLL-001",
    });
    expect(audits).toContainEqual(
      expect.objectContaining({
        actorStaffId: "admin-1",
        action: "staff.created",
        subjectType: "StaffUser",
        subjectId: "staff-2",
      })
    );
  });

  it("revokes sessions and audits suspension", async () => {
    const { service, audits, calls } = setup();
    await service.setStatus("staff-2", "suspended", "admin-1");
    expect(calls).toEqual(["sessions.revoked"]);
    expect(audits[0]).toMatchObject({ action: "staff.status_changed" });
  });

  it("audits role assignment", async () => {
    const { service, audits } = setup();
    await service.assignRole("staff-2", "role-1", "admin-1");
    expect(audits[0]).toMatchObject({
      action: "staff.role_assigned",
      subjectId: "staff-2",
      metadata: { roleId: "role-1" },
    });
  });

  it("rejects delegation of a role the delegator does not hold", async () => {
    const { service, withoutDelegatorRole } = setup();
    withoutDelegatorRole();
    await expect(
      service.createDelegation(
        {
          delegatorStaffId: "staff-1",
          delegateeStaffId: "staff-2",
          roleId: "role-1",
          startsAt: new Date("2026-08-20T10:00:00.000Z"),
          endsAt: new Date("2026-08-21T10:00:00.000Z"),
        },
        "admin-1"
      )
    ).rejects.toBeInstanceOf(StaffManagementError);
  });
});
