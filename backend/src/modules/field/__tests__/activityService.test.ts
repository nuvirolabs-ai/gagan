import { describe, expect, it } from "vitest";
import { ActivityService } from "../activityService";
import { fakePrisma } from "./fakePrisma";

function assigned(prisma: any, sameRep = true) {
  prisma.staffUser.findUnique.mockResolvedValue({ salesRepId: "rep-1" });
  prisma.retailer.findUnique.mockResolvedValue({ salesRepId: sameRep ? "rep-1" : "rep-2" });
}

describe("logging customer activity", () => {
  it("refuses a store belonging to another salesperson", async () => {
    const prisma = fakePrisma();
    assigned(prisma, false);

    await expect(
      new ActivityService(prisma).log({
        salespersonId: "staff-1",
        retailerId: "retailer-1",
        type: "stock_check",
      })
    ).rejects.toMatchObject({ code: "retailer_not_assigned", status: 404 });
    expect(prisma.customerActivity.create).not.toHaveBeenCalled();
  });

  it("refuses an unknown activity type", async () => {
    const prisma = fakePrisma();
    await expect(
      new ActivityService(prisma).log({
        salespersonId: "staff-1",
        retailerId: "retailer-1",
        type: "danced" as any,
      })
    ).rejects.toMatchObject({ code: "activity_type_unknown" });
  });

  it("returns the original row when an offline write is replayed", async () => {
    const prisma = fakePrisma();
    assigned(prisma);
    prisma.customerActivity.findUnique.mockResolvedValue({ id: "activity-1" });

    const result = await new ActivityService(prisma).log({
      salespersonId: "staff-1",
      retailerId: "retailer-1",
      type: "order_discussion",
      clientReference: "device-abc-0001",
    });

    expect(result).toEqual({ activity: { id: "activity-1" }, idempotent: true });
    expect(prisma.customerActivity.create).not.toHaveBeenCalled();
  });

  it("stores the controlled type alongside the salesperson's own note", async () => {
    const prisma = fakePrisma();
    assigned(prisma);
    prisma.customerActivity.findUnique.mockResolvedValue(null);
    prisma.customerActivity.create.mockResolvedValue({ id: "activity-1" });

    const result = await new ActivityService(prisma).log({
      salespersonId: "staff-1",
      retailerId: "retailer-1",
      type: "competitor_observation",
      notes: "  Rival brand ran a 10% off board  ",
      clientReference: "device-abc-0002",
    });

    expect(result.idempotent).toBe(false);
    expect(prisma.customerActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "competitor_observation",
          notes: "Rival brand ran a 10% off board",
          clientReference: "device-abc-0002",
        }),
      })
    );
  });

  it("refuses to attach activity to somebody else's visit", async () => {
    const prisma = fakePrisma();
    assigned(prisma);
    prisma.customerActivity.findUnique.mockResolvedValue(null);
    prisma.salesVisit.findUnique.mockResolvedValue({
      salespersonId: "staff-2",
      retailerId: "retailer-1",
    });

    await expect(
      new ActivityService(prisma).log({
        salespersonId: "staff-1",
        retailerId: "retailer-1",
        type: "note",
        visitId: "visit-1",
      })
    ).rejects.toMatchObject({ code: "visit_not_found" });
  });

  it("refuses to attach activity to a visit at a different store", async () => {
    const prisma = fakePrisma();
    assigned(prisma);
    prisma.customerActivity.findUnique.mockResolvedValue(null);
    prisma.salesVisit.findUnique.mockResolvedValue({
      salespersonId: "staff-1",
      retailerId: "retailer-9",
    });

    await expect(
      new ActivityService(prisma).log({
        salespersonId: "staff-1",
        retailerId: "retailer-1",
        type: "note",
        visitId: "visit-1",
      })
    ).rejects.toMatchObject({ code: "visit_not_found" });
  });
});

describe("reading customer activity", () => {
  it("checks assignment before showing a store's timeline", async () => {
    const prisma = fakePrisma();
    assigned(prisma, false);
    await expect(
      new ActivityService(prisma).forRetailer({
        retailerId: "retailer-1",
        salespersonId: "staff-1",
      })
    ).rejects.toMatchObject({ code: "retailer_not_assigned" });
  });

  it("caps how much history one request can pull", async () => {
    const prisma = fakePrisma();
    assigned(prisma);
    await new ActivityService(prisma).forRetailer({
      retailerId: "retailer-1",
      salespersonId: "staff-1",
      limit: 5000,
    });
    expect(prisma.customerActivity.findMany.mock.calls[0][0].take).toBe(200);
  });
});
