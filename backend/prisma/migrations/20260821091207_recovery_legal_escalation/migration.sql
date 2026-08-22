-- CreateEnum
CREATE TYPE "RecoveryLetterDeliveryChannel" AS ENUM ('manual', 'whatsapp', 'sms', 'email');

-- CreateEnum
CREATE TYPE "LegalCaseStatus" AS ENUM ('open', 'settled', 'written_off', 'closed');

-- CreateEnum
CREATE TYPE "LegalDecisionType" AS ENUM ('settlement', 'write_off');

-- CreateTable
CREATE TABLE "RecoveryLetter" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'application/pdf',
    "sizeBytes" INTEGER NOT NULL,
    "invoiceNumber" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "responseDueAt" TIMESTAMP(3) NOT NULL,
    "signatories" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryLetter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryLetterDelivery" (
    "id" TEXT NOT NULL,
    "letterId" TEXT NOT NULL,
    "channel" "RecoveryLetterDeliveryChannel" NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorStaffId" TEXT NOT NULL,
    "externalReference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryLetterDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalCase" (
    "id" TEXT NOT NULL,
    "recoveryCaseId" TEXT NOT NULL,
    "letterId" TEXT NOT NULL,
    "status" "LegalCaseStatus" NOT NULL DEFAULT 'open',
    "reason" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByStaffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalDecision" (
    "id" TEXT NOT NULL,
    "legalCaseId" TEXT NOT NULL,
    "type" "LegalDecisionType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "decidedByStaffId" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryLetter_objectKey_key" ON "RecoveryLetter"("objectKey");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryLetter_idempotencyKey_key" ON "RecoveryLetter"("idempotencyKey");

-- CreateIndex
CREATE INDEX "RecoveryLetter_caseId_sentAt_idx" ON "RecoveryLetter"("caseId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryLetterDelivery_idempotencyKey_key" ON "RecoveryLetterDelivery"("idempotencyKey");

-- CreateIndex
CREATE INDEX "RecoveryLetterDelivery_letterId_deliveredAt_idx" ON "RecoveryLetterDelivery"("letterId", "deliveredAt");

-- CreateIndex
CREATE UNIQUE INDEX "LegalCase_recoveryCaseId_key" ON "LegalCase"("recoveryCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "LegalCase_letterId_key" ON "LegalCase"("letterId");

-- CreateIndex
CREATE INDEX "LegalCase_status_openedAt_idx" ON "LegalCase"("status", "openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LegalDecision_legalCaseId_key" ON "LegalDecision"("legalCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "LegalDecision_idempotencyKey_key" ON "LegalDecision"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "RecoveryLetter" ADD CONSTRAINT "RecoveryLetter_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RecoveryCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryLetterDelivery" ADD CONSTRAINT "RecoveryLetterDelivery_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "RecoveryLetter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalCase" ADD CONSTRAINT "LegalCase_recoveryCaseId_fkey" FOREIGN KEY ("recoveryCaseId") REFERENCES "RecoveryCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalCase" ADD CONSTRAINT "LegalCase_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "RecoveryLetter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDecision" ADD CONSTRAINT "LegalDecision_legalCaseId_fkey" FOREIGN KEY ("legalCaseId") REFERENCES "LegalCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
