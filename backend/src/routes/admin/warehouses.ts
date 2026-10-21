import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAdminIdentity } from "../../lib/adminAuth";
import { invalidateWarehouseCache } from "../../modules/orders/orderAttribution";

const router = Router();
router.use(requireAdminIdentity);

// Automatic seeder for default warehouses and city routings
async function ensureDefaultWarehouses() {
  const count = await prisma.warehouse.count();
  if (count === 0) {
    const wh1 = await prisma.warehouse.upsert({
      where: { code: "WH-001" },
      update: {},
      create: {
        code: "WH-001",
        name: "Indore Central Fulfillment Hub",
        address: "Plot 14-16, Sector B, Sanwer Road Industrial Area",
        city: "Indore",
        state: "Madhya Pradesh",
        pincode: "452015",
        contactName: "Ramesh Shinde",
        contactPhone: "9826012345",
        isActive: true,
      },
    });

    const wh2 = await prisma.warehouse.upsert({
      where: { code: "WH-002" },
      update: {},
      create: {
        code: "WH-002",
        name: "Bhopal Regional Hub",
        address: "Govindpura Industrial Estate, Raisen Road",
        city: "Bhopal",
        state: "Madhya Pradesh",
        pincode: "462023",
        contactName: "Sunil Verma",
        contactPhone: "9826098765",
        isActive: true,
      },
    });

    await prisma.cityRouting.createMany({
      data: [
        {
          city: "Indore",
          state: "Madhya Pradesh",
          primaryWarehouseCode: "WH-001",
          fallbackWarehouseCode: "WH-002",
          pincodes: "452001, 452002, 452003, 452010, 452015",
          slaHours: 24,
          isActive: true,
        },
        {
          city: "Ujjain",
          state: "Madhya Pradesh",
          primaryWarehouseCode: "WH-001",
          fallbackWarehouseCode: "WH-002",
          pincodes: "456001, 456006, 456010",
          slaHours: 24,
          isActive: true,
        },
        {
          city: "Dewas",
          state: "Madhya Pradesh",
          primaryWarehouseCode: "WH-001",
          fallbackWarehouseCode: "WH-002",
          pincodes: "455001",
          slaHours: 24,
          isActive: true,
        },
        {
          city: "Bhopal",
          state: "Madhya Pradesh",
          primaryWarehouseCode: "WH-002",
          fallbackWarehouseCode: "WH-001",
          pincodes: "462001, 462010, 462023",
          slaHours: 36,
          isActive: true,
        },
      ],
      skipDuplicates: true,
    });
  }
}

// GET /admin/warehouses
router.get("/warehouses", async (_req: Request, res: Response) => {
  await ensureDefaultWarehouses();

  const [warehouses, routings, stockCounts] = await Promise.all([
    prisma.warehouse.findMany({
      orderBy: { code: "asc" },
      include: {
        cityRoutings: true,
      },
    }),
    prisma.cityRouting.findMany({
      orderBy: { city: "asc" },
    }),
    prisma.inventorySnapshot.groupBy({
      by: ["warehouseCode"],
      _count: { id: true },
    }),
  ]);

  const stockCountMap = new Map(stockCounts.map((s) => [s.warehouseCode, s._count.id]));

  const enrichedWarehouses = warehouses.map((wh) => ({
    ...wh,
    activeSkus: stockCountMap.get(wh.code) ?? 0,
    routedCities: wh.cityRoutings.map((r) => r.city),
  }));

  res.json({
    warehouses: enrichedWarehouses,
    routings,
  });
});

// POST /admin/warehouses
const createWarehouseSchema = z.object({
  code: z.string().trim().min(2).max(20).toUpperCase(),
  name: z.string().trim().min(2),
  address: z.string().trim().optional(),
  city: z.string().trim().min(2).default("Indore"),
  state: z.string().trim().default("Madhya Pradesh"),
  pincode: z.string().trim().optional(),
  contactName: z.string().trim().optional(),
  contactPhone: z.string().trim().optional(),
  isActive: z.boolean().default(true),
});

router.post("/warehouses", async (req: Request, res: Response) => {
  const parsed = createWarehouseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid warehouse data" });
    return;
  }

  const existing = await prisma.warehouse.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    res.status(409).json({ error: `Warehouse with code ${parsed.data.code} already exists` });
    return;
  }

  const created = await prisma.warehouse.create({
    data: parsed.data,
  });
  invalidateWarehouseCache();

  res.status(201).json({ warehouse: created });
});

// PUT /admin/warehouses/:id
const updateWarehouseSchema = z.object({
  name: z.string().trim().min(2).optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().min(2).optional(),
  state: z.string().trim().optional(),
  pincode: z.string().trim().optional(),
  contactName: z.string().trim().optional(),
  contactPhone: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

router.put("/warehouses/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsed = updateWarehouseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid warehouse data" });
    return;
  }

  const updated = await prisma.warehouse.update({
    where: { id },
    data: parsed.data,
  });
  invalidateWarehouseCache();

  res.json({ warehouse: updated });
});

// GET /admin/warehouses/routing
router.get("/warehouses/routing", async (_req: Request, res: Response) => {
  await ensureDefaultWarehouses();
  const routings = await prisma.cityRouting.findMany({
    orderBy: { city: "asc" },
  });
  res.json({ routings });
});

// POST /admin/warehouses/routing
const cityRoutingSchema = z.object({
  city: z.string().trim().min(2),
  state: z.string().trim().default("Madhya Pradesh"),
  pincodes: z.string().trim().optional(),
  primaryWarehouseCode: z.string().trim().min(2).toUpperCase(),
  fallbackWarehouseCode: z.string().trim().min(2).toUpperCase().optional().nullable(),
  slaHours: z.number().int().min(1).max(168).default(24),
  isActive: z.boolean().default(true),
});

router.post("/warehouses/routing", async (req: Request, res: Response) => {
  const parsed = cityRoutingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid routing data" });
    return;
  }

  const upserted = await prisma.cityRouting.upsert({
    where: { city: parsed.data.city },
    update: {
      state: parsed.data.state,
      pincodes: parsed.data.pincodes,
      primaryWarehouseCode: parsed.data.primaryWarehouseCode,
      fallbackWarehouseCode: parsed.data.fallbackWarehouseCode,
      slaHours: parsed.data.slaHours,
      isActive: parsed.data.isActive,
    },
    create: {
      city: parsed.data.city,
      state: parsed.data.state,
      pincodes: parsed.data.pincodes,
      primaryWarehouseCode: parsed.data.primaryWarehouseCode,
      fallbackWarehouseCode: parsed.data.fallbackWarehouseCode,
      slaHours: parsed.data.slaHours,
      isActive: parsed.data.isActive,
    },
  });
  invalidateWarehouseCache();

  res.json({ routing: upserted });
});

// DELETE /admin/warehouses/routing/:id
router.delete("/warehouses/routing/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.cityRouting.delete({ where: { id } });
  invalidateWarehouseCache();
  res.json({ success: true });
});

export default router;
