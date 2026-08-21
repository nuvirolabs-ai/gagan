import { Prisma, RecoveryLetterDeliveryChannel } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ObjectStorageError, type ObjectStorage } from "../../platform/storage/objectStorage";
import { getObjectStorage } from "../../platform/storage/storageRuntime";
import { renderRecoveryLetterPdf } from "./recoveryLetterPdf";
import { RecoveryServiceError } from "./recoveryService";

const VIEW = "recovery.view";
const MANAGE = "staff.manage";
const LEGAL = "legal.decide";
const SIGNATORIES: [string, string, string] = ["Accounts", "Credit", "Founder/Director"];

function can(permissions: string[], required: string) {
  return permissions.includes(required) || permissions.includes(MANAGE);
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export interface RecoveryLegalActor {
  actorStaffId: string;
  actorPermissions: string[];
}

export class RecoveryLegalService {
  private readonly storage: ObjectStorage;

  constructor(storage?: ObjectStorage) {
    this.storage = storage ?? getObjectStorage();
  }

  async createLetter(input: RecoveryLegalActor & { caseId: string; idempotencyKey: string; sentAt?: Date }) {
    this.assertPermission(input.actorPermissions, MANAGE);
    if (input.idempotencyKey.trim().length < 8) throw new RecoveryServiceError("invalid_idempotency_key", 400);
    const existing = await prisma.recoveryLetter.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.caseId !== input.caseId) throw new RecoveryServiceError("idempotency_key_conflict", 409);
      return this.publicLetter(existing);
    }
    const recoveryCase = await prisma.recoveryCase.findUnique({
      where: { id: input.caseId },
      include: { invoice: { select: { id: true, invoiceNumber: true, outstandingAmount: true, currency: true } }, retailer: { select: { name: true, shopAddress: true } } },
    });
    if (!recoveryCase) throw new RecoveryServiceError("recovery_case_not_found", 404);
    if (recoveryCase.status !== "open") throw new RecoveryServiceError("recovery_case_closed", 409);
    const sentAt = input.sentAt ?? new Date();
    const responseDueAt = new Date(sentAt.getTime() + 7 * 86_400_000);
    const amount = Number(recoveryCase.invoice.outstandingAmount);
    const body = renderRecoveryLetterPdf({
      retailerName: recoveryCase.retailer.name,
      retailerAddress: recoveryCase.retailer.shopAddress,
      invoiceNumber: recoveryCase.invoice.invoiceNumber,
      outstandingAmount: amount,
      currency: recoveryCase.invoice.currency,
      sentAt,
      responseDueAt,
      signatories: SIGNATORIES,
    });
    let stored;
    try {
      stored = await this.storage.put({ purpose: "recovery_letter", contentType: "application/pdf", body });
    } catch (error) {
      if (error instanceof ObjectStorageError) throw error;
      throw new RecoveryServiceError("letter_storage_failed", 503);
    }
    try {
      const letter = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "RecoveryCase" WHERE "id" = ${input.caseId} FOR UPDATE`;
        const current = await tx.recoveryCase.findUnique({ where: { id: input.caseId }, select: { status: true } });
        if (!current) throw new RecoveryServiceError("recovery_case_not_found", 404);
        if (current.status !== "open") throw new RecoveryServiceError("recovery_case_closed", 409);
        const created = await tx.recoveryLetter.create({
          data: {
            caseId: input.caseId,
            objectKey: stored.objectKey,
            checksum: stored.checksum,
            contentType: stored.contentType,
            sizeBytes: stored.sizeBytes,
            invoiceNumber: recoveryCase.invoice.invoiceNumber,
            amount,
            currency: recoveryCase.invoice.currency,
            sentAt,
            responseDueAt,
            signatories: json(SIGNATORIES),
            idempotencyKey: input.idempotencyKey,
          },
        });
        await tx.auditEvent.create({ data: { actorStaffId: input.actorStaffId, action: "recovery.letter_created", subjectType: "recovery_letter", subjectId: created.id, metadata: json({ caseId: input.caseId, invoiceNumber: created.invoiceNumber }) } });
        return created;
      });
      return this.publicLetter(letter);
    } catch (error) {
      await this.storage.delete(stored.objectKey).catch(() => undefined);
      if (error instanceof RecoveryServiceError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const retry = await prisma.recoveryLetter.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (retry && retry.caseId === input.caseId) return this.publicLetter(retry);
        throw new RecoveryServiceError("idempotency_key_conflict", 409);
      }
      throw error;
    }
  }

  async getLetter(id: string, permissions: string[]) {
    this.assertPermission(permissions, VIEW);
    const letter = await prisma.recoveryLetter.findUnique({ where: { id } });
    if (!letter) throw new RecoveryServiceError("recovery_letter_not_found", 404);
    return this.publicLetter(letter);
  }

  async recordDelivery(letterId: string, input: RecoveryLegalActor & { channel: RecoveryLetterDeliveryChannel; deliveredAt?: Date; externalReference?: string; idempotencyKey: string }) {
    this.assertPermission(input.actorPermissions, MANAGE);
    if (input.idempotencyKey.trim().length < 8) throw new RecoveryServiceError("invalid_idempotency_key", 400);
    const existing = await prisma.recoveryLetterDelivery.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.letterId !== letterId) throw new RecoveryServiceError("idempotency_key_conflict", 409);
      return existing;
    }
    const letter = await prisma.recoveryLetter.findUnique({ where: { id: letterId }, select: { id: true } });
    if (!letter) throw new RecoveryServiceError("recovery_letter_not_found", 404);
    return prisma.$transaction(async (tx) => {
      const delivery = await tx.recoveryLetterDelivery.create({ data: { letterId, channel: input.channel, deliveredAt: input.deliveredAt, externalReference: input.externalReference?.trim() || undefined, actorStaffId: input.actorStaffId, idempotencyKey: input.idempotencyKey } });
      await tx.auditEvent.create({ data: { actorStaffId: input.actorStaffId, action: "recovery.letter_delivered", subjectType: "recovery_letter", subjectId: letterId, metadata: json({ channel: input.channel, deliveryId: delivery.id }) } });
      return delivery;
    });
  }

  async createLegalCase(input: RecoveryLegalActor & { caseId: string; letterId: string; reason: string; idempotencyKey: string }) {
    this.assertPermission(input.actorPermissions, MANAGE);
    const reason = input.reason.trim();
    if (reason.length < 5) throw new RecoveryServiceError("legal_reason_required", 400);
    if (input.idempotencyKey.trim().length < 8) throw new RecoveryServiceError("invalid_idempotency_key", 400);
    const existing = await prisma.legalCase.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.recoveryCaseId !== input.caseId) throw new RecoveryServiceError("idempotency_key_conflict", 409);
      return existing;
    }
    const recoveryCase = await prisma.recoveryCase.findUnique({ where: { id: input.caseId }, select: { id: true, status: true } });
    if (!recoveryCase) throw new RecoveryServiceError("recovery_case_not_found", 404);
    if (recoveryCase.status !== "open") throw new RecoveryServiceError("recovery_case_closed", 409);
    const letter = await prisma.recoveryLetter.findUnique({ where: { id: input.letterId }, select: { id: true, caseId: true } });
    if (!letter || letter.caseId !== input.caseId) throw new RecoveryServiceError("recovery_letter_mismatch", 409);
    try {
      return await prisma.$transaction(async (tx) => {
        const created = await tx.legalCase.create({ data: { recoveryCaseId: input.caseId, letterId: input.letterId, reason, createdByStaffId: input.actorStaffId, idempotencyKey: input.idempotencyKey } });
        await tx.auditEvent.create({ data: { actorStaffId: input.actorStaffId, action: "recovery.legal_case_created", subjectType: "legal_case", subjectId: created.id, metadata: json({ caseId: input.caseId, letterId: input.letterId }) } });
        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existingCase = await prisma.legalCase.findUnique({ where: { recoveryCaseId: input.caseId } });
        if (existingCase) return existingCase;
      }
      throw error;
    }
  }

  async decide(id: string, input: RecoveryLegalActor & { type: "settlement" | "write_off"; amount: number; reason: string; idempotencyKey: string }) {
    this.assertPermission(input.actorPermissions, LEGAL);
    const reason = input.reason.trim();
    if (reason.length < 5) throw new RecoveryServiceError("legal_decision_reason_required", 400);
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new RecoveryServiceError("invalid_legal_decision_amount", 400);
    if (input.idempotencyKey.trim().length < 8) throw new RecoveryServiceError("invalid_idempotency_key", 400);
    const existingDecision = await prisma.legalDecision.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { legalCase: true } });
    if (existingDecision) {
      if (existingDecision.legalCaseId !== id) throw new RecoveryServiceError("idempotency_key_conflict", 409);
      return existingDecision.legalCase;
    }
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "LegalCase" WHERE "id" = ${id} FOR UPDATE`;
      const legalCase = await tx.legalCase.findUnique({ where: { id }, include: { recoveryCase: { include: { invoice: { select: { outstandingAmount: true } } } } } });
      if (!legalCase) throw new RecoveryServiceError("legal_case_not_found", 404);
      if (legalCase.status !== "open") throw new RecoveryServiceError("legal_case_decided", 409);
      if (input.amount > Number(legalCase.recoveryCase.invoice.outstandingAmount)) throw new RecoveryServiceError("legal_decision_exceeds_outstanding", 400);
      const status = input.type === "settlement" ? "settled" : "written_off";
      await tx.legalDecision.create({ data: { legalCaseId: id, type: input.type, amount: input.amount, reason, decidedByStaffId: input.actorStaffId, idempotencyKey: input.idempotencyKey } });
      const updated = await tx.legalCase.update({ where: { id }, data: { status } });
      await tx.auditEvent.create({ data: { actorStaffId: input.actorStaffId, action: `recovery.legal_${input.type}`, subjectType: "legal_case", subjectId: id, metadata: json({ amount: input.amount, reason }) } });
      return updated;
    });
  }

  private async publicLetter(letter: { id: string; objectKey: string; checksum: string; contentType: string; sizeBytes: number; invoiceNumber: number; amount: Prisma.Decimal; currency: string; sentAt: Date; responseDueAt: Date; signatories: Prisma.JsonValue }) {
    return { ...letter, signedUrl: await this.storage.signedReadUrl(letter.objectKey, 300) };
  }

  private assertPermission(permissions: string[], required: string) {
    if (!can(permissions, required)) throw new RecoveryServiceError("permission_required", 403, { permission: required });
  }
}
