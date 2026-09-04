-- Retailer Proposal V2.1: additive fields for the governed 19-field onboarding flow.
-- Aadhaar is stored only as encrypted ciphertext and its masked last four digits.
ALTER TYPE "EvidencePurpose" ADD VALUE 'retailer_proposal_aadhaar';

ALTER TABLE "RetailerProposal"
  ADD COLUMN "groupName" TEXT,
  ADD COLUMN "telephone" TEXT,
  ADD COLUMN "transporter" TEXT,
  ADD COLUMN "pinCode" TEXT,
  ADD COLUMN "tehsil" TEXT,
  ADD COLUMN "district" TEXT,
  ADD COLUMN "state" TEXT,
  ADD COLUMN "deliveryCity" TEXT,
  ADD COLUMN "shopDurationYears" INTEGER,
  ADD COLUMN "gstin" TEXT,
  ADD COLUMN "paymentTerms" TEXT,
  ADD COLUMN "upiId" TEXT,
  ADD COLUMN "aadhaarEncrypted" TEXT,
  ADD COLUMN "aadhaarLast4" TEXT,
  ADD COLUMN "aadhaarPhotoAssetId" TEXT;

CREATE UNIQUE INDEX "RetailerProposal_aadhaarPhotoAssetId_key"
  ON "RetailerProposal"("aadhaarPhotoAssetId");

ALTER TABLE "RetailerProposal"
  ADD CONSTRAINT "RetailerProposal_aadhaarPhotoAssetId_fkey"
  FOREIGN KEY ("aadhaarPhotoAssetId") REFERENCES "EvidenceAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
