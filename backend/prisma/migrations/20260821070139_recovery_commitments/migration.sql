-- CreateEnum
CREATE TYPE "PromiseToPayStatus" AS ENUM ('promised', 'kept', 'missed', 'superseded');

-- CreateEnum
CREATE TYPE "RecoveryCallOutcome" AS ENUM ('no_answer', 'spoke_with_customer', 'promise_made', 'dispute_raised', 'wrong_number');

-- CreateTable
CREATE TABLE "CallLog" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "actorStaffId" TEXT NOT NULL,
    "outcome" "RecoveryCallOutcome" NOT NULL,
    "notes" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextActionAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromiseToPay" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "promisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "PromiseToPayStatus" NOT NULL DEFAULT 'promised',
    "createdByStaffId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "keptAt" TIMESTAMP(3),
    "missedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromiseToPay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CallLog_idempotencyKey_key" ON "CallLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CallLog_caseId_occurredAt_idx" ON "CallLog"("caseId", "occurredAt");

-- CreateIndex
CREATE INDEX "CallLog_actorStaffId_occurredAt_idx" ON "CallLog"("actorStaffId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromiseToPay_idempotencyKey_key" ON "PromiseToPay"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PromiseToPay_caseId_status_dueAt_idx" ON "PromiseToPay"("caseId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "PromiseToPay_status_dueAt_idx" ON "PromiseToPay"("status", "dueAt");

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RecoveryCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromiseToPay" ADD CONSTRAINT "PromiseToPay_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RecoveryCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
