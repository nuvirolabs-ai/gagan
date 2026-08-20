import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAdmin } from "../../lib/adminAuth";
import { ageAllRetailers } from "../../lib/ageing";
import {
  financialAgeingFor,
  financialLedgerFor,
} from "../../modules/finance/financialQueries";
import {
  PaymentSettlementError,
  settleSucceededPayment,
} from "../../modules/payments/paymentService";
import { nextQuarterlyCheckpoint } from "../../modules/credit/reviewSchedule";

const router = Router();
router.use(requireAdmin);

router.get("/retailers", async (_req, res) => {
  const retailers = await prisma.retailer.findMany({
    include: { tier: true, salesRep: true },
    orderBy: { name: "asc" },
  });
  res.json({
    retailers: retailers.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      shopAddress: r.shopAddress,
      tier: { id: r.tier.id, name: r.tier.name },
      salesRep: r.salesRep ? { id: r.salesRep.id, name: r.salesRep.name } : null,
      creditLimit: Number(r.creditLimit),
      currentBalance: Number(r.currentBalance),
      overdueAmount: Number(r.overdueAmount),
      available: Math.max(Number(r.creditLimit) - Number(r.currentBalance), 0),
    })),
  });
});

router.get("/retailers/:id", async (req, res) => {
  const retailer = await prisma.retailer.findUnique({
    where: { id: req.params.id },
    include: {
      tier: true,
      salesRep: true,
      priceOverrides: { include: { variant: { include: { product: true } } } },
    },
  });
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });
  res.json({ retailer });
});

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10).max(15),
  shopAddress: z.string().min(1),
  tierId: z.string(),
  creditLimit: z.number().min(0).default(0),
  salesRepId: z.string().optional(),
});

router.post("/retailers", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const existing = await prisma.retailer.findUnique({ where: { phone: parsed.data.phone } });
  if (existing) return res.status(409).json({ error: "A retailer with this phone already exists" });

  const retailer = await prisma.$transaction(async (tx) => {
    const created = await tx.retailer.create({ data: parsed.data, include: { tier: true } });
    const nextReviewAt = nextQuarterlyCheckpoint(created.createdAt);
    await tx.creditProfile.create({
      data: { retailerId: created.id, rating: "N", accountCreatedAt: created.createdAt, nextReviewAt },
    });
    return created;
  });
  res.status(201).json({ retailer });
});

router.post("/retailers/:id/tier", async (req, res) => {
  const parsed = z.object({ tierId: z.string() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const tier = await prisma.tier.findUnique({ where: { id: parsed.data.tierId } });
  if (!tier) return res.status(404).json({ error: "Tier not found" });

  const retailer = await prisma.retailer.update({
    where: { id: req.params.id },
    data: { tierId: parsed.data.tierId },
    include: { tier: true },
  });
  res.json({ retailer });
});

router.post("/retailers/:id/credit-limit", async (req, res) => {
  const parsed = z.object({ creditLimit: z.number().min(0) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const retailer = await prisma.retailer.update({
    where: { id: req.params.id },
    data: { creditLimit: parsed.data.creditLimit },
  });
  res.json({ retailer });
});

const overrideSchema = z.object({ variantId: z.string(), price: z.number().min(0) });

router.post("/retailers/:id/price-override", async (req, res) => {
  const parsed = overrideSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const override = await prisma.priceOverride.upsert({
    where: {
      retailerId_variantId: { retailerId: req.params.id, variantId: parsed.data.variantId },
    },
    update: { price: parsed.data.price },
    create: { retailerId: req.params.id, variantId: parsed.data.variantId, price: parsed.data.price },
  });
  res.json({ override });
});

router.delete("/retailers/:id/price-override/:variantId", async (req, res) => {
  await prisma.priceOverride
    .delete({
      where: {
        retailerId_variantId: { retailerId: req.params.id, variantId: req.params.variantId },
      },
    })
    .catch(() => null);
  res.json({ ok: true });
});

router.get("/retailers/:id/ledger", async (req, res) => {
  const [retailer, entries, ageing] = await Promise.all([
    prisma.retailer.findUnique({ where: { id: req.params.id } }),
    financialLedgerFor(prisma, req.params.id),
    financialAgeingFor(prisma, req.params.id),
  ]);
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });

  res.json({
    currentBalance: Number(retailer.currentBalance),
    creditLimit: Number(retailer.creditLimit),
    overdueAmount: Number(retailer.overdueAmount),
    ageing,
    entries,
  });
});

/** Force an ageing refresh — normally driven by the scheduled job. */
router.post("/ageing/run", async (_req, res) => {
  const result = await ageAllRetailers();
  res.json(result);
});

const paymentSchema = z.object({
  retailerId: z.string(),
  amount: z.number().positive(),
  idempotencyKey: z.string().trim().min(8).max(100),
});

/**
 * Ops recording money collected offline (cash, cheque, NEFT). Goes through the
 * same settlement path as an in-app payment so both allocate against invoices
 * and re-age the account identically.
 */
router.post("/payments", async (req, res) => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const retailer = await prisma.retailer.findUnique({ where: { id: parsed.data.retailerId } });
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });

  const providerRef = `manual:${parsed.data.idempotencyKey}`;
  const payment = await prisma.payment.upsert({
    where: { providerRef },
    update: {},
    create: {
      retailerId: retailer.id,
      amount: parsed.data.amount,
      status: "pending",
      channel: "manual",
      provider: "manual",
      providerRef,
    },
  });
  if (
    payment.retailerId !== retailer.id ||
    Number(payment.amount) !== parsed.data.amount
  ) {
    return res.status(409).json({ error: "idempotency_key_conflict" });
  }
  try {
    const settled = await settleSucceededPayment({
      paymentId: payment.id,
      occurredAt: new Date(),
    });
    const updated = await prisma.retailer.findUnique({ where: { id: retailer.id } });
    res.json({ payment: { ...payment, status: "succeeded" }, ...settled, retailer: updated });
  } catch (error) {
    await prisma.payment.updateMany({
      where: { id: payment.id, status: "pending" },
      data: {
        status: "failed",
        failureReason:
          error instanceof PaymentSettlementError ? error.code : "manual_settlement_failed",
      },
    });
    if (error instanceof PaymentSettlementError) {
      return res.status(409).json({ error: error.code });
    }
    throw error;
  }
});

router.get("/tiers", async (_req, res) => {
  const tiers = await prisma.tier.findMany({ orderBy: { name: "asc" } });
  res.json({ tiers });
});

export default router;
