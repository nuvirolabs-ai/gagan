-- CreateEnum
CREATE TYPE "CreditRolloutMode" AS ENUM ('shadow', 'enforce');

-- AlterTable
ALTER TABLE "AppConfig" ADD COLUMN     "creditPolicyApprovedAt" TIMESTAMP(3),
ADD COLUMN     "creditPolicyApprovedByStaffId" TEXT,
ADD COLUMN     "creditRolloutMode" "CreditRolloutMode" NOT NULL DEFAULT 'shadow';

-- CreateTable
CREATE TABLE "CreditDecisionComparison" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "orderId" TEXT,
    "assessmentId" TEXT NOT NULL,
    "rolloutMode" "CreditRolloutMode" NOT NULL,
    "legacyResult" TEXT NOT NULL,
    "engineResult" "CreditAssessmentResult" NOT NULL,
    "effectiveResult" TEXT NOT NULL,
    "mismatch" BOOLEAN NOT NULL,
    "creditTeamDisposition" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditDecisionComparison_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditDecisionComparison_assessmentId_key" ON "CreditDecisionComparison"("assessmentId");

-- CreateIndex
CREATE INDEX "CreditDecisionComparison_mismatch_createdAt_idx" ON "CreditDecisionComparison"("mismatch", "createdAt");

-- CreateIndex
CREATE INDEX "CreditDecisionComparison_retailerId_createdAt_idx" ON "CreditDecisionComparison"("retailerId", "createdAt");

-- AddForeignKey
ALTER TABLE "CreditDecisionComparison" ADD CONSTRAINT "CreditDecisionComparison_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditDecisionComparison" ADD CONSTRAINT "CreditDecisionComparison_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditDecisionComparison" ADD CONSTRAINT "CreditDecisionComparison_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "CreditAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
