export type EntityAmounts = {
  jainTraders: number;
  padamInternational: number;
  unattributed: number;
};

export type AttributionStatus = "complete" | "contains_unattributed" | "review_required";

export type EntityBreakdown = EntityAmounts & {
  attributionStatus: AttributionStatus;
};

type InvoiceLike = {
  total?: unknown;
  outstandingAmount?: unknown;
  commercialSnapshot?: unknown;
  allocations?: Array<{
    amount?: unknown;
    jainAmount?: unknown;
    padamAmount?: unknown;
    reversals?: unknown[];
  }>;
};

type LedgerEntryLike = {
  kind: string;
  amount?: unknown;
  invoice?: (InvoiceLike & { id?: string }) | null;
  payment?: {
    id?: string;
    amount?: unknown;
    unallocatedAmount?: unknown;
    invoiceScopeId?: string | null;
    confirmedJainAmount?: unknown;
    confirmedPadamAmount?: unknown;
    allocations?: Array<{
      amount?: unknown;
      jainAmount?: unknown;
      padamAmount?: unknown;
    }>;
  } | null;
  creditNote?: { amount?: unknown; invoice?: { commercialSnapshot?: unknown } | null } | null;
  paymentReversal?: {
    amount?: unknown;
    payment?: {
      invoiceScopeId?: string | null;
      confirmedJainAmount?: unknown;
      confirmedPadamAmount?: unknown;
      allocations?: Array<{ jainAmount?: unknown; padamAmount?: unknown }>;
    } | null;
  } | null;
};

function toCents(value: unknown, allowNegative = false): number | null {
  if (value == null || typeof value === "boolean") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || (!allowNegative && amount < 0)) return null;
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(amount * 100 - cents) > 0.0001) return null;
  return cents;
}

function fromCents(value: number): number {
  return value / 100;
}

function amountsFromCents(jain: number, padam: number, unattributed: number): EntityAmounts {
  return {
    jainTraders: fromCents(jain),
    padamInternational: fromCents(padam),
    unattributed: fromCents(unattributed),
  };
}

function fallback(amountCents: number | null, attributionStatus: AttributionStatus): EntityBreakdown {
  return {
    ...amountsFromCents(0, 0, amountCents ?? 0),
    attributionStatus,
  };
}

function commercialTotals(snapshot: unknown, invoiceTotalCents: number) {
  if (!snapshot || typeof snapshot !== "object" || !("entities" in snapshot)) return null;
  const entities = (snapshot as { entities?: unknown }).entities;
  if (!Array.isArray(entities)) return null;

  let jain = 0;
  let padam = 0;
  const seen = new Set<string>();
  for (const item of entities) {
    if (!item || typeof item !== "object") return null;
    const entity = (item as { entity?: unknown }).entity;
    const total = toCents((item as { total?: unknown }).total);
    if (total == null || typeof entity !== "string" || seen.has(entity)) return null;
    seen.add(entity);
    if (entity === "jain_traders") jain += total;
    else if (entity === "padam_international") padam += total;
    else return null;
  }
  if (jain + padam !== invoiceTotalCents) return null;
  return { jain, padam };
}

export function emptyEntityAmounts(): EntityAmounts {
  return { jainTraders: 0, padamInternational: 0, unattributed: 0 };
}

export function addEntityAmounts(left: EntityAmounts, right: EntityAmounts): EntityAmounts {
  return {
    jainTraders: fromCents(Math.round(left.jainTraders * 100) + Math.round(right.jainTraders * 100)),
    padamInternational: fromCents(Math.round(left.padamInternational * 100) + Math.round(right.padamInternational * 100)),
    unattributed: fromCents(Math.round(left.unattributed * 100) + Math.round(right.unattributed * 100)),
  };
}

export function mergeAttributionStatus(
  current: AttributionStatus,
  next: AttributionStatus
): AttributionStatus {
  if (current === "review_required" || next === "review_required") return "review_required";
  if (current === "contains_unattributed" || next === "contains_unattributed") {
    return "contains_unattributed";
  }
  return "complete";
}

export function attributeInvoiceOutstanding(invoice: InvoiceLike): EntityBreakdown {
  const outstanding = toCents(invoice.outstandingAmount);
  if (outstanding == null) return fallback(null, "review_required");
  if (invoice.commercialSnapshot == null) return fallback(outstanding, "contains_unattributed");

  const total = toCents(invoice.total);
  const original = total == null ? null : commercialTotals(invoice.commercialSnapshot, total);
  if (!original || !Array.isArray(invoice.allocations)) {
    return fallback(outstanding, "review_required");
  }

  let allocatedJain = 0;
  let allocatedPadam = 0;
  for (const allocation of invoice.allocations) {
    if (!Array.isArray(allocation.reversals) || allocation.reversals.length > 0) {
      return fallback(outstanding, "review_required");
    }
    const amount = toCents(allocation.amount);
    const jain = toCents(allocation.jainAmount);
    const padam = toCents(allocation.padamAmount);
    if (amount == null || jain == null || padam == null || jain + padam !== amount) {
      return fallback(outstanding, "review_required");
    }
    allocatedJain += jain;
    allocatedPadam += padam;
  }

  const jain = original.jain - allocatedJain;
  const padam = original.padam - allocatedPadam;
  if (jain < 0 || padam < 0 || jain + padam !== outstanding) {
    return fallback(outstanding, "review_required");
  }
  return { ...amountsFromCents(jain, padam, 0), attributionStatus: "complete" };
}

function attributePayment(amountCents: number, payment: NonNullable<LedgerEntryLike["payment"]>): EntityBreakdown {
  const paymentAmount = toCents(payment.amount);
  const unallocated = toCents(payment.unallocatedAmount);
  if (paymentAmount !== amountCents || unallocated == null || !Array.isArray(payment.allocations)) {
    return fallback(amountCents, "review_required");
  }
  if (
    (payment.invoiceScopeId || payment.confirmedJainAmount != null || payment.confirmedPadamAmount != null) &&
    payment.allocations.length === 0
  ) {
    return fallback(amountCents, "review_required");
  }

  let allocated = 0;
  let jain = 0;
  let padam = 0;
  let hasExplicitAttribution = Boolean(payment.invoiceScopeId) ||
    payment.confirmedJainAmount != null || payment.confirmedPadamAmount != null;

  for (const allocation of payment.allocations) {
    const allocationAmount = toCents(allocation.amount);
    if (allocationAmount == null) return fallback(amountCents, "review_required");
    allocated += allocationAmount;

    const hasJain = allocation.jainAmount != null;
    const hasPadam = allocation.padamAmount != null;
    hasExplicitAttribution ||= hasJain || hasPadam;
    if (!hasJain && !hasPadam) continue;

    const allocationJain = toCents(allocation.jainAmount);
    const allocationPadam = toCents(allocation.padamAmount);
    if (allocationJain == null || allocationPadam == null || allocationJain + allocationPadam !== allocationAmount) {
      return fallback(amountCents, "review_required");
    }
    jain += allocationJain;
    padam += allocationPadam;
  }

  if (allocated + unallocated !== paymentAmount) return fallback(amountCents, "review_required");
  if (!hasExplicitAttribution) return fallback(amountCents, "contains_unattributed");
  if (payment.allocations.some((allocation) => allocation.jainAmount == null || allocation.padamAmount == null)) {
    return fallback(amountCents, "review_required");
  }
  const hasConfirmedJain = payment.confirmedJainAmount != null;
  const hasConfirmedPadam = payment.confirmedPadamAmount != null;
  if (hasConfirmedJain || hasConfirmedPadam) {
    const confirmedJain = toCents(payment.confirmedJainAmount);
    const confirmedPadam = toCents(payment.confirmedPadamAmount);
    if (confirmedJain == null || confirmedPadam == null || confirmedJain !== jain || confirmedPadam !== padam) {
      return fallback(amountCents, "review_required");
    }
  }

  return {
    ...amountsFromCents(jain, padam, unallocated),
    attributionStatus: unallocated > 0 ? "contains_unattributed" : "complete",
  };
}

export function attributeLedgerEntry(entry: LedgerEntryLike): EntityBreakdown {
  const amount = toCents(entry.amount);
  if (amount == null) return fallback(null, "review_required");

  if (entry.kind === "invoice") {
    if (!entry.invoice) return fallback(amount, "review_required");
    if (entry.invoice.commercialSnapshot == null) return fallback(amount, "contains_unattributed");
    const invoiceTotal = toCents(entry.invoice.total);
    const totals = invoiceTotal == null ? null : commercialTotals(entry.invoice.commercialSnapshot, invoiceTotal);
    if (!totals || invoiceTotal !== amount) return fallback(amount, "review_required");
    return { ...amountsFromCents(totals.jain, totals.padam, 0), attributionStatus: "complete" };
  }

  if (entry.kind === "payment") {
    if (!entry.payment) return fallback(amount, "review_required");
    return attributePayment(amount, entry.payment);
  }

  if (entry.kind === "credit_note") {
    if (!entry.creditNote) return fallback(amount, "review_required");
    if (toCents(entry.creditNote.amount) !== amount) return fallback(amount, "review_required");
    if (entry.creditNote.invoice?.commercialSnapshot != null) return fallback(amount, "review_required");
    return fallback(amount, "contains_unattributed");
  }

  if (entry.kind === "payment_reversal") {
    if (!entry.paymentReversal?.payment) return fallback(amount, "review_required");
    if (toCents(entry.paymentReversal.amount) !== amount) return fallback(amount, "review_required");
    const payment = entry.paymentReversal.payment;
    if (
      payment.invoiceScopeId || payment.confirmedJainAmount != null || payment.confirmedPadamAmount != null ||
      payment.allocations?.some((allocation) => allocation.jainAmount != null || allocation.padamAmount != null)
    ) {
      return fallback(amount, "review_required");
    }
    return fallback(amount, "contains_unattributed");
  }

  return fallback(amount, "review_required");
}
