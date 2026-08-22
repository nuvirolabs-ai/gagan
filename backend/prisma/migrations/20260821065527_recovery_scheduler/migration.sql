-- CreateEnum
CREATE TYPE "RecoveryCaseStatus" AS ENUM ('open', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "RecoveryActionStatus" AS ENUM ('pending', 'completed', 'skipped');

-- CreateEnum
CREATE TYPE "RecoveryActionType" AS ENUM ('day_35_sales_call', 'day_40_joint_call', 'days_45_48_collection_visit', 'days_49_52_accounts_escalation', 'days_53_56_credit_review', 'days_60_69_hold_escalation', 'days_70_89_legal_preparation', 'day_90_legal_referral');

-- CreateTable
CREATE TABLE "RecoveryCase" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "status" "RecoveryCaseStatus" NOT NULL DEFAULT 'open',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryAction" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" "RecoveryActionType" NOT NULL,
    "status" "RecoveryActionStatus" NOT NULL DEFAULT 'pending',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "role" TEXT NOT NULL,
    "assigneeStaffId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "details" JSONB,
    "completedAt" TIMESTAMP(3),
    "completedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryCase_invoiceId_key" ON "RecoveryCase"("invoiceId");

-- CreateIndex
CREATE INDEX "RecoveryCase_status_updatedAt_idx" ON "RecoveryCase"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "RecoveryCase_retailerId_status_idx" ON "RecoveryCase"("retailerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryAction_idempotencyKey_key" ON "RecoveryAction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "RecoveryAction_status_dueAt_idx" ON "RecoveryAction"("status", "dueAt");

-- CreateIndex
CREATE INDEX "RecoveryAction_caseId_type_idx" ON "RecoveryAction"("caseId", "type");

-- AddForeignKey
ALTER TABLE "RecoveryCase" ADD CONSTRAINT "RecoveryCase_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryCase" ADD CONSTRAINT "RecoveryCase_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryAction" ADD CONSTRAINT "RecoveryAction_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RecoveryCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
