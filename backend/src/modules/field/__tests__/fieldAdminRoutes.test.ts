import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFieldAdminRouter } from "../fieldAdminRoutes";
import { ScopeError } from "../../org/scope";

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
    listBeatTemplates: vi.fn().mockResolvedValue([]),
    saveBeatTemplate: vi.fn().mockResolvedValue({ id: "beat-1" }),
    applyBeatTemplate: vi.fn().mockResolvedValue({ id: "plan-2", status: "draft" }),
  },
  tasks: {
    list: vi.fn().mockResolvedValue([]),
    marketingHistoryForAdmin: vi.fn().mockResolvedValue([]),
    assign: vi.fn().mockResolvedValue({ id: "task-1" }),
    cancel: vi.fn().mockResolvedValue({ id: "task-1" }),
  },
  expenses: { list: vi.fn().mockResolvedValue([]), claimants: vi.fn().mockResolvedValue([]), historyFor: vi.fn().mockResolvedValue({ salesperson: { id: "staff-1", name: "Ravi" }, expenses: [], totals: {}, nextCursor: null }), receiptFor: vi.fn().mockResolvedValue({ receiptUrl: "https://signed.example/fresh" }), decide: vi.fn().mockResolvedValue({}) },
  issues: { list: vi.fn().mockResolvedValue([]), updateStatus: vi.fn().mockResolvedValue({}) },
  tracking: {
    lastKnownPositions: vi.fn().mockResolvedValue([]),
    history: vi.fn().mockResolvedValue({ session: null, pings: [] }),
  },
  dashboard: { metricsFor: vi.fn().mockResolvedValue({}) },
} as any;

const scopes = {
  resolveFor: vi.fn().mockResolvedValue({ staffIds: ["staff-1", "staff-2"] }),
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
      scopes,
    })
  );
  return application;
}

beforeEach(() => {
  scopes.resolveFor.mockReset().mockResolvedValue({ staffIds: ["staff-1", "staff-2"] });
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
    ["beat list", "route.manage", "get", "/field/beat-templates"],
    ["beat save", "route.manage", "post", "/field/beat-templates"],
    ["beat apply", "route.manage", "post", "/field/beat-templates/beat-1/apply"],
    ["task assignment", "route.manage", "post", "/field/tasks"],
    ["retailer marketing history", "route.manage", "get", "/field/retailers/retailer-1/marketing-history"],
    ["expense queue", "expense.review", "get", "/field/expenses"],
    ["expense claimants", "expense.review", "get", "/field/expenses/claimants"],
    ["expense history", "expense.review", "get", "/field/expenses/staff/staff-1"],
    ["expense receipt", "expense.review", "get", "/field/expenses/staff/staff-1/receipts/expense-1"],
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
  it("passes only the caller's reporting scope to claimant discovery", async () => {
    const response = await request(app()).get("/field/expenses/claimants");
    expect(response.status).toBe(200);
    expect(services.expenses.claimants).toHaveBeenCalledWith(["staff-1", "staff-2"]);
  });

  it("scopes per-person expense history before reading it", async () => {
    const response = await request(app()).get("/field/expenses/staff/staff-1?cursor=expense-49");
    expect(response.status).toBe(200);
    expect(scopes.resolveFor).toHaveBeenCalledWith(
      expect.objectContaining({ staffId: "manager-1" }), "staff-1"
    );
    expect(services.expenses.historyFor).toHaveBeenCalledWith("staff-1", "expense-49");
  });

  it("does not read another team's expense history", async () => {
    scopes.resolveFor.mockRejectedValueOnce(new ScopeError(403, "outside_reporting_scope"));
    const response = await request(app()).get("/field/expenses/staff/staff-else");
    expect(response.status).toBe(403);
    expect(response.body.error).toBe("outside_reporting_scope");
    expect(services.expenses.historyFor).not.toHaveBeenCalled();
  });

  it("scopes a fresh receipt link and refuses an out-of-scope person", async () => {
    const allowed = await request(app()).get("/field/expenses/staff/staff-1/receipts/expense-1");
    expect(allowed.status).toBe(200);
    expect(allowed.body).toEqual({ receiptUrl: "https://signed.example/fresh" });
    expect(services.expenses.receiptFor).toHaveBeenCalledWith("staff-1", "expense-1");
    services.expenses.receiptFor.mockClear();
    scopes.resolveFor.mockRejectedValueOnce(new ScopeError(403, "outside_reporting_scope"));
    const refused = await request(app()).get("/field/expenses/staff/staff-else/receipts/expense-1");
    expect(refused.status).toBe(403);
    expect(services.expenses.receiptFor).not.toHaveBeenCalled();
  });

  it("reads retailer marketing history only for the caller's reporting scope", async () => {
    const response = await request(app()).get("/field/retailers/retailer-1/marketing-history");

    expect(response.status).toBe(200);
    expect(scopes.resolveFor).toHaveBeenCalledWith(
      expect.objectContaining({ staffId: "manager-1" }),
      undefined
    );
    expect(services.tasks.marketingHistoryForAdmin).toHaveBeenCalledWith({
      retailerId: "retailer-1",
      scopeStaffIds: ["staff-1", "staff-2"],
    });
  });

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

  it("scopes a leader's template list to the requested salesperson", async () => {
    const salespersonId = "00000000-0000-0000-0000-000000000001";
    await request(app()).get(`/field/beat-templates?salespersonId=${salespersonId}`).expect(200);
    expect(scopes.resolveFor).toHaveBeenCalledWith(expect.objectContaining({ staffId: "manager-1" }), salespersonId);
    expect(services.routes.listBeatTemplates).toHaveBeenCalledWith({ salespersonId, scopeStaffIds: ["staff-1", "staff-2"] });
  });

  it("saves a leader template with server-stamped actor and applies only a draft", async () => {
    const salespersonId = "00000000-0000-0000-0000-000000000001";
    const body = { salespersonId, name: "North", stops: [{ retailerId: "00000000-0000-0000-0000-000000000002" }] };
    await request(app()).post("/field/beat-templates").send(body).expect(201);
    expect(services.routes.saveBeatTemplate).toHaveBeenCalledWith(expect.objectContaining({
      salespersonId, actorStaffId: "manager-1", origin: "leader",
    }));
    await request(app()).post("/field/beat-templates/beat-1/apply")
      .send({ salespersonId, planDate: "2026-10-01" }).expect(201);
    expect(services.routes.applyBeatTemplate).toHaveBeenCalledWith(expect.objectContaining({
      templateId: "beat-1", salespersonId, actorStaffId: "manager-1",
    }));
    expect(services.routes.publishPlan).not.toHaveBeenCalled();
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
