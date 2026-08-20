import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { OtpRouteService } from "../otpRoutes";
import {
  createSessionRouter,
  type SessionRouteService,
} from "../sessionRoutes";

const claims = {
  sub: "staff-1",
  realm: "staff" as const,
  sessionId: "session-1",
  permissions: ["staff.manage"],
  delegationIds: [],
  iat: 1,
  exp: 2,
};

function setup() {
  const now = new Date("2026-08-20T10:00:00.000Z");
  const session = {
    id: "session-1",
    realm: "staff",
    subjectId: "staff-1",
    tokenFamilyId: "family-1",
    refreshTokenHash: "private-hash",
    deviceName: "Field iPhone",
    userAgent: null,
    ipHash: null,
    createdAt: now,
    lastUsedAt: now,
    expiresAt: new Date("2026-09-19T10:00:00.000Z"),
    revokedAt: null,
  };
  const sessions: SessionRouteService = {
    authenticateAccessToken: vi.fn().mockResolvedValue(claims),
    refresh: vi.fn().mockResolvedValue({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      session,
    }),
    revokeSession: vi.fn().mockResolvedValue(undefined),
    revokeAll: vi.fn().mockResolvedValue(undefined),
    listSessions: vi.fn().mockResolvedValue([session]),
    elevateSession: vi.fn().mockResolvedValue({
      accessToken: "elevated-access",
      stepUpUntil: new Date("2026-08-20T10:10:00.000Z"),
    }),
  };
  const otpService: OtpRouteService = {
    request: vi.fn().mockResolvedValue({ accepted: true, challengeId: "challenge-1" }),
    verify: vi.fn().mockResolvedValue({ verified: true }),
  };
  const app = express();
  app.use(express.json());
  app.use(
    createSessionRouter({
      realm: "staff",
      sessions,
      otpService,
      resolvePhone: async () => "+919812345670",
    })
  );
  return { app, otpService, sessions };
}

describe("session routes", () => {
  it("rotates refresh tokens without returning private session fields", async () => {
    const { app, sessions } = setup();
    const response = await request(app)
      .post("/refresh")
      .send({ refreshToken: "old-refresh-token-that-is-long" });
    expect(response.status).toBe(200);
    expect(sessions.refresh).toHaveBeenCalledWith("old-refresh-token-that-is-long");
    expect(response.body).toEqual({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      session: expect.objectContaining({ id: "session-1", deviceName: "Field iPhone" }),
    });
    expect(response.body.session).not.toHaveProperty("refreshTokenHash");
    expect(response.body.session).not.toHaveProperty("tokenFamilyId");
  });

  it("lists and revokes only through an authenticated identity", async () => {
    const { app, sessions } = setup();
    const list = await request(app).get("/sessions").set("authorization", "Bearer access");
    expect(list.status).toBe(200);
    expect(sessions.listSessions).toHaveBeenCalledWith("staff", "staff-1");

    const revoke = await request(app)
      .post("/sessions/session-1/revoke")
      .set("authorization", "Bearer access");
    expect(revoke.status).toBe(204);
    expect(sessions.revokeSession).toHaveBeenCalledWith("session-1", "staff", "staff-1");
  });

  it("requires a fresh OTP before issuing step-up access", async () => {
    const { app, otpService, sessions } = setup();
    const response = await request(app)
      .post("/step-up")
      .set("authorization", "Bearer access")
      .send({ challengeId: "challenge-1", otp: "123456" });

    expect(response.status).toBe(200);
    expect(otpService.verify).toHaveBeenCalledWith({
      challengeId: "challenge-1",
      realm: "staff",
      phone: "+919812345670",
      code: "123456",
    });
    expect(sessions.elevateSession).toHaveBeenCalledWith(
      "session-1",
      "staff",
      "staff-1"
    );
    expect(response.body.accessToken).toBe("elevated-access");
  });
});
