import { describe, expect, it, vi } from "vitest";
import { CommercialStatusCode } from "@prisma/client";
import {
  COMMERCIAL_STATUS_LABELS,
  deriveCurrentCommercialStatus,
  recordCommercialStatusEvent,
  serializeCommercialStatusEvent,
} from "./statusService";
import { retailerOrderCreatedResponse, retailerOrderView } from "../../routes/orders";

describe("internal commercial status", () => {
  it("keeps stable codes separate from the emoji-plus-text presentation", () => {
    expect(CommercialStatusCode.SALES_ORDER_CREATED).toBe("SALES_ORDER_CREATED");
    expect(COMMERCIAL_STATUS_LABELS).toMatchObject({
      ACCOUNT_OPENED: "#️⃣ New Account Opened",
      RATE_APPROVAL_SENT: "🍓 Rate Sent for Approval",
      SALES_ORDER_APPROVAL_SENT: "❤️ Sales Order Sent for Approval",
      SALES_ORDER_PUNCHED: "📝 Sales Order Punched",
      SALES_ORDER_CREATED: "👍 Sales Order Created",
      SALES_ORDER_ON_HOLD: "❌ Sales Order On Hold",
      ADVANCE_PAYMENT_RECEIVED: "✍️ Advance Payment Received",
    });
    expect(COMMERCIAL_STATUS_LABELS.SALES_ORDER_CREATED).toBe("👍 Sales Order Created");
    expect(COMMERCIAL_STATUS_LABELS.SALES_ORDER_ON_HOLD).toBe("❌ Sales Order On Hold");
  });

  it("gives an active hold visual priority without changing the underlying event history", () => {
    const events = [
      { code: CommercialStatusCode.SALES_ORDER_CREATED, createdAt: new Date("2026-09-15T10:00:00Z") },
      { code: CommercialStatusCode.ADVANCE_PAYMENT_RECEIVED, createdAt: new Date("2026-09-15T10:05:00Z") },
    ];
    expect(deriveCurrentCommercialStatus(events, false)).toBe(CommercialStatusCode.SALES_ORDER_CREATED);
    expect(deriveCurrentCommercialStatus(events, true)).toBe(CommercialStatusCode.SALES_ORDER_ON_HOLD);
  });

  it("keeps account opening as the current retailer milestone until a later status exists", () => {
    expect(deriveCurrentCommercialStatus([
      { code: CommercialStatusCode.ACCOUNT_OPENED, createdAt: new Date("2026-09-15T09:00:00Z") },
    ], false)).toBe(CommercialStatusCode.ACCOUNT_OPENED);
  });

  it("distinguishes punched demand from an authorized created order", () => {
    const sameTransaction = new Date("2026-09-25T09:00:00Z");
    const events = [
      { code: CommercialStatusCode.SALES_ORDER_PUNCHED, createdAt: sameTransaction },
    ];
    expect(deriveCurrentCommercialStatus(events, false)).toBe(CommercialStatusCode.SALES_ORDER_PUNCHED);
    expect(deriveCurrentCommercialStatus([
      events[0],
      { code: CommercialStatusCode.SALES_ORDER_APPROVAL_SENT, createdAt: sameTransaction },
    ], false)).toBe(CommercialStatusCode.SALES_ORDER_APPROVAL_SENT);
    expect(deriveCurrentCommercialStatus([
      { code: CommercialStatusCode.SALES_ORDER_CREATED, createdAt: sameTransaction },
      ...events,
    ], false)).toBe(CommercialStatusCode.SALES_ORDER_CREATED);
  });

  it("replays the same event and rejects a key reused for another business object", async () => {
    const saved = new Map<string, any>();
    const db: any = {
      commercialStatusEvent: {
        findUnique: vi.fn(async ({ where }: any) => saved.get(where.idempotencyKey) ?? null),
        create: vi.fn(async ({ data }: any) => {
          if (data.idempotencyKey && saved.has(data.idempotencyKey)) {
            const error: any = new Error("unique");
            error.code = "P2002";
            throw error;
          }
          const row = { id: "event-1", createdAt: new Date(), ...data };
          if (data.idempotencyKey) saved.set(data.idempotencyKey, row);
          return row;
        }),
      },
    };
    const input = {
      code: CommercialStatusCode.SALES_ORDER_CREATED,
      retailerId: "retailer-1",
      orderId: "order-1",
      amount: "100.00",
      reason: "created from accepted order",
      metadata: { source: "test" },
      idempotencyKey: "order-created-1",
    };
    const first = await recordCommercialStatusEvent(db, input);
    const replay = await recordCommercialStatusEvent(db, input);
    expect(replay.id).toBe(first.id);
    await expect(recordCommercialStatusEvent(db, { ...input, orderId: "order-2" })).rejects.toMatchObject({ code: "commercial_status_idempotency_conflict" });
    await expect(recordCommercialStatusEvent(db, { ...input, amount: "101.00" })).rejects.toMatchObject({ code: "commercial_status_idempotency_conflict" });
    await expect(recordCommercialStatusEvent(db, { ...input, metadata: { source: "other" } })).rejects.toMatchObject({ code: "commercial_status_idempotency_conflict" });
  });

  it("replays equivalent JSON metadata regardless of object key order", async () => {
    const saved = new Map<string, any>();
    const db: any = {
      commercialStatusEvent: {
        findUnique: vi.fn(async ({ where }: any) => saved.get(where.idempotencyKey) ?? null),
        create: vi.fn(async ({ data }: any) => {
          const row = { id: "event-json-order", createdAt: new Date(), ...data };
          saved.set(data.idempotencyKey, row);
          return row;
        }),
      },
    };
    const input = {
      code: CommercialStatusCode.SALES_ORDER_CREATED,
      retailerId: "retailer-json-order",
      orderId: "order-json-order",
      metadata: { placedBy: "rep", orderNo: 42, dispatchAuthorizationId: "auth-1", assessmentId: "assessment-1" },
      idempotencyKey: "created-json-order",
    };
    const first = await recordCommercialStatusEvent(db, input);

    await expect(recordCommercialStatusEvent(db, {
      ...input,
      metadata: { orderNo: 42, placedBy: "rep", assessmentId: "assessment-1", dispatchAuthorizationId: "auth-1" },
    })).resolves.toMatchObject({ id: first.id });
  });

  it("serializes internal event data for staff without changing its stable code", () => {
    const result = serializeCommercialStatusEvent({
      id: "event-1",
      code: CommercialStatusCode.ADVANCE_PAYMENT_RECEIVED,
      retailerId: "retailer-1",
      orderId: "order-1",
      commercialQuoteId: null,
      actorStaffId: "staff-1",
      actorStaff: { id: "staff-1", name: "Field manager" },
      reason: null,
      amount: "250.00",
      reference: "RCPT-1",
      metadata: { paymentId: "payment-1" },
      createdAt: new Date("2026-09-15T10:00:00Z"),
    });
    expect(result).toMatchObject({
      code: "ADVANCE_PAYMENT_RECEIVED",
      label: "✍️ Advance Payment Received",
      amount: 250,
      actor: { name: "Field manager" },
    });
  });

  it("strips internal fields from retailer order DTOs even if Prisma returns them", () => {
    const publicOrder = retailerOrderView({
      id: "order-1",
      status: "placed",
      isOnHold: true,
      holdReason: "Credit review",
      heldAt: new Date(),
      heldByStaffId: "staff-1",
      commercialStatusEvents: [{ code: "SALES_ORDER_ON_HOLD" }],
      orderTotal: "100.00",
    });
    expect(publicOrder).toMatchObject({ id: "order-1", status: "placed", orderTotal: "100.00" });
    expect(publicOrder).not.toHaveProperty("isOnHold");
    expect(publicOrder).not.toHaveProperty("holdReason");
    expect(publicOrder).not.toHaveProperty("heldByStaffId");
    expect(publicOrder).not.toHaveProperty("commercialStatusEvents");
  });

  it("keeps approval and dispatch workflow objects on the protected staff boundary", () => {
    const pendingResponse = retailerOrderCreatedResponse({
      order: { id: "order-1", status: "placed" },
      decision: { result: "approval_required", reasons: ["internal_reason"] },
      approvalRequest: { id: "approval-1", requestedByStaffId: "staff-1", requestReason: "internal" },
    } as any);
    expect(pendingResponse).toEqual({ order: {
      id: "order-1", status: "placed", source: "RETAILER_APP", creatorName: null, salesOrderState: "punched",
    } });

    const createdResponse = retailerOrderCreatedResponse({
      order: { id: "order-2", status: "placed" },
      decision: { result: "allowed", reasons: [] },
      dispatchAuthorization: { id: "dispatch-2", assessmentId: "assessment-2" },
    } as any);
    expect(createdResponse).toEqual({ order: {
      id: "order-2", status: "placed", source: "RETAILER_APP", creatorName: null, salesOrderState: "created",
    } });
    expect(createdResponse).not.toHaveProperty("dispatchAuthorization");
    expect(createdResponse.order).not.toHaveProperty("decision");
  });

  it("exposes a safe derived lifecycle state from retailer order history", () => {
    const punched = retailerOrderView({
      id: "order-3",
      status: "placed",
      commercialStatusEvents: [{ code: "SALES_ORDER_PUNCHED", actorStaffId: "staff-private" }],
    });
    const created = retailerOrderView({
      id: "order-4",
      status: "placed",
      commercialStatusEvents: [
        { code: "SALES_ORDER_PUNCHED" },
        { code: "SALES_ORDER_CREATED", actorStaffId: "staff-private" },
      ],
    });
    expect(punched).toMatchObject({ salesOrderState: "punched" });
    expect(created).toMatchObject({ salesOrderState: "created" });
    expect(created).not.toHaveProperty("commercialStatusEvents");
    expect(created).not.toHaveProperty("actorStaffId");
  });

  it("exposes order source and salesperson attribution without leaking event records", () => {
    const createdAt = new Date("2026-09-25T10:15:00Z");
    const order = retailerOrderView({
      id: "order-source-1",
      retailerId: "retailer-source-1",
      retailer: { id: "retailer-source-1", name: "Bharat Stores" },
      placedBy: "rep",
      placedByRepId: "rep-source-1",
      createdAt,
      commercialStatusEvents: [{
        code: CommercialStatusCode.SALES_ORDER_PUNCHED,
        actorStaffId: "staff-private",
        actorStaff: { id: "staff-private", name: "Asha Verma" },
      }],
    });

    expect(order).toMatchObject({
      source: "SALESPERSON_APP",
      creatorName: "Asha Verma",
      retailer: { id: "retailer-source-1", name: "Bharat Stores" },
      createdAt,
    });
    expect(order).not.toHaveProperty("commercialStatusEvents");
    expect(order).not.toHaveProperty("actorStaffId");
    expect(order).not.toHaveProperty("placedByRepId");
  });

  it("labels retailer-created orders explicitly", () => {
    expect(retailerOrderView({
      id: "order-retailer-source",
      retailerId: "retailer-source-1",
      placedBy: "retailer",
      createdAt: new Date("2026-09-25T10:15:00Z"),
      commercialStatusEvents: [],
    })).toMatchObject({ source: "RETAILER_APP", creatorName: null });
  });
});
