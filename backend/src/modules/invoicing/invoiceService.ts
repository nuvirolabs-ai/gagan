import { Prisma } from "@prisma/client";
import { snapshot, asJson, quoteDelivery } from "../commercial/service";
import { hasPendingGst } from "../../lib/commercialQuote";
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
    if (line.deliveredWeightKg !== undefined && new Prisma.Decimal(line.deliveredWeightKg).decimalPlaces() > 3) {
      throw new InvoiceCreationError("invalid_delivered_weight_precision");
    }
  }
  return byId;
}

/** A retry may recover an accepted invoice, never substitute another order or
 * silently accept a different physical delivery. Compare immutable invoice
 * lines, not a subsequently edited SKU/order master. */
function verifiedReplay(existing: InvoiceResult, input: CreateInvoiceForDeliveryInput): InvoiceResult {
  if (existing.orderId !== input.orderId) throw new InvoiceCreationError("invoice_replay_conflict");
  const sourceLines = existing.lines.filter((line): line is typeof line & { orderItemId: string } => line.orderItemId != null);
  const requested = validateResolutions(sourceLines.map(line => line.orderItemId), input.lines);
  for (const line of sourceLines) {
    const next = requested.get(line.orderItemId)!;
    const weightMatches = line.deliveredWeightKg == null
      ? next.deliveredWeightKg == null
      : next.deliveredWeightKg != null && line.deliveredWeightKg.eq(next.deliveredWeightKg);
    if (line.deliveredCases !== next.deliveredCases || !weightMatches) throw new InvoiceCreationError("invoice_replay_conflict");
  }
  return existing;
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
      if (existing) return verifiedReplay(existing, input);

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

      const accepted=snapshot(order.commercialSnapshot);
      if (hasPendingGst(accepted)) throw new InvoiceCreationError("gst_configuration_required_before_invoice");
      const commercial=accepted ? quoteDelivery(accepted,order.items.map(item=>{const r=resolutions.get(item.id)!;return {variantId:item.variantId,cases:r.deliveredCases,weightKg:r.deliveredWeightKg};})) : null;
      const commercialTax = commercial
        ? commercial.entities.reduce((sum, entity) => {
            if (entity.gst === null) throw new InvoiceCreationError("gst_configuration_required_before_invoice");
            return sum.plus(entity.gst);
          }, new Prisma.Decimal(0))
        : null;

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
      if (commercial) {
        breakdown.total=Number(commercial.total);
        for (const line of breakdown.lines) {
          const item=order.items.find(i=>i.id===line.orderItemId)!;
          line.lineTotal=Number(commercial.lines.find(l=>l.variantId===item.variantId)!.total);
        }
      }
      if (breakdown.total <= 0) throw new InvoiceCreationError("invoice_total_must_be_positive");

      const termDays = await paymentTermDays(tx, order.retailerId);
      const dueDate = addDays(input.occurredAt, termDays);
      const itemById = new Map(order.items.map((item) => [item.id, item]));

      if (input.proof) {
        const actualWeight = breakdown.lines.reduce(
          (sum, line) => sum + (line.billedWeightKg ?? 0),
          0
        );
        await tx.delivery.upsert({
          where: { orderId: order.id },
          update: {
            podType: input.proof.podType,
            podCapturedAt: input.proof.capturedAt,
            actualWeight,
          },
          create: {
            orderId: order.id,
            podType: input.proof.podType,
            podCapturedAt: input.proof.capturedAt,
            actualWeight,
          },
        });
      }

      const invoice = await tx.invoice.create({
        data: {
          retailerId: order.retailerId,
          orderId: order.id,
          invoiceDate: input.occurredAt,
          dueDate,
          subtotal: commercial ? new Prisma.Decimal(commercial.total).minus(commercialTax!) : breakdown.total,
          taxTotal: commercial ? commercialTax! : 0,
          ...(commercial ? {commercialSnapshot:asJson(commercial)}:{}),
          total: breakdown.total,
          outstandingAmount: breakdown.total,
          idempotencyKey: input.idempotencyKey,
          lines: {
            create: breakdown.lines.map((line) => {
              const item = itemById.get(line.orderItemId)!;
              const resolution = resolutions.get(line.orderItemId)!;
              const commercialLine=commercial?.lines.find(l=>l.variantId===item.variantId);
              return {
                orderItemId: item.id as string | undefined,
                descriptionSnapshot: commercialLine?.productName ?? item.variant.product.name,
                itemCodeSnapshot: commercialLine ? commercialLine.itemCode : item.variant.product.sapMaterialId,
                ...(commercialLine ? {sellingEntity:commercialLine.entity,taxableBase:commercialLine.base,gstPercent:commercialLine.gstPercent,taxAmount:commercialLine.gst}:{}),
                deliveredCases: resolution.deliveredCases,
                deliveredWeightKg: resolution.deliveredWeightKg,
                unitPrice: item.unitPrice,
                lineTotal: line.lineTotal,
              };
            }).concat(commercial?.freight ? [{orderItemId:undefined,descriptionSnapshot:"Freight",itemCodeSnapshot:null,deliveredCases:0,deliveredWeightKg:undefined,unitPrice:new Prisma.Decimal(commercial.freight.amount),lineTotal:Number(commercial.freight.total),sellingEntity:commercial.freight.entity,taxableBase:commercial.freight.amount,gstPercent:commercial.freight.gstPercent,taxAmount:commercial.freight.gst}] : []),
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
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { legacyLedgerEntryId: legacyEntry.id },
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
      await tx.auditEvent.create({
        data: {
          actorStaffId: input.actorStaffId ?? null,
          action: "delivery.completed",
          subjectType: "order",
          subjectId: order.id,
          metadata: { invoiceId: invoice.id, ledgerEntryId: legacyEntry.id },
        },
      });

      return tx.invoice.findUniqueOrThrow({
        where: { id: invoice.id },
        include: { lines: true, ledgerEntry: true, legacyLedgerEntry: true },
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
        if (existing) return verifiedReplay(existing, input);
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
