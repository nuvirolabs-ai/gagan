import type { PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import {
  classifyVisitDistance,
  distanceBetweenMeters,
  validateCoordinateInput,
  type CoordinateInput,
} from "./locationDomain";
import type { LocationConfig } from "./locationConfig";
import { loadLocationConfig } from "./locationConfig";

type Db = PrismaClient | any;
type TransactionDb = any;
type LocationSource = "RETAILER_ONBOARDING" | "SALESPERSON_VISIT" | "ADMIN_CORRECTION" | "MIGRATION";

export class LocationServiceError extends Error {
  constructor(readonly code: string, readonly status = 400, message = code) {
    super(message);
    this.name = "LocationServiceError";
  }
}

function validate(input: CoordinateInput, config: LocationConfig) {
  validateCoordinateInput(input);
  if (input.accuracyMeters > config.maxAccuracyMeters) {
    throw new LocationServiceError("location_accuracy_too_low", 422);
  }
}

function numeric(value: unknown): number | null {
  return value == null ? null : Number(value);
}

export interface CaptureLocationInput extends CoordinateInput {
  retailerId: string;
  actorUserId: string;
  source: LocationSource;
  reasonForChange?: string;
}

export class LocationService {
  constructor(private readonly prisma: Db, private readonly config: LocationConfig) {}

  async getLocation(retailerId: string) {
    return this.prisma.retailerLocation.findUnique({ where: { retailerId } });
  }

  async assertAssignedSalesperson(salespersonId: string, retailerId: string) {
    const [staff, retailer] = await Promise.all([
      this.prisma.staffUser.findUnique({ where: { id: salespersonId }, select: { salesRepId: true } }),
      this.prisma.retailer.findUnique({ where: { id: retailerId }, select: { salesRepId: true } }),
    ]);
    if (!staff?.salesRepId || !retailer?.salesRepId || staff.salesRepId !== retailer.salesRepId) {
      throw new LocationServiceError("retailer_not_assigned", 404);
    }
  }

  async captureLocation(input: CaptureLocationInput) {
    validate(input, this.config);
    const current = await this.getLocation(input.retailerId);
    if (current?.status === "VERIFIED") {
      throw new LocationServiceError("location_change_request_required", 409);
    }
    const version = (current?.locationVersion ?? 0) + 1;
    return this.prisma.$transaction(async (tx: TransactionDb) => {
      const location = await tx.retailerLocation.upsert({
        where: { retailerId: input.retailerId },
        create: {
          retailerId: input.retailerId,
          latitude: input.latitude,
          longitude: input.longitude,
          accuracyMeters: input.accuracyMeters,
          devicePlatform: input.devicePlatform ?? null,
          status: "CAPTURED",
          source: input.source,
          capturedAt: new Date(),
          capturedByUserId: input.actorUserId,
          locationVersion: version,
        },
        update: {
          latitude: input.latitude,
          longitude: input.longitude,
          accuracyMeters: input.accuracyMeters,
          devicePlatform: input.devicePlatform ?? null,
          status: "CAPTURED",
          source: input.source,
          capturedAt: new Date(),
          capturedByUserId: input.actorUserId,
          verifiedAt: null,
          verifiedByUserId: null,
          locationVersion: version,
        },
      });
      await tx.retailerLocationHistory.create({
        data: {
          retailerId: input.retailerId,
          latitude: input.latitude,
          longitude: input.longitude,
          accuracyMeters: input.accuracyMeters,
          status: "CAPTURED",
          source: input.source,
          capturedByUserId: input.actorUserId,
          capturedAt: new Date(),
          version,
          reasonForChange: input.reasonForChange ?? null,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorStaffId: input.source === "RETAILER_ONBOARDING" ? null : input.actorUserId,
          action: "retailer_location.captured",
          subjectType: "retailer",
          subjectId: input.retailerId,
          metadata: { source: input.source, version },
        },
      });
      return location;
    });
  }

  async requestLocationChange(retailerId: string, actorUserId: string, reason: string) {
    if (!reason?.trim()) throw new LocationServiceError("location_change_reason_required", 400);
    const current = await this.getLocation(retailerId);
    if (!current || current.status === "NOT_SET") {
      throw new LocationServiceError("location_not_set", 409);
    }
    return this.prisma.$transaction(async (tx: TransactionDb) => {
      const location = await tx.retailerLocation.update({
        where: { retailerId },
        data: { status: "NEEDS_REVIEW" },
      });
      await tx.retailerLocationHistory.create({
        data: {
          retailerId,
          latitude: current.latitude,
          longitude: current.longitude,
          accuracyMeters: current.accuracyMeters,
          devicePlatform: current.devicePlatform,
          status: "NEEDS_REVIEW",
          source: current.source ?? "RETAILER_ONBOARDING",
          capturedByUserId: current.capturedByUserId,
          capturedAt: current.capturedAt,
          verifiedByUserId: current.verifiedByUserId,
          verifiedAt: current.verifiedAt,
          version: current.locationVersion,
          reasonForChange: reason.trim(),
        },
      });
      await tx.auditEvent.create({
        data: {
          actorStaffId: null,
          action: "retailer_location.change_requested",
          subjectType: "retailer",
          subjectId: retailerId,
          metadata: { reason: reason.trim(), actorUserId },
        },
      });
      return location;
    });
  }

  async verifyLocation(input: CaptureLocationInput) {
    validate(input, this.config);
    const current = await this.getLocation(input.retailerId);
    if (!current || current.latitude == null || current.longitude == null) {
      throw new LocationServiceError("location_not_set", 409);
    }
    const distance = distanceBetweenMeters(
      { latitude: Number(current.latitude), longitude: Number(current.longitude) },
      input
    );
    const status = classifyVisitDistance(distance, this.config);
    const nextStatus = status === "VERIFIED" ? "VERIFIED" : "NEEDS_REVIEW";
    return this.prisma.$transaction(async (tx: TransactionDb) => {
      const location = await tx.retailerLocation.update({
        where: { retailerId: input.retailerId },
        data: {
          status: nextStatus,
          verifiedAt: nextStatus === "VERIFIED" ? new Date() : null,
          verifiedByUserId: nextStatus === "VERIFIED" ? input.actorUserId : null,
        },
      });
      await tx.retailerLocationHistory.create({
        data: {
          retailerId: input.retailerId,
          latitude: current.latitude,
          longitude: current.longitude,
          accuracyMeters: current.accuracyMeters,
          devicePlatform: current.devicePlatform,
          status: nextStatus,
          source: current.source ?? input.source,
          capturedByUserId: current.capturedByUserId,
          capturedAt: current.capturedAt,
          verifiedByUserId: nextStatus === "VERIFIED" ? input.actorUserId : null,
          verifiedAt: nextStatus === "VERIFIED" ? new Date() : null,
          version: current.locationVersion,
          reasonForChange: `Verification reading ${Math.round(distance)}m from store`,
        },
      });
      return location;
    });
  }

  async correctLocation(input: CaptureLocationInput & { reasonForChange: string }) {
    if (!input.reasonForChange?.trim()) {
      throw new LocationServiceError("location_change_reason_required", 400);
    }
    validate(input, this.config);
    const current = await this.getLocation(input.retailerId);
    const version = (current?.locationVersion ?? 0) + 1;
    return this.prisma.$transaction(async (tx: TransactionDb) => {
      const location = await tx.retailerLocation.upsert({
        where: { retailerId: input.retailerId },
        create: {
          retailerId: input.retailerId,
          latitude: input.latitude,
          longitude: input.longitude,
          accuracyMeters: input.accuracyMeters,
          devicePlatform: input.devicePlatform ?? null,
          status: "NEEDS_REVIEW",
          source: "ADMIN_CORRECTION",
          capturedAt: new Date(),
          capturedByUserId: input.actorUserId,
          locationVersion: version,
        },
        update: {
          latitude: input.latitude,
          longitude: input.longitude,
          accuracyMeters: input.accuracyMeters,
          devicePlatform: input.devicePlatform ?? null,
          status: "NEEDS_REVIEW",
          source: "ADMIN_CORRECTION",
          capturedAt: new Date(),
          capturedByUserId: input.actorUserId,
          verifiedAt: null,
          verifiedByUserId: null,
          locationVersion: version,
        },
      });
      await tx.retailerLocationHistory.create({
        data: {
          retailerId: input.retailerId,
          latitude: input.latitude,
          longitude: input.longitude,
          accuracyMeters: input.accuracyMeters,
          status: "NEEDS_REVIEW",
          source: "ADMIN_CORRECTION",
          capturedByUserId: input.actorUserId,
          capturedAt: new Date(),
          version,
          reasonForChange: input.reasonForChange.trim(),
        },
      });
      await tx.auditEvent.create({
        data: {
          actorStaffId: input.actorUserId,
          action: "retailer_location.admin_corrected",
          subjectType: "retailer",
          subjectId: input.retailerId,
          metadata: { reason: input.reasonForChange.trim(), version },
        },
      });
      return location;
    });
  }

  async checkIn(input: { retailerId: string; salespersonId: string } & CoordinateInput) {
    validateCoordinateInput(input);
    const current = await this.getLocation(input.retailerId);
    const hasStore = current?.status === "VERIFIED" && current.latitude != null && current.longitude != null;
    const lowAccuracy = input.accuracyMeters > this.config.maxAccuracyMeters;
    const distance = hasStore
      ? distanceBetweenMeters(
          { latitude: Number(current.latitude), longitude: Number(current.longitude) },
          input
        )
      : null;
    const verificationStatus = !hasStore
      ? "STORE_LOCATION_NOT_AVAILABLE"
      : lowAccuracy
        ? "LOW_GPS_ACCURACY"
        : classifyVisitDistance(distance!, this.config);
    return this.prisma.salesVisit.create({
      data: {
        retailerId: input.retailerId,
        salespersonId: input.salespersonId,
        checkInLatitude: input.latitude,
        checkInLongitude: input.longitude,
        checkInAccuracyMeters: input.accuracyMeters,
        devicePlatform: input.devicePlatform ?? null,
        storeLatitudeSnapshot: hasStore ? current.latitude : null,
        storeLongitudeSnapshot: hasStore ? current.longitude : null,
        distanceFromStoreMeters: distance,
        verificationStatus,
        source: "SALESPERSON_VISIT",
      },
    });
  }

  async checkOut(input: { visitId: string; salespersonId: string } & CoordinateInput) {
    validateCoordinateInput(input);
    const visit = await this.prisma.salesVisit.findUnique({ where: { id: input.visitId } });
    if (!visit || visit.salespersonId !== input.salespersonId) {
      throw new LocationServiceError("visit_not_found", 404);
    }
    if (visit.checkedOutAt) throw new LocationServiceError("visit_already_checked_out", 409);
    const distance =
      visit.storeLatitudeSnapshot == null || visit.storeLongitudeSnapshot == null
        ? null
        : distanceBetweenMeters(
            { latitude: Number(visit.storeLatitudeSnapshot), longitude: Number(visit.storeLongitudeSnapshot) },
            input
          );
    return this.prisma.salesVisit.update({
      where: { id: input.visitId },
      data: {
        checkedOutLatitude: input.latitude,
        checkedOutLongitude: input.longitude,
        checkedOutAccuracyMeters: input.accuracyMeters,
        checkedOutAt: new Date(),
        checkoutDistanceMeters: distance,
      },
    });
  }

  async listVisits(filters: { retailerId?: string; salespersonId?: string; territory?: string; verificationStatus?: string; from?: Date; to?: Date } = {}) {
    return this.prisma.salesVisit.findMany({
      where: {
        ...(filters.retailerId ? { retailerId: filters.retailerId } : {}),
        ...(filters.salespersonId ? { salespersonId: filters.salespersonId } : {}),
        ...(filters.territory ? { retailer: { salesRep: { territory: filters.territory } } } : {}),
        ...(filters.verificationStatus ? { verificationStatus: filters.verificationStatus } : {}),
        ...(filters.from || filters.to ? { checkedInAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {}),
      },
      include: { retailer: { select: { id: true, name: true, salesRep: { select: { territory: true } } } }, salesperson: { select: { id: true, name: true } } },
      orderBy: { checkedInAt: "desc" },
    });
  }

  async history(retailerId: string) {
    return this.prisma.retailerLocationHistory.findMany({ where: { retailerId }, orderBy: { createdAt: "desc" } });
  }

  async listLocations() {
    return this.prisma.retailerLocation.findMany({
      include: { retailer: { select: { id: true, name: true, shopAddress: true, salesRepId: true } } },
      orderBy: { updatedAt: "desc" },
    });
  }

  async logisticsLocation(retailerId: string) {
    const [location, retailer] = await Promise.all([
      this.getLocation(retailerId),
      this.prisma.retailer.findUnique({ where: { id: retailerId }, select: { id: true, name: true } }),
    ]);
    if (!location || location.status !== "VERIFIED" || location.latitude == null || location.longitude == null) return null;
    return {
      retailerId: retailer?.id ?? retailerId,
      storeName: retailer?.name ?? null,
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      accuracyMeters: location.accuracyMeters == null ? null : Number(location.accuracyMeters),
      verifiedAt: location.verifiedAt,
    };
  }
}

export const defaultLocationService = new LocationService(
  prisma,
  loadLocationConfig()
);
