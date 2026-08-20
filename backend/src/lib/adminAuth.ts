import { Request, Response, NextFunction } from "express";
import { prisma } from "./prisma";
import { Permissions } from "../modules/identity/roleCatalog";
import { SessionError } from "../modules/identity/sessionService";
import { lazyIdentitySessionService } from "../modules/identity/sessionRuntime";
import type { StaffAuthedRequest } from "../modules/identity/permissions";

export interface AdminRequest extends StaffAuthedRequest {
  adminId?: string;
}

async function authenticateAdmin(
  req: AdminRequest,
  res: Response,
  next: NextFunction,
  requiredPermission?: string
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  try {
    const claims = await lazyIdentitySessionService.authenticateAccessToken(
      header.slice(7),
      "admin"
    );
    if (requiredPermission && !claims.permissions.includes(requiredPermission)) {
      return res.status(403).json({
        error: "permission_required",
        permission: requiredPermission,
      });
    }
    const staff = await prisma.staffUser.findUnique({
      where: { id: claims.sub },
      select: { id: true, adminUserId: true },
    });
    if (!staff?.adminUserId) return res.status(403).json({ error: "admin_access_required" });
    req.adminId = staff.adminUserId;
    req.staffAuth = {
      staffId: staff.id,
      sessionId: claims.sessionId,
      permissions: claims.permissions,
      delegationIds: claims.delegationIds,
      stepUpUntil: claims.stepUpUntil ? new Date(claims.stepUpUntil * 1000) : undefined,
    };
    next();
  } catch (error) {
    if (error instanceof SessionError) {
      return res.status(error.status).json({ error: error.code });
    }
    next(error);
  }
}

/** Authenticate a linked admin-portal identity without granting any operation. */
export async function requireAdminIdentity(
  req: AdminRequest,
  res: Response,
  next: NextFunction
) {
  return authenticateAdmin(req, res, next);
}

/** Existing admin surfaces remain restricted until each gets a narrow permission. */
export async function requireAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  return authenticateAdmin(req, res, next, Permissions.STAFF_MANAGE);
}
