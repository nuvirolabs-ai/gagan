import { describe, expect, it, vi } from "vitest";
import { CommercialStatusCode } from "@prisma/client";
import { attributeOrders, enrichOrderItems } from "./orderAttribution";

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

  it("enriches order items with quintal rates and packing types", () => {
    const items = [
      {
        id: "item-toor",
        variantId: "v-toor",
        qtyOrdered: 5,
        unitPrice: 4545,
        caseWeightKgSnapshot: 30,
        commercialSnapshot: { rate: "14950", rateBasis: "quintal", caseWeightKg: "30" },
        variant: {
          unitSize: "30 kg",
          unitsPerCase: 1,
          unitWeightKg: 30,
          listRate: 14950,
          listRateBasis: "quintal",
          product: { name: "Gagan Toor Dal", category: "Daal" },
        },
      },
      {
        id: "item-choice",
        variantId: "v-choice",
        qtyOrdered: 1,
        unitPrice: 2308.5,
        caseWeightKgSnapshot: 30,
        variant: {
          unitSize: "30 kg",
          unitsPerCase: 1,
          unitWeightKg: 30,
          listRate: 7695,
          listRateBasis: "quintal",
          product: { name: "Gagan Basmati Rice Choice", category: "Rice" },
        },
      },
      {
        id: "item-mix",
        variantId: "v-mix",
        qtyOrdered: 2,
        unitPrice: 1990,
        caseWeightKgSnapshot: 20,
        variant: {
          unitSize: "1 kg",
          unitsPerCase: 20,
          unitWeightKg: 1,
          catalogIdentityMasterPack: "20KG BOX",
          product: { name: "Instant Mix", category: "Breakfast Mix" },
        },
      },
    ];

    const enriched = enrichOrderItems(items);

    expect(enriched[0]).toMatchObject({
      rateBasis: "quintal",
      ratePerQuintal: 14950,
      ratePerKg: 149.5,
      outerPack: "Bag",
      rateLabel: "₹14,950 / quintal",
      unitPrice: 4545,
    });

    expect(enriched[1]).toMatchObject({
      rateBasis: "quintal",
      ratePerQuintal: 7695,
      ratePerKg: 76.95,
      outerPack: "Bag",
      rateLabel: "₹7,695 / quintal",
      unitPrice: 2308.5,
    });

    expect(enriched[2]).toMatchObject({
      rateBasis: "case",
      outerPack: "Box",
      rateLabel: "₹1,990 / box",
      unitPrice: 1990,
    });
  });
});
