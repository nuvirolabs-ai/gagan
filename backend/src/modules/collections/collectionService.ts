import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { settleSucceededPayment, type PaymentSettlementResult } from "../payments/paymentService";
import { getObjectStorage } from "../../platform/storage/storageRuntime";
import { ObjectStorageError, type ObjectStorage } from "../../platform/storage/objectStorage";

export class CollectionServiceError extends Error {
  constructor(public readonly code: string, public readonly status = 409, public readonly details?: unknown) {
    super(code);
  }
}

type CollectionPermission = "collection.submit" | "collection.confirm";

export interface CollectionEvidenceInput {
  contentType: string;
  bodyBase64: string;
  checksum?: string;
}

interface StoredCollectionEvidence {
  objectKey: string;
  checksum: string;
  contentType: string;
  sizeBytes: number;
}

export interface CollectionSubmitInput {
  retailerId: string;
  collectorStaffId: string;
  actorPermissions: string[];
  amount: number;
  method: "cash" | "cheque" | "neft" | "upi";
  reference?: string;
  notes?: string;
  idempotencyKey: string;
  evidence?: CollectionEvidenceInput;
}

export interface CollectionConfirmInput {
  actorStaffId: string;
  actorPermissions: string[];
  stepUpUntil?: Date;
}

export interface CollectionRejectInput extends CollectionConfirmInput {
  reason: string;
}

export interface CollectionAssignmentInput {
  actorPermissions: string[];
  collectorStaffId: string;
  retailerId: string;
}

export interface CollectionConfirmationResult {
  submissionId: string;
  paymentId: string;
  settlement: PaymentSettlementResult;
  idempotent: boolean;
}

const submissionInclude = {
  evidence: { orderBy: { createdAt: "asc" as const } },
  retailer: { select: { id: true, name: true, phone: true } },
} as const;

export interface CollectionServiceOptions {
  storage?: ObjectStorage;
}

function hasPermission(permissions: string[], permission: CollectionPermission) {
  return permissions.includes(permission);
}

export class CollectionService {
  private readonly storage?: ObjectStorage;

  constructor(options: CollectionServiceOptions = {}) {
    this.storage = options.storage;
  }

  async submit(input: CollectionSubmitInput) {
    if (!hasPermission(input.actorPermissions, "collection.submit")) {
      throw new CollectionServiceError("permission_required", 403, { permission: "collection.submit" });
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new CollectionServiceError("invalid_amount", 400);
    }
    if (input.idempotencyKey.trim().length < 8) {
      throw new CollectionServiceError("invalid_idempotency_key", 400);
    }
    if (!input.reference?.trim() && !input.evidence) {
      throw new CollectionServiceError("evidence_required", 400);
    }
    const existing = await prisma.collectionSubmission.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: submissionInclude,
    });
    if (existing) {
      if (
        existing.retailerId !== input.retailerId ||
        Number(existing.amount) !== input.amount ||
        existing.collectorStaffId !== input.collectorStaffId
      ) {
        throw new CollectionServiceError("idempotency_key_conflict", 409);
      }
      return this.publicSubmission(existing);
    }

    const retailer = await prisma.retailer.findUnique({
      where: { id: input.retailerId },
      select: { id: true },
    });
    if (!retailer) throw new CollectionServiceError("retailer_not_found", 404);
    const assignment = await prisma.collectionAssignment.findFirst({
      where: { collectorStaffId: input.collectorStaffId, retailerId: input.retailerId, active: true },
    });
    if (!assignment) throw new CollectionServiceError("collection_assignment_required", 403);

    let stored: StoredCollectionEvidence | undefined;
    try {
      if (input.evidence) {
        stored = await this.putEvidence(input.evidence);
      }
      const submission = await prisma.collectionSubmission.create({
        data: {
          retailerId: input.retailerId,
          collectorStaffId: input.collectorStaffId,
          amount: input.amount,
          method: input.method,
          reference: input.reference?.trim() || undefined,
          notes: input.notes?.trim() || undefined,
          idempotencyKey: input.idempotencyKey,
          evidence: stored ? { create: stored } : undefined,
        },
        include: submissionInclude,
      });
      return this.publicSubmission(submission);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const retry = await prisma.collectionSubmission.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: submissionInclude,
        });
        if (retry) {
          if (stored) await this.storageAdapter().delete(stored.objectKey).catch(() => undefined);
          return this.publicSubmission(retry);
        }
      }
      if (stored) await this.storageAdapter().delete(stored.objectKey).catch(() => undefined);
      if (error instanceof ObjectStorageError) {
        throw new CollectionServiceError(error.code, 400);
      }
      throw error;
    }
  }

  async listPending(actorPermissions: string[]) {
    if (!hasPermission(actorPermissions, "collection.confirm")) {
      throw new CollectionServiceError("permission_required", 403, { permission: "collection.confirm" });
    }
    const submissions = await prisma.collectionSubmission.findMany({
      where: { status: { in: ["pending", "confirming"] } },
      include: submissionInclude,
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
    });
    return Promise.all(submissions.map((submission) => this.publicSubmission(submission)));
  }

  async assignedRetailers(collectorStaffId: string, actorPermissions: string[]) {
    if (!hasPermission(actorPermissions, "collection.submit")) {
      throw new CollectionServiceError("permission_required", 403, { permission: "collection.submit" });
    }
    return prisma.collectionAssignment.findMany({
      where: { collectorStaffId, active: true },
      include: { retailer: { select: { id: true, name: true, phone: true, shopAddress: true } } },
      orderBy: { assignedAt: "asc" },
    });
  }

  async assign(input: CollectionAssignmentInput) {
    if (!input.actorPermissions.includes("staff.manage")) {
      throw new CollectionServiceError("permission_required", 403, { permission: "staff.manage" });
    }
    const [staff, retailer] = await Promise.all([
      prisma.staffUser.findFirst({
        where: {
          id: input.collectorStaffId,
          status: "active",
          roles: { some: { role: { permissions: { some: { permission: { name: "collection.submit" } } } } } },
        },
        select: { id: true },
      }),
      prisma.retailer.findUnique({ where: { id: input.retailerId }, select: { id: true } }),
    ]);
    if (!staff) throw new CollectionServiceError("collector_not_found", 404);
    if (!retailer) throw new CollectionServiceError("retailer_not_found", 404);
    return prisma.collectionAssignment.upsert({
      where: { collectorStaffId_retailerId: { collectorStaffId: input.collectorStaffId, retailerId: input.retailerId } },
      update: { active: true, endedAt: null },
      create: { collectorStaffId: input.collectorStaffId, retailerId: input.retailerId },
      include: { retailer: { select: { id: true, name: true, phone: true, shopAddress: true } } },
    });
  }

  async unassign(id: string, actorPermissions: string[]) {
    if (!actorPermissions.includes("staff.manage")) {
      throw new CollectionServiceError("permission_required", 403, { permission: "staff.manage" });
    }
    const assignment = await prisma.collectionAssignment.updateMany({
      where: { id, active: true },
      data: { active: false, endedAt: new Date() },
    });
    if (assignment.count === 0) throw new CollectionServiceError("assignment_not_found", 404);
    return prisma.collectionAssignment.findUnique({ where: { id } });
  }

  async detail(id: string, actorPermissions: string[]) {
    if (!hasPermission(actorPermissions, "collection.confirm")) {
      throw new CollectionServiceError("permission_required", 403, { permission: "collection.confirm" });
    }
    const submission = await prisma.collectionSubmission.findUnique({
      where: { id },
      include: { ...submissionInclude, payment: true },
    });
    if (!submission) throw new CollectionServiceError("submission_not_found", 404);
    return this.publicSubmission(submission);
  }

  async confirm(id: string, input: CollectionConfirmInput): Promise<CollectionConfirmationResult> {
    if (!hasPermission(input.actorPermissions, "collection.confirm")) {
      throw new CollectionServiceError("permission_required", 403, { permission: "collection.confirm" });
    }
    if (!input.stepUpUntil || input.stepUpUntil <= new Date()) {
      throw new CollectionServiceError("step_up_required", 403);
    }

    const prepared = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "CollectionSubmission" WHERE "id" = ${id} FOR UPDATE`;
      const submission = await tx.collectionSubmission.findUnique({ where: { id } });
      if (!submission) throw new CollectionServiceError("submission_not_found", 404);
      if (submission.status === "rejected") throw new CollectionServiceError("submission_rejected", 409);
      if (submission.status === "confirmed" && submission.paymentId) {
        return { paymentId: submission.paymentId, idempotent: true };
      }

      if (submission.status === "confirming" && submission.paymentId) {
        return { paymentId: submission.paymentId, idempotent: true };
      }

      await tx.$queryRaw`SELECT "id" FROM "Retailer" WHERE "id" = ${submission.retailerId} FOR UPDATE`;
      const retailer = await tx.retailer.findUnique({ where: { id: submission.retailerId } });
      if (!retailer) throw new CollectionServiceError("retailer_not_found", 404);
      if (Number(submission.amount) > Number(retailer.currentBalance)) {
        throw new CollectionServiceError("amount_exceeds_outstanding", 409);
      }

      const payment = await tx.payment.create({
        data: {
          retailerId: submission.retailerId,
          amount: submission.amount,
          status: "pending",
          channel: "manual",
          provider: "field_collection",
          providerRef: `collection:${submission.id}`,
        },
      });
      await tx.collectionSubmission.update({
        where: { id: submission.id },
        data: { status: "confirming", paymentId: payment.id },
      });
      await tx.auditEvent.create({
        data: {
          actorStaffId: input.actorStaffId,
          action: "collection.confirmation_started",
          subjectType: "collection_submission",
          subjectId: submission.id,
          metadata: { paymentId: payment.id },
        },
      });
      return { paymentId: payment.id, idempotent: false };
    });

    let settlement: PaymentSettlementResult;
    try {
      settlement = await settleSucceededPayment({
        paymentId: prepared.paymentId,
        occurredAt: new Date(),
      });
    } catch (error) {
      await prisma.collectionSubmission.updateMany({
        where: { id, status: "confirming" },
        data: { status: "pending", rejectionReason: "settlement_retry_required" },
      });
      throw error;
    }

    await prisma.collectionSubmission.updateMany({
      where: { id, status: "confirming" },
      data: {
        status: "confirmed",
        confirmedByStaffId: input.actorStaffId,
        confirmedAt: new Date(),
        rejectionReason: null,
      },
    });
    return {
      submissionId: id,
      paymentId: prepared.paymentId,
      settlement,
      idempotent: prepared.idempotent || settlement.idempotent,
    };
  }

  async reject(id: string, input: CollectionRejectInput) {
    if (!hasPermission(input.actorPermissions, "collection.confirm")) {
      throw new CollectionServiceError("permission_required", 403, { permission: "collection.confirm" });
    }
    if (!input.stepUpUntil || input.stepUpUntil <= new Date()) {
      throw new CollectionServiceError("step_up_required", 403);
    }
    const reason = input.reason.trim();
    if (reason.length < 3) throw new CollectionServiceError("rejection_reason_required", 400);

    const rejected = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "CollectionSubmission" WHERE "id" = ${id} FOR UPDATE`;
      const submission = await tx.collectionSubmission.findUnique({ where: { id } });
      if (!submission) throw new CollectionServiceError("submission_not_found", 404);
      if (submission.status === "confirmed") throw new CollectionServiceError("submission_already_confirmed", 409);
      if (submission.status === "rejected") {
        return tx.collectionSubmission.findUniqueOrThrow({ where: { id }, include: submissionInclude });
      }
      if (submission.status === "confirming") throw new CollectionServiceError("confirmation_in_progress", 409);
      const rejected = await tx.collectionSubmission.update({
        where: { id },
        data: {
          status: "rejected",
          rejectionReason: reason,
          confirmedByStaffId: input.actorStaffId,
        },
        include: submissionInclude,
      });
      await tx.auditEvent.create({
        data: {
          actorStaffId: input.actorStaffId,
          action: "collection.rejected",
          subjectType: "collection_submission",
          subjectId: id,
          metadata: { reason },
        },
      });
      return rejected;
    });
    return this.publicSubmission(rejected);
  }

  private storageAdapter() {
    return this.storage ?? getObjectStorage();
  }

  private async putEvidence(input: CollectionEvidenceInput): Promise<StoredCollectionEvidence> {
    const body = decodeBody(input.bodyBase64);
    try {
      return await this.storageAdapter().put({
        purpose: "collection_receipt",
        contentType: input.contentType,
        body,
        checksum: input.checksum,
      });
    } catch (error) {
      if (error instanceof ObjectStorageError) throw error;
      throw new CollectionServiceError("evidence_storage_failed", 503);
    }
  }

  private async publicSubmission<T extends { evidence: Array<{ objectKey: string; checksum: string; contentType: string; sizeBytes: number }> }>(submission: T) {
    return {
      ...submission,
      evidence: await Promise.all(submission.evidence.map(async ({ objectKey, ...evidence }) => {
        const signedUrl = await this.storageAdapter().signedReadUrl(objectKey, 300).catch(() => null);
        return { ...evidence, signedUrl };
      })),
    };
  }
}

function decodeBody(value: string) {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 === 1) {
    throw new CollectionServiceError("invalid_evidence_body", 400);
  }
  const body = Buffer.from(value, "base64");
  if (body.length === 0) throw new CollectionServiceError("invalid_evidence_body", 400);
  return body;
}
