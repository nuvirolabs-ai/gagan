import type { NextFunction, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import {
  createRequireSession,
  requireRecentStepUp,
  type SessionAuthenticator,
} from "../sessionAuth";
import type { StaffAuthedRequest } from "../permissions";

function response() {
  const status = vi.fn().mockReturnThis();
  const json = vi.fn();
  return { status, json } as unknown as Response;
}

describe("createRequireSession", () => {
  it("authenticates a bearer token and attaches only server-resolved authority", async () => {
    const authenticator: SessionAuthenticator = {
      authenticateAccessToken: vi.fn().mockResolvedValue({
        sub: "staff-1",
        realm: "staff",
        sessionId: "session-1",
        permissions: ["staff.manage"],
        delegationIds: ["delegation-1"],
        iat: 1,
        exp: 2,
      }),
    };
    const req = {
      headers: { authorization: "Bearer access-token" },
      body: { permissions: ["legal.decide"] },
    } as unknown as StaffAuthedRequest;
    const next = vi.fn() as NextFunction;

    await createRequireSession("staff", authenticator)(req, response(), next);

    expect(authenticator.authenticateAccessToken).toHaveBeenCalledWith(
      "access-token",
      "staff"
    );
    expect(req.staffAuth).toEqual({
      staffId: "staff-1",
      sessionId: "session-1",
      permissions: ["staff.manage"],
      delegationIds: ["delegation-1"],
      stepUpUntil: undefined,
    });
    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects a missing bearer token", async () => {
    const res = response();
    await createRequireSession("staff", {
      authenticateAccessToken: vi.fn(),
    })({ headers: {} } as StaffAuthedRequest, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe("requireRecentStepUp", () => {
  it("denies sensitive action without recent step-up", () => {
    const req = {
      staffAuth: {
        staffId: "staff-1",
        sessionId: "session-1",
        permissions: ["credit.block"],
        delegationIds: [],
      },
    } as unknown as StaffAuthedRequest;
    const res = response();
    requireRecentStepUp(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "step_up_required" });
  });
});
