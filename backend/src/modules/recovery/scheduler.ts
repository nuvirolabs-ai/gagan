import { Prisma, RecoveryActionType } from "@prisma/client";
import { prisma } from "../../lib/prisma";

const DAY = 86_400_000;

type RecoveryBandConfig = {
  type: RecoveryActionType;
  thresholdDays: number;
  role: string;
};

export const RECOVERY_BANDS: readonly RecoveryBandConfig[] = [
  { type: RecoveryActionType.day_35_sales_call, thresholdDays: 35, role: "salesperson" },
  { type: RecoveryActionType.day_40_joint_call, thresholdDays: 40, role: "salesperson" },
  { type: RecoveryActionType.days_45_48_collection_visit, thresholdDays: 45, role: "field_collection" },
  { type: RecoveryActionType.days_49_52_accounts_escalation, thresholdDays: 49, role: "accounts" },
  { type: RecoveryActionType.days_53_56_credit_review, thresholdDays: 53, role: "credit_team" },
  { type: RecoveryActionType.days_60_69_hold_escalation, thresholdDays: 60, role: "credit_team" },
  { type: RecoveryActionType.days_70_89_legal_preparation, thresholdDays: 70, role: "legal" },
  { type: RecoveryActionType.day_90_legal_referral, thresholdDays: 90, role: "legal" },
];

export function recoveryBandFor(ageDays: number): RecoveryActionType | null {
  const bands = RECOVERY_BANDS.filter((band) => ageDays >= band.thresholdDays);
  return bands.at(-1)?.type ?? null;
}

export function recoveryBandsThrough(ageDays: number) {
  return RECOVERY_BANDS.filter((band) => ageDays >= band.thresholdDays);
}

export function recoveryActionKey(invoiceId: string, band: RecoveryActionType) {
  return `${invoiceId}:${band}`;
}

export function invoiceAgeDays(invoiceDate: Date, now: Date) {
  return Math.max(0, Math.floor((now.getTime() - invoiceDate.getTime()) / DAY));
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export interface RecoveryScheduleResult {
  considered: number;
  casesCreated: number;
  actionsCreated: number;
}

/**
 * Creates every missed band up to the invoice's current age. The unique action
 * key makes retries and catch-up runs safe when more than one worker fires.
 */
export async function scheduleRecoveryActions({ now = new Date() } = {}): Promise<RecoveryScheduleResult> {
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ["open", "partially_paid"] },
      outstandingAmount: { gt: 0 },
      invoiceDate: { lte: now },
    },
    select: { id: true, retailerId: true, invoiceDate: true },
    orderBy: { invoiceDate: "asc" },
  });
  let casesCreated = 0;
  let actionsCreated = 0;

  for (const invoice of invoices) {
    const ageDays = invoiceAgeDays(invoice.invoiceDate, now);
    const bands = recoveryBandsThrough(ageDays);
    if (bands.length === 0) continue;

    const result = await prisma.$transaction(async (tx) => {
      const existingCase = await tx.recoveryCase.findUnique({ where: { invoiceId: invoice.id }, select: { id: true } });
      const recoveryCase = await tx.recoveryCase.upsert({
        where: { invoiceId: invoice.id },
        update: {},
        create: { invoiceId: invoice.id, retailerId: invoice.retailerId },
      });
      let created = 0;
      for (const band of bands) {
        const key = recoveryActionKey(invoice.id, band.type);
        const existingAction = await tx.recoveryAction.findUnique({ where: { idempotencyKey: key }, select: { id: true } });
        await tx.recoveryAction.upsert({
          where: { idempotencyKey: key },
          update: {},
          create: {
            caseId: recoveryCase.id,
            type: band.type,
            role: band.role,
            dueAt: new Date(invoice.invoiceDate.getTime() + band.thresholdDays * DAY),
            idempotencyKey: key,
            details: json({ invoiceAgeDays: ageDays, thresholdDays: band.thresholdDays }),
          },
        });
        if (!existingAction) created++;
      }
      return { caseCreated: !existingCase, actionsCreated: created };
    });
    if (result.caseCreated) casesCreated++;
    actionsCreated += result.actionsCreated;
  }

  return { considered: invoices.length, casesCreated, actionsCreated };
}
