import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";

describe("health", () => {
  it("returns liveness without starting a network listener", async () => {
    const response = await request(createApp()).get("/health/live");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it("adds a correlation ID to every response", async () => {
    const response = await request(createApp()).get("/health/live");

    expect(response.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it("returns readiness after the dependency probe succeeds", async () => {
    const app = createApp({ readinessProbe: async () => undefined });

    const response = await request(app).get("/health/ready");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it("fails readiness without leaking dependency errors", async () => {
    const app = createApp({
      readinessProbe: async () => {
        throw new Error("database password leaked");
      },
    });

    const response = await request(app).get("/health/ready");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ ok: false });
    expect(response.text).not.toContain("password");
  });

  it("sets baseline HTTP security headers", async () => {
    const response = await request(createApp()).get("/health/live");

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });

  it("does not allow an unconfigured browser origin", async () => {
    const response = await request(createApp({ corsOrigins: ["https://ops.gagan.example"] }))
      .get("/health/live")
      .set("Origin", "https://attacker.example");

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
