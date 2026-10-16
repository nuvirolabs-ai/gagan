import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";

export function createFieldTasksRouter() {
  const router = Router();

  const ensureDefaultTasks = async () => {
    try {
      const taskCount = await prisma.fieldTask.count();
      if (taskCount === 0) {
        const staff = await prisma.staffUser.findFirst({
          where: { roles: { some: { role: { name: "salesperson" } } } },
        });
        const retailer = await prisma.retailer.findFirst();

        if (staff && retailer) {
          const t1 = await prisma.fieldTask.create({
            data: {
              assignedToStaffId: staff.id,
              retailerId: retailer.id,
              title: "Shopfront Board & Brand Signage Audit",
              description: "Capture clear wide photo of Gagan yellow shopboard banner and verify illumination condition.",
              priority: "high",
              status: "done",
              dueAt: new Date(Date.now() + 2 * 24 * 3600 * 1000),
              completedAt: new Date(),
              completionNote: "Signage verified intact and properly illuminated facing main market road.",
            },
          });

          await prisma.fieldTaskEvidence.create({
            data: {
              taskId: t1.id,
              retailerId: retailer.id,
              salespersonId: staff.id,
              objectKey: "/catalog-images/basmati-rice.png",
              checksum: "audit-sha256-demo",
              contentType: "image/png",
              sizeBytes: 1048576,
              latitude: 22.7196,
              longitude: 75.8577,
              accuracyMeters: 4.5,
            },
          });

          await prisma.fieldTask.create({
            data: {
              assignedToStaffId: staff.id,
              retailerId: retailer.id,
              title: "Competitor Pulses Retail Price Audit",
              description: "Note down loose and packaged Toor Dal rates per kg currently sold at this outlet.",
              priority: "normal",
              status: "open",
              dueAt: new Date(Date.now() + 3 * 24 * 3600 * 1000),
            },
          });

          await prisma.fieldTask.create({
            data: {
              assignedToStaffId: staff.id,
              retailerId: retailer.id,
              title: "Counter Product Display & Shelf Share Photo",
              description: "Take close-up photograph of Gagan 1kg & 5kg packs placed on the front counter display.",
              priority: "normal",
              status: "open",
              dueAt: new Date(Date.now() + 4 * 24 * 3600 * 1000),
            },
          });
        }
      }
    } catch (err) {
      console.warn("Could not ensure default field tasks:", err);
    }
  };

  void ensureDefaultTasks();

  // GET /admin/field-tasks
  router.get("/field-tasks", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const salespersonId = req.query.salespersonId as string | undefined;

      const where: any = {};
      if (status) where.status = status;
      if (salespersonId) where.assignedToStaffId = salespersonId;

      const [tasks, salespersons, retailers] = await Promise.all([
        prisma.fieldTask.findMany({
          where,
          include: {
            assignedTo: { select: { id: true, name: true, phone: true } },
            retailer: { select: { id: true, name: true, deliveryCity: true, shopAddress: true } },
            evidence: true,
          },
          orderBy: [{ createdAt: "desc" }],
        }),
        prisma.staffUser.findMany({
          where: { roles: { some: { role: { name: "salesperson" } } } },
          select: { id: true, name: true, phone: true },
        }),
        prisma.retailer.findMany({
          select: { id: true, name: true, deliveryCity: true },
          take: 50,
        }),
      ]);

      res.json({
        tasks: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          priority: t.priority,
          status: t.status,
          dueAt: t.dueAt,
          completedAt: t.completedAt,
          completionNote: t.completionNote,
          assignedToStaffId: t.assignedToStaffId,
          assignedToName: t.assignedTo.name,
          assignedToPhone: t.assignedTo.phone,
          retailerId: t.retailerId,
          retailerName: t.retailer?.name || "General Market",
          retailerCity: t.retailer?.deliveryCity || "Indore",
          retailerAddress: t.retailer?.shopAddress || "",
          evidenceCount: t.evidence.length,
          evidence: t.evidence.map((e) => ({
            id: e.id,
            objectKey: e.objectKey,
            latitude: e.latitude ? Number(e.latitude) : null,
            longitude: e.longitude ? Number(e.longitude) : null,
            accuracyMeters: e.accuracyMeters ? Number(e.accuracyMeters) : null,
            createdAt: e.createdAt,
          })),
          createdAt: t.createdAt,
        })),
        salespersons,
        retailers,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to list field tasks", detail: String(err) });
    }
  });

  // POST /admin/field-tasks
  router.post("/field-tasks", async (req, res) => {
    const parsed = z
      .object({
        assignedToStaffId: z.string().uuid(),
        retailerId: z.string().uuid().optional(),
        title: z.string().trim().min(3),
        description: z.string().trim().optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
        dueAt: z.string().datetime().or(z.string().min(10)).optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid field task data", details: parsed.error.flatten() });
    }

    try {
      const data = parsed.data;
      const task = await prisma.fieldTask.create({
        data: {
          assignedToStaffId: data.assignedToStaffId,
          retailerId: data.retailerId || null,
          title: data.title,
          description: data.description || null,
          priority: data.priority as any,
          status: "open",
          dueAt: data.dueAt ? new Date(data.dueAt) : null,
        },
        include: {
          assignedTo: { select: { id: true, name: true } },
          retailer: { select: { id: true, name: true } },
        },
      });

      res.status(201).json({ ok: true, task });
    } catch (err) {
      res.status(500).json({ error: "Failed to create field task", detail: String(err) });
    }
  });

  // GET /admin/field-tasks/:id/evidence
  router.get("/field-tasks/:id/evidence", async (req, res) => {
    try {
      const evidence = await prisma.fieldTaskEvidence.findMany({
        where: { taskId: req.params.id },
        include: {
          salesperson: { select: { id: true, name: true } },
          retailer: { select: { id: true, name: true } },
        },
      });

      res.json({
        evidence: evidence.map((e) => ({
          id: e.id,
          objectKey: e.objectKey,
          photoUrl: e.objectKey.startsWith("http") ? e.objectKey : `http://localhost:4000${e.objectKey}`,
          latitude: e.latitude ? Number(e.latitude) : null,
          longitude: e.longitude ? Number(e.longitude) : null,
          accuracyMeters: e.accuracyMeters ? Number(e.accuracyMeters) : null,
          salespersonName: e.salesperson.name,
          retailerName: e.retailer.name,
          createdAt: e.createdAt,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to load field task evidence", detail: String(err) });
    }
  });

  return router;
}
