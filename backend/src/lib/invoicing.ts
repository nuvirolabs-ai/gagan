import { Prisma } from "@prisma/client";

export interface InvoiceLine {
  orderItemId: string;
  basis: "delivered_weight" | "delivered_cases" | "ordered_cases";
  pricePerKg: number;
  billedWeightKg: number | null;
  billedCases: number | null;
  lineTotal: number;
}

export interface InvoiceBreakdown {
  lines: InvoiceLine[];
  total: number;
}

type ItemForInvoice = {
  id: string;
  unitPrice: Prisma.Decimal;
  qtyOrdered: number;
  qtyDelivered: number | null;
  weightDelivered: Prisma.Decimal | null;
  caseWeightKgSnapshot?: Prisma.Decimal | null;
  variant: { unitsPerCase: number; unitWeightKg: Prisma.Decimal };
};

function round2(n: Prisma.Decimal): number {
  return n.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Commodities ship short or long, so the invoice is priced off what actually
 * arrived rather than what was ordered (spec §5.6).
 *
 * Preference order per line:
 *   1. actual delivered weight  -> price/kg x weight
 *   2. delivered case count     -> case price x cases
 *   3. ordered case count       -> case price x cases (nothing was recorded)
 */
export function buildInvoice(items: ItemForInvoice[]): InvoiceBreakdown {
  const lines: InvoiceLine[] = items.map((item) => {
    const unitPrice = new Prisma.Decimal(item.unitPrice);
    // Legacy null rows retain the explicit pre-snapshot policy until invoicing;
    // accepted new lines never consult mutable master conversion again.
    const caseWeightKg = item.caseWeightKgSnapshot != null
      ? new Prisma.Decimal(item.caseWeightKgSnapshot)
      : item.variant.unitWeightKg.mul(item.variant.unitsPerCase);
    const pricePerKg = caseWeightKg.gt(0) ? unitPrice.div(caseWeightKg) : new Prisma.Decimal(0);

    if (item.weightDelivered != null && caseWeightKg.gt(0)) {
      const weight = Number(item.weightDelivered);
      return {
        orderItemId: item.id,
        basis: "delivered_weight",
        pricePerKg: round2(pricePerKg),
        billedWeightKg: weight,
        billedCases: null,
        lineTotal: round2(pricePerKg.mul(item.weightDelivered)),
      };
    }

    if (item.qtyDelivered != null) {
      return {
        orderItemId: item.id,
        basis: "delivered_cases",
        pricePerKg: round2(pricePerKg),
        billedWeightKg: null,
        billedCases: item.qtyDelivered,
        lineTotal: round2(unitPrice.mul(item.qtyDelivered)),
      };
    }

    return {
      orderItemId: item.id,
      basis: "ordered_cases",
      pricePerKg: round2(pricePerKg),
      billedWeightKg: null,
      billedCases: item.qtyOrdered,
      lineTotal: round2(unitPrice.mul(item.qtyOrdered)),
    };
  });

  return { lines, total: round2(lines.reduce((sum, l) => sum.add(l.lineTotal), new Prisma.Decimal(0))) };
}
