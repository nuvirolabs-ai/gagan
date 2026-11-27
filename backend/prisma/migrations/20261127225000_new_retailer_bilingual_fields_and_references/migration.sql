-- AlterTable: Retailer
ALTER TABLE "Retailer"
  ADD COLUMN IF NOT EXISTS "groupName" TEXT,
  ADD COLUMN IF NOT EXISTS "telephone" TEXT,
  ADD COLUMN IF NOT EXISTS "transporter" TEXT,
  ADD COLUMN IF NOT EXISTS "broker" TEXT,
  ADD COLUMN IF NOT EXISTS "addressLine2" TEXT,
  ADD COLUMN IF NOT EXISTS "beatName" TEXT,
  ADD COLUMN IF NOT EXISTS "tehsil" TEXT,
  ADD COLUMN IF NOT EXISTS "district" TEXT,
  ADD COLUMN IF NOT EXISTS "state" TEXT,
  ADD COLUMN IF NOT EXISTS "shopDurationYears" INTEGER,
  ADD COLUMN IF NOT EXISTS "upiId" TEXT,
  ADD COLUMN IF NOT EXISTS "grade" TEXT,
  ADD COLUMN IF NOT EXISTS "buyerCategory" TEXT,
  ADD COLUMN IF NOT EXISTS "buyerSubCategory" TEXT,
  ADD COLUMN IF NOT EXISTS "remark" TEXT,
  ADD COLUMN IF NOT EXISTS "businessNameHi" TEXT,
  ADD COLUMN IF NOT EXISTS "transporterHi" TEXT,
  ADD COLUMN IF NOT EXISTS "shopAddressHi" TEXT,
  ADD COLUMN IF NOT EXISTS "addressLine2Hi" TEXT,
  ADD COLUMN IF NOT EXISTS "beatNameHi" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryCityHi" TEXT,
  ADD COLUMN IF NOT EXISTS "tehsilHi" TEXT,
  ADD COLUMN IF NOT EXISTS "districtHi" TEXT,
  ADD COLUMN IF NOT EXISTS "stateHi" TEXT;

-- AlterTable: RetailerProposal
ALTER TABLE "RetailerProposal"
  ADD COLUMN IF NOT EXISTS "broker" TEXT,
  ADD COLUMN IF NOT EXISTS "addressLine2" TEXT,
  ADD COLUMN IF NOT EXISTS "beatName" TEXT,
  ADD COLUMN IF NOT EXISTS "proposedCreditLimit" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "grade" TEXT,
  ADD COLUMN IF NOT EXISTS "buyerCategory" TEXT,
  ADD COLUMN IF NOT EXISTS "buyerSubCategory" TEXT,
  ADD COLUMN IF NOT EXISTS "remark" TEXT,
  ADD COLUMN IF NOT EXISTS "businessNameHi" TEXT,
  ADD COLUMN IF NOT EXISTS "transporterHi" TEXT,
  ADD COLUMN IF NOT EXISTS "shopAddressHi" TEXT,
  ADD COLUMN IF NOT EXISTS "addressLine2Hi" TEXT,
  ADD COLUMN IF NOT EXISTS "beatNameHi" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryCityHi" TEXT,
  ADD COLUMN IF NOT EXISTS "tehsilHi" TEXT,
  ADD COLUMN IF NOT EXISTS "districtHi" TEXT,
  ADD COLUMN IF NOT EXISTS "stateHi" TEXT,
  ADD COLUMN IF NOT EXISTS "hindiSnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "locationStandardized" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "locationNeedsReview" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "creditVerificationStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "creditVerifiedByStaffId" TEXT,
  ADD COLUMN IF NOT EXISTS "creditVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "creditVerificationNotes" TEXT;

-- CreateTable: RetailerProposalReference
CREATE TABLE IF NOT EXISTS "RetailerProposalReference" (
  "id" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "existingRetailerId" TEXT,
  "retailerName" TEXT NOT NULL,
  "ownerName" TEXT,
  "phone" TEXT,
  "shopAddress" TEXT,
  "city" TEXT NOT NULL,
  "isExistingCustomer" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RetailerProposalReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RetailerProposal_creditVerificationStatus_submittedAt_idx"
  ON "RetailerProposal"("creditVerificationStatus", "submittedAt");
CREATE INDEX IF NOT EXISTS "RetailerProposalReference_proposalId_idx"
  ON "RetailerProposalReference"("proposalId");
CREATE INDEX IF NOT EXISTS "RetailerProposalReference_existingRetailerId_idx"
  ON "RetailerProposalReference"("existingRetailerId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "RetailerProposal"
    ADD CONSTRAINT "RetailerProposal_creditVerifiedByStaffId_fkey"
    FOREIGN KEY ("creditVerifiedByStaffId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RetailerProposalReference"
    ADD CONSTRAINT "RetailerProposalReference_proposalId_fkey"
    FOREIGN KEY ("proposalId") REFERENCES "RetailerProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RetailerProposalReference"
    ADD CONSTRAINT "RetailerProposalReference_existingRetailerId_fkey"
    FOREIGN KEY ("existingRetailerId") REFERENCES "Retailer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
