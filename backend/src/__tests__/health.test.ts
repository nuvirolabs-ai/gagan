import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";

describe("health", () => {
  it("returns liveness without starting a network listener", async () => {
    const response = await request(createApp()).get("/health/live");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});
