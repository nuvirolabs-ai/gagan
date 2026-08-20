import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../lib/auth";

const router = Router();

router.get("/ledger/:retailerId", requireAuth, async (req: AuthedRequest, res) => {
  if (req.params.retailerId !== req.retailerId) {
    return res.status(403).json({ error: "Cannot view another retailer's ledger" });
  }
  const [retailer, entries] = await Promise.all([
    prisma.retailer.findUnique({ where: { id: req.params.retailerId } }),
    prisma.ledgerEntry.findMany({
      where: { retailerId: req.params.retailerId },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });

  res.json({
    currentBalance: retailer.currentBalance,
    creditLimit: retailer.creditLimit,
    entries,
  });
});

export default router;
