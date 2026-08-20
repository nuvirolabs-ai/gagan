import type { NextFunction, Request, RequestHandler, Response } from "express";
import { prisma } from "../../lib/prisma";

type StaffAccessStatus = "active" | "suspended" | "revoked";

export interface PermissionSnapshot {
  status: StaffAccessStatus;
  roles: Array<{ permissions: string[] }>;
  delegations: Array<{
    id: string;
    startsAt: Date;
    endsAt: Date;
    revokedAt: Date | null;
    permissions: string[];
  }>;
}

export interface PermissionSource {
  load(staffId: string): Promise<PermissionSnapshot | null>;
}

export interface EffectivePermissions {
  active: boolean;
  permissions: string[];
  delegationIds: string[];
}

export interface StaffAuth {
  staffId: string;
  permissions: string[];
  delegationIds: string[];
  sessionId?: string;
  stepUpUntil?: Date;
}

export interface StaffAuthedRequest extends Request {
  staffAuth?: StaffAuth;
}

const prismaPermissionSource: PermissionSource = {
  async load(staffId) {
    const staff = await prisma.staffUser.findUnique({
      where: { id: staffId },
      select: {
        status: true,
        roles: {
          select: {
            role: {
              select: {
                permissions: {
                  select: { permission: { select: { name: true } } },
                },
              },
            },
          },
        },
        delegationsHeld: {
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            revokedAt: true,
            role: {
              select: {
                permissions: {
                  select: { permission: { select: { name: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!staff) return null;
    return {
      status: staff.status,
      roles: staff.roles.map(({ role }) => ({
        permissions: role.permissions.map(({ permission }) => permission.name),
      })),
      delegations: staff.delegationsHeld.map((delegation) => ({
        id: delegation.id,
        startsAt: delegation.startsAt,
        endsAt: delegation.endsAt,
        revokedAt: delegation.revokedAt,
        permissions: delegation.role.permissions.map(({ permission }) => permission.name),
      })),
    };
  },
};

export async function effectivePermissions(
  staffId: string,
  at = new Date(),
  source: PermissionSource = prismaPermissionSource
): Promise<EffectivePermissions> {
  const snapshot = await source.load(staffId);
  if (!snapshot || snapshot.status !== "active") {
    return { active: false, permissions: [], delegationIds: [] };
  }

  const permissions = new Set(snapshot.roles.flatMap((role) => role.permissions));
  const activeDelegations = snapshot.delegations.filter(
    (delegation) =>
      !delegation.revokedAt && delegation.startsAt <= at && delegation.endsAt > at
  );
  for (const delegation of activeDelegations) {
    for (const permission of delegation.permissions) permissions.add(permission);
  }

  return {
    active: true,
    permissions: [...permissions].sort(),
    delegationIds: activeDelegations.map(({ id }) => id).sort(),
  };
}

export function requirePermission(permission: string): RequestHandler {
  return (req: StaffAuthedRequest, res: Response, next: NextFunction) => {
    if (!req.staffAuth) {
      return res.status(401).json({ error: "authentication_required" });
    }
    if (!req.staffAuth.permissions.includes(permission)) {
      return res.status(403).json({ error: "permission_required", permission });
    }
    next();
  };
}
