import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../lib/auth";
import { financialLedgerFor } from "../modules/finance/financialQueries";
import { financialSummaryFor } from "../modules/finance/financialSummary";

const router = Router();

router.get("/ledger/:retailerId", requireAuth, async (req: AuthedRequest, res) => {
  if (req.params.retailerId !== req.retailerId) {
    return res.status(403).json({ error: "Cannot view another retailer's ledger" });
  }
  const [summary, entries] = await Promise.all([
    financialSummaryFor(prisma, req.params.retailerId),
    financialLedgerFor(prisma, req.params.retailerId),
  ]);
  if (!summary) return res.status(404).json({ error: "Retailer not found" });

  res.json({
    currentBalance: summary.outstanding,
    creditLimit: summary.creditLimit,
    financialSummary: summary,
    entries,
  });
});

export default router;
