import { prisma } from "./prisma";
import { enqueueSalesOrder } from "./sap/outbox";

export interface OrderLineInput {
  variantId: string;
  qty: number;
}

export type CreateOrderResult =
  | { ok: true; order: any }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * Single path for creating an order, whether the retailer placed it themselves
 * or a sales rep placed it on their behalf. Pricing always resolves against the
 * *retailer's* tier (plus any per-retailer override), and the credit check is
 * identical either way — a rep can't sell around a retailer's limit.
 */
export async function createOrderForRetailer(
  retailerId: string,
  items: OrderLineInput[],
  placedBy: "retailer" | "rep",
  placedByRepId?: string
): Promise<CreateOrderResult> {
  const retailer = await prisma.retailer.findUnique({ where: { id: retailerId } });
  if (!retailer) return { ok: false, status: 404, body: { error: "Retailer not found" } };

  const variantIds = items.map((i) => i.variantId);
  const [priceList, overrides] = await Promise.all([
    prisma.priceList.findMany({ where: { tierId: retailer.tierId, variantId: { in: variantIds } } }),
    prisma.priceOverride.findMany({ where: { retailerId, variantId: { in: variantIds } } }),
  ]);
  const tierPrice = new Map(priceList.map((p) => [p.variantId, Number(p.price)]));
  const overridePrice = new Map(overrides.map((o) => [o.variantId, Number(o.price)]));

  let orderTotal = 0;
  const lineItems: { variantId: string; qtyOrdered: number; unitPrice: number }[] = [];
  for (const item of items) {
    const unitPrice = overridePrice.get(item.variantId) ?? tierPrice.get(item.variantId);
    if (unitPrice == null) {
      return {
        ok: false,
        status: 400,
        body: { error: `No price available for one of the items`, variantId: item.variantId },
      };
    }
    orderTotal += unitPrice * item.qty;
    lineItems.push({ variantId: item.variantId, qtyOrdered: item.qty, unitPrice });
  }

  const available = Number(retailer.creditLimit) - Number(retailer.currentBalance);
  if (orderTotal > available) {
    return {
      ok: false,
      status: 402,
      body: { error: "Order exceeds available credit", orderTotal, availableCredit: available },
    };
  }

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        retailerId,
        placedBy,
        placedByRepId: placedBy === "rep" ? placedByRepId ?? null : null,
        status: "placed",
        orderTotal,
        items: { create: lineItems },
      },
      include: { items: true },
    });
    // Queue for SAP on the same transaction — an order must never exist without
    // its outbox row, or it would silently never reach SAP.
    await enqueueSalesOrder(tx, created.id);
    return created;
  });

  return { ok: true, order };
}
