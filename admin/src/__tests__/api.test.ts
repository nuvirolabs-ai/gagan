import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, clearAccessToken, setAccessToken } from "../api";

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("admin API session client", () => {
  beforeEach(() => {
    clearAccessToken();
    vi.restoreAllMocks();
  });

  it("keeps access in memory and retries once through the refresh cookie", async () => {
    setAccessToken("expired-access");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(401, { error: "access_expired" }))
      .mockResolvedValueOnce(response(200, { accessToken: "fresh-access" }))
      .mockResolvedValueOnce(response(200, { orders: [{ id: "order-1" }] }));

    await expect(api.orders()).resolves.toEqual({ orders: [{ id: "order-1" }] });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/admin/auth/refresh"),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({ "X-Gagan-Client": "admin-web" }),
      })
    );
    expect(fetchMock.mock.calls[2][1]).toEqual(
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({ Authorization: "Bearer fresh-access" }),
      })
    );
    expect(localStorage.getItem("gagan_admin_token")).toBeNull();
  });
});
