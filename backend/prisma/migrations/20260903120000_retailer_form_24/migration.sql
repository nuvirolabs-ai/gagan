-- CreateEnum
CREATE TYPE "RetailerProposalStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "RetailerGrade" AS ENUM ('A', 'B', 'C', 'D');

-- AlterEnum
ALTER TYPE "EvidencePurpose" ADD VALUE 'aadhaar_card';

-- CreateTable
CREATE TABLE "RetailerGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetailerGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transporter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transporter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Beat" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Beat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuyerCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerSubCategory" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuyerSubCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailerProposal" (
    "id" TEXT NOT NULL,
    "status" "RetailerProposalStatus" NOT NULL DEFAULT 'pending',
    "proposedByStaffId" TEXT NOT NULL,
    "proposedByRepId" TEXT NOT NULL,
    "partyName" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "telephone" TEXT,
    "transporterId" TEXT NOT NULL,
    "address1" TEXT NOT NULL,
    "pin" TEXT,
    "tehsil" TEXT,
    "district" TEXT,
    "state" TEXT,
    "deliveryCity" TEXT NOT NULL,
    "salesmanRepId" TEXT NOT NULL,
    "beatId" TEXT,
    "shopTenureYears" INTEGER NOT NULL,
    "gstin" TEXT,
    "aadhaarNumber" TEXT NOT NULL,
    "aadhaarPhotoAssetId" TEXT NOT NULL,
    "paymentTermDays" INTEGER NOT NULL,
    "creditLimit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grade" "RetailerGrade" NOT NULL,
    "buyerCategoryId" TEXT NOT NULL,
    "buyerSubCategoryId" TEXT,
    "upiId" TEXT,
    "payload" JSONB,
    "retailerId" TEXT,
    "reviewedByStaffId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetailerProposal_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Retailer" ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "telephone" TEXT,
ADD COLUMN     "transporterId" TEXT,
ADD COLUMN     "pin" TEXT,
ADD COLUMN     "tehsil" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "deliveryCity" TEXT,
ADD COLUMN     "beatId" TEXT,
ADD COLUMN     "shopTenureYears" INTEGER,
ADD COLUMN     "gstin" TEXT,
ADD COLUMN     "aadhaarNumber" TEXT,
ADD COLUMN     "aadhaarPhotoAssetId" TEXT,
ADD COLUMN     "grade" "RetailerGrade",
ADD COLUMN     "buyerCategoryId" TEXT,
ADD COLUMN     "buyerSubCategoryId" TEXT,
ADD COLUMN     "upiId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "RetailerGroup_name_key" ON "RetailerGroup"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Transporter_name_key" ON "Transporter"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Beat_name_key" ON "Beat"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BuyerCategory_name_key" ON "BuyerCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BuyerSubCategory_categoryId_name_key" ON "BuyerSubCategory"("categoryId", "name");

-- CreateIndex
CREATE INDEX "BuyerSubCategory_categoryId_active_idx" ON "BuyerSubCategory"("categoryId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "RetailerProposal_aadhaarPhotoAssetId_key" ON "RetailerProposal"("aadhaarPhotoAssetId");

-- CreateIndex
CREATE INDEX "RetailerProposal_status_createdAt_idx" ON "RetailerProposal"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RetailerProposal_proposedByStaffId_createdAt_idx" ON "RetailerProposal"("proposedByStaffId", "createdAt");

-- CreateIndex
CREATE INDEX "RetailerProposal_mobile_status_idx" ON "RetailerProposal"("mobile", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RetailerProposal_one_pending_mobile_idx" ON "RetailerProposal"("mobile") WHERE "status" = 'pending';

-- CreateIndex
CREATE UNIQUE INDEX "Retailer_aadhaarPhotoAssetId_key" ON "Retailer"("aadhaarPhotoAssetId");

-- CreateIndex
CREATE INDEX "Retailer_groupId_idx" ON "Retailer"("groupId");

-- CreateIndex
CREATE INDEX "Retailer_transporterId_idx" ON "Retailer"("transporterId");

-- CreateIndex
CREATE INDEX "Retailer_beatId_idx" ON "Retailer"("beatId");

-- CreateIndex
CREATE INDEX "Retailer_buyerCategoryId_buyerSubCategoryId_idx" ON "Retailer"("buyerCategoryId", "buyerSubCategoryId");

-- AddForeignKey
ALTER TABLE "BuyerSubCategory" ADD CONSTRAINT "BuyerSubCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BuyerCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retailer" ADD CONSTRAINT "Retailer_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "RetailerGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retailer" ADD CONSTRAINT "Retailer_transporterId_fkey" FOREIGN KEY ("transporterId") REFERENCES "Transporter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retailer" ADD CONSTRAINT "Retailer_beatId_fkey" FOREIGN KEY ("beatId") REFERENCES "Beat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retailer" ADD CONSTRAINT "Retailer_aadhaarPhotoAssetId_fkey" FOREIGN KEY ("aadhaarPhotoAssetId") REFERENCES "EvidenceAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retailer" ADD CONSTRAINT "Retailer_buyerCategoryId_fkey" FOREIGN KEY ("buyerCategoryId") REFERENCES "BuyerCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retailer" ADD CONSTRAINT "Retailer_buyerSubCategoryId_fkey" FOREIGN KEY ("buyerSubCategoryId") REFERENCES "BuyerSubCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerProposal" ADD CONSTRAINT "RetailerProposal_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "RetailerGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerProposal" ADD CONSTRAINT "RetailerProposal_transporterId_fkey" FOREIGN KEY ("transporterId") REFERENCES "Transporter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerProposal" ADD CONSTRAINT "RetailerProposal_salesmanRepId_fkey" FOREIGN KEY ("salesmanRepId") REFERENCES "SalesRep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerProposal" ADD CONSTRAINT "RetailerProposal_beatId_fkey" FOREIGN KEY ("beatId") REFERENCES "Beat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerProposal" ADD CONSTRAINT "RetailerProposal_aadhaarPhotoAssetId_fkey" FOREIGN KEY ("aadhaarPhotoAssetId") REFERENCES "EvidenceAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerProposal" ADD CONSTRAINT "RetailerProposal_buyerCategoryId_fkey" FOREIGN KEY ("buyerCategoryId") REFERENCES "BuyerCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerProposal" ADD CONSTRAINT "RetailerProposal_buyerSubCategoryId_fkey" FOREIGN KEY ("buyerSubCategoryId") REFERENCES "BuyerSubCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerProposal" ADD CONSTRAINT "RetailerProposal_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
