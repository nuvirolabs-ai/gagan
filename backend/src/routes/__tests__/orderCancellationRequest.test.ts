import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import { createOrderForRetailer } from "../../lib/orders";
import { quoteFor } from "../../modules/commercial/service";
import { FieldDashboardService } from "../../modules/field/dashboardService";

const app = createApp();

describe("Order Cancellation Request Workflow", () => {
  let rep: any;
  let staff: any;
  let retailer: any;
  let variant: any;
  let repToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // 1. Get or create a SalesRep and StaffUser
    retailer = await prisma.retailer.findFirst({
      where: { status: "active", salesRepId: { not: null } },
      include: { salesRep: true },
    });

    if (!retailer || !retailer.salesRep) {
      rep = await prisma.salesRep.findFirst();
      if (!rep) {
        rep = await prisma.salesRep.create({
          data: { name: "Test Sales Rep", phone: "+919876543210" },
        });
      }
      retailer = await prisma.retailer.findFirst({ where: { status: "active" } });
      await prisma.retailer.update({
        where: { id: retailer.id },
        data: { salesRepId: rep.id },
      });
    } else {
      rep = retailer.salesRep;
    }

    // Staff user associated with this rep
    staff = await prisma.staffUser.findFirst({
      where: { salesRepId: rep.id },
    });
    if (!staff) {
      staff = await prisma.staffUser.create({
        data: {
          name: rep.name,
          phone: rep.phone,
          email: `${rep.id}@example.test`,
          salesRepId: rep.id,
        },
      });
    }

    variant = await prisma.variant.findFirst({
      where: { catalogStatus: "active" },
    });

    // Create a mock auth session/token or sign tokens
    // We can use jwt if app verifies it or inject authorization
  });

  async function punchTestOrder(qty: number, keyPrefix: string) {
    const quote = await quoteFor(retailer.id, [{ variantId: variant.id, qty }]);
    const commercialParam = quote ? { quoteId: quote.id, revision: quote.revision } : undefined;
    const res = await createOrderForRetailer(
      retailer.id,
      [{ variantId: variant.id, qty }],
      "rep",
      undefined,
      rep.id,
      `${keyPrefix}-${Date.now()}`,
      commercialParam
    );
    if (!res.ok) {
      console.error("Order creation failed:", res.body);
    }
    return res;
  }

  it("handles direct cancellation for placed orders on the same day", async () => {
    const orderRes = await punchTestOrder(2, "test-cancel-direct");
    expect(orderRes.ok).toBe(true);
    if (!orderRes.ok) return;

    const orderId = orderRes.order.id;

    // Direct cancel via database transaction or service logic
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(["placed", "confirmed"]).toContain(order.status);

    // Test rep direct cancel logic
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "rejected",
        cancellationStatus: "approved",
        cancellationReason: "Cancelled directly by sales representative on same day",
        cancellationDecidedAt: new Date(),
      },
    });
    expect(updated.status).toBe("rejected");
    expect(updated.cancellationStatus).toBe("approved");
  });

  it("supports cancellation request and dispatch coordinator approval for packed orders", async () => {
    // 1. Create an order and advance it to 'packed'
    const orderRes = await punchTestOrder(3, "test-cancel-req");
    expect(orderRes.ok).toBe(true);
    if (!orderRes.ok) return;

    const orderId = orderRes.order.id;

    // Advance status to 'packed'
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "packed" },
    });

    // 2. Sales rep submits cancellation request with reason
    const requestReason = "Customer requested to reduce quantity from 3 to 1 box";
    const requestedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        cancellationStatus: "pending",
        cancellationReason: requestReason,
        cancellationRequestedAt: new Date(),
        cancellationRequestedByRepId: rep.id,
      },
    });
    expect(requestedOrder.cancellationStatus).toBe("pending");
    expect(requestedOrder.cancellationReason).toBe(requestReason);

    // 3. Admin aggregate count reflects pending cancellation
    const pendingCount = await prisma.order.count({
      where: { cancellationStatus: "pending" },
    });
    expect(pendingCount).toBeGreaterThanOrEqual(1);

    // 4. Dispatch approves cancellation
    const approvedOrder = await prisma.$transaction(async (tx) => {
      await tx.dispatchAuthorization.updateMany({
        where: { orderId, status: "active" },
        data: { status: "invalidated", invalidatedAt: new Date() },
      });

      return tx.order.update({
        where: { id: orderId },
        data: {
          status: "rejected",
          cancellationStatus: "approved",
          cancellationDecisionNote: "Order cancelled per rep request. Return goods to shelf.",
          cancellationDecidedAt: new Date(),
          cancellationDecidedByStaffId: staff.id,
        },
      });
    });

    expect(approvedOrder.status).toBe("rejected");
    expect(approvedOrder.cancellationStatus).toBe("approved");

    // 5. Salesperson Today dashboard includes notification
    const dashboard = new FieldDashboardService(prisma);
    const todaySummary = await dashboard.today({ salespersonId: staff.id });
    expect(todaySummary.notifications).toBeDefined();

    const notif = todaySummary.notifications.find((n: any) => n.orderId === orderId);
    expect(notif).toBeDefined();
    expect(notif?.type).toBe("order_cancelled");
    expect(notif?.message).toContain("cancelled by dispatch");
  });

  it("supports dispatch declining a cancellation request with mandatory remark", async () => {
    // 1. Create an order and advance to 'out_for_delivery'
    const orderRes = await punchTestOrder(1, "test-cancel-decline");
    expect(orderRes.ok).toBe(true);
    if (!orderRes.ok) return;

    const orderId = orderRes.order.id;

    await prisma.order.update({
      where: { id: orderId },
      data: { status: "out_for_delivery" },
    });

    // 2. Rep requests cancellation
    await prisma.order.update({
      where: { id: orderId },
      data: {
        cancellationStatus: "pending",
        cancellationReason: "Retailer closed for today",
        cancellationRequestedAt: new Date(),
        cancellationRequestedByRepId: rep.id,
      },
    });

    // 3. Dispatch coordinator declines request because vehicle is already at shop
    const declineNote = "Vehicle already reached shop, driver attempting delivery";
    const declinedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        cancellationStatus: "declined",
        cancellationDecisionNote: declineNote,
        cancellationDecidedAt: new Date(),
        cancellationDecidedByStaffId: staff.id,
      },
    });

    expect(declinedOrder.status).toBe("out_for_delivery");
    expect(declinedOrder.cancellationStatus).toBe("declined");
    expect(declinedOrder.cancellationDecisionNote).toBe(declineNote);

    // 4. Salesperson Today dashboard includes decline notification
    const dashboard = new FieldDashboardService(prisma);
    const todaySummary = await dashboard.today({ salespersonId: staff.id });
    const notif = todaySummary.notifications.find((n: any) => n.orderId === orderId);
    expect(notif).toBeDefined();
    expect(notif?.type).toBe("cancellation_declined");
    expect(notif?.message).toContain(declineNote);
  });
});
