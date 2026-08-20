import { Prisma } from "@prisma/client";
import { recomputeOverdue } from "../../lib/ageing";
import { prisma } from "../../lib/prisma";
import { FinancialCorrectionError } from "./creditNoteService";

export interface ReversePaymentInput {
  paymentId: string;
  amount: number;
  reason: string;
  actorStaffId: string;
  occurredAt: Date;
  idempotencyKey: string;
}

function money(amount: number): number {
  const rounded = Math.round(amount * 100) / 100;
  if (!Number.isFinite(amount) || rounded <= 0 || Math.abs(rounded - amount) > 1e-9) {
    throw new FinancialCorrectionError("invalid_correction_amount");
  }
  return rounded;
}

function reasonFor(actorStaffId: string, reason: string): string {
  if (actorStaffId.trim() === "") throw new FinancialCorrectionError("actor_required");
  const normalized = reason.trim();
  if (normalized.length < 5) throw new FinancialCorrectionError("correction_reason_required");
  return normalized;
}

async function findExisting(input: ReversePaymentInput) {
  const existing = await prisma.paymentReversal.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { ledgerEntry: true, allocationReversals: true },
  });
  if (!existing) return null;
  if (
    existing.paymentId !== input.paymentId ||
    Number(existing.amount) !== input.amount ||
    existing.reason !== input.reason.trim()
  ) {
    throw new FinancialCorrectionError("idempotency_key_conflict");
  }
  return existing;
}

async function recomputeInvoiceProjection(
  tx: Prisma.TransactionClient,
  invoiceId: string
): Promise<void> {
  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const [credits, allocations] = await Promise.all([
    tx.creditNote.aggregate({
      where: { invoiceId, status: "issued" },
      _sum: { amount: true },
    }),
    tx.paymentAllocation.findMany({
      where: { invoiceId },
      include: { reversals: true },
    }),
  ]);
  const netAllocated = allocations.reduce(
    (sum, allocation) =>
      sum +
      Number(allocation.amount) -
      allocation.reversals.reduce((reversed, item) => reversed + Number(item.amount), 0),
    0
  );
  const rawOutstanding =
    Number(invoice.total) - Number(credits._sum.amount ?? 0) - netAllocated;
  const outstanding = Math.max(
    0,
    Math.min(Number(invoice.total), Math.round(rawOutstanding * 100) / 100)
  );
  const status =
    outstanding === 0
      ? "paid"
      : outstanding === Number(invoice.total)
        ? "open"
        : "partially_paid";
  await tx.invoice.update({
    where: { id: invoiceId },
    data: { outstandingAmount: outstanding, status },
  });
}

export async function reversePayment(input: ReversePaymentInput) {
  const amount = money(input.amount);
  const reason = reasonFor(input.actorStaffId, input.reason);
  const existing = await findExisting(input);
  if (existing) return existing;

  try {
    return await prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<Array<{ retailerId: string }>>`
          SELECT "retailerId" FROM "Payment" WHERE "id" = ${input.paymentId} FOR UPDATE
        `;
        if (locked.length === 0) throw new FinancialCorrectionError("payment_not_found");
        await tx.$queryRaw`
          SELECT "id" FROM "Retailer" WHERE "id" = ${locked[0].retailerId} FOR UPDATE
        `;

        const payment = await tx.payment.findUnique({
          where: { id: input.paymentId },
          include: {
            allocations: {
              include: {
                reversals: true,
                invoice: { select: { orderId: true, invoiceDate: true } },
              },
            },
          },
        });
        const retailer = await tx.retailer.findUnique({ where: { id: locked[0].retailerId } });
        if (!payment) throw new FinancialCorrectionError("payment_not_found");
        if (!retailer) throw new FinancialCorrectionError("retailer_not_found");
        if (payment.status !== "succeeded") {
          throw new FinancialCorrectionError(
            payment.status === "reversed" ? "payment_fully_reversed" : "payment_not_settled"
          );
        }

        const priorReversals = await tx.paymentReversal.aggregate({
          where: { paymentId: payment.id },
          _sum: { amount: true },
        });
        const alreadyReversed = Number(priorReversals._sum.amount ?? 0);
        const reversible = Math.round((Number(payment.amount) - alreadyReversed) * 100) / 100;
        if (amount > reversible) {
          throw new FinancialCorrectionError("payment_reversal_exceeds_settled_amount");
        }

        const reverseUnallocated = Math.min(Number(payment.unallocatedAmount), amount);
        let remaining = Math.round((amount - reverseUnallocated) * 100) / 100;
        const allocationReversals: Array<{
          paymentAllocationId: string;
          invoiceId: string;
          orderId: string;
          amount: number;
        }> = [];

        const allocationsNewestFirst = [...payment.allocations].sort(
          (left, right) =>
            right.invoice.invoiceDate.getTime() - left.invoice.invoiceDate.getTime() ||
            right.id.localeCompare(left.id)
        );
        for (const allocation of allocationsNewestFirst) {
          if (remaining === 0) break;
          const reversed = allocation.reversals.reduce(
            (sum, reversal) => sum + Number(reversal.amount),
            0
          );
          const available = Math.round((Number(allocation.amount) - reversed) * 100) / 100;
          if (available <= 0) continue;
          const applied = Math.min(available, remaining);
          allocationReversals.push({
            paymentAllocationId: allocation.id,
            invoiceId: allocation.invoiceId,
            orderId: allocation.invoice.orderId,
            amount: applied,
          });
          remaining = Math.round((remaining - applied) * 100) / 100;
        }
        if (remaining > 0) {
          throw new FinancialCorrectionError("payment_reversal_allocation_shortfall");
        }

        const reversal = await tx.paymentReversal.create({
          data: {
            paymentId: payment.id,
            amount,
            unallocatedAmount: reverseUnallocated,
            reason,
            idempotencyKey: input.idempotencyKey,
            allocationReversals: {
              create: allocationReversals.map(({ paymentAllocationId, amount: value }) => ({
                paymentAllocationId,
                amount: value,
              })),
            },
          },
        });

        for (const allocationReversal of allocationReversals) {
          await recomputeInvoiceProjection(tx, allocationReversal.invoiceId);
          const legacyInvoice = await tx.ledgerEntry.findFirst({
            where: { orderId: allocationReversal.orderId, type: "invoice" },
            orderBy: { createdAt: "asc" },
          });
          if (!legacyInvoice) throw new FinancialCorrectionError("legacy_invoice_missing");
          const settledAfter = Math.max(
            0,
            Math.round(
              (Number(legacyInvoice.settledAmount) - allocationReversal.amount) * 100
            ) / 100
          );
          await tx.ledgerEntry.update({
            where: { id: legacyInvoice.id },
            data: { settledAmount: settledAfter },
          });
        }

        const balanceAfter = new Prisma.Decimal(retailer.currentBalance).plus(amount);
        await tx.financialLedgerEntry.create({
          data: {
            retailerId: payment.retailerId,
            paymentReversalId: reversal.id,
            direction: "debit",
            kind: "payment_reversal",
            amount,
            balanceAfter,
            idempotencyKey: `payment-reversal:${reversal.id}`,
            occurredAt: input.occurredAt,
            metadata: { reason, actorStaffId: input.actorStaffId },
          },
        });
        const fullyReversed =
          Math.round((alreadyReversed + amount) * 100) / 100 === Number(payment.amount);
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            unallocatedAmount: new Prisma.Decimal(payment.unallocatedAmount).minus(
              reverseUnallocated
            ),
            status: fullyReversed ? "reversed" : "succeeded",
          },
        });
        await tx.retailer.update({
          where: { id: payment.retailerId },
          data: { currentBalance: balanceAfter },
        });
        await recomputeOverdue(tx, payment.retailerId, input.occurredAt);
        await tx.auditEvent.create({
          data: {
            actorStaffId: input.actorStaffId,
            action: "financial.payment_reversed",
            subjectType: "Payment",
            subjectId: payment.id,
            metadata: {
              paymentReversalId: reversal.id,
              amount,
              reason,
              idempotencyKey: input.idempotencyKey,
            },
          },
        });

        return tx.paymentReversal.findUniqueOrThrow({
          where: { id: reversal.id },
          include: { ledgerEntry: true, allocationReversals: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const recovered = await findExisting(input);
      if (recovered) return recovered;
    }
    throw error;
  }
}
