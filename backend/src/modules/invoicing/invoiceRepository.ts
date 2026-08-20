import type { Prisma, PrismaClient } from "@prisma/client";
import type { InvoiceResult } from "./types";

export type FinancialDb = PrismaClient | Prisma.TransactionClient;

export function findExistingInvoice(
  db: FinancialDb,
  input: { orderId: string; idempotencyKey: string }
): Promise<InvoiceResult | null> {
  return db.invoice.findFirst({
    where: {
      OR: [{ orderId: input.orderId }, { idempotencyKey: input.idempotencyKey }],
    },
    include: { lines: true, ledgerEntry: true },
  });
}
