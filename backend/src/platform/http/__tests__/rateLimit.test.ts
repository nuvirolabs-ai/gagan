import { describe, expect, it } from "vitest";
import { createRateLimiter } from "../rateLimit";

function response() {
  const headers = new Map<string, string>();
  return {
    headers,
    setHeader(name: string, value: string) { headers.set(name, value); },
    statusCode: 200,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { return body; },
  } as any;
}

describe("sensitive route rate limiter", () => {
  it("limits a subject and returns a safe retry response", () => {
    const limiter = createRateLimiter({ name: "orders", limit: 2, windowMs: 60_000, now: () => 1_000 });
    const req = { ip: "127.0.0.1", retailerId: "retailer-1" } as any;
    const next = () => undefined;
    const first = response();
    const second = response();
    const third = response();
    limiter(req, first, next);
    limiter(req, second, next);
    limiter(req, third, next);
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(third.statusCode).toBe(429);
    expect(third.headers.get("x-request-id")).toBeTruthy();
    expect(third.headers.get("retry-after")).toBe("60");
  });
});
