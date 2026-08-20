import { describe, expect, it, vi } from "vitest";
import { createSessionFetch } from "../sessionFetch";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe("staff authenticated fetch", () => {
  it("uses the staff refresh route and persists the rotated pair", async () => {
    let tokens = { accessToken: "old-access", refreshToken: "old-refresh" };
    const store = {
      load: vi.fn(async () => tokens),
      save: vi.fn(async (next) => { tokens = next; }),
      clear: vi.fn(async () => { tokens = undefined as never; }),
    };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json(401, { error: "access_expired" }))
      .mockResolvedValueOnce(json(200, { accessToken: "new-access", refreshToken: "new-refresh" }))
      .mockResolvedValueOnce(json(200, { staff: { id: "staff-1" } }));
    const request = createSessionFetch({ baseUrl: "https://api.gagan.test", refreshPath: "/rep/auth/refresh", store, fetcher });

    await expect(request("/rep/me")).resolves.toEqual({ staff: { id: "staff-1" } });
    expect(fetcher.mock.calls[1][0]).toBe("https://api.gagan.test/rep/auth/refresh");
    expect(store.save).toHaveBeenCalledWith({ accessToken: "new-access", refreshToken: "new-refresh" });
  });
});
