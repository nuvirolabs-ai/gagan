import type { PodType, Prisma, SalesOrderCompany } from "@prisma/client";

export interface DeliveryResolutionInput {
  orderItemId: string;
  deliveredCases: number;
  deliveredWeightKg?: number;
}

export interface CreateInvoiceForDeliveryInput {
  orderId: string;
  companySalesOrderId?: string;
  actorStaffId?: string;
  lines: DeliveryResolutionInput[];
  occurredAt: Date;
  idempotencyKey: string;
  proof?: { podType: PodType; capturedAt: Date };
  transportationAmount?: number;
  transportationEntity?: SalesOrderCompany;
}

export type InvoiceResult = Prisma.InvoiceGetPayload<{
  include: { lines: true; ledgerEntry: true; legacyLedgerEntry: true };
}>;

export type DeliveryInvoiceResult = InvoiceResult & { invoices: InvoiceResult[] };
