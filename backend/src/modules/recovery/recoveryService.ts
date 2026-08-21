import { Prisma, PromiseToPayStatus, RecoveryCallOutcome } from "@prisma/client";
import { prisma } from "../../lib/prisma";

const VIEW = "recovery.view";
const UPDATE = "recovery.update";

export class RecoveryServiceError extends Error {
  constructor(public readonly code: string, public readonly status = 409, public readonly details?: unknown) {
    super(code);
    this.name = "RecoveryServiceError";
  }
}

function can(permissions: string[], permission: string) {
  return permissions.includes(permission) || permissions.includes("staff.manage");
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export interface RecoveryActor {
  actorStaffId: string;
  actorPermissions: string[];
}

export interface LogCallInput extends RecoveryActor {
  caseId: string;
  outcome: RecoveryCallOutcome;
  notes: string;
  occurredAt?: Date;
  nextActionAt?: Date;
  idempotencyKey: string;
}

export interface CreatePromiseInput extends RecoveryActor {
  caseId: string;
  amount: number;
  dueAt: Date;
  promisedAt?: Date;
  idempotencyKey: string;
}

export class RecoveryService {
  async list(permissions: string[]) {
    this.assertPermission(permissions, VIEW);
    return prisma.recoveryCase.findMany({
      where: { status: "open" },
      include: {
        invoice: { select: { id: true, invoiceNumber: true, outstandingAmount: true, dueDate: true } },
        retailer: { select: { id: true, name: true, phone: true } },
        actions: { where: { status: "pending" }, orderBy: { dueAt: "asc" }, take: 1 },
      },
      orderBy: { updatedAt: "asc" },
      take: 200,
    });
  }

  async timeline(caseId: string, permissions: string[]) {
    this.assertPermission(permissions, VIEW);
    const recoveryCase = await prisma.recoveryCase.findUnique({
      where: { id: caseId },
      include: {
        invoice: { select: { id: true, invoiceNumber: true, total: true, outstandingAmount: true, invoiceDate: true, dueDate: true } },
        retailer: { select: { id: true, name: true, phone: true } },
        actions: { orderBy: { dueAt: "asc" } },
        calls: { orderBy: { occurredAt: "asc" } },
        promises: { orderBy: { promisedAt: "asc" } },
        letters: { orderBy: { sentAt: "asc" }, include: { deliveries: { orderBy: { deliveredAt: "asc" } }, legalCase: { include: { decision: true } } } },
        legalCase: { include: { decision: true } },
      },
    });
    if (!recoveryCase) throw new RecoveryServiceError("recovery_case_not_found", 404);
    const events = [
      ...recoveryCase.actions.map((action) => ({ kind: "action" as const, at: action.dueAt, ...action })),
      ...recoveryCase.calls.map((call) => ({ kind: "call" as const, at: call.occurredAt, ...call })),
      ...recoveryCase.promises.map((promise) => ({ kind: "promise" as const, at: promise.promisedAt, ...promise })),
      ...recoveryCase.letters.map((letter) => ({ kind: "letter" as const, at: letter.sentAt, ...letter })),
      ...(recoveryCase.legalCase ? [{ kind: "legal" as const, at: recoveryCase.legalCase.openedAt, ...recoveryCase.legalCase }] : []),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());
    return { recoveryCase, events };
  }

  async logCall(input: LogCallInput) {
    this.assertPermission(input.actorPermissions, UPDATE);
    const notes = input.notes.trim();
    if (notes.length < 3) throw new RecoveryServiceError("call_notes_required", 400);
    if (input.idempotencyKey.trim().length < 8) throw new RecoveryServiceError("invalid_idempotency_key", 400);
    const existing = await prisma.callLog.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.caseId !== input.caseId || existing.actorStaffId !== input.actorStaffId) throw new RecoveryServiceError("idempotency_key_conflict", 409);
      return existing;
    }
    return prisma.$transaction(async (tx) => {
      await this.caseForUpdate(tx, input.caseId);
      const call = await tx.callLog.create({
        data: {
          caseId: input.caseId,
          actorStaffId: input.actorStaffId,
          outcome: input.outcome,
          notes,
          occurredAt: input.occurredAt ?? new Date(),
          nextActionAt: input.nextActionAt,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await tx.auditEvent.create({ data: { actorStaffId: input.actorStaffId, action: "recovery.call_logged", subjectType: "recovery_case", subjectId: input.caseId, metadata: json({ callId: call.id, outcome: input.outcome }) } });
      return call;
    });
  }

  async createPromise(input: CreatePromiseInput) {
    this.assertPermission(input.actorPermissions, UPDATE);
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new RecoveryServiceError("invalid_promise_amount", 400);
    if (input.dueAt.getTime() < (input.promisedAt ?? new Date()).getTime()) throw new RecoveryServiceError("promise_due_date_invalid", 400);
    if (input.idempotencyKey.trim().length < 8) throw new RecoveryServiceError("invalid_idempotency_key", 400);
    const existing = await prisma.promiseToPay.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.caseId !== input.caseId || Number(existing.amount) !== input.amount) throw new RecoveryServiceError("idempotency_key_conflict", 409);
      return existing;
    }
    return prisma.$transaction(async (tx) => {
      await this.caseForUpdate(tx, input.caseId);
      await tx.promiseToPay.updateMany({ where: { caseId: input.caseId, status: PromiseToPayStatus.promised }, data: { status: PromiseToPayStatus.superseded, supersededAt: new Date() } });
      const promise = await tx.promiseToPay.create({ data: { caseId: input.caseId, amount: input.amount, dueAt: input.dueAt, promisedAt: input.promisedAt, createdByStaffId: input.actorStaffId, idempotencyKey: input.idempotencyKey } });
      await tx.auditEvent.create({ data: { actorStaffId: input.actorStaffId, action: "recovery.promise_created", subjectType: "recovery_case", subjectId: input.caseId, metadata: json({ promiseId: promise.id, amount: input.amount, dueAt: input.dueAt }) } });
      return promise;
    });
  }

  async setPromiseStatus(id: string, status: "kept" | "missed", actor: RecoveryActor) {
    this.assertPermission(actor.actorPermissions, UPDATE);
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PromiseToPay" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.promiseToPay.findUnique({ where: { id } });
      if (!current) throw new RecoveryServiceError("promise_not_found", 404);
      if (current.status !== PromiseToPayStatus.promised) throw new RecoveryServiceError("promise_terminal", 409, { status: current.status });
      const now = new Date();
      const updated = await tx.promiseToPay.update({ where: { id }, data: { status, keptAt: status === "kept" ? now : null, missedAt: status === "missed" ? now : null } });
      await tx.auditEvent.create({ data: { actorStaffId: actor.actorStaffId, action: `recovery.promise_${status}`, subjectType: "promise_to_pay", subjectId: id, metadata: json({ caseId: current.caseId }) } });
      return updated;
    });
  }

  private assertPermission(permissions: string[], required: string) {
    if (!can(permissions, required)) throw new RecoveryServiceError("permission_required", 403, { permission: required });
  }

  private async caseForUpdate(tx: Prisma.TransactionClient, caseId: string) {
    await tx.$queryRaw`SELECT "id" FROM "RecoveryCase" WHERE "id" = ${caseId} FOR UPDATE`;
    const recoveryCase = await tx.recoveryCase.findUnique({ where: { id: caseId }, select: { id: true, status: true } });
    if (!recoveryCase) throw new RecoveryServiceError("recovery_case_not_found", 404);
    if (recoveryCase.status === "closed") throw new RecoveryServiceError("recovery_case_closed", 409);
    return recoveryCase;
  }
}
