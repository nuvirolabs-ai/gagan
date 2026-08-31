import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { FieldServiceError } from "./attendanceService";
import { nextStop, routeProgress, startOfDay } from "./fieldDomain";

type Db = PrismaClient | any;

const STOP_RETAILER_SELECT = {
  id: true,
  name: true,
  phone: true,
  shopAddress: true,
  location: {
    select: { latitude: true, longitude: true, status: true, accuracyMeters: true },
  },
} as const;

export interface PublicRouteStop {
  id: string;
  sequence: number;
  status: "pending" | "visited" | "skipped";
  purpose: string;
  note: string | null;
  skipReason: string | null;
  visitedAt: Date | null;
  retailer: {
    id: string;
    name: string;
    phone: string;
    shopAddress: string;
    latitude: number | null;
    longitude: number | null;
    locationStatus: string;
  };
}

function publicStop(stop: any): PublicRouteStop {
  return {
    id: stop.id,
    sequence: stop.sequence,
    status: stop.status,
    purpose: stop.purpose,
    note: stop.note,
    skipReason: stop.skipReason,
    visitedAt: stop.visitedAt,
    retailer: {
      id: stop.retailer.id,
      name: stop.retailer.name,
      phone: stop.retailer.phone,
      shopAddress: stop.retailer.shopAddress,
      latitude: stop.retailer.location?.latitude == null ? null : Number(stop.retailer.location.latitude),
      longitude: stop.retailer.location?.longitude == null ? null : Number(stop.retailer.location.longitude),
      locationStatus: stop.retailer.location?.status ?? "NOT_SET",
    },
  };
}

/**
 * Day planning. A route plan schedules retailers that are *already* assigned
 * to the salesperson through `Retailer.salesRepId` — it is a schedule, not a
 * second assignment system, and publishing one never changes who owns a store.
 */
export class RouteService {
  constructor(private readonly prisma: Db = defaultPrisma) {}

  async routeForDate(salespersonId: string, date: Date) {
    const plan = await this.prisma.routePlan.findUnique({
      where: { salespersonId_planDate: { salespersonId, planDate: startOfDay(date) } },
      include: {
        stops: {
          orderBy: { sequence: "asc" },
          include: { retailer: { select: STOP_RETAILER_SELECT } },
        },
      },
    });
    if (!plan) return null;
    const stops: PublicRouteStop[] = plan.stops.map(publicStop);
    return {
      id: plan.id,
      planDate: plan.planDate,
      name: plan.name,
      status: plan.status,
      publishedAt: plan.publishedAt,
      completedAt: plan.completedAt,
      stops,
      progress: routeProgress(stops),
      nextStop: nextStop(stops),
    };
  }

  async routeHistory(salespersonId: string, from: Date, to: Date) {
    const plans = await this.prisma.routePlan.findMany({
      where: { salespersonId, planDate: { gte: startOfDay(from), lte: startOfDay(to) } },
      include: { stops: { select: { status: true, sequence: true } } },
      orderBy: { planDate: "desc" },
    });
    return plans.map((plan: any) => ({
      id: plan.id,
      planDate: plan.planDate,
      name: plan.name,
      status: plan.status,
      progress: routeProgress(plan.stops),
    }));
  }

  async skipStop(input: { stopId: string; salespersonId: string; reason: string }) {
    if (!input.reason.trim()) throw new FieldServiceError("skip_reason_required", 400);
    const stop = await this.prisma.routePlanStop.findUnique({
      where: { id: input.stopId },
      include: { routePlan: { select: { salespersonId: true } } },
    });
    if (!stop || stop.routePlan.salespersonId !== input.salespersonId) {
      throw new FieldServiceError("route_stop_not_found", 404);
    }
    if (stop.status !== "pending") throw new FieldServiceError("route_stop_already_settled", 409);
    return this.prisma.routePlanStop.update({
      where: { id: stop.id },
      data: { status: "skipped", skipReason: input.reason.trim() },
    });
  }

  /**
   * Called right after a check-in. If today's published plan has a pending stop
   * for that store, the visit fulfils it — the planned stop and the visit that
   * happened stay one record instead of two.
   */
  async linkVisitToPlannedStop(input: {
    visitId: string;
    salespersonId: string;
    retailerId: string;
    at?: Date;
  }) {
    const at = input.at ?? new Date();
    const stop = await this.prisma.routePlanStop.findFirst({
      where: {
        retailerId: input.retailerId,
        status: "pending",
        routePlan: {
          salespersonId: input.salespersonId,
          planDate: startOfDay(at),
          status: { in: ["draft", "published"] },
        },
      },
      orderBy: { sequence: "asc" },
    });
    if (!stop) return null;
    await this.prisma.$transaction(async (tx: Db) => {
      await tx.routePlanStop.update({
        where: { id: stop.id },
        data: { status: "visited", visitedAt: at },
      });
      await tx.salesVisit.update({
        where: { id: input.visitId },
        data: { routeStopId: stop.id, purpose: stop.purpose },
      });
    });
    return stop;
  }

  /* ------------------------------ management ------------------------------ */

  /**
   * Create or replace one salesperson's plan for a date. Every retailer in the
   * plan must already be assigned to that salesperson; anything else is
   * rejected rather than silently reassigned.
   */
  async upsertPlan(input: {
    salespersonId: string;
    planDate: Date;
    name?: string;
    createdByStaffId: string;
    stops: Array<{ retailerId: string; purpose?: string; note?: string }>;
  }) {
    const planDate = startOfDay(input.planDate);
    if (input.stops.length === 0) throw new FieldServiceError("route_requires_stops", 400);

    const retailerIds = input.stops.map((stop) => stop.retailerId);
    if (new Set(retailerIds).size !== retailerIds.length) {
      throw new FieldServiceError("route_stop_duplicated", 400);
    }

    const staff = await this.prisma.staffUser.findUnique({
      where: { id: input.salespersonId },
      select: { salesRepId: true, status: true },
    });
    if (!staff?.salesRepId || staff.status !== "active") {
      throw new FieldServiceError("salesperson_not_available", 404);
    }

    const assigned = await this.prisma.retailer.findMany({
      where: { id: { in: retailerIds }, salesRepId: staff.salesRepId },
      select: { id: true },
    });
    if (assigned.length !== retailerIds.length) {
      throw new FieldServiceError("retailer_not_assigned_to_salesperson", 422, {
        unassigned: retailerIds.filter(
          (id) => !assigned.some((retailer: any) => retailer.id === id)
        ),
      });
    }

    const existing = await this.prisma.routePlan.findUnique({
      where: { salespersonId_planDate: { salespersonId: input.salespersonId, planDate } },
      include: { stops: { select: { id: true, retailerId: true, status: true } } },
    });
    if (existing?.stops.some((stop: any) => stop.status !== "pending")) {
      throw new FieldServiceError("route_already_in_progress", 409);
    }

    return this.prisma.$transaction(async (tx: Db) => {
      const plan = await tx.routePlan.upsert({
        where: { salespersonId_planDate: { salespersonId: input.salespersonId, planDate } },
        create: {
          salespersonId: input.salespersonId,
          planDate,
          name: input.name?.trim() || null,
          createdByStaffId: input.createdByStaffId,
          status: "draft",
        },
        update: { name: input.name?.trim() || null, status: "draft" },
      });
      await tx.routePlanStop.deleteMany({ where: { routePlanId: plan.id } });
      await tx.routePlanStop.createMany({
        data: input.stops.map((stop, index) => ({
          routePlanId: plan.id,
          retailerId: stop.retailerId,
          sequence: index + 1,
          purpose: (stop.purpose as any) ?? "sales_call",
          note: stop.note?.trim() || null,
        })),
      });
      await tx.auditEvent.create({
        data: {
          actorStaffId: input.createdByStaffId,
          action: "route_plan.saved",
          subjectType: "route_plan",
          subjectId: plan.id,
          metadata: { salespersonId: input.salespersonId, stops: input.stops.length },
        },
      });
      return plan;
    });
  }

  async publishPlan(input: { planId: string; actorStaffId: string }) {
    const plan = await this.prisma.routePlan.findUnique({ where: { id: input.planId } });
    if (!plan) throw new FieldServiceError("route_plan_not_found", 404);
    if (plan.status !== "draft") throw new FieldServiceError("route_plan_not_draft", 409);
    return this.prisma.$transaction(async (tx: Db) => {
      const published = await tx.routePlan.update({
        where: { id: plan.id },
        data: { status: "published", publishedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          actorStaffId: input.actorStaffId,
          action: "route_plan.published",
          subjectType: "route_plan",
          subjectId: plan.id,
          metadata: { salespersonId: plan.salespersonId },
        },
      });
      return published;
    });
  }

  async listPlans(filters: { salespersonId?: string; from?: Date; to?: Date }) {
    return this.prisma.routePlan.findMany({
      where: {
        ...(filters.salespersonId ? { salespersonId: filters.salespersonId } : {}),
        ...(filters.from || filters.to
          ? {
              planDate: {
                ...(filters.from ? { gte: startOfDay(filters.from) } : {}),
                ...(filters.to ? { lte: startOfDay(filters.to) } : {}),
              },
            }
          : {}),
      },
      include: {
        salesperson: { select: { id: true, name: true } },
        stops: {
          orderBy: { sequence: "asc" },
          include: { retailer: { select: { id: true, name: true, shopAddress: true } } },
        },
      },
      orderBy: [{ planDate: "desc" }, { createdAt: "desc" }],
    });
  }
}

export const defaultRouteService = new RouteService();
