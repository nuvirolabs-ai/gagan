import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";

export function createCreditPolicyRouter() {
  const router = Router();

  // GET /admin/credit/policy
  router.get("/credit/policy", async (_req, res) => {
    try {
      const [config, retailers, overrides, comparisons] = await Promise.all([
        prisma.appConfig.findUnique({ where: { id: "default" } }),
        prisma.retailer.findMany({
          select: {
            id: true,
            name: true,
            phone: true,
            creditLimit: true,
            currentBalance: true,
            overdueAmount: true,
            paymentTermDays: true,
            tier: { select: { id: true, name: true, paymentTermDays: true } },
          },
        }),
        prisma.creditLimitOverride.findMany({
          where: { status: "active" },
          include: { retailer: { select: { id: true, name: true, phone: true } } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.creditDecisionComparison.findMany({
          take: 10,
          orderBy: { createdAt: "desc" },
          include: { retailer: { select: { id: true, name: true, phone: true } } },
        }),
      ]);

      const mode = config?.creditRolloutMode ?? "shadow";
      const totalRetailers = retailers.length;
      let totalCreditLimit = 0;
      let totalOutstanding = 0;
      let totalOverdue = 0;
      let retailersExceedingLimit = 0;
      let retailersWithOverdue = 0;

      for (const r of retailers) {
        const lim = Number(r.creditLimit);
        const bal = Number(r.currentBalance);
        const ovd = Number(r.overdueAmount);
        totalCreditLimit += lim;
        totalOutstanding += bal;
        totalOverdue += ovd;
        if (lim > 0 && bal > lim) retailersExceedingLimit++;
        if (ovd > 0) retailersWithOverdue++;
      }

      const exposure = {
        totalRetailers,
        totalCreditLimit,
        totalOutstanding,
        totalOverdue,
        retailersOverLimit: retailersExceedingLimit,
        retailersExceedingLimit,
        retailersWithOverdue,
        activeOverridesCount: overrides.length,
        shadowBlocks30d: comparisons.length,
      };

      const mappedOverrides = overrides.map((o) => ({
        id: o.id,
        retailerId: o.retailerId,
        retailerName: o.retailer.name,
        retailerPhone: o.retailer.phone,
        retailer: { id: o.retailer.id, name: o.retailer.name, phone: o.retailer.phone },
        previousLimit: Number(o.previousLimit),
        newLimit: Number(o.newLimit),
        reason: o.reason,
        status: o.status,
        createdAt: o.createdAt,
        expiresAt: o.expiresAt,
      }));

      res.json({
        mode,
        stats: exposure,
        exposure,
        overrides: mappedOverrides,
        recentOverrides: mappedOverrides,
        recentMismatches: comparisons.map((c) => ({
          id: c.id,
          retailerName: c.retailer.name,
          retailerPhone: c.retailer.phone,
          retailer: { id: c.retailer.id, name: c.retailer.name, phone: c.retailer.phone },
          legacyResult: c.legacyResult,
          engineResult: c.engineResult,
          createdAt: c.createdAt,
        })),
        comparisons: comparisons.map((c) => ({
          id: c.id,
          retailer: { id: c.retailer.id, name: c.retailer.name, phone: c.retailer.phone },
          legacyResult: c.legacyResult,
          engineResult: c.engineResult,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to load credit policy summary", detail: String(err) });
    }
  });

  // Backward compatibility routes for legacy frontend callers
  router.get("/credit-ratings/proposals", async (_req, res) => {
    res.json({ proposals: [] });
  });

  router.get("/credit-policy/shadow/comparisons", async (_req, res) => {
    try {
      const comps = await prisma.creditDecisionComparison.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        include: { retailer: { select: { id: true, name: true, phone: true } } },
      });
      res.json({ comparisons: comps });
    } catch {
      res.json({ comparisons: [] });
    }
  });

  // POST /admin/credit/policy/mode
  router.post("/credit/policy/mode", async (req, res) => {
    const parsed = z.object({ mode: z.enum(["shadow", "enforce"]) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid credit mode (must be 'shadow' or 'enforce')" });

    try {
      const config = await prisma.appConfig.upsert({
        where: { id: "default" },
        update: { creditRolloutMode: parsed.data.mode },
        create: {
          id: "default",
          creditRolloutMode: parsed.data.mode,
          minOrderValue: 2500,
          freeDeliveryThreshold: 0,
          supportPhone: "9812345680",
        },
      });

      res.json({ ok: true, mode: config.creditRolloutMode });
    } catch (err) {
      res.status(500).json({ error: "Failed to update credit rollout mode", detail: String(err) });
    }
  });

  // POST /admin/credit/retailers/:id/override-limit
  router.post("/credit/retailers/:id/override-limit", async (req, res) => {
    const parsed = z
      .object({
        newLimit: z.number().finite().nonnegative(),
        reason: z.string().trim().min(3),
        expiresDays: z.number().int().positive().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: "Invalid limit override parameters" });

    try {
      const retailer = await prisma.retailer.findUnique({ where: { id: req.params.id } });
      if (!retailer) return res.status(404).json({ error: "Retailer not found" });

      const expiresAt = parsed.data.expiresDays
        ? new Date(Date.now() + parsed.data.expiresDays * 86400000)
        : null;

      const [override, updatedRetailer] = await prisma.$transaction([
        prisma.creditLimitOverride.create({
          data: {
            retailerId: retailer.id,
            previousLimit: retailer.creditLimit,
            newLimit: parsed.data.newLimit,
            reason: parsed.data.reason,
            expiresAt,
            status: "active",
          },
        }),
        prisma.retailer.update({
          where: { id: retailer.id },
          data: { creditLimit: parsed.data.newLimit },
        }),
      ]);

      res.json({
        ok: true,
        message: `Credit limit updated to ₹${parsed.data.newLimit.toLocaleString("en-IN")}`,
        override,
        retailer: {
          id: updatedRetailer.id,
          creditLimit: Number(updatedRetailer.creditLimit),
        },
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to override credit limit", detail: String(err) });
    }
  });

  // POST /admin/credit/retailers/:id/payment-terms
  router.post("/credit/retailers/:id/payment-terms", async (req, res) => {
    const parsed = z
      .object({
        paymentTermDays: z.number().int().min(0).max(180).nullable(),
      })
      .safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: "Invalid payment terms days" });

    try {
      const updated = await prisma.retailer.update({
        where: { id: req.params.id },
        data: { paymentTermDays: parsed.data.paymentTermDays },
        select: { id: true, name: true, paymentTermDays: true, tier: { select: { paymentTermDays: true } } },
      });

      res.json({
        ok: true,
        paymentTermDays: updated.paymentTermDays ?? updated.tier.paymentTermDays,
        retailer: updated,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to update payment terms", detail: String(err) });
    }
  });

  return router;
}
