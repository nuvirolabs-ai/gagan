import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { FieldServiceError } from "./attendanceService";
import { CUSTOMER_ACTIVITY_TYPES, type CustomerActivityTypeName } from "./fieldDomain";

type Db = PrismaClient | any;

export interface LogActivityInput {
  salespersonId: string;
  retailerId: string;
  type: CustomerActivityTypeName;
  visitId?: string;
  notes?: string;
  followUpAt?: Date;
  orderId?: string;
  collectionId?: string;
  serviceIssueId?: string;
  occurredAt?: Date;
  /** Stable id generated on the device so an offline replay cannot duplicate. */
  clientReference?: string;
}

/**
 * Structured customer activity. The controlled `type` is what dashboards and
 * manager reporting read; `notes` stays free text for the salesperson.
 */
export class ActivityService {
  constructor(private readonly prisma: Db = defaultPrisma) {}

  /** A salesperson may only log against a retailer assigned to them. */
  private async assertAssigned(salespersonId: string, retailerId: string) {
    const [staff, retailer] = await Promise.all([
      this.prisma.staffUser.findUnique({
        where: { id: salespersonId },
        select: { salesRepId: true },
      }),
      this.prisma.retailer.findUnique({
        where: { id: retailerId },
        select: { salesRepId: true },
      }),
    ]);
    if (!staff?.salesRepId || !retailer?.salesRepId || staff.salesRepId !== retailer.salesRepId) {
      throw new FieldServiceError("retailer_not_assigned", 404);
    }
  }

  async log(input: LogActivityInput) {
    if (!(CUSTOMER_ACTIVITY_TYPES as readonly string[]).includes(input.type)) {
      throw new FieldServiceError("activity_type_unknown", 400);
    }
    await this.assertAssigned(input.salespersonId, input.retailerId);

    // Replaying a queued offline write must return the original row rather
    // than writing a second one.
    if (input.clientReference) {
      const existing = await this.prisma.customerActivity.findUnique({
        where: {
          salespersonId_clientReference: {
            salespersonId: input.salespersonId,
            clientReference: input.clientReference,
          },
        },
      });
      if (existing) return { activity: existing, idempotent: true };
    }

    if (input.visitId) {
      const visit = await this.prisma.salesVisit.findUnique({
        where: { id: input.visitId },
        select: { salespersonId: true, retailerId: true },
      });
      if (!visit || visit.salespersonId !== input.salespersonId || visit.retailerId !== input.retailerId) {
        throw new FieldServiceError("visit_not_found", 404);
      }
    }

    const activity = await this.prisma.customerActivity.create({
      data: {
        retailerId: input.retailerId,
        salespersonId: input.salespersonId,
        visitId: input.visitId ?? null,
        type: input.type,
        notes: input.notes?.trim() || null,
        followUpAt: input.followUpAt ?? null,
        orderId: input.orderId ?? null,
        collectionId: input.collectionId ?? null,
        serviceIssueId: input.serviceIssueId ?? null,
        occurredAt: input.occurredAt ?? new Date(),
        clientReference: input.clientReference ?? null,
      },
    });
    return { activity, idempotent: false };
  }

  /** Activity timeline for one customer, newest first. */
  async forRetailer(input: { retailerId: string; salespersonId?: string; limit?: number }) {
    if (input.salespersonId) await this.assertAssigned(input.salespersonId, input.retailerId);
    return this.prisma.customerActivity.findMany({
      where: { retailerId: input.retailerId },
      include: { salesperson: { select: { id: true, name: true } } },
      orderBy: { occurredAt: "desc" },
      take: Math.min(input.limit ?? 50, 200),
    });
  }

  async forSalesperson(input: { salespersonId: string; from?: Date; to?: Date; limit?: number }) {
    return this.prisma.customerActivity.findMany({
      where: {
        salespersonId: input.salespersonId,
        ...(input.from || input.to
          ? {
              occurredAt: {
                ...(input.from ? { gte: input.from } : {}),
                ...(input.to ? { lte: input.to } : {}),
              },
            }
          : {}),
      },
      include: { retailer: { select: { id: true, name: true } } },
      orderBy: { occurredAt: "desc" },
      take: Math.min(input.limit ?? 100, 200),
    });
  }

  /** Follow-ups the salesperson still owes a customer. */
  async openFollowUps(salespersonId: string, until: Date) {
    return this.prisma.customerActivity.findMany({
      where: {
        salespersonId,
        followUpAt: { not: null, lte: until },
        type: { in: ["follow_up_required", "order_discussion", "payment_discussion"] },
      },
      include: { retailer: { select: { id: true, name: true } } },
      orderBy: { followUpAt: "asc" },
      take: 50,
    });
  }
}

export const defaultActivityService = new ActivityService();
