import { randomUUID } from "node:crypto";
import { Prisma, type ExpenseStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { ExpenseService } from "../expenseService";

const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const disposable = url && ["localhost", "127.0.0.1"].includes(url.hostname) && url.pathname.includes("test");

describe.skipIf(!disposable)("expense history on local PostgreSQL", () => {
  it("reconciles all-time mixed-status paise totals across more than 50 stored claims", async () => {
    const rollback = new Error("rollback expense history fixture");
    const salespersonId = randomUUID();
    try {
      await prisma.$transaction(async (tx) => {
        const otherId = randomUUID();
        await tx.staffUser.createMany({ data: [
          { id: salespersonId, name: "Expense total test", phone: `+91${salespersonId.replace(/\D/g, "").slice(0, 10).padEnd(10, "1")}`, email: `${salespersonId}@test.invalid` },
          { id: otherId, name: "Other expense test", phone: `+91${otherId.replace(/\D/g, "").slice(0, 10).padEnd(10, "2")}`, email: `${otherId}@test.invalid` },
        ] });
        const statuses: ExpenseStatus[] = ["submitted", "approved", "rejected"];
        const fixture = Array.from({ length: 57 }, (_, index) => ({
          id: randomUUID(), salespersonId, expenseDate: new Date("2026-03-10T00:00:00.000Z"),
          category: "fuel" as const, amount: (((index * 137) % 10000 + 1) / 100).toFixed(2),
          description: `Expense history fixture ${index}`, status: statuses[index % statuses.length],
        }));
        await tx.fieldExpense.createMany({ data: fixture });
        const foreign = await tx.fieldExpense.create({ data: {
          salespersonId: otherId, expenseDate: new Date("2026-03-10T00:00:00.000Z"),
          category: "fuel", amount: "999.99", description: "Foreign fixture",
        } });

        const service = new ExpenseService(tx);
        const first = await service.historyFor(salespersonId);
        expect(first.expenses).toHaveLength(50);
        expect(first.nextCursor).toBeTruthy();
        const second = await service.historyFor(salespersonId, first.nextCursor!);
        expect(second.expenses).toHaveLength(7);
        expect(second.nextCursor).toBeNull();
        expect(new Set([...first.expenses, ...second.expenses].map((row) => row.id)).size).toBe(57);
        expect(second.totals).toEqual(first.totals);

        const stored = await tx.fieldExpense.findMany({ where: { salespersonId }, select: { amount: true, status: true } });
        for (const status of [...statuses, "claimed"] as const) {
          const rows = status === "claimed" ? stored : stored.filter((row) => row.status === status);
          const cents = rows.reduce((sum, row) => sum + new Prisma.Decimal(row.amount).mul(100).toNumber(), 0);
          expect(first.totals[status]).toEqual({ count: rows.length, amount: (cents / 100).toFixed(2) });
        }
        await expect(service.historyFor(salespersonId, foreign.id))
          .rejects.toMatchObject({ code: "expense_cursor_invalid", status: 400 });
        await expect(service.historyFor(salespersonId, randomUUID()))
          .rejects.toMatchObject({ code: "expense_cursor_invalid", status: 400 });
        throw rollback;
      }, { timeout: 15_000 });
      throw new Error("expense fixture transaction unexpectedly committed");
    } catch (error) {
      if (error !== rollback) throw error;
    }
    expect(await prisma.fieldExpense.count({ where: { salespersonId } })).toBe(0);
    expect(await prisma.staffUser.count({ where: { id: salespersonId } })).toBe(0);
  });
});
