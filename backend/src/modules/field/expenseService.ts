import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { getObjectStorage } from "../../platform/storage/storageRuntime";
import { ObjectStorageError, type ObjectStorage } from "../../platform/storage/objectStorage";
import { FieldServiceError } from "./attendanceService";
import { isWithinScope, startOfDay } from "./fieldDomain";

type Db = PrismaClient | any;

export interface ExpenseReceiptInput {
  contentType: string;
  bodyBase64: string;
  checksum?: string;
}

/**
 * The salesperson-facing slice of expenses: record what was spent in the
 * field, attach the receipt, submit it, and see the decision. Accounting
 * treatment stays out of this module — an approved expense is an approved
 * claim, not a posted ledger entry.
 */
export class ExpenseService {
  constructor(
    private readonly prisma: Db = defaultPrisma,
    private readonly storage: () => ObjectStorage = getObjectStorage
  ) {}

  async submit(input: {
    salespersonId: string;
    expenseDate: Date;
    category: "travel" | "fuel" | "food" | "lodging" | "telephone" | "other";
    amount: number;
    description: string;
    receipt?: ExpenseReceiptInput;
  }) {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new FieldServiceError("expense_amount_invalid", 400);
    }
    if (!input.description.trim()) throw new FieldServiceError("expense_description_required", 400);
    const expenseDate = startOfDay(input.expenseDate);
    if (expenseDate.getTime() > startOfDay(new Date()).getTime()) {
      throw new FieldServiceError("expense_date_in_future", 400);
    }

    let receiptObjectKey: string | null = null;
    let receiptContentType: string | null = null;
    if (input.receipt) {
      try {
        const stored = await this.storage().put({
          purpose: "expense_receipt",
          contentType: input.receipt.contentType,
          body: Buffer.from(input.receipt.bodyBase64, "base64"),
          checksum: input.receipt.checksum,
        });
        receiptObjectKey = stored.objectKey;
        receiptContentType = stored.contentType;
      } catch (error) {
        if (error instanceof ObjectStorageError) {
          throw new FieldServiceError(error.code, 422);
        }
        throw new FieldServiceError("expense_receipt_storage_failed", 503);
      }
    }

    return this.prisma.fieldExpense.create({
      data: {
        salespersonId: input.salespersonId,
        expenseDate,
        category: input.category,
        amount: input.amount,
        description: input.description.trim(),
        receiptObjectKey,
        receiptContentType,
      },
    });
  }

  async list(filters: {
    salespersonId?: string;
    status?: string;
    from?: Date;
    to?: Date;
    scopeStaffIds?: string[] | null;
  }) {
    const rows = await this.prisma.fieldExpense.findMany({
      where: {
        ...(filters.scopeStaffIds ? { salespersonId: { in: filters.scopeStaffIds } } : {}),
        ...(filters.salespersonId ? { salespersonId: filters.salespersonId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.from || filters.to
          ? {
              expenseDate: {
                ...(filters.from ? { gte: startOfDay(filters.from) } : {}),
                ...(filters.to ? { lte: startOfDay(filters.to) } : {}),
              },
            }
          : {}),
      },
      include: { salesperson: { select: { id: true, name: true } } },
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      take: 200,
    });
    // Receipts are handed out as short-lived signed URLs, never as raw keys.
    return Promise.all(
      rows.map(async ({ receiptObjectKey, ...expense }: any) => ({
        ...expense,
        amount: Number(expense.amount),
        hasReceipt: receiptObjectKey != null,
        receiptUrl: receiptObjectKey
          ? await this.storage()
              .signedReadUrl(receiptObjectKey, 300)
              .catch(() => null)
          : null,
      }))
    );
  }

  async historyFor(salespersonId: string, cursor?: string) {
    const salesperson = await this.prisma.staffUser.findUnique({
      where: { id: salespersonId },
      select: { id: true, name: true },
    });
    if (!salesperson) throw new FieldServiceError("staff_not_found", 404);
    if (cursor) {
      const ownedCursor = await this.prisma.fieldExpense.findFirst({
        where: { id: cursor, salespersonId },
        select: { id: true },
      });
      if (!ownedCursor) throw new FieldServiceError("expense_cursor_invalid", 400);
    }

    const [groups, rows] = await Promise.all([
      this.prisma.fieldExpense.groupBy({
        by: ["status"],
        where: { salespersonId },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.fieldExpense.findMany({
        where: { salespersonId },
        orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        take: 51,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
    ]);

    const statuses = ["submitted", "approved", "rejected"] as const;
    const totals = Object.fromEntries(statuses.map((status) => {
      const group = groups.find((entry: any) => entry.status === status);
      return [status, {
        count: group?._count._all ?? 0,
        amount: new Prisma.Decimal(group?._sum.amount ?? 0).toFixed(2),
      }];
    })) as Record<(typeof statuses)[number], { count: number; amount: string }>;
    const claimed = statuses.reduce(
      (sum, status) => ({
        count: sum.count + totals[status].count,
        amount: sum.amount.plus(totals[status].amount),
      }),
      { count: 0, amount: new Prisma.Decimal(0) }
    );
    const page = rows.slice(0, 50);
    return {
      salesperson,
      totals: { claimed: { count: claimed.count, amount: claimed.amount.toFixed(2) }, ...totals },
      expenses: await Promise.all(page.map(async ({ receiptObjectKey, ...expense }: any) => ({
        ...expense,
        amount: expense.amount.toString(),
        hasReceipt: receiptObjectKey != null,
        receiptUrl: receiptObjectKey
          ? await this.storage().signedReadUrl(receiptObjectKey, 300).catch(() => null)
          : null,
      }))),
      nextCursor: rows.length > 50 ? page[page.length - 1].id : null,
    };
  }

  async receiptFor(salespersonId: string, expenseId: string) {
    const expense = await this.prisma.fieldExpense.findFirst({
      where: { id: expenseId, salespersonId },
      select: { receiptObjectKey: true },
    });
    if (!expense?.receiptObjectKey) throw new FieldServiceError("expense_receipt_not_found", 404);
    try {
      return { receiptUrl: await this.storage().signedReadUrl(expense.receiptObjectKey, 300) };
    } catch {
      throw new FieldServiceError("expense_receipt_unavailable", 503);
    }
  }

  async claimants(scopeStaffIds: string[] | null) {
    return this.prisma.staffUser.findMany({
      where: {
        ...(scopeStaffIds ? { id: { in: scopeStaffIds } } : {}),
        fieldExpenses: { some: {} },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  async decide(input: {
    expenseId: string;
    decidedByStaffId: string;
    decision: "approved" | "rejected";
    note?: string;
    scopeStaffIds?: string[] | null;
  }) {
    const expense = await this.prisma.fieldExpense.findUnique({ where: { id: input.expenseId } });
    if (!expense) throw new FieldServiceError("expense_not_found", 404);
    if (expense.status !== "submitted") throw new FieldServiceError("expense_already_decided", 409);
    if (expense.salespersonId === input.decidedByStaffId) {
      throw new FieldServiceError("expense_self_decision_forbidden", 403);
    }
    // The reviewer must be above the claimant. Scope carries no monetary limit:
    // the existing policy has none, and inventing tiers here would be new policy.
    if (!isWithinScope(expense.salespersonId, input.scopeStaffIds)) {
      throw new FieldServiceError("outside_reporting_scope", 403);
    }
    return this.prisma.$transaction(async (tx: Db) => {
      const decided = await tx.fieldExpense.update({
        where: { id: expense.id },
        data: {
          status: input.decision,
          decidedByStaffId: input.decidedByStaffId,
          decidedAt: new Date(),
          decisionNote: input.note?.trim() || null,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorStaffId: input.decidedByStaffId,
          action: `expense.${input.decision}`,
          subjectType: "field_expense",
          subjectId: expense.id,
          metadata: { salespersonId: expense.salespersonId, amount: String(expense.amount) },
        },
      });
      return decided;
    });
  }
}

export const defaultExpenseService = new ExpenseService();
