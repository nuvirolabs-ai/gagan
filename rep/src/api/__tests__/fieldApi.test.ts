import { describe, expect, it, vi } from "vitest";
import { createStaffApi } from "../staffApi";

function api() {
  const request = vi.fn().mockResolvedValue({});
  const store = { load: vi.fn(), save: vi.fn(), clear: vi.fn() };
  return { api: createStaffApi(request, store), request };
}

describe("field day API", () => {
  it("never names a salesperson — the session decides whose day it is", async () => {
    const { api: client, request } = api();
    await client.today();
    await client.route();
    await client.tasks();
    const paths = request.mock.calls.map((call) => call[0] as string);
    expect(paths).toEqual(["/rep/field/today", "/rep/field/route", "/rep/field/tasks"]);
    expect(paths.some((path) => path.includes("salespersonId"))).toBe(false);
  });

  it("posts a clock-in with the coordinates the device captured", async () => {
    const { api: client, request } = api();
    await client.startDay({ latitude: 18.52, longitude: 73.85, accuracyMeters: 12, devicePlatform: "ios" });
    expect(request).toHaveBeenCalledWith(
      "/rep/field/attendance/start",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          latitude: 18.52,
          longitude: 73.85,
          accuracyMeters: 12,
          devicePlatform: "ios",
        }),
      }),
      true
    );
  });

  it("sends a ping batch as one request", async () => {
    const { api: client, request } = api();
    await client.sendPings([{ clientReference: "p-1" }, { clientReference: "p-2" }]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe("/rep/field/tracking/pings");
    expect(JSON.parse((request.mock.calls[0][1] as any).body).pings).toHaveLength(2);
  });

  it("carries the client reference on an activity so a replay is idempotent", async () => {
    const { api: client, request } = api();
    await client.logActivity({
      retailerId: "retailer-1",
      type: "stock_check",
      clientReference: "device-abc",
    });
    expect(JSON.parse((request.mock.calls[0][1] as any).body)).toMatchObject({
      clientReference: "device-abc",
    });
  });

  it("builds date ranges only from the parts it was given", async () => {
    const { api: client, request } = api();
    await client.attendance();
    await client.attendance("2026-03-01");
    await client.performance("2026-03-01", "2026-03-31");
    expect(request.mock.calls.map((call) => call[0])).toEqual([
      "/rep/field/attendance",
      "/rep/field/attendance?from=2026-03-01",
      "/rep/field/performance?from=2026-03-01&to=2026-03-31",
    ]);
  });

  it("asks for the customer map with an origin only when it has one", async () => {
    const { api: client, request } = api();
    await client.customerMap();
    await client.customerMap({ latitude: 18.5, longitude: 73.8 });
    expect(request.mock.calls.map((call) => call[0])).toEqual([
      "/rep/field/customers/map",
      "/rep/field/customers/map?latitude=18.5&longitude=73.8",
    ]);
  });

  it("sends a visit outcome on check-out rather than opening a second visit", async () => {
    const { api: client, request } = api();
    await client.checkOut("visit-1", {
      latitude: 18.5,
      longitude: 73.8,
      accuracyMeters: 10,
      outcome: "order_placed",
      notes: "Took a repeat order",
    });
    expect(request.mock.calls[0][0]).toBe("/rep/visits/visit-1/check-out");
    expect(JSON.parse((request.mock.calls[0][1] as any).body)).toMatchObject({
      outcome: "order_placed",
      notes: "Took a repeat order",
    });
  });

  it("passes the visit purpose through check-in", async () => {
    const { api: client, request } = api();
    await client.checkIn("retailer-1", {
      latitude: 18.5,
      longitude: 73.8,
      accuracyMeters: 10,
      purpose: "collection",
    });
    expect(JSON.parse((request.mock.calls[0][1] as any).body).purpose).toBe("collection");
  });
});
