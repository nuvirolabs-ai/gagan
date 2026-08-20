import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { asyncRoute } from "../platform/http/asyncRoute";

describe("asyncRoute", () => {
  it("forwards rejected handlers to the Express error boundary", async () => {
    const app = express();
    app.get(
      "/boom",
      asyncRoute(async () => {
        throw new Error("boom");
      })
    );
    app.use(
      (
        _err: unknown,
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction
      ) => res.status(500).json({ error: "caught" })
    );

    const response = await request(app).get("/boom");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "caught" });
  });
});
