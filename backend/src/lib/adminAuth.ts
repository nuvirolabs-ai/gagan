import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { prisma } from "./prisma";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export interface AdminRequest extends Request {
  adminId?: string;
}

export function signAdminToken(adminId: string): string {
  // `scope` keeps retailer and admin tokens from being interchangeable even
  // though they're signed with the same secret.
  return jwt.sign({ adminId, scope: "admin" }, JWT_SECRET, { expiresIn: "12h" });
}

export async function requireAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  let payload: { adminId: string; scope?: string };
  try {
    payload = jwt.verify(header.slice(7), JWT_SECRET) as { adminId: string; scope?: string };
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  if (payload.scope !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    const admin = await prisma.adminUser.findUnique({
      where: { id: payload.adminId },
      select: { id: true },
    });
    if (!admin) return res.status(401).json({ error: "Session no longer valid" });
  } catch (err) {
    return next(err);
  }

  req.adminId = payload.adminId;
  next();
}
