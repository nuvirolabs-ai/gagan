import { Prisma } from "@prisma/client";
import { addDays, paymentTermDays, recomputeOverdue } from "../../lib/ageing";
import { buildInvoice } from "../../lib/invoicing";
import { prisma } from "../../lib/prisma";
import { enqueueInvoice } from "../../lib/sap/outbox";
import { findExistingInvoice } from "./invoiceRepository";
import type {
  CreateInvoiceForDeliveryInput,
  DeliveryResolutionInput,
  InvoiceResult,
} from "./types";

const MAX_SERIALIZATION_ATTEMPTS = 5;

export class InvoiceCreationError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

function validateResolutions(
  orderItemIds: string[],
  lines: DeliveryResolutionInput[]
): Map<string, DeliveryResolutionInput> {
  const byId = new Map(lines.map((line) => [line.orderItemId, line]));
  if (byId.size !== lines.length) throw new InvoiceCreationError("duplicate_delivery_line");
  if (byId.size !== orderItemIds.length) {
    throw new InvoiceCreationError("incomplete_delivery_resolution");
  }

  const expected = new Set(orderItemIds);
  for (const line of lines) {
    if (!expected.has(line.orderItemId)) {
      throw new InvoiceCreationError("unknown_delivery_line");
    }
    if (!Number.isInteger(line.deliveredCases) || line.deliveredCases < 0) {
      throw new InvoiceCreationError("invalid_delivered_cases");
    }
    if (
      line.deliveredWeightKg !== undefined &&
      (!Number.isFinite(line.deliveredWeightKg) || line.deliveredWeightKg < 0)
    ) {
      throw new InvoiceCreationError("invalid_delivered_weight");
    }
  }
  return byId;
}

function isPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

async function waitBeforeRetry(attempt: number): Promise<void> {
  const exponentialMs = Math.min(5 * 2 ** (attempt - 1), 40);
  const jitterMs = Math.floor(Math.random() * 6);
  await new Promise((resolve) => setTimeout(resolve, exponentialMs + jitterMs));
}

async function createOnce(input: CreateInvoiceForDeliveryInput): Promise<InvoiceResult> {
  return prisma.$transaction(
    async (tx) => {
      const lockedOrders = await tx.$queryRaw<Array<{ retailerId: string }>>`
        SELECT "retailerId"
        FROM "Order"
        WHERE "id" = ${input.orderId}
        FOR UPDATE
      `;
      if (lockedOrders.length === 0) throw new InvoiceCreationError("order_not_found");

      const existing = await findExistingInvoice(tx, input);
      if (existing) return existing;

      await tx.$queryRaw`
        SELECT "id"
        FROM "Retailer"
        WHERE "id" = ${lockedOrders[0].retailerId}
        FOR UPDATE
      `;

      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        include: {
          retailer: true,
          items: {
            include: {
              variant: { include: { product: true } },
            },
          },
        },
      });
      if (!order) throw new InvoiceCreationError("order_not_found");
      if (order.status !== "out_for_delivery") {
        throw new InvoiceCreationError("order_not_ready_for_delivery");
      }

      const resolutions = validateResolutions(
        order.items.map(({ id }) => id),
        input.lines
      );

      for (const item of order.items) {
        const resolution = resolutions.get(item.id)!;
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            qtyDelivered: resolution.deliveredCases,
            weightDelivered: resolution.deliveredWeightKg ?? null,
          },
        });
      }

      const resolvedItems = order.items.map((item) => {
        const resolution = resolutions.get(item.id)!;
        return {
          ...item,
          qtyDelivered: resolution.deliveredCases,
          weightDelivered:
            resolution.deliveredWeightKg === undefined
              ? null
              : new Prisma.Decimal(resolution.deliveredWeightKg),
        };
      });
      const breakdown = buildInvoice(resolvedItems);
      if (breakdown.total <= 0) throw new InvoiceCreationError("invoice_total_must_be_positive");

      const termDays = await paymentTermDays(tx, order.retailerId);
      const dueDate = addDays(input.occurredAt, termDays);
      const itemById = new Map(order.items.map((item) => [item.id, item]));

      const invoice = await tx.invoice.create({
        data: {
          retailerId: order.retailerId,
          orderId: order.id,
          invoiceDate: input.occurredAt,
          dueDate,
          subtotal: breakdown.total,
          taxTotal: 0,
          total: breakdown.total,
          outstandingAmount: breakdown.total,
          idempotencyKey: input.idempotencyKey,
          lines: {
            create: breakdown.lines.map((line) => {
              const item = itemById.get(line.orderItemId)!;
              const resolution = resolutions.get(line.orderItemId)!;
              return {
                orderItemId: item.id,
                descriptionSnapshot: item.variant.product.name,
                itemCodeSnapshot: item.variant.product.sapMaterialId,
                deliveredCases: resolution.deliveredCases,
                deliveredWeightKg: resolution.deliveredWeightKg,
                unitPrice: item.unitPrice,
                lineTotal: line.lineTotal,
              };
            }),
          },
        },
        include: { lines: true },
      });

      const balanceAfter = Number(order.retailer.currentBalance) + breakdown.total;
      await tx.financialLedgerEntry.create({
        data: {
          retailerId: order.retailerId,
          invoiceId: invoice.id,
          direction: "debit",
          kind: "invoice",
          amount: breakdown.total,
          balanceAfter,
          idempotencyKey: `invoice:${invoice.id}`,
          occurredAt: input.occurredAt,
        },
      });

      const legacyEntry = await tx.ledgerEntry.create({
        data: {
          retailerId: order.retailerId,
          orderId: order.id,
          type: "invoice",
          amount: breakdown.total,
          balanceAfter,
          dueDate,
        },
      });
      await tx.retailer.update({
        where: { id: order.retailerId },
        data: { currentBalance: balanceAfter },
      });
      await recomputeOverdue(tx, order.retailerId, input.occurredAt);
      await enqueueInvoice(tx, legacyEntry.id);
      await tx.order.update({
        where: { id: order.id },
        data: { status: "delivered" },
      });

      return tx.invoice.findUniqueOrThrow({
        where: { id: invoice.id },
        include: { lines: true, ledgerEntry: true },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
  );
}

export async function createInvoiceForDelivery(
  input: CreateInvoiceForDeliveryInput
): Promise<InvoiceResult> {
  for (let attempt = 1; attempt <= MAX_SERIALIZATION_ATTEMPTS; attempt += 1) {
    try {
      return await createOnce(input);
    } catch (error) {
      if (isPrismaCode(error, "P2002")) {
        const existing = await findExistingInvoice(prisma, input);
        if (existing) return existing;
      }
      if (isPrismaCode(error, "P2034") && attempt < MAX_SERIALIZATION_ATTEMPTS) {
        await waitBeforeRetry(attempt);
        continue;
      }
      throw error;
    }
  }
  throw new InvoiceCreationError("invoice_retry_exhausted");
}

export type { CreateInvoiceForDeliveryInput, DeliveryResolutionInput } from "./types";
