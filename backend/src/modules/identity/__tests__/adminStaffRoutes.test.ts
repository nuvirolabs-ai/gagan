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
    setupSellingLeader: vi.fn().mockResolvedValue({ staff: { id: "staff-1", salesRepId: "rep-1" }, roles: ["salesperson", "field_manager"] }),
    setupSalesperson: vi.fn().mockResolvedValue({ staff: { id: "staff-1", salesRepId: "rep-1" }, roles: ["salesperson"] }),
    setupManagerOnly: vi.fn().mockResolvedValue({ staff: { id: "staff-1" }, workspaceMode: "manager_only" }),
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
  it.each([
    ["list staff", (app: express.Express) => request(app).get("/staff")],
    ["list roles", (app: express.Express) => request(app).get("/roles")],
    ["create staff", (app: express.Express) => request(app).post("/staff").send({})],
    ["change status", (app: express.Express) => request(app).patch("/staff/staff-1/status").send({})],
    ["assign role", (app: express.Express) => request(app).post("/staff/staff-1/roles").send({})],
    ["remove role", (app: express.Express) => request(app).delete("/staff/staff-1/roles/role-1")],
    ["create delegation", (app: express.Express) => request(app).post("/staff/staff-1/delegations").send({})],
    ["setup salesperson", (app: express.Express) => request(app).post("/staff/staff-1/salesperson-setup").send({})],
    ["revoke delegation", (app: express.Express) => request(app).delete("/staff/delegations/delegation-1")],
  ])("denies %s without staff.manage", async (_name, buildRequest) => {
    const { app, service } = setup([]);
    const response = await buildRequest(app);
    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "permission_required",
      permission: "staff.manage",
    });
    for (const operation of Object.values(service)) {
      expect(operation).not.toHaveBeenCalled();
    }
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

  it("requires org.manage for hierarchy changes in a selling leader setup", async () => {
    const { app, service } = setup(["staff.manage"]);
    const reportId = "11111111-1111-4111-8111-111111111111";
    const denied = await request(app).post("/staff/staff-1/selling-leader-setup").send({ reportIds: [reportId] });
    expect(denied.status).toBe(403);
    expect(service.setupSellingLeader).not.toHaveBeenCalled();

    const allowed = setup(["staff.manage", "org.manage"]);
    const result = await request(allowed.app).post("/staff/staff-1/selling-leader-setup").send({ reportIds: [reportId] });
    expect(result.status).toBe(200);
    expect(allowed.service.setupSellingLeader).toHaveBeenCalledWith(
      expect.objectContaining({ staffId: "staff-1", reportIds: [reportId] }),
      "admin-staff-1"
    );
  });

  it("requires org.manage only when ordinary salesperson setup requests a reporting change", async () => {
    const managerId = "11111111-1111-4111-8111-111111111111";
    const staffOnly = setup(["staff.manage"]);
    expect((await request(staffOnly.app).post("/staff/staff-1/salesperson-setup").send({})).status).toBe(200);
    const denied = await request(staffOnly.app).post("/staff/staff-1/salesperson-setup").send({ managerId });
    expect(denied.status).toBe(403);
    expect(denied.body).toEqual({ error: "permission_required", permission: "org.manage" });
    expect((await request(staffOnly.app).post("/staff/salesperson-setup").send({ newStaff: {
      name: "New Seller", phone: "9876543210", email: "seller@test.invalid",
    }, managerId: null })).status).toBe(403);
    expect(staffOnly.service.setupSalesperson).toHaveBeenCalledTimes(1);

    const withHierarchy = setup(["staff.manage", "org.manage"]);
    const result = await request(withHierarchy.app).post("/staff/staff-1/salesperson-setup").send({ managerId });
    expect(result.status).toBe(200);
    expect(withHierarchy.service.setupSalesperson).toHaveBeenCalledWith(
      { staffId: "staff-1", managerId }, "admin-staff-1"
    );
    expect((await request(withHierarchy.app).post("/staff/staff-1/salesperson-setup").send({ reportIds: [] })).status).toBe(400);
  });
});
