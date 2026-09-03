import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../prisma";
import { getSapConnector, SapSalesOrderPayload, SapInvoicePayload } from "./index";

type Db = PrismaClient | Prisma.TransactionClient;

const MAX_ATTEMPTS = 5;

async function salesOrderPayload(db: Db, orderId: string): Promise<SapSalesOrderPayload | null> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      retailer: { select: { sapCustomerId: true } },
      items: { include: { variant: { include: { product: true } } } },
    },
  });
  if (!order) return null;

  return {
    orderId: order.id,
    orderNo: order.orderNo,
    externalReference: order.sapExternalReference ?? `GGN-${String(order.orderNo).padStart(8, "0")}`,
    sapCustomerId: order.retailer.sapCustomerId ?? "",
    placedAt: order.createdAt.toISOString(),
    lines: order.items.map((i) => ({
      sapMaterialId: i.variant.product.sapMaterialId ?? "",
      quantityCases: i.qtyOrdered,
      unitPrice: Number(i.unitPrice),
    })),
  };
}

async function invoicePayload(db: Db, ledgerEntryId: string): Promise<SapInvoicePayload | null> {
  const entry = await db.ledgerEntry.findUnique({
    where: { id: ledgerEntryId },
    include: {
      retailer: { select: { sapCustomerId: true } },
      order: { include: { items: { include: { variant: { include: { product: true } } } } } },
    },
  });
  if (!entry || !entry.order) return null;

  return {
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
}

/**
 * Queue an authorized order for posting to SAP. Automatically allowed orders
 * enqueue during creation; approval-held orders enqueue in the same transaction
 * as the final approval and dispatch authorization.
 */
export async function enqueueSalesOrder(db: Db, orderId: string): Promise<void> {
  const payload = await salesOrderPayload(db, orderId);
  if (!payload) return;

  await db.sapOutbox.upsert({
    where: { kind_referenceId: { kind: "sales_order", referenceId: orderId } },
    update: { payload: payload as unknown as Prisma.InputJsonValue },
    create: {
      kind: "sales_order",
      referenceId: orderId,
      payload: payload as unknown as Prisma.InputJsonValue,
    },
  });
}

/** Queue a delivered-weight invoice for posting back into SAP FI/SD. */
export async function enqueueInvoice(db: Db, ledgerEntryId: string): Promise<void> {
  const payload = await invoicePayload(db, ledgerEntryId);
  if (!payload) return;

  await db.sapOutbox.upsert({
    where: { kind_referenceId: { kind: "invoice", referenceId: ledgerEntryId } },
    update: { payload: payload as unknown as Prisma.InputJsonValue },
    create: {
      kind: "invoice",
      referenceId: ledgerEntryId,
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
export async function drainOutbox(
  limit = 25,
  connectorOverride?: ReturnType<typeof getSapConnector>,
  onlyReferenceId?: string
): Promise<DrainResult> {
  const connector = connectorOverride ?? getSapConnector();
  if (!connector.enabled) return { attempted: 0, sent: 0, failed: 0, skipped: true };

  const queued = await prisma.sapOutbox.findMany({
    where: { status: "pending", ...(onlyReferenceId ? { referenceId: onlyReferenceId } : {}) },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let sent = 0;
  let failed = 0;

  for (const item of queued) {
    try {
      if (item.kind === "sales_order") {
        // Rebuild from current mappings. An order can be queued before the
        // SAP sync links its CardCode/ItemCodes; retrying the original JSON
        // would permanently preserve empty mappings.
        const payload = await salesOrderPayload(prisma, item.referenceId);
        if (!payload) throw new Error("Order no longer exists");
        if (!payload.sapCustomerId || payload.lines.some((line) => !line.sapMaterialId)) {
          throw new Error("Order is not fully linked to SAP yet");
        }
        // A timeout can happen after SAP commits the order. Reconcile by the
        // stable external reference before posting, otherwise a retry can
        // create a duplicate ERP order.
        const result =
          (await connector.findSalesOrderByExternalReference(payload.externalReference)) ??
          (await connector.postSalesOrder(payload));
        const syncedAt = new Date();
        await prisma.$transaction([
          prisma.order.update({
            where: { id: item.referenceId },
            data: {
              sapSalesOrderId: result.sapSalesOrderId,
              sapDocEntry: result.sapDocEntry ?? null,
              sapDocNum: result.sapDocNum ?? null,
              sapExternalReference: payload.externalReference,
              sapSyncStatus: "sent",
              sapLastSyncedAt: syncedAt,
              sapErrorCode: null,
              sapErrorMessage: null,
            },
          }),
          prisma.sapOutbox.update({
            where: { id: item.id },
            data: {
              status: "sent",
              sapId: result.sapSalesOrderId,
              payload: payload as unknown as Prisma.InputJsonValue,
              sentAt: syncedAt,
              attempts: item.attempts + 1,
              lastError: null,
            },
          }),
          prisma.auditEvent.create({
            data: {
              actorStaffId: null,
              action: "sap.sales_order_synced",
              subjectType: "order",
              subjectId: item.referenceId,
              metadata: {
                outboxId: item.id,
                sapSalesOrderId: result.sapSalesOrderId,
                sapDocEntry: result.sapDocEntry ?? null,
                sapDocNum: result.sapDocNum ?? null,
                externalReference: payload.externalReference,
              },
            },
          }),
        ]);
      } else {
        // Rebuild invoice payloads from current mappings as well. A delivery
        // can be completed before SAP customer linking finishes; retrying the
        // original JSON would preserve an empty CardCode forever.
        const payload = await invoicePayload(prisma, item.referenceId);
        if (!payload) throw new Error("Invoice ledger entry no longer exists");
        const result = await connector.postInvoice(payload);
        await prisma.$transaction([
          prisma.sapOutbox.update({
            where: { id: item.id },
            data: {
              status: "sent",
              sapId: result.sapInvoiceId,
              payload: payload as unknown as Prisma.InputJsonValue,
              sentAt: new Date(),
              attempts: item.attempts + 1,
              lastError: null,
            },
          }),
          prisma.auditEvent.create({
            data: {
              actorStaffId: null,
              action: "sap.invoice_synced",
              subjectType: "order",
              subjectId: payload.orderId,
              metadata: { outboxId: item.id, ledgerEntryId: payload.ledgerEntryId, sapInvoiceId: result.sapInvoiceId },
            },
          }),
        ]);
      }
      sent++;
    } catch (err) {
      const attempts = item.attempts + 1;
      const message = err instanceof Error ? err.message : "Unknown error";
      await prisma.order.updateMany({
        where: { id: item.referenceId },
        data: {
          sapSyncStatus: attempts >= MAX_ATTEMPTS ? "failed" : "reconciliation_required",
          sapErrorCode: "sap_outbox_delivery_failed",
          sapErrorMessage: message,
        },
      });
      await prisma.sapOutbox.update({
        where: { id: item.id },
        data: {
          attempts,
          lastError: message,
          status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
        },
      });
      failed++;
    }
  }

  return { attempted: queued.length, sent, failed, skipped: false };
}
