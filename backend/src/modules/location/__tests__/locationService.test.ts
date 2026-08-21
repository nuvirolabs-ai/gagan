import { describe, expect, it, vi } from "vitest";
import { LocationService } from "../locationService";

function fakePrisma() {
  const location = {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  };
  const history = { create: vi.fn() };
  const visits = { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() };
  const retailer = { findUnique: vi.fn() };
  const staffUser = { findUnique: vi.fn() };
  const auditEvent = { create: vi.fn() };
  const tx = { retailerLocation: location, retailerLocationHistory: history, salesVisit: visits, retailer, staffUser, auditEvent };
  return {
    retailerLocation: location,
    retailerLocationHistory: history,
    salesVisit: visits,
    retailer,
    staffUser,
    auditEvent,
    $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
  } as any;
}

describe("LocationService", () => {
  it("captures a retailer location as a versioned history row", async () => {
    const prisma = fakePrisma();
    prisma.retailerLocation.findUnique.mockResolvedValue(null);
    prisma.retailerLocation.upsert.mockResolvedValue({
      id: "location-1",
      retailerId: "retailer-1",
      status: "CAPTURED",
      locationVersion: 1,
      latitude: 18.52,
      longitude: 73.85,
      accuracyMeters: 12,
    });
    const service = new LocationService(prisma, {
      maxAccuracyMeters: 50,
      verifiedRadiusMeters: 150,
      reviewRadiusMeters: 500,
    });

    const result = await service.captureLocation({
      retailerId: "retailer-1",
      actorUserId: "retailer-1",
      source: "RETAILER_ONBOARDING",
      latitude: 18.52,
      longitude: 73.85,
      accuracyMeters: 12,
    });

    expect(result.status).toBe("CAPTURED");
    expect(prisma.retailerLocationHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ retailerId: "retailer-1", version: 1 }) })
    );
  });

  it("rejects direct overwrite of an already verified location", async () => {
    const prisma = fakePrisma();
    prisma.retailerLocation.findUnique.mockResolvedValue({ status: "VERIFIED", locationVersion: 2 });
    const service = new LocationService(prisma, {
      maxAccuracyMeters: 50,
      verifiedRadiusMeters: 150,
      reviewRadiusMeters: 500,
    });

    await expect(
      service.captureLocation({
        retailerId: "retailer-1",
        actorUserId: "retailer-1",
        source: "RETAILER_ONBOARDING",
        latitude: 18.52,
        longitude: 73.85,
        accuracyMeters: 12,
      })
    ).rejects.toMatchObject({ code: "location_change_request_required" });
  });

  it("uses the verified store snapshot for server-side visit classification", async () => {
    const prisma = fakePrisma();
    prisma.retailerLocation.findUnique.mockResolvedValue({
      status: "VERIFIED",
      latitude: 18.5204,
      longitude: 73.8567,
      accuracyMeters: 10,
    });
    prisma.salesVisit.create.mockResolvedValue({ id: "visit-1", verificationStatus: "VERIFIED" });
    const service = new LocationService(prisma, {
      maxAccuracyMeters: 50,
      verifiedRadiusMeters: 150,
      reviewRadiusMeters: 500,
    });

    const visit = await service.checkIn({
      retailerId: "retailer-1",
      salespersonId: "staff-1",
      latitude: 18.5208,
      longitude: 73.8567,
      accuracyMeters: 12,
    });

    expect(visit.verificationStatus).toBe("VERIFIED");
    expect(prisma.salesVisit.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ salespersonId: "staff-1", retailerId: "retailer-1", verificationStatus: "VERIFIED" }) })
    );
  });

  it("keeps a historical store snapshot when a visit is checked out", async () => {
    const prisma = fakePrisma();
    prisma.salesVisit.findUnique.mockResolvedValue({
      id: "visit-1",
      salespersonId: "staff-1",
      retailerId: "retailer-1",
      storeLatitudeSnapshot: 18.52,
      storeLongitudeSnapshot: 73.85,
      checkedOutAt: null,
    });
    prisma.salesVisit.update.mockResolvedValue({ id: "visit-1", checkedOutAt: new Date() });
    const service = new LocationService(prisma, {
      maxAccuracyMeters: 50,
      verifiedRadiusMeters: 150,
      reviewRadiusMeters: 500,
    });

    await service.checkOut({ visitId: "visit-1", salespersonId: "staff-1", latitude: 18.5201, longitude: 73.8501, accuracyMeters: 10 });
    expect(prisma.salesVisit.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "visit-1" }, data: expect.objectContaining({ checkedOutAccuracyMeters: 10 }) })
    );
  });
});
