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
  variant: { unitsPerCase: number; unitWeightKg: Prisma.Decimal };
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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
    const unitPrice = Number(item.unitPrice);
    const caseWeightKg = Number(item.variant.unitWeightKg) * item.variant.unitsPerCase;
    const pricePerKg = caseWeightKg > 0 ? unitPrice / caseWeightKg : 0;

    if (item.weightDelivered != null && caseWeightKg > 0) {
      const weight = Number(item.weightDelivered);
      return {
        orderItemId: item.id,
        basis: "delivered_weight",
        pricePerKg: round2(pricePerKg),
        billedWeightKg: weight,
        billedCases: null,
        lineTotal: round2(pricePerKg * weight),
      };
    }

    if (item.qtyDelivered != null) {
      return {
        orderItemId: item.id,
        basis: "delivered_cases",
        pricePerKg: round2(pricePerKg),
        billedWeightKg: null,
        billedCases: item.qtyDelivered,
        lineTotal: round2(unitPrice * item.qtyDelivered),
      };
    }

    return {
      orderItemId: item.id,
      basis: "ordered_cases",
      pricePerKg: round2(pricePerKg),
      billedWeightKg: null,
      billedCases: item.qtyOrdered,
      lineTotal: round2(unitPrice * item.qtyOrdered),
    };
  });

  return { lines, total: round2(lines.reduce((sum, l) => sum + l.lineTotal, 0)) };
}
