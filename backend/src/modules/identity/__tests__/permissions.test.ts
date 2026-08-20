import type { NextFunction, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import {
  effectivePermissions,
  type PermissionSource,
  requirePermission,
  type StaffAuthedRequest,
} from "../permissions";

const at = new Date("2026-08-20T10:00:00.000Z");

function source(snapshot: Awaited<ReturnType<PermissionSource["load"]>>): PermissionSource {
  return { load: vi.fn().mockResolvedValue(snapshot) };
}

describe("effectivePermissions", () => {
  it("returns a stable union of direct role permissions", async () => {
    const result = await effectivePermissions(
      "staff-1",
      at,
      source({
        status: "active",
        roles: [
          { permissions: ["kyc.submit", "order.create_for_retailer"] },
          { permissions: ["collection.submit", "kyc.submit"] },
        ],
        delegations: [],
      })
    );

    expect(result).toEqual({
      active: true,
      permissions: ["collection.submit", "kyc.submit", "order.create_for_retailer"],
      delegationIds: [],
    });
  });

  it("adds only currently active, non-revoked delegations", async () => {
    const result = await effectivePermissions(
      "staff-1",
      at,
      source({
        status: "active",
        roles: [],
        delegations: [
          {
            id: "active",
            startsAt: new Date("2026-08-19T10:00:00.000Z"),
            endsAt: new Date("2026-08-21T10:00:00.000Z"),
            revokedAt: null,
            permissions: ["approval.third_invoice"],
          },
          {
            id: "expired",
            startsAt: new Date("2026-08-18T10:00:00.000Z"),
            endsAt: new Date("2026-08-19T10:00:00.000Z"),
            revokedAt: null,
            permissions: ["credit.block"],
          },
          {
            id: "future",
            startsAt: new Date("2026-08-21T10:00:00.000Z"),
            endsAt: new Date("2026-08-22T10:00:00.000Z"),
            revokedAt: null,
            permissions: ["credit.rating_confirm"],
          },
          {
            id: "revoked",
            startsAt: new Date("2026-08-19T10:00:00.000Z"),
            endsAt: new Date("2026-08-21T10:00:00.000Z"),
            revokedAt: new Date("2026-08-20T09:00:00.000Z"),
            permissions: ["legal.decide"],
          },
        ],
      })
    );

    expect(result.permissions).toEqual(["approval.third_invoice"]);
    expect(result.delegationIds).toEqual(["active"]);
  });

  it.each(["suspended", "revoked"] as const)(
    "returns no authority for a %s user",
    async (status) => {
      const result = await effectivePermissions(
        "staff-1",
        at,
        source({
          status,
          roles: [{ permissions: ["staff.manage"] }],
          delegations: [],
        })
      );
      expect(result).toEqual({ active: false, permissions: [], delegationIds: [] });
    }
  );
});

describe("requirePermission", () => {
  it("denies missing permission and ignores a client-provided role", () => {
    const req = {
      body: { role: "platform_admin" },
      staffAuth: { staffId: "staff-1", permissions: [], delegationIds: [] },
    } as unknown as StaffAuthedRequest;
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const res = { status, json } as unknown as Response;
    const next = vi.fn() as NextFunction;

    requirePermission("staff.manage")(req, res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      error: "permission_required",
      permission: "staff.manage",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("allows a server-resolved permission", () => {
    const req = {
      staffAuth: {
        staffId: "staff-1",
        permissions: ["staff.manage"],
        delegationIds: [],
      },
    } as unknown as StaffAuthedRequest;
    const next = vi.fn() as NextFunction;

    requirePermission("staff.manage")(req, {} as Response, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
