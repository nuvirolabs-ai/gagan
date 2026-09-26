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

  it("loads field marketing history through the authenticated Admin API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response(200, { executions: [] }));

    await expect(api.fieldRetailerMarketingHistory("retailer-7")).resolves.toEqual({ executions: [] });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/admin/field/retailers/retailer-7/marketing-history"),
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("uses the atomic salesperson setup endpoints", async () => {
    setAccessToken("staff-access");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response(201, { staff: { id: "staff-new" } }));
    await api.createSalesperson({ newStaff: { name: "Asha", phone: "9999999999", email: "asha@example.com" } });
    await api.setupSalesperson("staff-existing", { managerId: "manager-id" });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      expect.stringContaining("/admin/staff/salesperson-setup"),
      expect.stringContaining("/admin/staff/staff-existing/salesperson-setup"),
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.any(String), expect.objectContaining({
      method: "POST", body: JSON.stringify({ managerId: "manager-id" }),
    }));
  });

  it("downloads a filtered workbook after refreshing an expired Admin session", async () => {
    setAccessToken("expired-access");
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(401, { error: "access_expired" }))
      .mockResolvedValueOnce(response(200, { accessToken: "fresh-access" }))
      .mockResolvedValueOnce(new Response("workbook", { status: 200 }));
    const result = await api.exportServiceIssues({ status: "open", retailerId: "retailer-a", from: "2026-09-01", through: "2026-09-20" });
    expect(await result.text()).toBe("workbook");
    expect(fetchMock.mock.calls[0][0]).toContain("/admin/exports/service-issues.xlsx?status=open&retailerId=retailer-a&from=2026-09-01&through=2026-09-20");
    expect(fetchMock.mock.calls[2][1]).toEqual(expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer fresh-access" }),
    }));
  });
});
