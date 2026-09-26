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
    listBeatTemplates: vi.fn().mockResolvedValue([]),
    saveBeatTemplate: vi.fn().mockResolvedValue({ id: "beat-1" }),
  },
  activities: {
    log: vi.fn().mockResolvedValue({ activity: { id: "activity-1" }, idempotent: false }),
    forRetailer: vi.fn().mockResolvedValue([]),
    forSalesperson: vi.fn().mockResolvedValue([]),
  },
  tasks: {
    forSalesperson: vi.fn().mockResolvedValue([]),
    marketingHistoryForSalesperson: vi.fn().mockResolvedValue([]),
    updateStatus: vi.fn().mockResolvedValue({ id: "task-1" }),
    addEvidence: vi.fn().mockResolvedValue({ id: "evidence-1", signedUrl: "https://signed.example/photo" }),
    evidenceForSalesperson: vi.fn().mockResolvedValue([]),
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
    listForSalesperson: vi.fn().mockResolvedValue([]),
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
  it("reads issues through the authenticated salesperson's assigned-store scope", async () => {
    const response = await request(app(FIELD_PERMISSIONS, "staff-2"))
      .get("/field/issues?retailerId=retailer-1");
    expect(response.status).toBe(200);
    expect(services.issues.listForSalesperson).toHaveBeenCalledWith("staff-2", "retailer-1");
    expect(services.issues.list).not.toHaveBeenCalled();
  });

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

  it("uploads task evidence as the session's salesperson and reads assigned evidence", async () => {
    const uploaded = await request(app(FIELD_PERMISSIONS, "staff-7"))
      .post("/field/tasks/task-7/evidence")
      .send({
        contentType: "image/jpeg",
        bodyBase64: Buffer.from("photo").toString("base64"),
        latitude: 18.52,
        longitude: 73.85,
        accuracyMeters: 12,
        salespersonId: "staff-999",
        retailerId: "retailer-999",
      });

    expect(uploaded.status).toBe(201);
    expect(services.tasks.addEvidence).toHaveBeenCalledWith({
      taskId: "task-7",
      salespersonId: "staff-7",
      contentType: "image/jpeg",
      bodyBase64: Buffer.from("photo").toString("base64"),
      location: { latitude: 18.52, longitude: 73.85, accuracyMeters: 12 },
    });

    await request(app(FIELD_PERMISSIONS, "staff-7")).get("/field/tasks/task-7/evidence").expect(200);
    expect(services.tasks.evidenceForSalesperson).toHaveBeenCalledWith({ taskId: "task-7", salespersonId: "staff-7" });
  });

  it("reads retailer marketing history as the session's salesperson", async () => {
    const response = await request(app(FIELD_PERMISSIONS, "staff-7"))
      .get("/field/retailers/retailer-7/marketing-history");

    expect(response.status).toBe(200);
    expect(services.tasks.marketingHistoryForSalesperson).toHaveBeenCalledWith({
      retailerId: "retailer-7",
      salespersonId: "staff-7",
    });
  });

  it("reads the route for the caller only", async () => {
    await request(app()).get("/field/route?salespersonId=staff-999");
    expect(services.routes.routeForDate).toHaveBeenCalledWith("staff-1", expect.any(Date));
  });

  it("saves and edits only the session owner's self template", async () => {
    const body = { salespersonId: "staff-999", name: "My north beat", stops: [{ retailerId: "00000000-0000-0000-0000-000000000002" }] };
    const permissions = [...FIELD_PERMISSIONS, "route.manage_self"];
    await request(app(permissions, "staff-7")).post("/field/beat-templates").send(body).expect(201);
    await request(app(permissions, "staff-7")).put("/field/beat-templates/beat-1").send(body).expect(200);
    expect(services.routes.saveBeatTemplate).toHaveBeenLastCalledWith(expect.objectContaining({
      templateId: "beat-1", salespersonId: "staff-7", actorStaffId: "staff-7", origin: "self",
    }));
    await request(app(permissions, "staff-7")).get("/field/beat-templates?salespersonId=staff-999").expect(200);
    expect(services.routes.listBeatTemplates).toHaveBeenCalledWith({ salespersonId: "staff-7", origin: "self" });
  });

  it("denies template writes with route execution but without self-management", async () => {
    await request(app()).post("/field/beat-templates").send({}).expect(403);
    expect(services.routes.saveBeatTemplate).not.toHaveBeenCalled();
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
    ["task evidence", "task.complete", "post", "/field/tasks/task-1/evidence"],
    ["retailer marketing history", "task.complete", "get", "/field/retailers/retailer-1/marketing-history"],
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
  it("rejects partial task evidence coordinates", async () => {
    const response = await request(app())
      .post("/field/tasks/task-1/evidence")
      .send({ contentType: "image/jpeg", bodyBase64: Buffer.from("photo").toString("base64"), latitude: 18.52 });
    expect(response.status).toBe(400);
    expect(services.tasks.addEvidence).not.toHaveBeenCalled();
  });

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
