import { Prisma } from "@prisma/client";
import { recomputeOverdue } from "../../lib/ageing";
import { prisma } from "../../lib/prisma";

export interface IssueCreditNoteInput {
  invoiceId: string;
  amount: number;
  reason: string;
  actorStaffId: string;
  occurredAt: Date;
  idempotencyKey: string;
}

export class FinancialCorrectionError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

function money(amount: number): number {
  const rounded = Math.round(amount * 100) / 100;
  if (!Number.isFinite(amount) || rounded <= 0 || Math.abs(rounded - amount) > 1e-9) {
    throw new FinancialCorrectionError("invalid_correction_amount");
  }
  return rounded;
}

function validateAuthority(actorStaffId: string, reason: string): string {
  if (actorStaffId.trim() === "") throw new FinancialCorrectionError("actor_required");
  const normalizedReason = reason.trim();
  if (normalizedReason.length < 5) throw new FinancialCorrectionError("correction_reason_required");
  return normalizedReason;
}

async function findExisting(input: IssueCreditNoteInput) {
  const existing = await prisma.creditNote.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { ledgerEntry: true },
  });
  if (!existing) return null;
  if (
    existing.invoiceId !== input.invoiceId ||
    Number(existing.amount) !== input.amount ||
    existing.reason !== input.reason.trim()
  ) {
    throw new FinancialCorrectionError("idempotency_key_conflict");
  }
  return existing;
}

export async function issueCreditNote(input: IssueCreditNoteInput) {
  const amount = money(input.amount);
  const reason = validateAuthority(input.actorStaffId, input.reason);
  const existing = await findExisting(input);
  if (existing) return existing;

  try {
    return await prisma.$transaction(
      async (tx) => {
        const target = await tx.invoice.findUnique({
          where: { id: input.invoiceId },
          select: { retailerId: true },
        });
        if (!target) throw new FinancialCorrectionError("invoice_not_found");

        await tx.$queryRaw`
          SELECT "id" FROM "Retailer" WHERE "id" = ${target.retailerId} FOR UPDATE
        `;
        await tx.$queryRaw`
          SELECT "id" FROM "Invoice" WHERE "id" = ${input.invoiceId} FOR UPDATE
        `;

        const invoice = await tx.invoice.findUnique({ where: { id: input.invoiceId } });
        const retailer = await tx.retailer.findUnique({ where: { id: target.retailerId } });
        if (!invoice) throw new FinancialCorrectionError("invoice_not_found");
        if (!retailer) throw new FinancialCorrectionError("retailer_not_found");
        if (invoice.status === "voided") {
          throw new FinancialCorrectionError("voided_invoice_cannot_be_credited");
        }

        const priorCredits = await tx.creditNote.aggregate({
          where: { invoiceId: invoice.id, status: "issued" },
          _sum: { amount: true },
        });
        const creditable =
          Math.round(
            (Number(invoice.total) - Number(priorCredits._sum.amount ?? 0)) * 100
          ) / 100;
        if (amount > creditable) {
          throw new FinancialCorrectionError("credit_note_exceeds_invoice_total");
        }

        const appliedToOutstanding = Math.min(amount, Number(invoice.outstandingAmount));
        const outstandingAfter =
          Math.round((Number(invoice.outstandingAmount) - appliedToOutstanding) * 100) / 100;
        const balanceAfter = new Prisma.Decimal(retailer.currentBalance).minus(amount);

        const creditNote = await tx.creditNote.create({
          data: {
            retailerId: invoice.retailerId,
            invoiceId: invoice.id,
            amount,
            reason,
            idempotencyKey: input.idempotencyKey,
          },
        });
        await tx.financialLedgerEntry.create({
          data: {
            retailerId: invoice.retailerId,
            creditNoteId: creditNote.id,
            direction: "credit",
            kind: "credit_note",
            amount,
            balanceAfter,
            idempotencyKey: `credit-note:${creditNote.id}`,
            occurredAt: input.occurredAt,
            metadata: { reason, actorStaffId: input.actorStaffId },
          },
        });
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            outstandingAmount: outstandingAfter,
            status: outstandingAfter === 0 ? "paid" : "partially_paid",
          },
        });

        if (appliedToOutstanding > 0) {
          const legacyInvoice = await tx.ledgerEntry.findFirst({
            where: { orderId: invoice.orderId, type: "invoice" },
            orderBy: { createdAt: "asc" },
          });
          if (!legacyInvoice) throw new FinancialCorrectionError("legacy_invoice_missing");
          await tx.ledgerEntry.update({
            where: { id: legacyInvoice.id },
            data: {
              settledAmount: new Prisma.Decimal(legacyInvoice.settledAmount).plus(
                appliedToOutstanding
              ),
            },
          });
        }

        await tx.retailer.update({
          where: { id: invoice.retailerId },
          data: { currentBalance: balanceAfter },
        });
        await recomputeOverdue(tx, invoice.retailerId, input.occurredAt);
        await tx.auditEvent.create({
          data: {
            actorStaffId: input.actorStaffId,
            action: "financial.credit_note_issued",
            subjectType: "Invoice",
            subjectId: invoice.id,
            metadata: {
              creditNoteId: creditNote.id,
              amount,
              reason,
              idempotencyKey: input.idempotencyKey,
            },
          },
        });

        return tx.creditNote.findUniqueOrThrow({
          where: { id: creditNote.id },
          include: { ledgerEntry: true },
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
