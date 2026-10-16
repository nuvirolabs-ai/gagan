import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";

export function createFleetRunsRouter() {
  const router = Router();

  const ensureDefaultFleet = async () => {
    try {
      const vCount = await prisma.deliveryVehicle.count();
      if (vCount === 0) {
        const v1 = await prisma.deliveryVehicle.create({
          data: {
            regNumber: "MP-09-GA-1024",
            model: "Tata 407 LPT Heavy",
            type: "truck",
            capacityKg: 4500,
            capacityBags: 180,
            driverName: "Rameshwar Yadav",
            driverPhone: "9826011223",
            isActive: true,
          },
        });

        await prisma.deliveryVehicle.create({
          data: {
            regNumber: "MP-09-TP-4050",
            model: "Mahindra Bolero Maxi Truck",
            type: "tempo",
            capacityKg: 1500,
            capacityBags: 60,
            driverName: "Dinesh Patidar",
            driverPhone: "9826044556",
            isActive: true,
          },
        });

        await prisma.deliveryVehicle.create({
          data: {
            regNumber: "MP-09-EV-3011",
            model: "Piaggio Ape E-City Cargo",
            type: "three_wheeler",
            capacityKg: 500,
            capacityBags: 20,
            driverName: "Kailash Verma",
            driverPhone: "9826099887",
            isActive: true,
          },
        });

        // Ensure sample dispatch run
        const runCount = await prisma.deliveryRun.count();
        if (runCount === 0) {
          const sampleOrders = await prisma.order.findMany({
            where: { status: { in: ["packed", "confirmed"] } },
            take: 3,
            select: { id: true },
          });

          await prisma.deliveryRun.create({
            data: {
              runNumber: "RUN-IND-001",
              warehouseCode: "WH-001",
              vehicleId: v1.id,
              driverName: "Rameshwar Yadav",
              driverPhone: "9826011223",
              status: "out_for_delivery",
              orderIds: sampleOrders.map((o) => o.id),
              notes: "Morning delivery run covering Rajwada, Sarafa, and Chhavani stores",
              departureTime: new Date(),
            },
          });
        }
      }
    } catch (err) {
      console.warn("Could not ensure default delivery fleet:", err);
    }
  };

  void ensureDefaultFleet();

  // GET /admin/fleet/vehicles
  router.get("/fleet/vehicles", async (_req, res) => {
    try {
      const vehicles = await prisma.deliveryVehicle.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { runs: true },
          },
        },
      });

      res.json({
        vehicles: vehicles.map((v) => ({
          id: v.id,
          regNumber: v.regNumber,
          model: v.model,
          type: v.type,
          capacityKg: Number(v.capacityKg),
          capacityBags: v.capacityBags,
          driverName: v.driverName,
          driverPhone: v.driverPhone,
          isActive: v.isActive,
          runsCount: v._count.runs,
          createdAt: v.createdAt,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to list delivery vehicles", detail: String(err) });
    }
  });

  // POST /admin/fleet/vehicles
  router.post("/fleet/vehicles", async (req, res) => {
    const parsed = z
      .object({
        regNumber: z.string().trim().min(4),
        model: z.string().trim().min(2),
        type: z.enum(["truck", "tempo", "three_wheeler", "van"]).default("tempo"),
        capacityKg: z.number().finite().positive(),
        capacityBags: z.number().int().positive().default(50),
        driverName: z.string().trim().min(2),
        driverPhone: z.string().trim().regex(/^\d{10}$/, "10-digit mobile number required"),
        isActive: z.boolean().default(true),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid vehicle data", details: parsed.error.flatten() });
    }

    try {
      const vehicle = await prisma.deliveryVehicle.create({
        data: parsed.data,
      });
      res.status(201).json({ ok: true, vehicle });
    } catch (err) {
      res.status(500).json({ error: "Failed to register delivery vehicle", detail: String(err) });
    }
  });

  // PUT /admin/fleet/vehicles/:id
  router.put("/fleet/vehicles/:id", async (req, res) => {
    const parsed = z
      .object({
        regNumber: z.string().trim().min(4).optional(),
        model: z.string().trim().min(2).optional(),
        type: z.enum(["truck", "tempo", "three_wheeler", "van"]).optional(),
        capacityKg: z.number().finite().positive().optional(),
        capacityBags: z.number().int().positive().optional(),
        driverName: z.string().trim().min(2).optional(),
        driverPhone: z.string().trim().regex(/^\d{10}$/, "10-digit mobile number required").optional(),
        isActive: z.boolean().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid vehicle update", details: parsed.error.flatten() });
    }

    try {
      const vehicle = await prisma.deliveryVehicle.update({
        where: { id: req.params.id },
        data: parsed.data,
      });
      res.json({ ok: true, vehicle });
    } catch (err) {
      res.status(500).json({ error: "Failed to update delivery vehicle", detail: String(err) });
    }
  });

  // DELETE /admin/fleet/vehicles/:id
  router.delete("/fleet/vehicles/:id", async (req, res) => {
    try {
      await prisma.deliveryVehicle.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete vehicle", detail: String(err) });
    }
  });

  // GET /admin/fleet/runs
  router.get("/fleet/runs", async (req, res) => {
    try {
      const warehouseCode = req.query.warehouseCode as string | undefined;
      const where: any = {};
      if (warehouseCode) where.warehouseCode = warehouseCode;

      const runs = await prisma.deliveryRun.findMany({
        where,
        include: {
          vehicle: true,
        },
        orderBy: { createdAt: "desc" },
      });

      // Get order numbers and totals for assigned orders
      const allOrderIds = Array.from(new Set(runs.flatMap((r) => (Array.isArray(r.orderIds) ? (r.orderIds as string[]) : []))));
      const orders = await prisma.order.findMany({
        where: { id: { in: allOrderIds } },
        include: {
          retailer: { select: { id: true, name: true, deliveryCity: true, shopAddress: true, phone: true } },
          items: {
            select: { qtyOrdered: true, caseWeightKgSnapshot: true, variant: { select: { unitWeightKg: true, unitsPerCase: true } } },
          },
        },
      });

      const orderMap = new Map(orders.map((o) => [o.id, o]));

      const enriched = runs.map((r) => {
        const oIds = Array.isArray(r.orderIds) ? (r.orderIds as string[]) : [];
        const runOrders = oIds.map((id) => orderMap.get(id)).filter((o): o is NonNullable<typeof o> => Boolean(o));

        let totalWeightKg = 0;
        let totalOrderAmount = 0;

        for (const o of runOrders) {
          totalOrderAmount += Number(o.orderTotal);
          for (const item of o.items) {
            const w = item.caseWeightKgSnapshot
              ? Number(item.caseWeightKgSnapshot)
              : Number(item.variant?.unitWeightKg || 1) * (item.variant?.unitsPerCase || 1);
            totalWeightKg += w * item.qtyOrdered;
          }
        }

        return {
          id: r.id,
          runNumber: r.runNumber,
          warehouseCode: r.warehouseCode,
          vehicleId: r.vehicleId,
          vehicleReg: r.vehicle?.regNumber || "Unassigned",
          vehicleModel: r.vehicle?.model || "Fleet",
          driverName: r.driverName,
          driverPhone: r.driverPhone,
          status: r.status,
          orderCount: oIds.length,
          totalWeightKg: Math.round(totalWeightKg * 10) / 10,
          totalOrderAmount,
          notes: r.notes,
          departureTime: r.departureTime,
          completedTime: r.completedTime,
          createdAt: r.createdAt,
          orders: runOrders.map((o) => ({
            id: o.id,
            orderNo: o.orderNo,
            orderTotal: Number(o.orderTotal),
            retailerName: o.retailer.name,
            deliveryCity: o.retailer.deliveryCity,
            shopAddress: o.retailer.shopAddress,
            phone: o.retailer.phone,
          })),
        };
      });

      res.json({ runs: enriched });
    } catch (err) {
      res.status(500).json({ error: "Failed to list delivery runs", detail: String(err) });
    }
  });

  // POST /admin/fleet/runs
  router.post("/fleet/runs", async (req, res) => {
    const parsed = z
      .object({
        runNumber: z.string().trim().optional(),
        warehouseCode: z.string().trim().min(1).default("WH-001"),
        vehicleId: z.string().uuid().optional(),
        driverName: z.string().trim().min(2),
        driverPhone: z.string().trim().regex(/^\d{10}$/, "10-digit driver mobile number required"),
        orderIds: z.array(z.string().uuid()).default([]),
        notes: z.string().trim().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid run dispatch data", details: parsed.error.flatten() });
    }

    try {
      const { warehouseCode, vehicleId, driverName, driverPhone, orderIds, notes } = parsed.data;

      const runCount = await prisma.deliveryRun.count();
      const runNumber = parsed.data.runNumber || `RUN-${warehouseCode}-${String(runCount + 1).padStart(3, "0")}`;

      const run = await prisma.deliveryRun.create({
        data: {
          runNumber,
          warehouseCode,
          vehicleId: vehicleId || null,
          driverName,
          driverPhone,
          orderIds,
          notes: notes || undefined,
          status: "draft",
        },
      });

      res.status(201).json({ ok: true, run });
    } catch (err) {
      res.status(500).json({ error: "Failed to create delivery run", detail: String(err) });
    }
  });

  // POST /admin/fleet/runs/:id/status
  router.post("/fleet/runs/:id/status", async (req, res) => {
    const parsed = z
      .object({
        status: z.enum(["draft", "loaded", "out_for_delivery", "completed", "cancelled"]),
      })
      .safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: "Invalid run status" });

    try {
      const run = await prisma.deliveryRun.findUnique({
        where: { id: req.params.id },
      });
      if (!run) return res.status(404).json({ error: "Delivery run not found" });

      const newStatus = parsed.data.status;
      const departureTime = newStatus === "out_for_delivery" ? new Date() : run.departureTime;
      const completedTime = newStatus === "completed" ? new Date() : run.completedTime;

      const updated = await prisma.deliveryRun.update({
        where: { id: req.params.id },
        data: {
          status: newStatus,
          departureTime,
          completedTime,
        },
      });

      // Advance assigned order statuses
      const orderIds = Array.isArray(run.orderIds) ? (run.orderIds as string[]) : [];
      if (orderIds.length > 0) {
        if (newStatus === "out_for_delivery") {
          await prisma.order.updateMany({
            where: { id: { in: orderIds }, status: "packed" },
            data: { status: "out_for_delivery" },
          });
        } else if (newStatus === "completed") {
          await prisma.order.updateMany({
            where: { id: { in: orderIds }, status: "out_for_delivery" },
            data: { status: "delivered" },
          });
        }
      }

      res.json({ ok: true, run: updated });
    } catch (err) {
      res.status(500).json({ error: "Failed to update run status", detail: String(err) });
    }
  });

  return router;
}
