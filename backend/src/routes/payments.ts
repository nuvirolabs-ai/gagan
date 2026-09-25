import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../lib/auth";
import { getPaymentProvider } from "../lib/payments";
import { settleSucceededPayment } from "../modules/payments/paymentService";
import { financialSummaryFor } from "../modules/finance/financialSummary";
import { retailerPaymentInvoicesFor } from "../modules/finance/financialQueries";
import { CommercialError, invoiceBalances } from "../modules/commercial/service";
import { createRateLimiter } from "../platform/http/rateLimit";
import { PaymentEvidenceError, PaymentEvidenceService } from "../modules/payments/paymentEvidenceService";

const router = Router();
const paymentEvidenceService = new PaymentEvidenceService();

const paymentReadbackInclude = {
  scopedInvoice: { select: { id: true, invoiceNumber: true, order: { select: { orderNo: true } } } },
  allocations: {
    select: {
      amount: true,
      jainAmount: true,
      padamAmount: true,
      invoice: { select: { id: true, invoiceNumber: true, order: { select: { orderNo: true } } } },
    },
  },
} as const;

type PaymentReadback = Prisma.PaymentGetPayload<{ include: typeof paymentReadbackInclude }>;

const paymentEvidenceSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  bodyBase64: z.string().min(4).max(14_000_000),
  checksum: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict();

/** What the retailer owes, split by ageing bucket, to drive the pay screen. */
router.get("/payments/dues", requireAuth, async (req: AuthedRequest, res) => {
  const retailer = await prisma.retailer.findUnique({ where: { id: req.retailerId } });
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });

  const summary = await financialSummaryFor(prisma, retailer.id);
  if (!summary) return res.status(404).json({ error: "Retailer not found" });
  const paymentOptions = await retailerPaymentInvoicesFor(prisma, retailer.id);
  res.json({
    outstanding: summary.outstanding,
    overdue: summary.overdue,
    creditLimit: summary.creditLimit,
    available: summary.availableCredit,
    ageing: summary.invoiceAgeing,
    financialSummary: summary,
    ...paymentOptions,
  });
});

const intentSchema = z.object({
  amount: z.number().positive(),
  invoiceScopeId: z.string().uuid().optional(),
  jainAmount: z.number().nonnegative().optional(),
  padamAmount: z.number().nonnegative().optional(),
}).strict().superRefine((data, context) => {
  const toCents = (value: number) => Math.round(value * 100);
  const isMoney = (value: number) => {
    const cents = toCents(value);
    return Number.isSafeInteger(cents) && Math.abs(value * 100 - cents) < 0.0001;
  };
  if (!isMoney(data.amount)) context.addIssue({ code: "custom", path: ["amount"], message: "invalid_precision" });
  const hasEntityAmounts = data.jainAmount !== undefined || data.padamAmount !== undefined;
  if (!data.invoiceScopeId) {
    if (hasEntityAmounts) context.addIssue({ code: "custom", path: ["invoiceScopeId"], message: "invoice_required" });
    return;
  }
  if (data.jainAmount === undefined || data.padamAmount === undefined) {
    context.addIssue({ code: "custom", path: ["jainAmount"], message: "entity_split_required" });
    return;
  }
  if (!isMoney(data.jainAmount) || !isMoney(data.padamAmount)) {
    context.addIssue({ code: "custom", path: ["jainAmount"], message: "invalid_precision" });
  }
  if (toCents(data.jainAmount) + toCents(data.padamAmount) !== toCents(data.amount)) {
    context.addIssue({ code: "custom", path: ["amount"], message: "entity_split_must_match_amount" });
  }
});

function scopedInvoiceProjection(payment: PaymentReadback) {
  return {
    invoice: payment.scopedInvoice
      ? {
          id: payment.scopedInvoice.id,
          invoiceNumber: payment.scopedInvoice.invoiceNumber,
          orderNo: payment.scopedInvoice.order?.orderNo ?? null,
        }
      : null,
    jainAmount: payment.confirmedJainAmount == null ? null : Number(payment.confirmedJainAmount),
    padamAmount: payment.confirmedPadamAmount == null ? null : Number(payment.confirmedPadamAmount),
    allocations: payment.allocations.map((allocation) => ({
      invoice: {
        id: allocation.invoice.id,
        invoiceNumber: allocation.invoice.invoiceNumber,
        orderNo: allocation.invoice.order?.orderNo ?? null,
      },
      amount: Number(allocation.amount),
      jainAmount: allocation.jainAmount == null ? null : Number(allocation.jainAmount),
      padamAmount: allocation.padamAmount == null ? null : Number(allocation.padamAmount),
    })),
  };
}

/**
 * Start a payment. Creates a pending Payment row *before* handing off to the
 * provider so a callback always has a record to reconcile against, even if the
 * app dies mid-flow.
 */
router.post("/payments/intent", requireAuth, createRateLimiter({ name: "payment-intent", limit: 10, windowMs: 60_000 }), async (req: AuthedRequest, res) => {
  const parsed = intentSchema.safeParse(req.body);
  if (!parsed.success) {
    const scoped = Boolean(req.body?.invoiceScopeId);
    return res.status(400).json({ error: scoped ? "invalid_invoice_entity_allocation" : "Enter a valid amount" });
  }

  const retailer = await prisma.retailer.findUnique({ where: { id: req.retailerId } });
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });

  const outstanding = Number(retailer.currentBalance);
  if (outstanding <= 0) {
    return res.status(400).json({ error: "There is nothing outstanding to pay" });
  }
  if (parsed.data.amount > outstanding) {
    return res.status(400).json({
      error: "Amount is more than you owe",
      outstanding,
    });
  }

  const provider = getPaymentProvider();
  let payment: { id: string; amount: Prisma.Decimal };
  if (parsed.data.invoiceScopeId) {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id"=${parsed.data.invoiceScopeId} AND "retailerId"=${retailer.id} FOR UPDATE`;
      const invoice = await tx.invoice.findFirst({
        where: {
          id: parsed.data.invoiceScopeId,
          retailerId: retailer.id,
          status: { in: ["open", "partially_paid"] },
          outstandingAmount: { gt: 0 },
        },
        select: { id: true, outstandingAmount: true },
      });
      if (!invoice) return { error: { status: 404, code: "invoice_not_found" } as const };

      let balances;
      try {
        balances = await invoiceBalances(tx, invoice.id);
      } catch (error) {
        if (error instanceof CommercialError) {
          return { error: { status: error.status, code: error.code } as const };
        }
        throw error;
      }

      const amount = new Prisma.Decimal(parsed.data.amount);
      const jainAmount = new Prisma.Decimal(parsed.data.jainAmount!);
      const padamAmount = new Prisma.Decimal(parsed.data.padamAmount!);
      if (
        balances.invoice.retailerId !== retailer.id ||
        amount.gt(invoice.outstandingAmount) ||
        jainAmount.gt(balances.jain) ||
        padamAmount.gt(balances.padam)
      ) {
        return { error: { status: 409, code: "invoice_entity_allocation_invalid" } as const };
      }

      const scopedPayment = await tx.payment.create({
        data: {
          retailerId: retailer.id,
          amount,
          status: "pending",
          channel: "online",
          provider: provider.name,
          invoiceScopeId: invoice.id,
          confirmedJainAmount: jainAmount,
          confirmedPadamAmount: padamAmount,
        },
      });
      return { payment: scopedPayment } as const;
    });
    if ("error" in result && result.error) {
      return res.status(result.error.status).json({ error: result.error.code });
    }
    payment = result.payment;
  } else {
    // The legacy FIFO path remains available only when it cannot consume an
    // entity-attributed invoice without an explicit invoice/company split.
    if (await prisma.invoice.count({
      where: { retailerId: retailer.id, outstandingAmount: { gt: 0 }, commercialSnapshot: { not: Prisma.DbNull } },
    })) {
      return res.status(409).json({
        error: "Please ask your collecting employee to record payment against the specific invoice with Jain and Padam allocations.",
      });
    }
    payment = await prisma.payment.create({
      data: {
        retailerId: retailer.id,
        amount: parsed.data.amount,
        status: "pending",
        channel: "online",
        provider: provider.name,
      },
    });
  }

  try {
    const intent = await provider.createIntent({
      amount: Number(payment.amount),
      currency: "INR",
      retailerId: retailer.id,
      reference: payment.id,
    });

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { providerRef: intent.providerRef },
    });

    res.status(201).json({
      paymentId: updated.id,
      amount: Number(updated.amount),
      redirectUrl: intent.redirectUrl,
      clientPayload: intent.clientPayload,
    });
  } catch (err) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "failed", failureReason: "Could not reach the payment provider" },
    });
    throw err;
  }
});

/**
 * Provider callback. This is the only thing that marks a payment succeeded —
 * the app reporting success is never trusted, because a client can lie about it.
 * Unauthenticated by design (the provider has no session); the signature check
 * inside verifyCallback is what authorises it.
 */
router.post("/payments/callback", async (req, res) => {
  const provider = getPaymentProvider();
  const event = provider.verifyCallback(req.body, req.headers as Record<string, string | undefined>);
  if (!event) return res.status(400).json({ error: "Invalid or unverified callback" });

  const payment = await prisma.payment.findUnique({ where: { providerRef: event.providerRef } });
  if (!payment) return res.status(404).json({ error: "Unknown payment reference" });

  // Providers retry callbacks, so this must be idempotent.
  if (payment.status !== "pending") {
    return res.json({ ok: true, status: payment.status, idempotent: true });
  }

  if (event.status !== "succeeded") {
    const transition = await prisma.payment.updateMany({
      where: { id: payment.id, status: "pending" },
      data: {
        status: event.status,
        failureReason: event.status === "failed" ? event.reason : "Cancelled by the retailer",
      },
    });
    if (transition.count === 0) {
      const current = await prisma.payment.findUnique({ where: { id: payment.id } });
      return res.json({ ok: true, status: current?.status ?? payment.status, idempotent: true });
    }
    return res.json({ ok: true, status: event.status });
  }

  const result = await settleSucceededPayment({
    paymentId: payment.id,
    occurredAt: new Date(),
  });

  res.json({ ok: true, status: "succeeded", ...result });
});

router.post("/payments/:id/evidence", requireAuth, createRateLimiter({ name: "payment-evidence", limit: 8, windowMs: 60_000 }), async (req: AuthedRequest, res) => {
  const parsed = paymentEvidenceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_evidence" });
  try {
    const evidence = await paymentEvidenceService.attach(req.params.id, req.retailerId!, parsed.data);
    res.status(201).json({ evidence });
  } catch (error) {
    if (error instanceof PaymentEvidenceError) return res.status(error.status).json({ error: error.code });
    throw error;
  }
});

router.get("/payments/:id", requireAuth, async (req: AuthedRequest, res) => {
  const payment = await prisma.payment.findFirst({
    where: { id: req.params.id, retailerId: req.retailerId },
    include: {
      evidence: { orderBy: { createdAt: "asc" } },
      ...paymentReadbackInclude,
    },
  });
  if (!payment) return res.status(404).json({ error: "Payment not found" });

  const evidence = await paymentEvidenceService.presentMany(payment.evidence);
  res.json({
    id: payment.id,
    amount: Number(payment.amount),
    status: payment.status,
    channel: payment.channel,
    failureReason: payment.failureReason,
    createdAt: payment.createdAt,
    settledAt: payment.settledAt,
    ...scopedInvoiceProjection(payment),
    evidence,
  });
});

router.get("/payments", requireAuth, async (req: AuthedRequest, res) => {
  const payments = await prisma.payment.findMany({
    where: { retailerId: req.retailerId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      evidence: { orderBy: { createdAt: "asc" } },
      ...paymentReadbackInclude,
    },
  });
  res.json({
    payments: await Promise.all(payments.map(async (p) => ({
      id: p.id,
      amount: Number(p.amount),
      status: p.status,
      channel: p.channel,
      createdAt: p.createdAt,
      settledAt: p.settledAt,
      ...scopedInvoiceProjection(p),
      evidence: await paymentEvidenceService.presentMany(p.evidence),
    }))),
  });
});

export default router;
