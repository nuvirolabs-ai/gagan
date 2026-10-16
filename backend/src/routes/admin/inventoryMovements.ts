import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";

export function createInventoryMovementsRouter() {
  const router = Router();

  const ensureDefaultStockData = async () => {
    try {
      // Ensure primary warehouse WH-001 has snapshots for catalog products
      const count = await prisma.inventorySnapshot.count();
      if (count === 0) {
        const variants = await prisma.variant.findMany({ take: 10 });
        for (const v of variants) {
          await prisma.inventorySnapshot.create({
            data: {
              productId: v.productId,
              variantId: v.id,
              warehouseCode: "WH-001",
              onHand: 150,
              committed: 15,
              available: 135,
              status: "available",
              source: "manual",
              syncedAt: new Date(),
            },
          });
        }
      }

      // Ensure some initial sample stock movements
      const movCount = await prisma.stockMovement.count();
      if (movCount === 0) {
        const firstVariant = await prisma.variant.findFirst();
        if (firstVariant) {
          await prisma.stockMovement.createMany({
            data: [
              {
                warehouseCode: "WH-001",
                variantId: firstVariant.id,
                type: "receipt",
                quantity: 100,
                previousStock: 50,
                newStock: 150,
                reason: "Factory dispatch arrival batch #G-9921",
                performedBy: "Warehouse Manager",
              },
              {
                warehouseCode: "WH-001",
                variantId: firstVariant.id,
                type: "spoilage",
                quantity: 2,
                previousStock: 150,
                newStock: 148,
                reason: "Moisture bag leakage during unloading audit",
                performedBy: "Quality Inspector",
              },
            ],
          });
        }
      }

      // Ensure a sample transfer order
      const transferCount = await prisma.stockTransfer.count();
      if (transferCount === 0) {
        const firstVariant = await prisma.variant.findFirst();
        if (firstVariant) {
          await prisma.stockTransfer.create({
            data: {
              transferNumber: "TR-2026-001",
              fromWarehouseCode: "WH-001",
              toWarehouseCode: "WH-002",
              status: "in_transit",
              notes: "Weekly replenishment transfer to Ujjain distribution center",
              dispatchedAt: new Date(),
              items: {
                create: [
                  {
                    variantId: firstVariant.id,
                    quantity: 40,
                  },
                ],
              },
            },
          });
        }
      }
    } catch (err) {
      console.warn("Could not ensure default inventory movements data:", err);
    }
  };

  void ensureDefaultStockData();

  // GET /admin/inventory/summary
  router.get("/inventory/summary", async (req, res) => {
    try {
      const warehouseCode = (req.query.warehouseCode as string) || "WH-001";

      const [variants, snapshots, warehouses] = await Promise.all([
        prisma.variant.findMany({
          include: {
            product: { select: { name: true, category: true } },
          },
          orderBy: { product: { name: "asc" } },
        }),
        prisma.inventorySnapshot.findMany({
          where: { warehouseCode },
        }),
        prisma.warehouse.findMany({
          where: { isActive: true },
          select: { code: true, name: true, city: true },
        }),
      ]);

      const snapshotMap = new Map(snapshots.map((s) => [s.variantId || s.productId, s]));

      const items = variants.map((v) => {
        const snap = snapshotMap.get(v.id);
        const onHand = snap ? Number(snap.onHand) : 100;
        const committed = snap ? Number(snap.committed) : 5;
        const available = Math.max(0, onHand - committed);
        const threshold = v.lowStockThreshold ?? 15;
        const isLowStock = available <= threshold;

        return {
          id: v.id,
          variantId: v.id,
          productName: v.product.name,
          category: v.product.category,
          pack: `${v.unitSize} × ${v.unitsPerCase}`,
          unitSize: v.unitSize,
          unit: v.unit,
          onHand,
          committed,
          available,
          lowStockThreshold: threshold,
          isLowStock,
          warehouseCode,
        };
      });

      const metrics = {
        totalSkus: items.length,
        totalOnHand: items.reduce((sum, item) => sum + item.onHand, 0),
        totalCommitted: items.reduce((sum, item) => sum + item.committed, 0),
        lowStockCount: items.filter((item) => item.isLowStock).length,
      };

      res.json({
        warehouseCode,
        warehouses,
        metrics,
        inventory: items,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to load inventory summary", detail: String(err) });
    }
  });

  // GET /admin/inventory/movements
  router.get("/inventory/movements", async (req, res) => {
    try {
      const warehouseCode = req.query.warehouseCode as string | undefined;
      const where: any = {};
      if (warehouseCode) where.warehouseCode = warehouseCode;

      const movements = await prisma.stockMovement.findMany({
        where,
        take: 50,
        orderBy: { createdAt: "desc" },
      });

      // Enrich with variant names
      const variantIds = Array.from(new Set(movements.map((m) => m.variantId)));
      const variants = await prisma.variant.findMany({
        where: { id: { in: variantIds } },
        include: { product: { select: { name: true } } },
      });
      const varMap = new Map(variants.map((v) => [v.id, `${v.product.name} (${v.unitSize})`]));

      res.json({
        movements: movements.map((m) => ({
          id: m.id,
          warehouseCode: m.warehouseCode,
          variantId: m.variantId,
          variantName: varMap.get(m.variantId) || "Unknown SKU",
          type: m.type,
          quantity: Number(m.quantity),
          previousStock: Number(m.previousStock),
          newStock: Number(m.newStock),
          reason: m.reason,
          performedBy: m.performedBy || "Warehouse Staff",
          createdAt: m.createdAt,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to load stock movements", detail: String(err) });
    }
  });

  // POST /admin/inventory/adjustments
  router.post("/inventory/adjustments", async (req, res) => {
    const parsed = z
      .object({
        warehouseCode: z.string().trim().min(1),
        variantId: z.string().uuid(),
        type: z.enum([
          "receipt",
          "spoilage",
          "damage",
          "discrepancy",
          "audit_reconciliation",
        ]),
        quantity: z.number().finite().positive(),
        reason: z.string().trim().min(3),
        performedBy: z.string().trim().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid adjustment data", details: parsed.error.flatten() });
    }

    try {
      const { warehouseCode, variantId, type, quantity, reason, performedBy } = parsed.data;

      const variant = await prisma.variant.findUnique({
        where: { id: variantId },
        select: { id: true, productId: true },
      });
      if (!variant) return res.status(404).json({ error: "SKU variant not found" });

      let snapshot = await prisma.inventorySnapshot.findFirst({
        where: { variantId, warehouseCode },
      });

      const prevStock = snapshot ? Number(snapshot.onHand) : 100;
      let newStock = prevStock;

      if (type === "receipt") {
        newStock = prevStock + quantity;
      } else if (type === "spoilage" || type === "damage") {
        newStock = Math.max(0, prevStock - quantity);
      } else if (type === "audit_reconciliation" || type === "discrepancy") {
        newStock = quantity; // Absolute count
      }

      if (snapshot) {
        await prisma.inventorySnapshot.update({
          where: { id: snapshot.id },
          data: {
            onHand: newStock,
            available: Math.max(0, newStock - Number(snapshot.committed)),
            syncedAt: new Date(),
          },
        });
      } else {
        snapshot = await prisma.inventorySnapshot.create({
          data: {
            productId: variant.productId,
            variantId: variant.id,
            warehouseCode,
            onHand: newStock,
            committed: 0,
            available: newStock,
            status: "available",
            source: "manual_adjustment",
            syncedAt: new Date(),
          },
        });
      }

      const movement = await prisma.stockMovement.create({
        data: {
          warehouseCode,
          variantId,
          type,
          quantity,
          previousStock: prevStock,
          newStock,
          reason,
          performedBy: performedBy || "Warehouse Manager",
        },
      });

      res.json({
        ok: true,
        movement,
        newStock,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to record stock adjustment", detail: String(err) });
    }
  });

  // GET /admin/inventory/transfers
  router.get("/inventory/transfers", async (_req, res) => {
    try {
      const transfers = await prisma.stockTransfer.findMany({
        include: {
          items: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const variantIds = Array.from(new Set(transfers.flatMap((t) => t.items.map((i) => i.variantId))));
      const variants = await prisma.variant.findMany({
        where: { id: { in: variantIds } },
        include: { product: { select: { name: true } } },
      });
      const varMap = new Map(variants.map((v) => [v.id, `${v.product.name} (${v.unitSize})`]));

      res.json({
        transfers: transfers.map((t) => ({
          id: t.id,
          transferNumber: t.transferNumber,
          fromWarehouseCode: t.fromWarehouseCode,
          toWarehouseCode: t.toWarehouseCode,
          status: t.status,
          notes: t.notes,
          initiatedAt: t.initiatedAt,
          dispatchedAt: t.dispatchedAt,
          receivedAt: t.receivedAt,
          items: t.items.map((i) => ({
            id: i.id,
            variantId: i.variantId,
            variantName: varMap.get(i.variantId) || "SKU",
            quantity: Number(i.quantity),
          })),
        })),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to list stock transfers", detail: String(err) });
    }
  });

  // POST /admin/inventory/transfers
  router.post("/inventory/transfers", async (req, res) => {
    const parsed = z
      .object({
        fromWarehouseCode: z.string().trim().min(1),
        toWarehouseCode: z.string().trim().min(1),
        notes: z.string().trim().optional(),
        items: z.array(
          z.object({
            variantId: z.string().uuid(),
            quantity: z.number().finite().positive(),
          })
        ).min(1),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid transfer order data", details: parsed.error.flatten() });
    }

    try {
      const { fromWarehouseCode, toWarehouseCode, notes, items } = parsed.data;
      if (fromWarehouseCode === toWarehouseCode) {
        return res.status(400).json({ error: "Source and destination warehouses cannot be the same" });
      }

      const seq = Math.floor(100 + Math.random() * 900);
      const transferNumber = `TR-${new Date().getFullYear()}-${seq}`;

      const transfer = await prisma.stockTransfer.create({
        data: {
          transferNumber,
          fromWarehouseCode,
          toWarehouseCode,
          notes: notes || undefined,
          status: "in_transit",
          dispatchedAt: new Date(),
          items: {
            create: items.map((i) => ({
              variantId: i.variantId,
              quantity: i.quantity,
            })),
          },
        },
        include: { items: true },
      });

      res.status(201).json({ ok: true, transfer });
    } catch (err) {
      res.status(500).json({ error: "Failed to create stock transfer", detail: String(err) });
    }
  });

  // POST /admin/inventory/transfers/:id/status
  router.post("/inventory/transfers/:id/status", async (req, res) => {
    const parsed = z
      .object({
        status: z.enum(["draft", "in_transit", "received", "cancelled"]),
      })
      .safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: "Invalid transfer status" });

    try {
      const transfer = await prisma.stockTransfer.findUnique({
        where: { id: req.params.id },
        include: { items: true },
      });
      if (!transfer) return res.status(404).json({ error: "Transfer not found" });

      const updated = await prisma.stockTransfer.update({
        where: { id: req.params.id },
        data: {
          status: parsed.data.status,
          receivedAt: parsed.data.status === "received" ? new Date() : undefined,
          dispatchedAt: parsed.data.status === "in_transit" ? new Date() : transfer.dispatchedAt,
        },
      });

      res.json({ ok: true, transfer: updated });
    } catch (err) {
      res.status(500).json({ error: "Failed to update transfer status", detail: String(err) });
    }
  });

  // POST /admin/inventory/variants/:id/low-stock-threshold
  router.post("/inventory/variants/:id/low-stock-threshold", async (req, res) => {
    const parsed = z.object({ threshold: z.number().int().min(0) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid threshold value" });

    try {
      const updated = await prisma.variant.update({
        where: { id: req.params.id },
        data: { lowStockThreshold: parsed.data.threshold },
      });
      res.json({ ok: true, variantId: updated.id, threshold: updated.lowStockThreshold });
    } catch (err) {
      res.status(500).json({ error: "Failed to set low stock threshold", detail: String(err) });
    }
  });

  return router;
}
