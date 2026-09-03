import type { PodType, Prisma } from "@prisma/client";

export interface DeliveryResolutionInput {
  orderItemId: string;
  deliveredCases: number;
  deliveredWeightKg?: number;
}

export interface CreateInvoiceForDeliveryInput {
  orderId: string;
  actorStaffId?: string;
  lines: DeliveryResolutionInput[];
  occurredAt: Date;
  idempotencyKey: string;
  proof?: { podType: PodType; capturedAt: Date };
}

export type InvoiceResult = Prisma.InvoiceGetPayload<{
  include: { lines: true; ledgerEntry: true; legacyLedgerEntry: true };
}>;
