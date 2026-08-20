import express, { type RequestHandler } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createAdminStaffRouter, type StaffManagement } from "../adminStaffRoutes";
import { StaffManagementError } from "../staffManagementService";

function setup(permissions = ["staff.manage"]) {
  const service: StaffManagement = {
    listStaff: vi.fn().mockResolvedValue([{ id: "staff-1", name: "Ravi" }]),
    listRoles: vi.fn().mockResolvedValue([{ id: "role-1", name: "salesperson" }]),
    createStaff: vi.fn().mockResolvedValue({ id: "staff-2", name: "Meera" }),
    setStatus: vi.fn().mockResolvedValue({ id: "staff-1", status: "suspended" }),
    assignRole: vi.fn().mockResolvedValue(undefined),
    removeRole: vi.fn().mockResolvedValue(undefined),
    createDelegation: vi.fn().mockResolvedValue({ id: "delegation-1" }),
    revokeDelegation: vi.fn().mockResolvedValue(undefined),
  };
  const authenticate: RequestHandler = (req, _res, next) => {
    (req as any).staffAuth = {
      staffId: "admin-staff-1",
      permissions,
      delegationIds: [],
      sessionId: "session-1",
    };
    next();
  };
  const app = express();
  app.use(express.json());
  app.use(createAdminStaffRouter({ service, authenticate }));
  return { app, service };
}

describe("admin staff API", () => {
  it("denies staff administration without staff.manage", async () => {
    const { app, service } = setup([]);
    const response = await request(app).get("/staff");
    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "permission_required",
      permission: "staff.manage",
    });
    expect(service.listStaff).not.toHaveBeenCalled();
  });

  it("lists roles and staff", async () => {
    const { app } = setup();
    expect((await request(app).get("/staff")).status).toBe(200);
    expect((await request(app).get("/roles")).body.roles).toEqual([
      { id: "role-1", name: "salesperson" },
    ]);
  });

  it("creates and suspends a staff user with the authenticated actor", async () => {
    const { app, service } = setup();
    const created = await request(app).post("/staff").send({
      name: "Meera Shah",
      phone: "9876543210",
      email: "meera@example.com",
      employeeRef: "COLL-001",
    });
    expect(created.status).toBe(201);
    expect(service.createStaff).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Meera Shah" }),
      "admin-staff-1"
    );

    const suspended = await request(app)
      .patch("/staff/staff-1/status")
      .send({ status: "suspended" });
    expect(suspended.status).toBe(200);
    expect(service.setStatus).toHaveBeenCalledWith(
      "staff-1",
      "suspended",
      "admin-staff-1"
    );
  });

  it("assigns roles and creates bounded delegation", async () => {
    const { app, service } = setup();
    const role = await request(app)
      .post("/staff/staff-1/roles")
      .send({ roleId: "role-1" });
    expect(role.status).toBe(204);
    expect(service.assignRole).toHaveBeenCalledWith(
      "staff-1",
      "role-1",
      "admin-staff-1"
    );

    const delegation = await request(app)
      .post("/staff/staff-2/delegations")
      .send({
        delegatorStaffId: "staff-1",
        roleId: "role-1",
        startsAt: "2026-08-20T10:00:00.000Z",
        endsAt: "2026-08-21T10:00:00.000Z",
      });
    expect(delegation.status).toBe(201);
    expect(service.createDelegation).toHaveBeenCalledWith(
      expect.objectContaining({ delegateeStaffId: "staff-2", roleId: "role-1" }),
      "admin-staff-1"
    );
  });

  it("returns a safe business error for rejected mutations", async () => {
    const { app, service } = setup();
    vi.mocked(service.createDelegation).mockRejectedValue(
      new StaffManagementError("delegator_role_required", 409)
    );

    const response = await request(app)
      .post("/staff/staff-2/delegations")
      .send({
        delegatorStaffId: "staff-1",
        roleId: "role-1",
        startsAt: "2026-08-20T10:00:00.000Z",
        endsAt: "2026-08-21T10:00:00.000Z",
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "delegator_role_required" });
  });
});
