import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";

describe("collection evidence body parsing", () => {
  it("parses a bounded receipt payload before the default 100kb parser", async () => {
    process.env.DATABASE_URL ??= "postgresql://localhost/gagan-body-limit-test";
    process.env.JWT_SECRET ??= "test-jwt-secret-that-is-at-least-32-chars";
    process.env.REFRESH_TOKEN_SECRET ??= "test-refresh-secret-at-least-32-chars";

    const response = await request(createApp())
      .post("/rep/collections")
      .send({ bodyBase64: "a".repeat(120_000) });

    // Authentication runs after the route-scoped parser. A 401 proves the
    // body was accepted by the parser; the old global parser returned 413.
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "authentication_required" });
  });
});
