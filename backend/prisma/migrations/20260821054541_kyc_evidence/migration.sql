-- CreateEnum
CREATE TYPE "RetailerLifecycle" AS ENUM ('pending_kyc', 'active', 'suspended', 'closed');

-- CreateEnum
CREATE TYPE "KycCaseStatus" AS ENUM ('draft', 'submitted', 'in_review', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "KycDocumentType" AS ENUM ('business_registration', 'identity_proof', 'address_proof', 'bank_proof', 'other');

-- CreateEnum
CREATE TYPE "KycDocumentStatus" AS ENUM ('uploaded', 'accepted', 'rejected');

-- CreateEnum
CREATE TYPE "KycReviewDecision" AS ENUM ('approved', 'rejected', 'changes_requested');

-- CreateEnum
CREATE TYPE "EvidencePurpose" AS ENUM ('kyc_document', 'collection_receipt', 'pod');

-- CreateEnum
CREATE TYPE "RetailerSapAccountStatus" AS ENUM ('pending', 'active', 'blocked');

-- AlterTable
ALTER TABLE "Retailer" ADD COLUMN     "status" "RetailerLifecycle" NOT NULL DEFAULT 'pending_kyc';

-- CreateTable
CREATE TABLE "KycCase" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "status" "KycCaseStatus" NOT NULL DEFAULT 'draft',
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedByStaffId" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycDocument" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" "KycDocumentType" NOT NULL,
    "assetId" TEXT NOT NULL,
    "status" "KycDocumentStatus" NOT NULL DEFAULT 'uploaded',
    "uploadedByStaffId" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycReview" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "reviewerStaffId" TEXT NOT NULL,
    "decision" "KycReviewDecision" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceAsset" (
    "id" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "purpose" "EvidencePurpose" NOT NULL,
    "createdByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EvidenceAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailerContact" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "role" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetailerContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailerSapAccount" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "cardCode" TEXT NOT NULL,
    "status" "RetailerSapAccountStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetailerSapAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KycCase_retailerId_key" ON "KycCase"("retailerId");

-- CreateIndex
CREATE INDEX "KycCase_status_updatedAt_idx" ON "KycCase"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "KycDocument_assetId_key" ON "KycDocument"("assetId");

-- CreateIndex
CREATE INDEX "KycDocument_caseId_type_status_idx" ON "KycDocument"("caseId", "type", "status");

-- CreateIndex
CREATE INDEX "KycReview_caseId_createdAt_idx" ON "KycReview"("caseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceAsset_objectKey_key" ON "EvidenceAsset"("objectKey");

-- CreateIndex
CREATE INDEX "EvidenceAsset_purpose_createdAt_idx" ON "EvidenceAsset"("purpose", "createdAt");

-- CreateIndex
CREATE INDEX "RetailerContact_retailerId_isPrimary_idx" ON "RetailerContact"("retailerId", "isPrimary");

-- CreateIndex
CREATE INDEX "RetailerSapAccount_cardCode_status_idx" ON "RetailerSapAccount"("cardCode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RetailerSapAccount_retailerId_cardCode_key" ON "RetailerSapAccount"("retailerId", "cardCode");

-- AddForeignKey
ALTER TABLE "KycCase" ADD CONSTRAINT "KycCase_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycDocument" ADD CONSTRAINT "KycDocument_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "KycCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycDocument" ADD CONSTRAINT "KycDocument_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "EvidenceAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycReview" ADD CONSTRAINT "KycReview_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "KycCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerContact" ADD CONSTRAINT "RetailerContact_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerSapAccount" ADD CONSTRAINT "RetailerSapAccount_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
