export const firmNames = {
  jain_traders: "Jain Traders",
  padam_international: "Padam International",
};

export type BillingFirm = keyof typeof firmNames;

export type BillingInvoice = {
  id: string;
  invoiceNumber: number;
  firmInvoiceNumber?: string | null;
  sellingEntity?: BillingFirm | null;
  total: number | string;
  outstandingAmount: number | string;
  status?: string;
};

export function billingInvoiceReference(invoice: Pick<BillingInvoice, "invoiceNumber" | "firmInvoiceNumber">) {
  return invoice.firmInvoiceNumber || `INV-${invoice.invoiceNumber}`;
}

export function billingInvoiceLabel(invoice: Pick<BillingInvoice, "invoiceNumber" | "firmInvoiceNumber" | "sellingEntity">) {
  return invoice.sellingEntity
    ? `${firmNames[invoice.sellingEntity]} · ${billingInvoiceReference(invoice)}`
    : billingInvoiceReference(invoice);
}

export type DeliveryCompany = {
  id: string;
  company: BillingFirm;
  reference: string;
  routeId: string | null;
  deliveryResolvedAt?: string | null;
};

export function deliveryScope(documents: DeliveryCompany[], selection: string) {
  const pending = documents.filter(document => !document.deliveryResolvedAt);
  const canDeliverTogether = pending.length > 1
    && pending.length === documents.length
    && new Set(pending.map(document => document.routeId)).size === 1;
  const company = pending.length === 1 ? pending[0] : pending.find(document => document.id === selection);
  return {
    pending,
    company,
    canDeliverTogether,
    chosen: documents.length === 0 || Boolean(company) || (canDeliverTogether && selection === "all"),
  };
}

export function acceptedFreight(
  snapshot: { quote?: { freight?: unknown }; freight?: unknown } | null | undefined,
): { entity: BillingFirm; gstPercent: string } | null {
  const value = snapshot?.quote?.freight ?? snapshot?.freight;
  if (!value || typeof value !== "object") return null;
  const freight = value as { entity?: unknown; gstPercent?: unknown };
  if ((freight.entity !== "jain_traders" && freight.entity !== "padam_international") || freight.gstPercent == null) return null;
  return { entity: freight.entity, gstPercent: String(freight.gstPercent) };
}
