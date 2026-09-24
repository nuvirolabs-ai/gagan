import { describe, expect, it, vi } from "vitest";
import { CommercialStatusCode } from "@prisma/client";
import { attributeOrders } from "./orderAttribution";

describe("order attribution read model", () => {
  it("uses the punch actor and does not expose internal event rows", async () => {
    const salesRep = { findMany: vi.fn() };
    const [order] = await attributeOrders([{
      id: "order-rep",
      placedBy: "rep",
      placedByRepId: "rep-1",
      commercialStatusEvents: [{
        code: CommercialStatusCode.SALES_ORDER_PUNCHED,
        actorStaff: { name: "Asha Verma" },
      }],
    }], { salesRep } as any);

    expect(order).toMatchObject({ source: "SALESPERSON_APP", creatorName: "Asha Verma" });
    expect(order).not.toHaveProperty("commercialStatusEvents");
    expect(order).not.toHaveProperty("placedByRepId");
    expect(salesRep.findMany).not.toHaveBeenCalled();
  });

  it("resolves legacy salesperson names in one batch", async () => {
    const salesRep = {
      findMany: vi.fn().mockResolvedValue([
        { id: "rep-1", name: "Historical Salesperson" },
        { id: "rep-2", name: "Second Salesperson" },
      ]),
    };
    const result = await attributeOrders([
      { id: "order-old-1", placedBy: "rep", placedByRepId: "rep-1", commercialStatusEvents: [] },
      { id: "order-old-2", placedBy: "rep", placedByRepId: "rep-2", commercialStatusEvents: [] },
    ], { salesRep } as any);

    expect(salesRep.findMany).toHaveBeenCalledExactlyOnceWith({
      where: { id: { in: ["rep-1", "rep-2"] } },
      select: { id: true, name: true },
    });
    expect(result.map((order) => order.creatorName)).toEqual([
      "Historical Salesperson",
      "Second Salesperson",
    ]);
  });

  it("identifies retailer-created orders without inventing a creator", async () => {
    const salesRep = { findMany: vi.fn() };
    const [order] = await attributeOrders([{
      id: "order-retailer",
      placedBy: "retailer",
      commercialStatusEvents: [],
    }], { salesRep } as any);

    expect(order).toMatchObject({ source: "RETAILER_APP", creatorName: null });
    expect(salesRep.findMany).not.toHaveBeenCalled();
  });
});
