import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { FieldServiceError } from "../field/attendanceService";

type Db = PrismaClient | any;
const PAGE_SIZE = 25;
const feedbackSelect = {
  id: true,
  retailerId: true,
  salesRepId: true,
  salesRep: { select: { id: true, name: true } },
  description: true,
  clientReference: true,
  createdAt: true,
} as const;

function seek(cursor?: string) {
  if (!cursor) return {};
  if (cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new FieldServiceError("invalid_feedback_cursor", 400);
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const value = JSON.parse(decoded);
    if (Buffer.from(decoded).toString("base64url") !== cursor ||
      typeof value?.createdAt !== "string" || new Date(value.createdAt).toISOString() !== value.createdAt ||
      typeof value?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(value.id)) throw new Error("invalid_cursor");
    const createdAt = new Date(value.createdAt);
    return { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: value.id } }] };
  } catch {
    throw new FieldServiceError("invalid_feedback_cursor", 400);
  }
}

function page(rows: any[]) {
  const feedback = rows.slice(0, PAGE_SIZE);
  const last = feedback.at(-1);
  return {
    feedback,
    nextCursor: rows.length > PAGE_SIZE && last
      ? Buffer.from(JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id })).toString("base64url")
      : null,
  };
}

export class SalespersonFeedbackService {
  constructor(private readonly db: Db = defaultPrisma) {}

  async submit(input: { retailerId: string; expectedSalesRepId: string; description: string; clientReference: string }) {
    const description = input.description.trim();
    if (description.length < 3 || description.length > 1000) throw new FieldServiceError("feedback_description_required", 400);
    if (!input.clientReference || input.clientReference.length > 120) throw new FieldServiceError("feedback_reference_required", 400);
    if (!input.expectedSalesRepId) throw new FieldServiceError("salesperson_identity_required", 400);
    return this.db.$transaction(async (tx: Db) => {
      const [retailer] = await tx.$queryRaw<Array<{ id: string; salesRepId: string | null }>>`
        SELECT "id", "salesRepId" FROM "Retailer" WHERE "id" = ${input.retailerId} FOR UPDATE
      `;
      if (!retailer) throw new FieldServiceError("retailer_not_found", 404);
      const existing = await tx.salespersonFeedback.findUnique({
        where: { retailerId_clientReference: { retailerId: input.retailerId, clientReference: input.clientReference } },
        select: feedbackSelect,
      });
      if (existing) {
        if (existing.description !== description || existing.salesRepId !== input.expectedSalesRepId) {
          throw new FieldServiceError("feedback_payload_conflict", 409);
        }
        return existing;
      }
      if (!retailer.salesRepId) throw new FieldServiceError("salesperson_not_assigned", 409);
      if (retailer.salesRepId !== input.expectedSalesRepId) throw new FieldServiceError("salesperson_assignment_changed", 409);
      return tx.salespersonFeedback.create({
        data: { retailerId: input.retailerId, salesRepId: retailer.salesRepId, description, clientReference: input.clientReference },
        select: feedbackSelect,
      });
    });
  }

  async assignmentForRetailer(retailerId: string) {
    const retailer = await this.db.retailer.findUnique({
      where: { id: retailerId }, select: { salesRep: { select: { id: true, name: true } } },
    });
    if (!retailer) throw new FieldServiceError("retailer_not_found", 404);
    return retailer.salesRep;
  }

  async byClientReference(retailerId: string, clientReference: string) {
    const feedback = await this.db.salespersonFeedback.findUnique({
      where: { retailerId_clientReference: { retailerId, clientReference } }, select: feedbackSelect,
    });
    if (!feedback) throw new FieldServiceError("feedback_not_found", 404);
    return feedback;
  }

  async forRetailer(retailerId: string, cursor?: string) {
    const rows = await this.db.salespersonFeedback.findMany({
      where: { retailerId, ...seek(cursor) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: PAGE_SIZE + 1, select: feedbackSelect,
    });
    return page(rows);
  }

  async forAdmin(scopeStaffIds: string[] | null, cursor?: string) {
    const salesRepIds = scopeStaffIds === null ? null : (await this.db.staffUser.findMany({
      where: { id: { in: scopeStaffIds } }, select: { salesRepId: true },
    })).map((staff: { salesRepId: string | null }) => staff.salesRepId).filter((id: string | null): id is string => Boolean(id));
    const rows = await this.db.salespersonFeedback.findMany({
      where: { ...(salesRepIds === null ? {} : { salesRepId: { in: salesRepIds } }), ...seek(cursor) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: PAGE_SIZE + 1,
      select: { ...feedbackSelect, retailer: { select: { name: true } } },
    });
    return page(rows);
  }
}

export const defaultSalespersonFeedbackService = new SalespersonFeedbackService();
