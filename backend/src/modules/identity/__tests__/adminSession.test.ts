import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { sendAdminSession } from "../adminSession";

describe("admin session response", () => {
  it("keeps the refresh token out of JavaScript-visible response data", async () => {
    const now = new Date("2026-08-20T10:00:00.000Z");
    const app = express();
    app.post("/login", (_req, res) => {
      sendAdminSession(
        res,
        {
          accessToken: "access-token",
          refreshToken: "refresh-token-that-is-long-enough",
          session: {
            id: "session-1",
            realm: "admin",
            subjectId: "staff-1",
            tokenFamilyId: "family-1",
            refreshTokenHash: "hash",
            deviceName: "Admin browser",
            userAgent: null,
            ipHash: null,
            createdAt: now,
            lastUsedAt: now,
            expiresAt: new Date("2026-09-19T10:00:00.000Z"),
            revokedAt: null,
          },
        },
        { id: "admin-1", name: "Ops Admin", email: "admin@gagan.test" },
        "production"
      );
    });

    const response = await request(app).post("/login");
    expect(response.body).toEqual({
      accessToken: "access-token",
      session: expect.objectContaining({ id: "session-1" }),
      admin: { id: "admin-1", name: "Ops Admin", email: "admin@gagan.test" },
    });
    expect(response.text).not.toContain("refresh-token");
    expect(response.headers["set-cookie"][0]).toContain("gagan_admin_refresh=");
    expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"][0]).toContain("Secure");
  });
});
