import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../lib/auth";
import { getPaymentProvider } from "../lib/payments";
import { settleSucceededPayment } from "../modules/payments/paymentService";
import { financialAgeingFor } from "../modules/finance/financialQueries";

const router = Router();

/** What the retailer owes, split by ageing bucket, to drive the pay screen. */
router.get("/payments/dues", requireAuth, async (req: AuthedRequest, res) => {
  const retailer = await prisma.retailer.findUnique({ where: { id: req.retailerId } });
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });

  const ageing = await financialAgeingFor(prisma, retailer.id);
  res.json({
    outstanding: Number(retailer.currentBalance),
    overdue: Number(retailer.overdueAmount),
    creditLimit: Number(retailer.creditLimit),
    available: Math.max(Number(retailer.creditLimit) - Number(retailer.currentBalance), 0),
    ageing,
  });
});

const intentSchema = z.object({ amount: z.number().positive() });

/**
 * Start a payment. Creates a pending Payment row *before* handing off to the
 * provider so a callback always has a record to reconcile against, even if the
 * app dies mid-flow.
 */
router.post("/payments/intent", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = intentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter a valid amount" });

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
  const payment = await prisma.payment.create({
    data: {
      retailerId: retailer.id,
      amount: parsed.data.amount,
      status: "pending",
      channel: "online",
      provider: provider.name,
    },
  });

  try {
    const intent = await provider.createIntent({
      amount: parsed.data.amount,
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

router.get("/payments/:id", requireAuth, async (req: AuthedRequest, res) => {
  const payment = await prisma.payment.findFirst({
    where: { id: req.params.id, retailerId: req.retailerId },
  });
  if (!payment) return res.status(404).json({ error: "Payment not found" });

  res.json({
    id: payment.id,
    amount: Number(payment.amount),
    status: payment.status,
    channel: payment.channel,
    failureReason: payment.failureReason,
    createdAt: payment.createdAt,
    settledAt: payment.settledAt,
  });
});

router.get("/payments", requireAuth, async (req: AuthedRequest, res) => {
  const payments = await prisma.payment.findMany({
    where: { retailerId: req.retailerId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({
    payments: payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      status: p.status,
      channel: p.channel,
      createdAt: p.createdAt,
      settledAt: p.settledAt,
    })),
  });
});

export default router;
