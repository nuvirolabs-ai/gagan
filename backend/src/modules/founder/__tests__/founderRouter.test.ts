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

  it("does not expose a decision mutation on the pulse gate router", async () => {
    const response = await request(app([Permissions.FOUNDER_VIEW, Permissions.FOUNDER_DECIDE])).post(
      "/founder/decisions/x/approve"
    );
    expect(response.status).toBe(404);
  });
});
