-- CreateEnum
CREATE TYPE "RatingProposalStatus" AS ENUM ('pending', 'confirmed', 'dismissed');

-- CreateTable
CREATE TABLE "RatingProposal" (
    "id" TEXT NOT NULL,
    "creditProfileId" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "previousRating" "CreditRating" NOT NULL,
    "proposedRating" "CreditRating" NOT NULL,
    "trigger" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "status" "RatingProposalStatus" NOT NULL DEFAULT 'pending',
    "idempotencyKey" TEXT NOT NULL,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedByStaffId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "dismissedByStaffId" TEXT,
    "dismissedAt" TIMESTAMP(3),

    CONSTRAINT "RatingProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RatingProposal_idempotencyKey_key" ON "RatingProposal"("idempotencyKey");

-- CreateIndex
CREATE INDEX "RatingProposal_status_proposedAt_idx" ON "RatingProposal"("status", "proposedAt");

-- CreateIndex
CREATE INDEX "RatingProposal_creditProfileId_proposedAt_idx" ON "RatingProposal"("creditProfileId", "proposedAt");

-- AddForeignKey
ALTER TABLE "RatingProposal" ADD CONSTRAINT "RatingProposal_creditProfileId_fkey" FOREIGN KEY ("creditProfileId") REFERENCES "CreditProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingProposal" ADD CONSTRAINT "RatingProposal_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "CreditPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
