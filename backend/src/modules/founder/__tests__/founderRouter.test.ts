import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createFounderRouter } from "../founderRouter";
import { Permissions } from "../../identity/roleCatalog";

const pulseService = {
  getPulse: vi.fn().mockResolvedValue({
    asOf: "2026-09-02T10:00:00.000Z",
    metrics: [],
    pendingDecisions: { count: 0, label: "none" },
  }),
};
const trendsService = {
  getTrends: vi.fn().mockResolvedValue({ period: "30D", trends: [] }),
};
const issuesService = {
  list: vi.fn().mockResolvedValue([]),
  detail: vi.fn().mockResolvedValue(null),
};
const decisionsService = {
  list: vi.fn().mockResolvedValue({ decisions: [], unavailableTypes: [] }),
  detail: vi.fn(),
  decide: vi.fn(),
  askOwner: vi.fn(),
};
const briefService = {
  getBrief: vi.fn().mockResolvedValue({ kind: "morning", statements: [] }),
};

function app(permissions: string[]) {
  const server = express();
  server.use(express.json());
  server.use(
    "/founder",
    createFounderRouter({
      authenticate: (req, _res, next) => {
        (req as any).staffAuth = {
          staffId: "staff-founder",
          permissions,
          delegationIds: [],
        };
        next();
      },
      pulseService: pulseService as any,
      trendsService: trendsService as any,
      issuesService: issuesService as any,
      decisionsService: decisionsService as any,
      briefService: briefService as any,
    })
  );
  return server;
}

describe("founder authorization", () => {
  it("refuses staff without founder.view", async () => {
    const response = await request(app([Permissions.STAFF_MANAGE])).get("/founder/pulse");
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ error: "permission_required", permission: "founder.view" });
    expect(pulseService.getPulse).not.toHaveBeenCalled();
  });

  it("does not treat platform-style ops permissions as founder access", async () => {
    const response = await request(app(["org.view_all", "legal.decide"])).get("/founder/pulse");
    expect(response.status).toBe(403);
  });

  it("returns pulse for founder.view", async () => {
    const response = await request(app([Permissions.FOUNDER_VIEW])).get("/founder/pulse");
    expect(response.status).toBe(200);
    expect(pulseService.getPulse).toHaveBeenCalledWith(
      expect.objectContaining({ staffId: "staff-founder" })
    );
  });

  it("returns trends, issues, decisions, and brief for founder.view", async () => {
    const server = app([Permissions.FOUNDER_VIEW]);
    expect((await request(server).get("/founder/trends?period=7D")).status).toBe(200);
    expect((await request(server).get("/founder/issues")).status).toBe(200);
    expect((await request(server).get("/founder/decisions")).status).toBe(200);
    expect((await request(server).get("/founder/brief?kind=morning")).status).toBe(200);
    expect(trendsService.getTrends).toHaveBeenCalledWith({ period: "7D" });
  });

  it("requires founder.decide for approve and decline", async () => {
    const viewOnly = app([Permissions.FOUNDER_VIEW]);
    expect((await request(viewOnly).post("/founder/decisions/x/approve")).status).toBe(403);
    const allowed = app([Permissions.FOUNDER_VIEW, Permissions.FOUNDER_DECIDE]);
    decisionsService.decide.mockResolvedValue({ id: "x", status: "approved" });
    expect((await request(allowed).post("/founder/decisions/x/approve")).status).toBe(200);
    expect(decisionsService.decide).toHaveBeenCalledWith(
      expect.objectContaining({ id: "x", result: "approved", actorStaffId: "staff-founder" })
    );
  });
});
