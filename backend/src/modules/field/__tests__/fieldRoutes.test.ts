import express from "express";
import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createFieldRouter } from "../fieldRoutes";
import { FieldServiceError } from "../attendanceService";

const services = {
  attendance: {
    clockIn: vi.fn().mockResolvedValue({ id: "session-1" }),
    clockOut: vi.fn().mockResolvedValue({ id: "session-1" }),
    attendanceHistory: vi.fn().mockResolvedValue([]),
    listLeave: vi.fn().mockResolvedValue([]),
    requestLeave: vi.fn().mockResolvedValue({ id: "leave-1" }),
    cancelLeave: vi.fn().mockResolvedValue({ id: "leave-1" }),
  },
  routes: {
    routeForDate: vi.fn().mockResolvedValue(null),
    routeHistory: vi.fn().mockResolvedValue([]),
    skipStop: vi.fn().mockResolvedValue({ id: "stop-1" }),
  },
  activities: {
    log: vi.fn().mockResolvedValue({ activity: { id: "activity-1" }, idempotent: false }),
    forRetailer: vi.fn().mockResolvedValue([]),
    forSalesperson: vi.fn().mockResolvedValue([]),
  },
  tasks: {
    forSalesperson: vi.fn().mockResolvedValue([]),
    updateStatus: vi.fn().mockResolvedValue({ id: "task-1" }),
  },
  tracking: {
    state: vi.fn().mockResolvedValue({ tracking: false, reason: "off_duty" }),
    ingest: vi.fn().mockResolvedValue({ accepted: 1, duplicates: 0, rejected: [] }),
  },
  expenses: {
    list: vi.fn().mockResolvedValue([]),
    submit: vi.fn().mockResolvedValue({ id: "expense-1" }),
  },
  issues: {
    list: vi.fn().mockResolvedValue([]),
    raise: vi.fn().mockResolvedValue({ id: "issue-1" }),
  },
  dashboard: {
    today: vi.fn().mockResolvedValue({ date: "2026-03-10" }),
    performance: vi.fn().mockResolvedValue({}),
    activityFeed: vi.fn().mockResolvedValue([]),
    customerMap: vi.fn().mockResolvedValue({ customers: [] }),
  },
} as any;

const FIELD_PERMISSIONS = [
  "attendance.manage_self",
  "route.execute",
  "activity.log",
  "task.complete",
  "expense.submit",
  "issue.raise",
  "location.view",
];

function app(permissions: string[] = FIELD_PERMISSIONS, staffId = "staff-1") {
  const application = express();
  application.use(express.json());
  application.use(
    createFieldRouter({
      authenticate: (req, _res, next) => {
        (req as any).staffAuth = { staffId, permissions, delegationIds: [] };
        next();
      },
      services,
    })
  );
  return application;
}

const coordinates = { latitude: 18.52, longitude: 73.85, accuracyMeters: 12 };

beforeEach(() => {
  for (const service of Object.values(services)) {
    for (const fn of Object.values(service as Record<string, any>)) (fn as any).mockClear?.();
  }
});

describe("field routes always act on the caller's own identity", () => {
  it("clocks in as the session's staff member, ignoring any body id", async () => {
    const response = await request(app())
      .post("/field/attendance/start")
      .send({ ...coordinates, salespersonId: "staff-999" });

    expect(response.status).toBe(201);
    expect(services.attendance.clockIn).toHaveBeenCalledWith(
      expect.objectContaining({ salespersonId: "staff-1" })
    );
  });

  it("logs activity as the session's staff member", async () => {
    const response = await request(app())
      .post("/field/activities")
      .send({
        retailerId: "00000000-0000-0000-0000-000000000001",
        type: "stock_check",
        salespersonId: "staff-999",
      });

    expect(response.status).toBe(201);
    expect(services.activities.log).toHaveBeenCalledWith(
      expect.objectContaining({ salespersonId: "staff-1" })
    );
  });

  it("reads the route for the caller only", async () => {
    await request(app()).get("/field/route?salespersonId=staff-999");
    expect(services.routes.routeForDate).toHaveBeenCalledWith("staff-1", expect.any(Date));
  });
});

describe("field route permissions", () => {
  const cases: Array<[string, string, "get" | "post", string]> = [
    ["today", "route.execute", "get", "/field/today"],
    ["clock in", "attendance.manage_self", "post", "/field/attendance/start"],
    ["clock out", "attendance.manage_self", "post", "/field/attendance/end"],
    ["attendance history", "attendance.manage_self", "get", "/field/attendance"],
    ["leave request", "attendance.manage_self", "post", "/field/leave"],
    ["route", "route.execute", "get", "/field/route"],
    ["activity log", "activity.log", "post", "/field/activities"],
    ["tasks", "task.complete", "get", "/field/tasks"],
    ["tracking state", "attendance.manage_self", "get", "/field/tracking/state"],
    ["ping ingest", "attendance.manage_self", "post", "/field/tracking/pings"],
    ["expenses", "expense.submit", "get", "/field/expenses"],
    ["issues", "issue.raise", "get", "/field/issues"],
    ["performance", "route.execute", "get", "/field/performance"],
    ["customer map", "location.view", "get", "/field/customers/map"],
  ];

  for (const [label, permission, method, path] of cases) {
    it(`refuses ${label} without ${permission}`, async () => {
      const withoutIt = FIELD_PERMISSIONS.filter((name) => name !== permission);
      const response = await request(app(withoutIt))[method](path).send({});
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ error: "permission_required", permission });
    });
  }

  it("refuses everything to a staff member with no field permissions", async () => {
    const response = await request(app([])).get("/field/today");
    expect(response.status).toBe(403);
  });
});

describe("field route validation", () => {
  it("rejects a clock-in without a usable coordinate", async () => {
    const response = await request(app()).post("/field/attendance/start").send({ latitude: 18.5 });
    expect(response.status).toBe(400);
    expect(services.attendance.clockIn).not.toHaveBeenCalled();
  });

  it("rejects an unknown activity type before it reaches the service", async () => {
    const response = await request(app())
      .post("/field/activities")
      .send({ retailerId: "00000000-0000-0000-0000-000000000001", type: "danced" });
    expect(response.status).toBe(400);
    expect(services.activities.log).not.toHaveBeenCalled();
  });

  it("requires a reason to skip a planned stop", async () => {
    const response = await request(app()).post("/field/route/stops/stop-1/skip").send({});
    expect(response.status).toBe(400);
    expect(services.routes.skipStop).not.toHaveBeenCalled();
  });

  it("caps a ping batch", async () => {
    const pings = Array.from({ length: 300 }, (_, index) => ({
      clientReference: `ping-${String(index).padStart(8, "0")}`,
      recordedAt: new Date().toISOString(),
      latitude: 18.5,
      longitude: 73.8,
      accuracyMeters: 12,
    }));
    const response = await request(app()).post("/field/tracking/pings").send({ pings });
    expect(response.status).toBe(400);
    expect(services.tracking.ingest).not.toHaveBeenCalled();
  });

  it("answers a replayed activity with 200 rather than a second 201", async () => {
    services.activities.log.mockResolvedValueOnce({
      activity: { id: "activity-1" },
      idempotent: true,
    });
    const response = await request(app())
      .post("/field/activities")
      .send({
        retailerId: "00000000-0000-0000-0000-000000000001",
        type: "note",
        clientReference: "device-abc-0001",
      });
    expect(response.status).toBe(200);
  });

  it("passes a service error through with its own status and code", async () => {
    services.attendance.clockIn.mockRejectedValueOnce(
      new FieldServiceError("workday_already_open", 409)
    );
    const response = await request(app()).post("/field/attendance/start").send(coordinates);
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ error: "workday_already_open" });
  });
});
