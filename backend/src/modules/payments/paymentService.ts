import { Prisma } from "@prisma/client";
import { recomputeOverdue } from "../../lib/ageing";
import { prisma } from "../../lib/prisma";
import { buildFifoAllocations } from "./allocationService";

export interface SettleSucceededPaymentInput {
  paymentId: string;
  occurredAt: Date;
  allowAdvanceCredit?: { actorStaffId: string; reason: string };
}

export interface PaymentSettlementResult {
  paymentId: string;
  allocations: Array<{ invoiceId: string; amount: number }>;
  unallocated: number;
  balanceAfter: number;
  idempotent: boolean;
}

const MAX_TRANSACTION_ATTEMPTS = 5;

export class PaymentSettlementError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

function isPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

async function waitBeforeRetry(attempt: number): Promise<void> {
  const exponentialMs = Math.min(5 * 2 ** (attempt - 1), 40);
  const jitterMs = Math.floor(Math.random() * 6);
  await new Promise((resolve) => setTimeout(resolve, exponentialMs + jitterMs));
}

async function existingSettlement(paymentId: string): Promise<PaymentSettlementResult | null> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      allocations: { orderBy: { createdAt: "asc" } },
      settlementLedgerEntry: true,
    },
  });
  if (!payment || payment.status !== "succeeded" || !payment.settlementLedgerEntry) return null;

  return {
    paymentId: payment.id,
    allocations: payment.allocations.map((allocation) => ({
      invoiceId: allocation.invoiceId,
      amount: Number(allocation.amount),
    })),
    unallocated: Number(payment.unallocatedAmount),
    balanceAfter: Number(payment.settlementLedgerEntry.balanceAfter),
    idempotent: true,
  };
}

async function settleOnce(
  input: SettleSucceededPaymentInput
): Promise<PaymentSettlementResult> {
  return prisma.$transaction(
    async (tx) => {
      const lockedPayments = await tx.$queryRaw<Array<{ retailerId: string }>>`
        SELECT "retailerId"
        FROM "Payment"
        WHERE "id" = ${input.paymentId}
        FOR UPDATE
      `;
      if (lockedPayments.length === 0) throw new PaymentSettlementError("payment_not_found");

      const payment = await tx.payment.findUnique({
        where: { id: input.paymentId },
        include: {
          allocations: { orderBy: { createdAt: "asc" } },
          settlementLedgerEntry: true,
        },
      });
      if (!payment) throw new PaymentSettlementError("payment_not_found");

      if (payment.status === "succeeded") {
        if (!payment.settlementLedgerEntry) {
          throw new PaymentSettlementError("payment_settlement_incomplete");
        }
        return {
          paymentId: payment.id,
          allocations: payment.allocations.map((allocation) => ({
            invoiceId: allocation.invoiceId,
            amount: Number(allocation.amount),
          })),
          unallocated: Number(payment.unallocatedAmount),
          balanceAfter: Number(payment.settlementLedgerEntry.balanceAfter),
          idempotent: true,
        };
      }
      if (payment.status !== "pending") {
        throw new PaymentSettlementError("payment_not_pending");
      }

      await tx.$queryRaw`
        SELECT "id"
        FROM "Retailer"
        WHERE "id" = ${payment.retailerId}
        FOR UPDATE
      `;

      const retailer = await tx.retailer.findUnique({ where: { id: payment.retailerId } });
      if (!retailer) throw new PaymentSettlementError("retailer_not_found");

      const invoices = await tx.invoice.findMany({
        where: {
          retailerId: payment.retailerId,
          status: { in: ["open", "partially_paid"] },
          outstandingAmount: { gt: 0 },
        },
        orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      });
      const { allocations, unallocated } = buildFifoAllocations(
        invoices,
        Number(payment.amount)
      );

      const advance = input.allowAdvanceCredit;
      if (
        unallocated > 0 &&
        (!advance || advance.actorStaffId.trim() === "" || advance.reason.trim() === "")
      ) {
        throw new PaymentSettlementError("advance_credit_not_authorized");
      }

      const balanceAfter = new Prisma.Decimal(retailer.currentBalance).minus(payment.amount);

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "succeeded",
          settledAt: input.occurredAt,
          unallocatedAmount: unallocated,
        },
      });

      for (const allocation of allocations) {
        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            invoiceId: allocation.invoiceId,
            amount: allocation.amount,
          },
        });
        await tx.invoice.update({
          where: { id: allocation.invoiceId },
          data: {
            outstandingAmount: allocation.outstandingAfter,
            status: allocation.outstandingAfter === 0 ? "paid" : "partially_paid",
          },
        });

        const legacyInvoice = allocation.legacyLedgerEntryId
          ? await tx.ledgerEntry.findUnique({
              where: { id: allocation.legacyLedgerEntryId },
            })
          : await tx.ledgerEntry.findFirst({
              where: { orderId: allocation.orderId, type: "invoice" },
              orderBy: { createdAt: "asc" },
            });
        if (!legacyInvoice) {
          throw new PaymentSettlementError("legacy_invoice_missing");
        }
        await tx.ledgerEntry.update({
          where: { id: legacyInvoice.id },
          data: {
            settledAmount: new Prisma.Decimal(legacyInvoice.settledAmount).plus(allocation.amount),
          },
        });
      }

      await tx.financialLedgerEntry.create({
        data: {
          retailerId: payment.retailerId,
          paymentId: payment.id,
          direction: "credit",
          kind: "payment",
          amount: payment.amount,
          balanceAfter,
          idempotencyKey: `payment:${payment.id}`,
          occurredAt: input.occurredAt,
          metadata: advance
            ? {
                advanceCredit: {
                  actorStaffId: advance.actorStaffId,
                  reason: advance.reason.trim(),
                  amount: unallocated,
                },
              }
            : undefined,
        },
      });
      await tx.ledgerEntry.create({
        data: {
          retailerId: payment.retailerId,
          paymentId: payment.id,
          type: "payment",
          amount: payment.amount,
          balanceAfter,
        },
      });
      await tx.retailer.update({
        where: { id: payment.retailerId },
        data: { currentBalance: balanceAfter },
      });
      await recomputeOverdue(tx, payment.retailerId, input.occurredAt);

      return {
        paymentId: payment.id,
        allocations: allocations.map(({ invoiceId, amount }) => ({ invoiceId, amount })),
        unallocated,
        balanceAfter: Number(balanceAfter),
        idempotent: false,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
  );
}

export async function settleSucceededPayment(
  input: SettleSucceededPaymentInput
): Promise<PaymentSettlementResult> {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await settleOnce(input);
    } catch (error) {
      if (isPrismaCode(error, "P2002")) {
        const existing = await existingSettlement(input.paymentId);
        if (existing) return existing;
      }
      if (isPrismaCode(error, "P2034") && attempt < MAX_TRANSACTION_ATTEMPTS) {
        await waitBeforeRetry(attempt);
        continue;
      }
      throw error;
    }
  }
  throw new PaymentSettlementError("payment_settlement_retry_exhausted");
}
