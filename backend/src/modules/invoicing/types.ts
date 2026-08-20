import type { Prisma } from "@prisma/client";

export interface DeliveryResolutionInput {
  orderItemId: string;
  deliveredCases: number;
  deliveredWeightKg?: number;
}

export interface CreateInvoiceForDeliveryInput {
  orderId: string;
  lines: DeliveryResolutionInput[];
  occurredAt: Date;
  idempotencyKey: string;
}

export type InvoiceResult = Prisma.InvoiceGetPayload<{
  include: { lines: true; ledgerEntry: true };
}>;
