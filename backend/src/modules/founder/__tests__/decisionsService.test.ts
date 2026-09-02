import { describe, expect, it, vi } from "vitest";
import { ApprovalServiceError } from "../../approvals/approvalService";
import { Permissions } from "../../identity/roleCatalog";
import { DecisionsService, FounderDecisionError } from "../decisionsService";

const now = new Date("2026-09-02T10:00:00.000Z");

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: "dec-1",
    retailerId: "ret-1",
    approvalType: "credit_cap",
    status: "open",
    requiredPermission: "legal.decide",
    requestReason: "[FOUNDER UAT] credit exception",
    requestedByStaffId: null,
    createdAt: now,
    deadlineAt: null,
    escalatedAt: null,
    retailer: { name: "Executive Store" },
    order: { orderNo: 24, orderTotal: 78_000 },
    assessment: { reasons: ["new_customer_cap"], projectedExposure: 78_000 },
    ...overrides,
  };
}

describe("founder decisions", () => {
  it("maps only legal.decide or escalated approvals", async () => {
    const db = {
      approvalRequest: {
        findMany: vi.fn().mockResolvedValue([request(), request({ id: "ops", requiredPermission: "approval.second_invoice", status: "open" })]),
      },
      staffUser: { findMany: vi.fn().mockResolvedValue([]) },
      invoice: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new DecisionsService(db as any, { decide: vi.fn() } as any);
    const open = await service.list({ segment: "open", permissions: [Permissions.FOUNDER_VIEW, Permissions.FOUNDER_DECIDE], now });
    expect(open.decisions).toHaveLength(1);
    expect(open.decisions[0].type).toBe("CREDIT_EXCEPTION");
    expect(open.decisions[0].availableActions).toEqual(["approve", "decline"]);
    expect(open.decisions[0].unavailableActions[0].id).toBe("askOwner");
    expect(open.unavailableTypes.map((row) => row.type)).toEqual(["LARGE_PURCHASE", "EXCEPTIONAL_DISCOUNT"]);
  });

  it("hides actions without founder.decide", async () => {
    const db = {
      approvalRequest: { findMany: vi.fn().mockResolvedValue([request()]) },
      staffUser: { findMany: vi.fn().mockResolvedValue([]) },
      invoice: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new DecisionsService(db as any, { decide: vi.fn() } as any);
    const open = await service.list({ segment: "open", permissions: [Permissions.FOUNDER_VIEW], now });
    expect(open.decisions[0].availableActions).toEqual([]);
  });

  it("is idempotent when the approval is already decided", async () => {
    const decide = vi.fn().mockRejectedValue(new ApprovalServiceError("approval_already_decided", 409));
    const decided = request({ status: "approved" });
    const db = {
      approvalRequest: {
        findUnique: vi.fn().mockResolvedValue(decided),
      },
      staffUser: { findUnique: vi.fn().mockResolvedValue(null) },
      invoice: { findMany: vi.fn().mockResolvedValue([]) },
      auditEvent: { create: vi.fn() },
    };
    const service = new DecisionsService(db as any, { decide } as any);
    const result = await service.decide({
      id: "dec-1",
      result: "approved",
      actorStaffId: "founder-1",
      permissions: [Permissions.FOUNDER_DECIDE, "legal.decide"],
    });
    expect(result.status).toBe("approved");
    expect(db.auditEvent.create).not.toHaveBeenCalled();
  });

  it("records a founder audit after a fresh decide", async () => {
    const decide = vi.fn().mockResolvedValue({ status: "approved" });
    const db = {
      approvalRequest: {
        findUnique: vi.fn()
          .mockResolvedValueOnce(request())
          .mockResolvedValueOnce(request({ status: "approved" })),
      },
      staffUser: { findUnique: vi.fn().mockResolvedValue(null) },
      invoice: { findMany: vi.fn().mockResolvedValue([]) },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const service = new DecisionsService(db as any, { decide } as any);
    const result = await service.decide({
      id: "dec-1",
      result: "approved",
      actorStaffId: "founder-1",
      permissions: [Permissions.FOUNDER_DECIDE, "legal.decide"],
    });
    expect(decide).toHaveBeenCalledWith(
      "dec-1",
      expect.objectContaining({ actorStaffId: "founder-1", result: "approved" })
    );
    expect(db.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "founder.decided", actorStaffId: "founder-1" }),
      })
    );
    expect(result.status).toBe("approved");
  });

  it("does not invent Ask Owner", () => {
    const service = new DecisionsService({} as any, { decide: vi.fn() } as any);
    try {
      service.askOwner();
      throw new Error("expected");
    } catch (error) {
      expect(error).toBeInstanceOf(FounderDecisionError);
      expect((error as FounderDecisionError).code).toBe("action_unavailable");
    }
  });

  it("refuses decide without founder.decide", async () => {
    const service = new DecisionsService({} as any, { decide: vi.fn() } as any);
    await expect(
      service.decide({
        id: "dec-1",
        result: "approved",
        actorStaffId: "x",
        permissions: [Permissions.FOUNDER_VIEW],
      })
    ).rejects.toMatchObject({ code: "permission_required", status: 403 });
  });
});
