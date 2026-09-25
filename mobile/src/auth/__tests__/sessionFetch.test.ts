import { describe, expect, it, vi } from "vitest";
import { createSessionFetch } from "../sessionFetch";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe("refresh failure classification", () => {
  it.each(["network", "server", "malformed"])("retains the session after a %s refresh failure", async kind => {
    const store = { load: vi.fn(async () => ({ accessToken: "expired", refreshToken: "valid" })),
      save: vi.fn(), clear: vi.fn() };
    const onUnauthorized = vi.fn();
    const fetcher = vi.fn().mockResolvedValueOnce(json(401, { error: "access_expired" }));
    if (kind === "network") fetcher.mockRejectedValueOnce(new TypeError("Network request failed"));
    else fetcher.mockResolvedValueOnce(json(kind === "server" ? 503 : 200, { error: "temporarily_unavailable" }));
    const request = createSessionFetch({ baseUrl: "https://api.gagan.test", refreshPath: "/refresh", store, fetcher, onUnauthorized });
    await expect(request("/me")).rejects.toThrow();
    expect(store.clear).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(store.save).not.toHaveBeenCalled();
  });
  it("still clears a session explicitly rejected by the refresh endpoint", async () => {
    const store = { load: vi.fn(async () => ({ accessToken: "expired", refreshToken: "revoked" })),
      save: vi.fn(), clear: vi.fn() };
    const onUnauthorized = vi.fn();
    const fetcher = vi.fn().mockResolvedValueOnce(json(401, { error: "expired" }))
      .mockResolvedValueOnce(json(401, { error: "refresh_revoked" }));
    const request = createSessionFetch({ baseUrl: "https://api.gagan.test", refreshPath: "/refresh", store, fetcher, onUnauthorized });
    await expect(request("/me")).rejects.toMatchObject({ status: 401 });
    expect(store.clear).toHaveBeenCalledOnce();
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});

describe("retailer authenticated fetch", () => {
  it("rotates tokens and retries the original request once", async () => {
    let tokens = { accessToken: "old-access", refreshToken: "old-refresh" };
    const store = {
      load: vi.fn(async () => tokens),
      save: vi.fn(async (next) => { tokens = next; }),
      clear: vi.fn(async () => { tokens = undefined as never; }),
    };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json(401, { error: "access_expired" }))
      .mockResolvedValueOnce(json(200, { accessToken: "new-access", refreshToken: "new-refresh" }))
      .mockResolvedValueOnce(json(200, { retailer: { id: "retailer-1" } }));
    const request = createSessionFetch({ baseUrl: "https://api.gagan.test", refreshPath: "/auth/refresh", store, fetcher });

    await expect(request("/auth/me")).resolves.toEqual({ retailer: { id: "retailer-1" } });
    expect(fetcher.mock.calls[1][0]).toBe("https://api.gagan.test/auth/refresh");
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ refreshToken: "old-refresh" });
    expect(fetcher.mock.calls[2][1].headers.Authorization).toBe("Bearer new-access");
    expect(store.save).toHaveBeenCalledWith({ accessToken: "new-access", refreshToken: "new-refresh" });
  });
});
