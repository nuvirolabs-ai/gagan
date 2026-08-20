import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../lib/auth";
import { financialLedgerFor } from "../modules/finance/financialQueries";

const router = Router();

router.get("/ledger/:retailerId", requireAuth, async (req: AuthedRequest, res) => {
  if (req.params.retailerId !== req.retailerId) {
    return res.status(403).json({ error: "Cannot view another retailer's ledger" });
  }
  const [retailer, entries] = await Promise.all([
    prisma.retailer.findUnique({ where: { id: req.params.retailerId } }),
    financialLedgerFor(prisma, req.params.retailerId),
  ]);
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });

  res.json({
    currentBalance: Number(retailer.currentBalance),
    creditLimit: Number(retailer.creditLimit),
    entries,
  });
});

export default router;
