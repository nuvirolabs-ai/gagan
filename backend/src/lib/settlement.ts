import { Prisma, PrismaClient } from "@prisma/client";
import { allocatePaymentToInvoices, recomputeOverdue } from "./ageing";

type Db = PrismaClient | Prisma.TransactionClient;

export interface SettleResult {
  ledgerEntryId: string;
  balanceAfter: number;
  unallocated: number;
  overdueAfter: number;
}

/**
 * The one place a payment is turned into money movement, whether it came from
 * the retailer paying in-app or ops recording a cash collection. Creates the
 * ledger entry, allocates against open invoices oldest-first, moves the balance
 * and re-ages the account — all on the caller's transaction so a partial
 * failure can't leave the ledger and the balance disagreeing.
 */
export async function settlePayment(
  db: Db,
  params: { retailerId: string; amount: number; paymentId?: string }
): Promise<SettleResult> {
  const retailer = await db.retailer.findUnique({ where: { id: params.retailerId } });
  if (!retailer) throw new Error("Retailer not found");

  const balanceAfter = Math.round((Number(retailer.currentBalance) - params.amount) * 100) / 100;

  const entry = await db.ledgerEntry.create({
    data: {
      retailerId: params.retailerId,
      paymentId: params.paymentId ?? null,
      type: "payment",
      amount: params.amount,
      balanceAfter,
    },
  });

  const unallocated = await allocatePaymentToInvoices(db, params.retailerId, params.amount);

  await db.retailer.update({
    where: { id: params.retailerId },
    data: { currentBalance: balanceAfter },
  });

  const overdueAfter = await recomputeOverdue(db, params.retailerId);

  return { ledgerEntryId: entry.id, balanceAfter, unallocated, overdueAfter };
}
