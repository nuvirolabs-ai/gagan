import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAdmin } from "../../lib/adminAuth";
import { getSapConnector } from "../../lib/sap";
import { syncAll, syncCustomers, syncMaterials, syncPricing, syncStock } from "../../lib/sap/sync";
import { drainOutbox } from "../../lib/sap/outbox";

const router = Router();
router.use(requireAdmin);

/** Integration health: mode, per-entity watermarks, and what's owed to SAP. */
router.get("/sap/status", async (_req, res) => {
  const connector = getSapConnector();

  const [states, pending, failed, sent, unlinkedRetailers, unlinkedProducts] = await Promise.all([
    prisma.sapSyncState.findMany(),
    prisma.sapOutbox.count({ where: { status: "pending" } }),
    prisma.sapOutbox.count({ where: { status: "failed" } }),
    prisma.sapOutbox.count({ where: { status: "sent" } }),
    prisma.retailer.count({ where: { sapCustomerId: null } }),
    prisma.product.count({ where: { sapMaterialId: null } }),
  ]);

  res.json({
    connector: { name: connector.name, enabled: connector.enabled },
    entities: states,
    outbox: { pending, failed, sent },
    // Anything unlinked can't be posted to SAP yet — the number ops cares about.
    unlinked: { retailers: unlinkedRetailers, products: unlinkedProducts },
  });
});

const runSchema = z.object({
  entity: z.enum(["customers", "materials", "pricing", "stock", "all"]).default("all"),
});

router.post("/sap/sync", async (req, res) => {
  const parsed = runSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid entity" });

  const connector = getSapConnector();
  if (!connector.enabled) {
    return res.status(409).json({
      error: "SAP is not configured. Set SAP_MODE=mock for development, or add a real connector.",
    });
  }

  try {
    switch (parsed.data.entity) {
      case "customers":
        return res.json({ results: [await syncCustomers()] });
      case "materials":
        return res.json({ results: [await syncMaterials()] });
      case "pricing":
        return res.json({ results: [await syncPricing()] });
      case "stock":
        return res.json({ results: [await syncStock()] });
      default:
        return res.json({ results: await syncAll() });
    }
  } catch (err) {
    return res.status(502).json({
      error: "Sync failed",
      detail: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

router.post("/sap/outbox/drain", async (_req, res) => {
  const result = await drainOutbox();
  res.json(result);
});

router.get("/sap/outbox", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const valid = status && ["pending", "sent", "failed"].includes(status);

  const items = await prisma.sapOutbox.findMany({
    where: valid ? { status: status as any } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json({ items });
});

/** Requeue a parked item after the underlying problem is fixed. */
router.post("/sap/outbox/:id/retry", async (req, res) => {
  const item = await prisma.sapOutbox.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: "Outbox item not found" });
  if (item.status === "sent") return res.status(409).json({ error: "Already sent to SAP" });

  const updated = await prisma.sapOutbox.update({
    where: { id: item.id },
    data: { status: "pending", attempts: 0, lastError: null },
  });
  res.json({ item: updated });
});

export default router;
