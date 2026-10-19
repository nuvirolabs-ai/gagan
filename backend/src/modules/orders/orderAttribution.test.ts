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
    expect(order).toHaveProperty("placedByRepId", "rep-1");
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

  it("resolves multi-warehouse origin and salesperson tracking", async () => {
    const [indoreOrder, bhopalOrder] = await attributeOrders([
      {
        id: "order-indore",
        placedBy: "rep",
        retailer: {
          name: "Indore Store",
          deliveryCity: "Indore",
          salesRep: { name: "Vikram Singh", phone: "9800000001" },
        },
        commercialStatusEvents: [{
          code: CommercialStatusCode.SALES_ORDER_PUNCHED,
          actorStaff: { name: "Vikram Singh" },
        }],
      },
      {
        id: "order-bhopal",
        placedBy: "retailer",
        retailer: {
          name: "Bhopal Kirana",
          deliveryCity: "Bhopal",
          salesRep: { name: "Priya Deshmukh", phone: "9812345671" },
        },
        commercialStatusEvents: [],
      },
    ]);

    expect(indoreOrder).toMatchObject({
      salespersonName: "Vikram Singh",
      punchedByName: "Vikram Singh",
      punchedByRole: "Salesperson",
      punchedByLabel: "Punched by Sales Rep: Vikram Singh",
      warehouseCode: "WH-001",
      warehouseName: "Indore Central Fulfillment Hub",
      warehouseCity: "Indore",
    });

    expect(bhopalOrder).toMatchObject({
      salespersonName: "Priya Deshmukh",
      punchedByName: "Bhopal Kirana",
      punchedByRole: "Retailer",
      punchedByLabel: "Placed by Retailer: Bhopal Kirana (Assigned Rep: Priya Deshmukh)",
      warehouseCode: "WH-002",
      warehouseName: "Bhopal Regional Hub",
      warehouseCity: "Bhopal",
    });
  });
});
