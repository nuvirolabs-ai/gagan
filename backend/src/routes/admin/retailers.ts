import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { AdminRequest, requireAdmin, requireAnyAdminPermission } from "../../lib/adminAuth";
import { Permissions } from "../../modules/identity/roleCatalog";
import { ageAllRetailers } from "../../lib/ageing";
import { financialLedgerFor } from "../../modules/finance/financialQueries";
import { financialSummaryFor, financialSummariesForRetailers } from "../../modules/finance/financialSummary";
import {
  PaymentSettlementError,
  settleSucceededPayment,
} from "../../modules/payments/paymentService";
import { nextQuarterlyCheckpoint } from "../../modules/credit/reviewSchedule";
import { CommercialStatusCode } from "@prisma/client";
import { internalStatusForRetailer, internalStatusesForRetailers, recordCommercialStatusEvent } from "../../modules/commercialStatus/statusService";

const router = Router();

router.get(
  "/tiers",
  requireAnyAdminPermission(Permissions.STAFF_MANAGE, Permissions.RETAILER_PROPOSAL_REVIEW, Permissions.CATALOG_MANAGE),
  async (_req, res) => {
    const tiers = await prisma.tier.findMany({ orderBy: { name: "asc" } });
    res.json({ tiers });
  }
);

router.use(["/retailers", "/ageing", "/payments"], requireAdmin);

router.get("/retailers", async (_req, res) => {
  const retailers = await prisma.retailer.findMany({
    include: { tier: true, salesRep: true },
    orderBy: { name: "asc" },
  });

  const retailerIds = retailers.map((r) => r.id);
  const [financialMap, commercialMap] = await Promise.all([
    financialSummariesForRetailers(prisma, retailers),
    internalStatusesForRetailers(retailerIds),
  ]);

  const summary = retailers.map((r) => {
    const financial = financialMap.get(r.id);
    const commercialStatus = commercialMap.get(r.id) ?? null;
    return {
      id: r.id,
      name: r.name,
      phone: r.phone,
      shopAddress: r.shopAddress,
      deliveryCity: r.deliveryCity,
      tier: { id: r.tier.id, name: r.tier.name },
      internalSegment: r.internalSegment,
      salesRep: r.salesRep ? { id: r.salesRep.id, name: r.salesRep.name } : null,
      creditLimit: financial ? financial.creditLimit : Number(r.creditLimit),
      currentBalance: financial ? financial.outstanding : Number(r.currentBalance),
      overdueAmount: financial ? financial.overdue : Number(r.overdueAmount),
      available: financial ? financial.availableCredit : 0,
      financialSummary: financial,
      commercialStatus,
    };
  });
  res.json({ retailers: summary });
});

router.get("/retailers/:id", async (req, res) => {
  const [retailer, commercialStatus] = await Promise.all([prisma.retailer.findUnique({
    where: { id: req.params.id },
    include: {
      tier: true,
      salesRep: true,
      priceOverrides: { include: { variant: { include: { product: true } } } },
    },
  }), internalStatusForRetailer(req.params.id)]);
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });
  res.json({ retailer, commercialStatus });
});

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10).max(15),
  shopAddress: z.string().min(1),
  deliveryCity: z.string().trim().min(2).max(120).optional(),
  tierId: z.string(),
  creditLimit: z.number().min(0).default(0),
  salesRepId: z.string().optional(),
});

router.post("/retailers", async (req: AdminRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const existing = await prisma.retailer.findUnique({ where: { phone: parsed.data.phone } });
  if (existing) return res.status(409).json({ error: "A retailer with this phone already exists" });

  const retailer = await prisma.$transaction(async (tx) => {
    const created = await tx.retailer.create({ data: parsed.data, include: { tier: true } });
    await tx.retailerLocation.create({
      data: { retailerId: created.id, status: "NOT_SET", source: "MIGRATION", locationVersion: 0 },
    });
    const nextReviewAt = nextQuarterlyCheckpoint(created.createdAt);
    await tx.creditProfile.create({
      data: { retailerId: created.id, rating: "N", accountCreatedAt: created.createdAt, nextReviewAt },
    });
    await recordCommercialStatusEvent(tx, {
      code: CommercialStatusCode.ACCOUNT_OPENED,
      retailerId: created.id,
      actorStaffId: req.staffAuth?.staffId ?? null,
      metadata: { source: "admin_retailer_creation", lifecycle: created.status },
      idempotencyKey: `account-opened:${created.id}`,
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

router.post("/retailers/:id/internal-segment", async (req, res) => {
  const parsed = z.object({ internalSegment: z.enum(["A", "B", "C"]).nullable() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid internal segment" });

  const retailer = await prisma.retailer.update({
    where: { id: req.params.id },
    data: { internalSegment: parsed.data.internalSegment },
    select: { id: true, internalSegment: true, tierId: true },
  });
  res.json({ retailer });
});

// Routing geography is explicit operational data. It is intentionally kept
// separate from shopAddress so the quote engine never parses free text.
router.post("/retailers/:id/delivery-city", async (req, res) => {
  const parsed = z.object({ deliveryCity: z.string().trim().min(2).max(120) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid delivery city" });
  const retailer = await prisma.retailer.update({ where: { id: req.params.id }, data: { deliveryCity: parsed.data.deliveryCity } });
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
    update: { price: parsed.data.price, rateBasis:"case" },
    create: { retailerId: req.params.id, variantId: parsed.data.variantId, price: parsed.data.price, rateBasis:"case" },
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
  const [retailer, entries, financialSummary] = await Promise.all([
    prisma.retailer.findUnique({ where: { id: req.params.id } }),
    financialLedgerFor(prisma, req.params.id),
    financialSummaryFor(prisma, req.params.id),
  ]);
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });

  res.json({
    currentBalance: financialSummary?.outstanding ?? Number(retailer.currentBalance),
    creditLimit: financialSummary?.creditLimit ?? Number(retailer.creditLimit),
    overdueAmount: financialSummary?.overdue ?? Number(retailer.overdueAmount),
    ageing: financialSummary?.invoiceAgeing ?? null,
    financialSummary,
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
  const existingPayment = await prisma.payment.findUnique({ where: { providerRef } });
  if (!existingPayment) {
    const summary = await financialSummaryFor(prisma, retailer.id);
    if (summary?.reconciliationRequired) {
      return res.status(409).json({ error: "financial_reconciliation_required" });
    }
  }
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

const bulkReassignSchema = z.object({
  retailerIds: z.array(z.string().min(1)).min(1),
  salesRepId: z.string().min(1),
});

router.post("/retailers/bulk-reassign", async (req: AdminRequest, res) => {
  const parsed = bulkReassignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const targetRep = await prisma.salesRep.findUnique({
    where: { id: parsed.data.salesRepId },
  });
  if (!targetRep) {
    return res.status(404).json({ error: "Target salesperson does not exist" });
  }

  const result = await prisma.retailer.updateMany({
    where: { id: { in: parsed.data.retailerIds } },
    data: { salesRepId: parsed.data.salesRepId },
  });

  res.json({
    updatedCount: result.count,
    targetSalesRep: { id: targetRep.id, name: targetRep.name },
    message: `Successfully reassigned ${result.count} retailer(s) to ${targetRep.name}`,
  });
});

// Gap 8: Full Retailer Profile & KYC Master
router.get("/retailers/:id/full-profile", async (req: AdminRequest, res) => {
  try {
    const retailer = await prisma.retailer.findUnique({
      where: { id: req.params.id },
      include: {
        tier: true,
        salesRep: true,
        location: true,
        contacts: true,
        kycCase: {
          include: {
            documents: {
              include: { asset: true },
            },
          },
        },
      },
    });

    if (!retailer) return res.status(404).json({ error: "Retailer not found" });

    res.json({
      retailer: {
        id: retailer.id,
        name: retailer.name,
        ownerName: retailer.ownerName,
        shopAddress: retailer.shopAddress,
        deliveryCity: retailer.deliveryCity,
        pincode: retailer.pincode,
        phone: retailer.phone,
        gstin: retailer.gstin,
        pan: retailer.pan,
        status: retailer.status,
        internalSegment: retailer.internalSegment,
        tierId: retailer.tierId,
        tierName: retailer.tier.name,
        creditLimit: Number(retailer.creditLimit),
        currentBalance: Number(retailer.currentBalance),
        overdueAmount: Number(retailer.overdueAmount),
        paymentTermDays: retailer.paymentTermDays ?? retailer.tier.paymentTermDays,
        salesRepId: retailer.salesRepId,
        salesRepName: retailer.salesRep?.name ?? null,
        location: retailer.location
          ? {
              latitude: retailer.location.latitude ? Number(retailer.location.latitude) : null,
              longitude: retailer.location.longitude ? Number(retailer.location.longitude) : null,
              accuracyMeters: retailer.location.accuracyMeters ? Number(retailer.location.accuracyMeters) : null,
              status: retailer.location.status,
            }
          : null,
        contacts: retailer.contacts,
        kyc: retailer.kycCase
          ? {
              id: retailer.kycCase.id,
              status: retailer.kycCase.status,
              submittedAt: retailer.kycCase.submittedAt,
              reviewedAt: retailer.kycCase.reviewedAt,
              rejectionReason: retailer.kycCase.rejectionReason,
              documents: retailer.kycCase.documents.map((d) => ({
                id: d.id,
                type: d.type,
                status: d.status,
                rejectionReason: d.rejectionReason,
                url: d.asset?.objectKey || null,
              })),
            }
          : null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load full retailer profile", detail: String(err) });
  }
});

router.put("/retailers/:id/full-profile", async (req: AdminRequest, res) => {
  const parsed = z
    .object({
      name: z.string().trim().min(2).optional(),
      ownerName: z.string().trim().nullable().optional(),
      shopAddress: z.string().trim().min(3).optional(),
      deliveryCity: z.string().trim().nullable().optional(),
      pincode: z.string().trim().nullable().optional(),
      phone: z.string().trim().min(10).max(15).optional(),
      gstin: z.string().trim().nullable().optional(),
      pan: z.string().trim().nullable().optional(),
      tierId: z.string().uuid().optional(),
      internalSegment: z.enum(["A", "B", "C"]).nullable().optional(),
      salesRepId: z.string().nullable().optional(),
      paymentTermDays: z.number().int().min(0).max(180).nullable().optional(),
      creditLimit: z.number().finite().nonnegative().optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: "Invalid profile data", details: parsed.error.flatten() });

  try {
    const updated = await prisma.retailer.update({
      where: { id: req.params.id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.ownerName !== undefined ? { ownerName: parsed.data.ownerName } : {}),
        ...(parsed.data.shopAddress !== undefined ? { shopAddress: parsed.data.shopAddress } : {}),
        ...(parsed.data.deliveryCity !== undefined ? { deliveryCity: parsed.data.deliveryCity } : {}),
        ...(parsed.data.pincode !== undefined ? { pincode: parsed.data.pincode } : {}),
        ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone } : {}),
        ...(parsed.data.gstin !== undefined ? { gstin: parsed.data.gstin } : {}),
        ...(parsed.data.pan !== undefined ? { pan: parsed.data.pan } : {}),
        ...(parsed.data.tierId !== undefined ? { tierId: parsed.data.tierId } : {}),
        ...(parsed.data.internalSegment !== undefined ? { internalSegment: parsed.data.internalSegment } : {}),
        ...(parsed.data.salesRepId !== undefined ? { salesRepId: parsed.data.salesRepId } : {}),
        ...(parsed.data.paymentTermDays !== undefined ? { paymentTermDays: parsed.data.paymentTermDays } : {}),
        ...(parsed.data.creditLimit !== undefined ? { creditLimit: parsed.data.creditLimit } : {}),
      },
      include: { tier: true, salesRep: true },
    });

    res.json({ ok: true, retailer: updated, message: "Retailer profile updated successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update retailer profile", detail: String(err) });
  }
});

router.post("/retailers/:id/coordinates", async (req: AdminRequest, res) => {
  const parsed = z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracyMeters: z.number().min(0).optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: "Invalid GPS coordinates" });

  try {
    const location = await prisma.retailerLocation.upsert({
      where: { retailerId: req.params.id },
      update: {
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        accuracyMeters: parsed.data.accuracyMeters ?? 5.0,
        status: "VERIFIED",
        source: "ADMIN_CORRECTION",
        verifiedAt: new Date(),
        locationVersion: { increment: 1 },
      },
      create: {
        retailerId: req.params.id,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        accuracyMeters: parsed.data.accuracyMeters ?? 5.0,
        status: "VERIFIED",
        source: "ADMIN_CORRECTION",
        verifiedAt: new Date(),
      },
    });

    res.json({ ok: true, location, message: "GPS coordinates updated successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update coordinates", detail: String(err) });
  }
});

router.post("/retailers/:id/kyc-decision", async (req: AdminRequest, res) => {
  const parsed = z
    .object({
      decision: z.enum(["approve", "reject"]),
      reason: z.string().trim().min(3),
    })
    .safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: "Invalid KYC decision input" });

  try {
    const kycCase = await prisma.kycCase.findUnique({
      where: { retailerId: req.params.id },
    });

    if (!kycCase) return res.status(404).json({ error: "No KYC case found for this retailer" });

    const newStatus = parsed.data.decision === "approve" ? "approved" : "rejected";

    const [updatedCase] = await prisma.$transaction([
      prisma.kycCase.update({
        where: { id: kycCase.id },
        data: {
          status: newStatus,
          reviewedAt: new Date(),
          rejectionReason: parsed.data.decision === "reject" ? parsed.data.reason : null,
        },
      }),
      prisma.retailer.update({
        where: { id: req.params.id },
        data: {
          status: parsed.data.decision === "approve" ? "active" : "pending_kyc",
        },
      }),
    ]);

    res.json({ ok: true, kycCase: updatedCase, message: `KYC ${newStatus} successfully` });
  } catch (err) {
    res.status(500).json({ error: "Failed to process KYC decision", detail: String(err) });
  }
});

export default router;

