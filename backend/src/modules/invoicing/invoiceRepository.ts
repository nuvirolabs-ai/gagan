import type { Prisma, PrismaClient } from "@prisma/client";
import type { InvoiceResult } from "./types";

export type FinancialDb = PrismaClient | Prisma.TransactionClient;

export const invoiceDetails = { lines: true, ledgerEntry: true, legacyLedgerEntry: true } as const;

export function findOrderInvoices(db: FinancialDb, orderId: string): Promise<InvoiceResult[]> {
  return db.invoice.findMany({
    where: { orderId },
    orderBy: { invoiceNumber: "asc" },
    include: invoiceDetails,
  });
}
