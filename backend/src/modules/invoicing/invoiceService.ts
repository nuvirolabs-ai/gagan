import { Prisma, type SalesOrderCompany } from "@prisma/client";
import { snapshot, asJson, quoteDelivery, type CommercialSnapshot } from "../commercial/service";
import { hasPendingGst } from "../../lib/commercialQuote";
import { addDays, paymentTermDays, recomputeOverdue } from "../../lib/ageing";
import { buildInvoice } from "../../lib/invoicing";
import { prisma } from "../../lib/prisma";
import { enqueueInvoice } from "../../lib/sap/outbox";
import { findOrderInvoices, invoiceDetails, type FinancialDb } from "./invoiceRepository";
import { firmSeller, nextFirmInvoiceIdentity } from "./firmInvoiceIdentity";
import { promotionLine } from "../orders/companySalesOrders";
import type {
  CreateInvoiceForDeliveryInput,
  DeliveryResolutionInput,
  DeliveryInvoiceResult,
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
    if (!Number.isSafeInteger(line.deliveredCases) || line.deliveredCases < 0 || line.deliveredCases > 2_147_483_647) {
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

async function existingDelivery(db: FinancialDb, input: CreateInvoiceForDeliveryInput) {
  const keyed = await db.invoice.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { orderId: true, companySalesOrderId: true },
  });
  if (keyed && (keyed.orderId !== input.orderId ||
    (input.companySalesOrderId && keyed.companySalesOrderId !== input.companySalesOrderId))) {
    throw new InvoiceCreationError("invoice_replay_conflict");
  }
  const invoices = await findOrderInvoices(db, input.orderId);
  if (!invoices.length) return null;
  const selected = input.companySalesOrderId
    ? invoices.find(invoice => invoice.companySalesOrderId === input.companySalesOrderId)
    : invoices[0];
  if (!selected) return null;

  const firmInvoices = invoices.some(invoice => invoice.companySalesOrderId);
  if (firmInvoices && !input.companySalesOrderId && await db.companySalesOrder.count({
    where: { orderId: input.orderId, deliveryResolvedAt: null },
  })) throw new InvoiceCreationError("company_delivery_selection_required");

  const sourceLines = firmInvoices
    ? await db.orderItem.findMany({
        where: { orderId: input.orderId, ...(input.companySalesOrderId ? { companySalesOrderId: input.companySalesOrderId } : {}) },
        select: { id: true, qtyDelivered: true, weightDelivered: true },
      }).then(items => items.map(item => ({
        orderItemId: item.id, deliveredCases: item.qtyDelivered, deliveredWeightKg: item.weightDelivered,
      })))
    : selected.lines.filter((line): line is typeof line & { orderItemId: string } => line.orderItemId != null);
  const requested = validateResolutions(sourceLines.map(line => line.orderItemId), input.lines);
  for (const line of sourceLines) {
    const next = requested.get(line.orderItemId)!;
    const weightMatches = line.deliveredWeightKg == null
      ? next.deliveredWeightKg == null
      : next.deliveredWeightKg != null && line.deliveredWeightKg.eq(next.deliveredWeightKg);
    if (line.deliveredCases !== next.deliveredCases || !weightMatches) throw new InvoiceCreationError("invoice_replay_conflict");
  }
  if (firmInvoices) {
    const billing = selected.billingSnapshot as { transportation?: { amount: string; entity: SalesOrderCompany | null } } | null;
    const original = billing?.transportation;
    if (!new Prisma.Decimal(original?.amount ?? 0).eq(input.transportationAmount ?? 0)
      || (input.transportationEntity && original?.entity !== input.transportationEntity)) {
      throw new InvoiceCreationError("invoice_replay_conflict");
    }
  }
  return { ...selected, invoices };
}

function isPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

async function waitBeforeRetry(attempt: number): Promise<void> {
  const exponentialMs = Math.min(5 * 2 ** (attempt - 1), 40);
  const jitterMs = Math.floor(Math.random() * 6);
  await new Promise((resolve) => setTimeout(resolve, exponentialMs + jitterMs));
}

async function createOnce(input: CreateInvoiceForDeliveryInput): Promise<DeliveryInvoiceResult> {
  return prisma.$transaction(
    async (tx) => {
      const lockedOrders = await tx.$queryRaw<Array<{ retailerId: string }>>`
        SELECT "retailerId"
        FROM "Order"
        WHERE "id" = ${input.orderId}
        FOR UPDATE
      `;
      if (lockedOrders.length === 0) throw new InvoiceCreationError("order_not_found");

      const existing = await existingDelivery(tx, input);
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
          companySalesOrders: { orderBy: { company: "asc" } },
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
      const documents = input.companySalesOrderId
        ? order.companySalesOrders.filter(document => document.id === input.companySalesOrderId)
        : order.companySalesOrders;
      if (input.companySalesOrderId && documents.length === 0) throw new InvoiceCreationError("company_sales_order_not_found");
      if (documents.some(document => document.deliveryResolvedAt)) {
        throw new InvoiceCreationError(input.companySalesOrderId ? "company_delivery_already_resolved" : "company_delivery_selection_required");
      }
      if (documents.some(document => !document.dispatchedAt)) {
        throw new InvoiceCreationError("company_dispatch_routes_required");
      }
      const deliveryItems = input.companySalesOrderId
        ? order.items.filter(item => item.companySalesOrderId === input.companySalesOrderId)
        : order.items;

      const resolutions = validateResolutions(
        deliveryItems.map(({ id }) => id),
        input.lines
      );

      const stored = order.commercialSnapshot;
      const saved = snapshot(stored);
      const scopedCompany = input.companySalesOrderId ? documents[0].company : undefined;
      const accepted = Array.isArray(saved?.lines) ? {
        ...saved,
        lines: scopedCompany ? saved.lines.filter(line => line.entity === scopedCompany) : saved.lines,
        freight: scopedCompany && saved.freight?.entity !== scopedCompany ? null : saved.freight,
      } : null;
      const firmBilling = order.companySalesOrders.length > 0;
      if (firmBilling && !accepted) throw new InvoiceCreationError("firm_billing_quote_required");
      if (hasPendingGst(scopedCompany ? { lines: accepted?.lines } : accepted)) {
        throw new InvoiceCreationError("gst_configuration_required_before_invoice");
      }
      if (firmBilling && stored && typeof stored === "object" && !Array.isArray(stored) && stored.coupon) {
        throw new InvoiceCreationError("company_invoice_discount_review_required");
      }

      const transportAmount = new Prisma.Decimal(input.transportationAmount ?? 0);
      if (!transportAmount.isFinite() || transportAmount.lt(0) || transportAmount.decimalPlaces() > 2) {
        throw new InvoiceCreationError("invalid_transportation_amount");
      }
      let deliveryQuote = accepted;
      if (accepted && transportAmount.gt(0)) {
        if (!accepted.freight) throw new InvoiceCreationError("firm_freight_configuration_required");
        if (input.transportationEntity && input.transportationEntity !== accepted.freight.entity) {
          throw new InvoiceCreationError("firm_freight_entity_mismatch");
        }
        deliveryQuote = { ...accepted, freight: { ...accepted.freight, amount: transportAmount.toFixed(2) } };
      }
      const commercial = deliveryQuote ? quoteDelivery(deliveryQuote, deliveryItems
        .filter(item => !promotionLine(item.commercialSnapshot))
        .map(item => {
          const resolution = resolutions.get(item.id)!;
          return { variantId: item.variantId, cases: resolution.deliveredCases, weightKg: resolution.deliveredWeightKg };
        })) : null;

      const itemById = new Map(deliveryItems.map(item => [item.id, item]));
      const commercialByVariant = new Map(commercial?.lines.map(line => [line.variantId, line]));
      const companyById = new Map(documents.map(doc => [doc.id, doc.company]));
      const breakdown = buildInvoice(deliveryItems.map(item => {
        const resolution = resolutions.get(item.id)!;
        return {
          ...item,
          qtyDelivered: resolution.deliveredCases,
          weightDelivered: resolution.deliveredWeightKg === undefined ? null : new Prisma.Decimal(resolution.deliveredWeightKg),
        };
      }));

      const goods = breakdown.lines.map(line => {
        const item = itemById.get(line.orderItemId)!;
        const resolution = resolutions.get(item.id)!;
        const promotion = promotionLine(item.commercialSnapshot);
        const commercialLine = promotion ? undefined : commercialByVariant.get(item.variantId);
        const company = item.companySalesOrderId ? companyById.get(item.companySalesOrderId) : undefined;
        if (firmBilling && (!company || (!promotion && commercialLine?.entity !== company))) {
          throw new InvoiceCreationError("firm_billing_allocation_mismatch");
        }
        const data: Prisma.InvoiceLineUncheckedCreateWithoutInvoiceInput = {
          orderItemId: item.id,
          descriptionSnapshot: commercialLine?.productName ?? item.variant.product.name,
          itemCodeSnapshot: commercialLine ? commercialLine.itemCode : item.variant.product.sapMaterialId,
          ...(commercialLine ? {
            sellingEntity: commercialLine.entity, taxableBase: commercialLine.base,
            gstPercent: commercialLine.gstPercent, taxAmount: commercialLine.gst,
          } : {}),
          deliveredCases: resolution.deliveredCases,
          deliveredWeightKg: resolution.deliveredWeightKg,
          unitPrice: item.unitPrice,
          lineTotal: promotion ? 0 : commercialLine?.total ?? line.lineTotal,
        };
        return { companySalesOrderId: item.companySalesOrderId, variantId: item.variantId, data };
      });

      const freight = commercial?.freight;
      const legacyTransport = !accepted && transportAmount.gt(0);
      const freightLine: Prisma.InvoiceLineUncheckedCreateWithoutInvoiceInput | null =
        legacyTransport
          ? {
              descriptionSnapshot: "Transportation / Freight Charge", itemCodeSnapshot: "FREIGHT",
              deliveredCases: 0, unitPrice: transportAmount, lineTotal: transportAmount,
            }
          : freight ? {
              descriptionSnapshot: "Freight", deliveredCases: 0, unitPrice: freight.amount,
              lineTotal: freight.total, sellingEntity: freight.entity, taxableBase: freight.amount,
              gstPercent: freight.gstPercent, taxAmount: freight.gst,
            } : null;

      const groups: {
        document: (typeof order.companySalesOrders)[number] | null;
        lines: Prisma.InvoiceLineUncheckedCreateWithoutInvoiceInput[];
        quote: CommercialSnapshot | null;
      }[] = [];
      if (firmBilling && commercial) {
        for (const document of documents) {
          const companyGoods = goods.filter(line => line.companySalesOrderId === document.id
            && ((line.data.deliveredCases ?? 0) > 0 || Number(line.data.deliveredWeightKg ?? 0) > 0));
          const entity = commercial.entities.find(group => group.entity === document.company);
          if (!entity || entity.gst === null) throw new InvoiceCreationError("firm_billing_allocation_mismatch");
          const companyFreight = freight?.entity === document.company ? freight : null;
          if (!companyGoods.length) {
            if (companyFreight && new Prisma.Decimal(companyFreight.total).gt(0)) {
              throw new InvoiceCreationError("firm_freight_without_delivery");
            }
            continue;
          }
          if (new Prisma.Decimal(entity.total).isZero()) continue;

          const deliveredVariants = new Set(companyGoods.map(line => line.variantId));
          const payableLines = companyGoods.map(line => line.data);
          if (companyFreight && freightLine) payableLines.push(freightLine);
          const quote: CommercialSnapshot = {
            ...commercial,
            lines: commercial.lines.filter(line => line.entity === document.company && deliveredVariants.has(line.variantId)),
            entities: [entity],
            freight: companyFreight,
            total: entity.total,
            ...(commercial.routing ? {
              routing: { ...commercial.routing, lines: commercial.routing.lines.filter(line => line.entity === document.company) },
            } : {}),
          };
          groups.push({ document, lines: payableLines, quote });
        }
      } else {
        const lines = goods.map(line => line.data);
        if (freightLine) lines.push(freightLine);
        groups.push({ document: null, lines, quote: commercial });
      }

      const billable = groups.map(group => {
        const total = group.lines.reduce((sum, line) => sum.plus(line.lineTotal as Prisma.Decimal.Value), new Prisma.Decimal(0));
        const tax = group.lines.reduce((sum, line) => sum.plus((line.taxAmount ?? 0) as Prisma.Decimal.Value), new Prisma.Decimal(0));
        if (group.document && (!total.eq(group.quote!.total) || !tax.eq(group.quote!.entities[0].gst!))) {
          throw new InvoiceCreationError("firm_billing_total_mismatch");
        }
        return { ...group, total, tax };
      }).filter(group => group.total.gt(0));
      if (!billable.length) throw new InvoiceCreationError("invoice_total_must_be_positive");

      const dueDate = addDays(input.occurredAt, await paymentTermDays(tx, order.retailerId));
      for (const item of deliveryItems) {
        const resolution = resolutions.get(item.id)!;
        await tx.orderItem.update({
          where: { id: item.id },
          data: { qtyDelivered: resolution.deliveredCases, weightDelivered: resolution.deliveredWeightKg ?? null },
        });
      }

      const resolvingIds = documents.map(document => document.id);
      const completesOrder = order.companySalesOrders.every(document =>
        document.deliveryResolvedAt || resolvingIds.includes(document.id));
      if (input.proof && completesOrder) {
        const data = {
          podType: input.proof.podType,
          podCapturedAt: input.proof.capturedAt,
          actualWeight: order.items.reduce((sum, item) =>
            sum + (resolutions.get(item.id)?.deliveredWeightKg ?? Number(item.weightDelivered ?? 0)), 0),
        };
        await tx.delivery.upsert({
          where: { orderId: order.id }, update: data, create: { orderId: order.id, ...data },
        });
      }

      let balanceAfter = order.retailer.currentBalance;
      const invoices: InvoiceResult[] = [];
      for (const group of billable) {
        const { document, quote, lines, total, tax } = group;
        let firmData = {};
        if (document) {
          const identity = await nextFirmInvoiceIdentity(tx, document.company, input.occurredAt);
          firmData = {
            companySalesOrderId: document.id,
            sellingEntity: document.company,
            firmInvoiceNumber: identity.firmInvoiceNumber,
            billingSnapshot: asJson({
              seller: firmSeller(document.company),
              buyer: {
                name: order.retailer.name,
                address: [order.retailer.shopAddress, order.retailer.addressLine2, order.retailer.pincode].filter(Boolean).join(", "),
                gstin: order.retailer.gstin,
              },
              delivery: { city: document.deliveryCity, address: document.deliveryAddress },
              financialYear: identity.financialYear,
              documentKind: "firm_billing_record",
              transportation: { amount: transportAmount.toFixed(2), entity: transportAmount.gt(0) ? accepted?.freight?.entity ?? null : null },
            }),
          };
        }
        const invoice = await tx.invoice.create({
          data: {
            ...firmData,
            retailerId: order.retailerId,
            orderId: order.id,
            invoiceDate: input.occurredAt,
            dueDate,
            subtotal: total.minus(tax),
            taxTotal: tax,
            ...(quote ? { commercialSnapshot: asJson(quote) } : {}),
            total,
            outstandingAmount: total,
            idempotencyKey: invoices.length && document ? `firm-delivery:${document.id}` : input.idempotencyKey,
            lines: { create: lines },
          },
        });
        balanceAfter = balanceAfter.plus(total);
        await tx.financialLedgerEntry.create({
          data: {
            retailerId: order.retailerId, invoiceId: invoice.id,
            direction: "debit", kind: "invoice", amount: total, balanceAfter,
            idempotencyKey: `invoice:${invoice.id}`, occurredAt: input.occurredAt,
          },
        });
        const ledger = await tx.ledgerEntry.create({
          data: { retailerId: order.retailerId, orderId: order.id, type: "invoice", amount: total, balanceAfter, dueDate },
        });
        invoices.push(await tx.invoice.update({
          where: { id: invoice.id }, data: { legacyLedgerEntryId: ledger.id }, include: invoiceDetails,
        }));
        // The existing invoice export is an order-wide contract. Firm invoices stay local.
        if (!document) await enqueueInvoice(tx, ledger.id);
      }
      await tx.retailer.update({ where: { id: order.retailerId }, data: { currentBalance: balanceAfter } });
      await recomputeOverdue(tx, order.retailerId, input.occurredAt);
      if (documents.length) {
        const deliveredDocuments = new Set(goods.flatMap(line =>
          line.companySalesOrderId && ((line.data.deliveredCases ?? 0) > 0 || Number(line.data.deliveredWeightKg ?? 0) > 0)
            ? [line.companySalesOrderId] : []));
        for (const document of documents) {
          await tx.companySalesOrder.update({
            where: { id: document.id },
            data: {
              deliveryResolvedAt: input.occurredAt,
              deliveredAt: deliveredDocuments.has(document.id) ? input.occurredAt : null,
              podType: input.proof?.podType,
              podCapturedAt: input.proof?.capturedAt,
            },
          });
        }
      }
      if (completesOrder) {
        await tx.order.update({ where: { id: order.id }, data: { status: "delivered" } });
      }
      await tx.auditEvent.create({
        data: {
          actorStaffId: input.actorStaffId ?? null,
          action: completesOrder ? "delivery.completed" : "company_delivery.completed",
          subjectType: "order",
          subjectId: order.id,
          metadata: {
            invoiceId: invoices[0].id,
            ledgerEntryId: invoices[0].legacyLedgerEntryId,
            invoiceIds: invoices.map(invoice => invoice.id),
            companySalesOrderIds: resolvingIds,
          },
        },
      });

      return {
        ...invoices[0],
        invoices: input.companySalesOrderId ? await findOrderInvoices(tx, order.id) : invoices,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
  );
}

export async function createInvoiceForDelivery(
  input: CreateInvoiceForDeliveryInput
): Promise<DeliveryInvoiceResult> {
  for (let attempt = 1; attempt <= MAX_SERIALIZATION_ATTEMPTS; attempt += 1) {
    try {
      return await createOnce(input);
    } catch (error) {
      if (isPrismaCode(error, "P2002")) {
        const existing = await existingDelivery(prisma, input);
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
