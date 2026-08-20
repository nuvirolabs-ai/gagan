import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createOtpRouter, type OtpRouteService } from "../otpRoutes";

function appFor(findAccount: (phone: string) => Promise<{ id: string } | null>) {
  const otpService: OtpRouteService = {
    request: vi.fn().mockResolvedValue({ accepted: true, challengeId: "challenge-1" }),
    verify: vi.fn().mockResolvedValue({ verified: true }),
  };
  const issueIdentity = vi.fn().mockResolvedValue({ accessToken: "token" });
  const app = express();
  app.use(express.json());
  app.use(
    createOtpRouter({
      realm: "retailer",
      otpService,
      findAccount,
      issueIdentity,
    })
  );
  return { app, issueIdentity, otpService };
}

describe("OTP routes", () => {
  it("returns the same 202 response for known and unknown accounts", async () => {
    const known = appFor(async () => ({ id: "retailer-1" }));
    const unknown = appFor(async () => null);

    const knownResponse = await request(known.app)
      .post("/otp/request")
      .set("x-request-id", "request-1")
      .send({ phone: "9812345670" });
    const unknownResponse = await request(unknown.app)
      .post("/otp/request")
      .set("x-request-id", "request-1")
      .send({ phone: "9812345670" });

    expect(knownResponse.status).toBe(202);
    expect(unknownResponse.status).toBe(202);
    expect(knownResponse.body).toEqual(unknownResponse.body);
    expect(knownResponse.body).toEqual({ accepted: true, challengeId: "challenge-1" });
    expect(known.otpService.request).toHaveBeenCalledWith(
      expect.objectContaining({ accountExists: true, correlationId: "request-1" })
    );
    expect(unknown.otpService.request).toHaveBeenCalledWith(
      expect.objectContaining({ accountExists: false, correlationId: "request-1" })
    );
  });

  it("issues identity only after OTP verification", async () => {
    const { app, issueIdentity, otpService } = appFor(async () => ({ id: "retailer-1" }));
    const response = await request(app).post("/otp/verify").send({
      challengeId: "challenge-1",
      phone: "9812345670",
      otp: "123456",
    });

    expect(response.status).toBe(200);
    expect(otpService.verify).toHaveBeenCalledWith({
      challengeId: "challenge-1",
      realm: "retailer",
      phone: "9812345670",
      code: "123456",
    });
    expect(issueIdentity).toHaveBeenCalledWith({ id: "retailer-1" }, expect.anything());
    expect(response.body).toEqual({ accessToken: "token" });
  });
});
