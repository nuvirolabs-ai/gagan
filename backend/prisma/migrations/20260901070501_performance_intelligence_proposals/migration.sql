-- CreateEnum
CREATE TYPE "AchievementType" AS ENUM ('TARGET_50', 'TARGET_75', 'TARGET_90', 'TARGET_100', 'TARGET_EXCEEDED', 'PERSONAL_BEST', 'COLLECTION_TARGET', 'NEW_RETAILER_MILESTONE', 'RANK_UP', 'TOP_10', 'TOP_3');

-- CreateEnum
CREATE TYPE "AchievementSubjectKind" AS ENUM ('salesperson', 'retailer');

-- CreateEnum
CREATE TYPE "RetailerProposalStatus" AS ENUM ('pending', 'approved', 'rejected', 'withdrawn');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SalesTargetMetric" ADD VALUE 'order_count';
ALTER TYPE "SalesTargetMetric" ADD VALUE 'line_items';
ALTER TYPE "SalesTargetMetric" ADD VALUE 'productive_outlets';

-- CreateTable
CREATE TABLE "AchievementEvent" (
    "id" TEXT NOT NULL,
    "subjectKind" "AchievementSubjectKind" NOT NULL DEFAULT 'salesperson',
    "subjectId" TEXT NOT NULL,
    "type" "AchievementType" NOT NULL,
    "metric" TEXT,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "threshold" DECIMAL(14,2),
    "actual" DECIMAL(14,2),
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "evidence" JSONB,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AchievementEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailerProposal" (
    "id" TEXT NOT NULL,
    "status" "RetailerProposalStatus" NOT NULL DEFAULT 'pending',
    "businessName" TEXT NOT NULL,
    "ownerName" TEXT,
    "phone" TEXT NOT NULL,
    "shopAddress" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "accuracyMeters" DECIMAL(8,2),
    "proposedTierId" TEXT,
    "notes" TEXT,
    "submittedByStaffId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedByStaffId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "retailerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetailerProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AchievementEvent_subjectKind_subjectId_earnedAt_idx" ON "AchievementEvent"("subjectKind", "subjectId", "earnedAt");

-- CreateIndex
CREATE INDEX "AchievementEvent_type_earnedAt_idx" ON "AchievementEvent"("type", "earnedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementEvent_subjectKind_subjectId_dedupeKey_key" ON "AchievementEvent"("subjectKind", "subjectId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "RetailerProposal_retailerId_key" ON "RetailerProposal"("retailerId");

-- CreateIndex
CREATE INDEX "RetailerProposal_status_submittedAt_idx" ON "RetailerProposal"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "RetailerProposal_submittedByStaffId_submittedAt_idx" ON "RetailerProposal"("submittedByStaffId", "submittedAt");

-- AddForeignKey
ALTER TABLE "RetailerProposal" ADD CONSTRAINT "RetailerProposal_proposedTierId_fkey" FOREIGN KEY ("proposedTierId") REFERENCES "Tier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerProposal" ADD CONSTRAINT "RetailerProposal_submittedByStaffId_fkey" FOREIGN KEY ("submittedByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerProposal" ADD CONSTRAINT "RetailerProposal_reviewedByStaffId_fkey" FOREIGN KEY ("reviewedByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerProposal" ADD CONSTRAINT "RetailerProposal_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
