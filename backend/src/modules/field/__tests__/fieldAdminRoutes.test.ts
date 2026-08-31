import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFieldAdminRouter } from "../fieldAdminRoutes";

const services = {
  attendance: {
    teamAttendance: vi.fn().mockResolvedValue([]),
    attendanceHistory: vi.fn().mockResolvedValue([]),
    listLeave: vi.fn().mockResolvedValue([]),
    decideLeave: vi.fn().mockResolvedValue({ id: "leave-1" }),
  },
  routes: {
    listPlans: vi.fn().mockResolvedValue([]),
    upsertPlan: vi.fn().mockResolvedValue({ id: "plan-1" }),
    publishPlan: vi.fn().mockResolvedValue({ id: "plan-1" }),
    routeForDate: vi.fn().mockResolvedValue(null),
  },
  tasks: {
    list: vi.fn().mockResolvedValue([]),
    assign: vi.fn().mockResolvedValue({ id: "task-1" }),
    cancel: vi.fn().mockResolvedValue({ id: "task-1" }),
  },
  expenses: { list: vi.fn().mockResolvedValue([]), decide: vi.fn().mockResolvedValue({}) },
  issues: { list: vi.fn().mockResolvedValue([]), updateStatus: vi.fn().mockResolvedValue({}) },
  tracking: {
    lastKnownPositions: vi.fn().mockResolvedValue([]),
    history: vi.fn().mockResolvedValue({ session: null, pings: [] }),
  },
  dashboard: { metricsFor: vi.fn().mockResolvedValue({}) },
} as any;

const MANAGER_PERMISSIONS = [
  "attendance.review",
  "route.manage",
  "expense.review",
  "issue.review",
  "location.view",
];

function app(permissions: string[] = MANAGER_PERMISSIONS) {
  const application = express();
  application.use(express.json());
  application.use(
    createFieldAdminRouter({
      authenticate: (req, _res, next) => {
        (req as any).staffAuth = { staffId: "manager-1", permissions, delegationIds: [] };
        next();
      },
      services,
    })
  );
  return application;
}

beforeEach(() => {
  for (const service of Object.values(services)) {
    for (const fn of Object.values(service as Record<string, any>)) (fn as any).mockClear?.();
  }
});

describe("back-office field permissions", () => {
  const cases: Array<[string, string, "get" | "post", string]> = [
    ["team attendance", "attendance.review", "get", "/field/attendance"],
    ["leave queue", "attendance.review", "get", "/field/leave"],
    ["leave decision", "attendance.review", "post", "/field/leave/leave-1/decision"],
    ["route list", "route.manage", "get", "/field/routes"],
    ["route save", "route.manage", "post", "/field/routes"],
    ["route publish", "route.manage", "post", "/field/routes/plan-1/publish"],
    ["task assignment", "route.manage", "post", "/field/tasks"],
    ["expense queue", "expense.review", "get", "/field/expenses"],
    ["expense decision", "expense.review", "post", "/field/expenses/expense-1/decision"],
    ["issue queue", "issue.review", "get", "/field/issues"],
    ["issue status", "issue.review", "post", "/field/issues/issue-1/status"],
    ["live positions", "location.view", "get", "/field/tracking/live"],
    ["team view", "attendance.review", "get", "/field/team"],
    ["targets", "route.manage", "get", "/field/targets"],
  ];

  for (const [label, permission, method, path] of cases) {
    it(`refuses ${label} without ${permission}`, async () => {
      const response = await request(app(MANAGER_PERMISSIONS.filter((p) => p !== permission)))
        [method](path)
        .send({});
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ error: "permission_required", permission });
    });
  }

  it("refuses the whole back office to a plain salesperson", async () => {
    const salesperson = ["attendance.manage_self", "route.execute", "activity.log"];
    for (const path of ["/field/attendance", "/field/leave", "/field/routes", "/field/expenses"]) {
      const response = await request(app(salesperson)).get(path);
      expect(response.status).toBe(403);
    }
  });
});

describe("back-office field behaviour", () => {
  it("stamps the decision with the reviewer's own identity", async () => {
    const response = await request(app())
      .post("/field/leave/leave-1/decision")
      .send({ decision: "approved", note: "Covered" });

    expect(response.status).toBe(200);
    expect(services.attendance.decideLeave).toHaveBeenCalledWith(
      expect.objectContaining({ leaveId: "leave-1", decidedByStaffId: "manager-1" })
    );
  });

  it("rejects a decision that is neither approve nor reject", async () => {
    const response = await request(app())
      .post("/field/expenses/expense-1/decision")
      .send({ decision: "maybe" });
    expect(response.status).toBe(400);
    expect(services.expenses.decide).not.toHaveBeenCalled();
  });

  it("rejects a route with no stops", async () => {
    const response = await request(app())
      .post("/field/routes")
      .send({
        salespersonId: "00000000-0000-0000-0000-000000000001",
        planDate: "2026-03-10",
        stops: [],
      });
    expect(response.status).toBe(400);
    expect(services.routes.upsertPlan).not.toHaveBeenCalled();
  });

  it("records who saved a route plan", async () => {
    const response = await request(app())
      .post("/field/routes")
      .send({
        salespersonId: "00000000-0000-0000-0000-000000000001",
        planDate: "2026-03-10",
        stops: [{ retailerId: "00000000-0000-0000-0000-000000000002" }],
      });
    expect(response.status).toBe(201);
    expect(services.routes.upsertPlan).toHaveBeenCalledWith(
      expect.objectContaining({ createdByStaffId: "manager-1" })
    );
  });

  it("summarises a team member's route as progress only, not their stop list", async () => {
    services.attendance.teamAttendance.mockResolvedValueOnce([
      { salespersonId: "staff-1", name: "Ravi", mark: "present" },
    ]);
    services.routes.routeForDate.mockResolvedValueOnce({
      id: "plan-1",
      status: "published",
      progress: { total: 5, visited: 2, skipped: 0, pending: 3, completionPct: 40 },
      stops: [{ id: "stop-1" }],
      nextStop: { id: "stop-1" },
    });

    const response = await request(app()).get("/field/team");
    expect(response.status).toBe(200);
    expect(response.body.members[0].route).toEqual({
      id: "plan-1",
      status: "published",
      progress: { total: 5, visited: 2, skipped: 0, pending: 3, completionPct: 40 },
    });
  });
});
