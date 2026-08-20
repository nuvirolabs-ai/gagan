import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { prisma } from "./prisma";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export interface RepRequest extends Request {
  repId?: string;
}

export function signRepToken(repId: string): string {
  return jwt.sign({ repId, scope: "rep" }, JWT_SECRET, { expiresIn: "30d" });
}

export async function requireRep(req: RepRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  let payload: { repId: string; scope?: string };
  try {
    payload = jwt.verify(header.slice(7), JWT_SECRET) as { repId: string; scope?: string };
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  if (payload.scope !== "rep") {
    return res.status(403).json({ error: "Sales rep access required" });
  }

  try {
    const rep = await prisma.salesRep.findUnique({
      where: { id: payload.repId },
      select: { id: true },
    });
    if (!rep) return res.status(401).json({ error: "Session no longer valid" });
  } catch (err) {
    return next(err);
  }

  req.repId = payload.repId;
  next();
}

/**
 * A rep may only touch retailers assigned to them. Returns the retailer, or
 * null if it doesn't exist or belongs to another rep — callers must treat both
 * the same so this can't be used to probe for retailers.
 */
export async function assignedRetailer(repId: string, retailerId: string) {
  return prisma.retailer.findFirst({ where: { id: retailerId, salesRepId: repId } });
}
