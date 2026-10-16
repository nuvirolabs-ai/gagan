import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";

export function createBroadcastsRouter() {
  const router = Router();

  const ensureDefaultBroadcasts = async () => {
    try {
      const count = await prisma.broadcastMessage.count();
      if (count === 0) {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
        const twoDaysAgo = new Date(now.getTime() - 48 * 3600 * 1000);
        const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);

        const retailerCount = await prisma.retailer.count();
        const repCount = await prisma.staffUser.count();

        await prisma.broadcastMessage.createMany({
          data: [
            {
              title: "Diwali Festive Trade Scheme — 3.5% Cash Rebate on Bulk Basmati Rice",
              body: "All Tier 1 and Tier 2 wholesale partners booking minimum 50 bags before Friday qualify for direct 3.5% invoice credit. Order now through your assigned salesperson.",
              priority: "urgent",
              audience: "all_retailers",
              targetCity: null,
              channels: ["in_app", "push", "sms"],
              status: "sent",
              sentAt: yesterday,
              recipientCount: retailerCount || 59,
              authorName: "Operations Platform Admin",
            },
            {
              title: "Mandatory Morning Beat Attendance & GPS Verification Policy",
              body: "Daily check-in selfies with shop background must be completed by 10:00 AM. Unverified visits will not count towards monthly travel reimbursement.",
              priority: "urgent",
              audience: "all_salespeople",
              targetCity: null,
              channels: ["in_app", "push"],
              status: "sent",
              sentAt: twoDaysAgo,
              recipientCount: repCount || 14,
              authorName: "Sales Operations Lead",
            },
            {
              title: "Indore Regional Logistics Hub — Dussehra Dispatch Schedule",
              body: "Deliveries will operate at half capacity on Saturday due to municipal road closures in Central Indore (Rajwada & Sarafa beat). Please plan order dispatches accordingly.",
              priority: "normal",
              audience: "city",
              targetCity: "Indore",
              channels: ["in_app"],
              status: "sent",
              sentAt: now,
              recipientCount: Math.max(1, Math.floor((retailerCount || 59) * 0.65)),
              authorName: "Logistics Dispatch Manager",
            },
            {
              title: "New Season Launch: Choice Premium 10kg & 30kg Packaging in Stock",
              body: "Refreshed moisture-proof laminated bags for Choice Rice are ready for dispatch with zero booking deposit. Bulk quantity slabs are live in the catalog.",
              priority: "normal",
              audience: "all_retailers",
              targetCity: null,
              channels: ["in_app", "push"],
              status: "scheduled",
              scheduledAt: tomorrow,
              recipientCount: retailerCount || 59,
              authorName: "Category Brand Manager",
            },
          ],
        });
      }
    } catch (err) {
      console.warn("Could not seed default broadcasts:", err);
    }
  };

  void ensureDefaultBroadcasts();

  // 1. GET /admin/broadcasts - list broadcasts with search, status, audience & KPI metrics
  router.get("/broadcasts", async (req, res) => {
    try {
      await ensureDefaultBroadcasts();
      const { search, status, audience } = req.query;

      const where: any = {};
      if (typeof search === "string" && search.trim()) {
        const q = search.trim();
        where.OR = [
          { title: { contains: q, mode: "insensitive" } },
          { body: { contains: q, mode: "insensitive" } },
          { authorName: { contains: q, mode: "insensitive" } },
        ];
      }
      if (typeof status === "string" && status && status !== "all") {
        where.status = status;
      }
      if (typeof audience === "string" && audience && audience !== "all") {
        where.audience = audience;
      }

      const broadcasts = await prisma.broadcastMessage.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });

      const allBroadcasts = await prisma.broadcastMessage.findMany({
        select: {
          id: true,
          status: true,
          channels: true,
          recipientCount: true,
        },
      });

      const totalBroadcasts = allBroadcasts.length;
      const activeBroadcasts = allBroadcasts.filter(
        (b) => b.status === "sent" || b.status === "scheduled"
      ).length;
      const deliveredPushAlerts = allBroadcasts.reduce(
        (sum, b) => (b.channels.includes("push") && b.status === "sent" ? sum + b.recipientCount : sum),
        0
      );
      const scheduledPipeline = allBroadcasts.filter(
        (b) => b.status === "scheduled"
      ).length;

      return res.json({
        broadcasts,
        metrics: {
          totalBroadcasts,
          activeBroadcasts,
          deliveredPushAlerts,
          scheduledPipeline,
        },
      });
    } catch (err) {
      console.error("Failed to fetch broadcasts:", err);
      return res.status(500).json({ error: "Failed to fetch broadcasts" });
    }
  });

  const createBroadcastSchema = z.object({
    title: z.string().min(2, "Title is required"),
    body: z.string().min(2, "Message body is required"),
    priority: z.enum(["normal", "urgent"]).default("normal"),
    audience: z.enum(["all_users", "all_salespeople", "all_retailers", "city"]).default("all_retailers"),
    targetCity: z.string().nullable().optional(),
    channels: z.array(z.string()).min(1, "Select at least one delivery channel"),
    scheduledAt: z.string().nullable().optional(),
    authorName: z.string().optional(),
  });

  // 2. POST /admin/broadcasts - create & dispatch broadcast announcement
  router.post("/broadcasts", async (req, res) => {
    try {
      const parsed = createBroadcastSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid broadcast data", details: parsed.error.issues });
      }

      const { title, body, priority, audience, targetCity, channels, scheduledAt, authorName } = parsed.data;

      // Determine recipient count dynamically
      let recipientCount = 0;
      const activeRetailers = await prisma.retailer.findMany({
        where:
          audience === "city" && targetCity
            ? {
                OR: [
                  { shopAddress: { contains: targetCity, mode: "insensitive" } },
                  { deliveryCity: { contains: targetCity, mode: "insensitive" } },
                ],
              }
            : undefined,
        select: { id: true },
      });
      const activeStaff = await prisma.staffUser.findMany({
        where: { status: "active" },
        select: { id: true },
      });

      if (audience === "all_retailers" || audience === "city") {
        recipientCount = activeRetailers.length;
      } else if (audience === "all_salespeople") {
        recipientCount = activeStaff.length;
      } else {
        recipientCount = activeRetailers.length + activeStaff.length;
      }

      const isScheduled = Boolean(scheduledAt && new Date(scheduledAt) > new Date());
      const status = isScheduled ? "scheduled" : "sent";
      const sentAt = isScheduled ? null : new Date();

      const broadcast = await prisma.broadcastMessage.create({
        data: {
          title: title.trim(),
          body: body.trim(),
          priority,
          audience,
          targetCity: audience === "city" && targetCity ? targetCity.trim() : null,
          channels,
          status,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          sentAt,
          recipientCount: Math.max(1, recipientCount),
          authorName: authorName?.trim() || "Operations Lead",
        },
      });

      // If sent immediately and includes in_app channel for retailers, fan out notification items
      if (status === "sent" && channels.includes("in_app") && (audience === "all_retailers" || audience === "all_users" || audience === "city")) {
        const fanoutRetailers = activeRetailers.slice(0, 50);
        if (fanoutRetailers.length > 0) {
          await prisma.notification.createMany({
            data: fanoutRetailers.map((r) => ({
              retailerId: r.id,
              title: title.trim(),
              body: body.trim(),
              read: false,
            })),
          });
        }
      }

      // Record audit event
      await prisma.auditEvent.create({
        data: {
          action: "broadcast.create",
          subjectType: "broadcast",
          subjectId: broadcast.id,
          metadata: {
            title: broadcast.title,
            priority: broadcast.priority,
            audience: broadcast.audience,
            recipientCount: broadcast.recipientCount,
          },
        },
      });

      return res.status(201).json({ broadcast });
    } catch (err) {
      console.error("Failed to create broadcast:", err);
      return res.status(500).json({ error: "Failed to create broadcast" });
    }
  });

  // 3. PATCH /admin/broadcasts/:id/cancel - cancel a broadcast
  router.patch("/broadcasts/:id/cancel", async (req, res) => {
    try {
      const { id } = req.params;
      const broadcast = await prisma.broadcastMessage.update({
        where: { id },
        data: { status: "cancelled" },
      });

      await prisma.auditEvent.create({
        data: {
          action: "broadcast.cancel",
          subjectType: "broadcast",
          subjectId: id,
          metadata: { title: broadcast.title },
        },
      });

      return res.json({ broadcast });
    } catch (err) {
      console.error("Failed to cancel broadcast:", err);
      return res.status(500).json({ error: "Failed to cancel broadcast" });
    }
  });

  // 4. POST /admin/broadcasts/:id/resend - re-dispatch an existing broadcast
  router.post("/broadcasts/:id/resend", async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await prisma.broadcastMessage.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: "Broadcast not found" });

      const broadcast = await prisma.broadcastMessage.update({
        where: { id },
        data: {
          status: "sent",
          sentAt: new Date(),
        },
      });

      await prisma.auditEvent.create({
        data: {
          action: "broadcast.resend",
          subjectType: "broadcast",
          subjectId: id,
          metadata: { title: broadcast.title },
        },
      });

      return res.json({ broadcast });
    } catch (err) {
      console.error("Failed to resend broadcast:", err);
      return res.status(500).json({ error: "Failed to resend broadcast" });
    }
  });

  // 5. DELETE /admin/broadcasts/:id - delete a broadcast
  router.delete("/admin/broadcasts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await prisma.broadcastMessage.delete({ where: { id } });
      return res.json({ success: true });
    } catch (err) {
      console.error("Failed to delete broadcast:", err);
      return res.status(500).json({ error: "Failed to delete broadcast" });
    }
  });

  return router;
}
