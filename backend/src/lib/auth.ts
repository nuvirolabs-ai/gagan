import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { prisma } from "./prisma";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export interface AuthedRequest extends Request {
  retailerId?: string;
}

export function signToken(retailerId: string): string {
  return jwt.sign({ retailerId }, JWT_SECRET, { expiresIn: "30d" });
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  let payload: { retailerId: string };
  try {
    payload = jwt.verify(header.slice(7), JWT_SECRET) as { retailerId: string };
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // A structurally valid token can still name a retailer that no longer exists
  // (deleted account, restored database). That's an invalid session, not a 404.
  try {
    const exists = await prisma.retailer.findUnique({
      where: { id: payload.retailerId },
      select: { id: true },
    });
    if (!exists) return res.status(401).json({ error: "Session no longer valid" });
  } catch (err) {
    return next(err);
  }

  req.retailerId = payload.retailerId;
  next();
}
