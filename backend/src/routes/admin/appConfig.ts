import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAdminIdentity } from "../../lib/adminAuth";

const router = Router();
router.use(requireAdminIdentity);

async function ensureAppConfig() {
  return prisma.appConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      freeDeliveryThreshold: 5000,
      minOrderValue: 2000,
      supportPhone: "9812345680",
      creditRolloutMode: "shadow",
      attendanceSelfieRequired: false,
      locationTrackingEnabled: true,
      locationPingIntervalSeconds: 300,
    },
  });
}

// GET /admin/app-config
router.get("/app-config", async (_req: Request, res: Response) => {
  const config = await ensureAppConfig();
  res.json({
    config: {
      ...config,
      freeDeliveryThreshold: Number(config.freeDeliveryThreshold),
      minOrderValue: Number(config.minOrderValue),
    },
  });
});

// PUT /admin/app-config
const updateAppConfigSchema = z.object({
  freeDeliveryThreshold: z.number().finite().nonnegative().optional(),
  minOrderValue: z.number().finite().nonnegative().optional(),
  supportPhone: z.string().trim().min(8).max(20).optional(),
  creditRolloutMode: z.enum(["shadow", "enforce"]).optional(),
  attendanceSelfieRequired: z.boolean().optional(),
  locationTrackingEnabled: z.boolean().optional(),
  locationPingIntervalSeconds: z.number().int().min(30).max(3600).optional(),
});

router.put("/app-config", async (req: Request, res: Response) => {
  const parsed = updateAppConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid configuration input" });
    return;
  }

  await ensureAppConfig();

  const updated = await prisma.appConfig.update({
    where: { id: "singleton" },
    data: {
      ...(parsed.data.freeDeliveryThreshold !== undefined ? { freeDeliveryThreshold: parsed.data.freeDeliveryThreshold } : {}),
      ...(parsed.data.minOrderValue !== undefined ? { minOrderValue: parsed.data.minOrderValue } : {}),
      ...(parsed.data.supportPhone !== undefined ? { supportPhone: parsed.data.supportPhone } : {}),
      ...(parsed.data.creditRolloutMode !== undefined ? { creditRolloutMode: parsed.data.creditRolloutMode } : {}),
      ...(parsed.data.attendanceSelfieRequired !== undefined ? { attendanceSelfieRequired: parsed.data.attendanceSelfieRequired } : {}),
      ...(parsed.data.locationTrackingEnabled !== undefined ? { locationTrackingEnabled: parsed.data.locationTrackingEnabled } : {}),
      ...(parsed.data.locationPingIntervalSeconds !== undefined ? { locationPingIntervalSeconds: parsed.data.locationPingIntervalSeconds } : {}),
    },
  });

  res.json({
    config: {
      ...updated,
      freeDeliveryThreshold: Number(updated.freeDeliveryThreshold),
      minOrderValue: Number(updated.minOrderValue),
    },
    message: "Global configuration and business rules successfully updated",
  });
});

export default router;
