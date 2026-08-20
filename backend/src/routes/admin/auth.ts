import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { signAdminToken, requireAdmin, AdminRequest } from "../../lib/adminAuth";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const admin = await prisma.adminUser.findUnique({ where: { email: parsed.data.email } });
  // Same message either way so the response can't be used to enumerate accounts.
  if (!admin || !(await bcrypt.compare(parsed.data.password, admin.passwordHash))) {
    return res.status(401).json({ error: "Incorrect email or password" });
  }

  res.json({
    token: signAdminToken(admin.id),
    admin: { id: admin.id, name: admin.name, email: admin.email },
  });
});

router.get("/auth/me", requireAdmin, async (req: AdminRequest, res) => {
  const admin = await prisma.adminUser.findUnique({
    where: { id: req.adminId },
    select: { id: true, name: true, email: true },
  });
  res.json({ admin });
});

export default router;
