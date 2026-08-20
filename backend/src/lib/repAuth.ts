import { Request, Response, NextFunction } from "express";
import { prisma } from "./prisma";
import { Permissions } from "../modules/identity/roleCatalog";
import { SessionError } from "../modules/identity/sessionService";
import { lazyIdentitySessionService } from "../modules/identity/sessionRuntime";
import { staffAppAccess } from "../modules/identity/staffAppAccess";

export interface RepRequest extends Request {
  repId?: string;
  staffId?: string;
}

export async function requireRep(req: RepRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  try {
    const claims = await lazyIdentitySessionService.authenticateAccessToken(
      header.slice(7),
      "staff"
    );
    const staff = await prisma.staffUser.findUnique({
      where: { id: claims.sub },
      select: { id: true, salesRepId: true },
    });
    const access = staffAppAccess(claims.permissions, staff?.salesRepId ?? null);
    if (!claims.permissions.includes(Permissions.ORDER_CREATE_FOR_RETAILER)) {
      return res.status(403).json({
        error: "permission_required",
        permission: Permissions.ORDER_CREATE_FOR_RETAILER,
      });
    }
    if (!staff?.salesRepId || !access.canUseSalesWorkspace) {
      return res.status(403).json({ error: "salesperson_required" });
    }
    req.staffId = staff.id;
    req.repId = staff.salesRepId;
    next();
  } catch (error) {
    if (error instanceof SessionError) {
      return res.status(error.status).json({ error: error.code });
    }
    next(error);
  }
}

/**
 * A rep may only touch retailers assigned to them. Returns the retailer, or
 * null if it doesn't exist or belongs to another rep — callers must treat both
 * the same so this can't be used to probe for retailers.
 */
export async function assignedRetailer(repId: string, retailerId: string) {
  return prisma.retailer.findFirst({ where: { id: retailerId, salesRepId: repId } });
}
