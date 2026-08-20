import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../prisma";
import { getSapConnector, SapSalesOrderPayload, SapInvoicePayload } from "./index";

type Db = PrismaClient | Prisma.TransactionClient;

const MAX_ATTEMPTS = 5;

/**
 * Queue an order for posting to SAP. Called on the same transaction that
 * creates the order, so an order can never exist without its outbox row — that
 * is what makes "post every app order into SAP" (spec §7) safe across restarts
 * and outages.
 */
export async function enqueueSalesOrder(db: Db, orderId: string): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      retailer: { select: { sapCustomerId: true } },
      items: { include: { variant: { include: { product: true } } } },
    },
  });
  if (!order) return;

  const payload: SapSalesOrderPayload = {
    orderId: order.id,
    orderNo: order.orderNo,
    sapCustomerId: order.retailer.sapCustomerId ?? "",
    placedAt: order.createdAt.toISOString(),
    lines: order.items.map((i) => ({
      sapMaterialId: i.variant.product.sapMaterialId ?? "",
      quantityCases: i.qtyOrdered,
      unitPrice: Number(i.unitPrice),
    })),
  };

  await db.sapOutbox.upsert({
    where: { kind_referenceId: { kind: "sales_order", referenceId: order.id } },
    update: { payload: payload as unknown as Prisma.InputJsonValue },
    create: {
      kind: "sales_order",
      referenceId: order.id,
      payload: payload as unknown as Prisma.InputJsonValue,
    },
  });
}

/** Queue a delivered-weight invoice for posting back into SAP FI/SD. */
export async function enqueueInvoice(db: Db, ledgerEntryId: string): Promise<void> {
  const entry = await db.ledgerEntry.findUnique({
    where: { id: ledgerEntryId },
    include: {
      retailer: { select: { sapCustomerId: true } },
      order: { include: { items: { include: { variant: { include: { product: true } } } } } },
    },
  });
  if (!entry || !entry.order) return;

  const payload: SapInvoicePayload = {
    ledgerEntryId: entry.id,
    orderId: entry.order.id,
    sapCustomerId: entry.retailer.sapCustomerId ?? "",
    amount: Number(entry.amount),
    invoicedAt: entry.createdAt.toISOString(),
    lines: entry.order.items.map((i) => ({
      sapMaterialId: i.variant.product.sapMaterialId ?? "",
      billedWeightKg: i.weightDelivered != null ? Number(i.weightDelivered) : null,
      billedCases: i.qtyDelivered,
      lineTotal:
        i.weightDelivered != null
          ? Math.round(
              (Number(i.unitPrice) /
                (Number(i.variant.unitWeightKg) * i.variant.unitsPerCase)) *
                Number(i.weightDelivered) *
                100
            ) / 100
          : Number(i.unitPrice) * (i.qtyDelivered ?? i.qtyOrdered),
    })),
  };

  await db.sapOutbox.upsert({
    where: { kind_referenceId: { kind: "invoice", referenceId: entry.id } },
    update: { payload: payload as unknown as Prisma.InputJsonValue },
    create: {
      kind: "invoice",
      referenceId: entry.id,
      payload: payload as unknown as Prisma.InputJsonValue,
    },
  });
}

export interface DrainResult {
  attempted: number;
  sent: number;
  failed: number;
  skipped: boolean;
}

/**
 * Push queued items to SAP. Safe to run on a timer or by hand.
 *
 * Failures increment `attempts` and keep the row pending until MAX_ATTEMPTS, at
 * which point it is parked as `failed` for a human to look at — better than
 * retrying a malformed payload forever.
 */
export async function drainOutbox(limit = 25): Promise<DrainResult> {
  const connector = getSapConnector();
  if (!connector.enabled) return { attempted: 0, sent: 0, failed: 0, skipped: true };

  const queued = await prisma.sapOutbox.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let sent = 0;
  let failed = 0;

  for (const item of queued) {
    try {
      if (item.kind === "sales_order") {
        const payload = item.payload as unknown as SapSalesOrderPayload;
        const result = await connector.postSalesOrder(payload);
        await prisma.$transaction([
          prisma.order.update({
            where: { id: item.referenceId },
            data: { sapSalesOrderId: result.sapSalesOrderId },
          }),
          prisma.sapOutbox.update({
            where: { id: item.id },
            data: {
              status: "sent",
              sapId: result.sapSalesOrderId,
              sentAt: new Date(),
              attempts: item.attempts + 1,
              lastError: null,
            },
          }),
        ]);
      } else {
        const payload = item.payload as unknown as SapInvoicePayload;
        const result = await connector.postInvoice(payload);
        await prisma.sapOutbox.update({
          where: { id: item.id },
          data: {
            status: "sent",
            sapId: result.sapInvoiceId,
            sentAt: new Date(),
            attempts: item.attempts + 1,
            lastError: null,
          },
        });
      }
      sent++;
    } catch (err) {
      const attempts = item.attempts + 1;
      await prisma.sapOutbox.update({
        where: { id: item.id },
        data: {
          attempts,
          lastError: err instanceof Error ? err.message : "Unknown error",
          status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
        },
      });
      failed++;
    }
  }

  return { attempted: queued.length, sent, failed, skipped: false };
}
