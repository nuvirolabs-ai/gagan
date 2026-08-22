-- CreateEnum
CREATE TYPE "LocationStatus" AS ENUM ('NOT_SET', 'CAPTURED', 'VERIFIED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "LocationSource" AS ENUM ('RETAILER_ONBOARDING', 'SALESPERSON_VISIT', 'ADMIN_CORRECTION', 'MIGRATION');

-- CreateEnum
CREATE TYPE "LocationVerificationStatus" AS ENUM ('VERIFIED', 'NEEDS_REVIEW', 'OUTSIDE_STORE_AREA', 'STORE_LOCATION_NOT_AVAILABLE', 'LOW_GPS_ACCURACY');

-- CreateTable
CREATE TABLE "RetailerLocation" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "accuracyMeters" DECIMAL(8,2),
    "status" "LocationStatus" NOT NULL DEFAULT 'NOT_SET',
    "source" "LocationSource",
    "capturedAt" TIMESTAMP(3),
    "capturedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedByUserId" TEXT,
    "locationVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RetailerLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailerLocationHistory" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "accuracyMeters" DECIMAL(8,2),
    "status" "LocationStatus" NOT NULL,
    "source" "LocationSource" NOT NULL,
    "capturedByUserId" TEXT,
    "capturedAt" TIMESTAMP(3),
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL,
    "reasonForChange" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RetailerLocationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesVisit" (
    "id" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "checkInLatitude" DECIMAL(10,7) NOT NULL,
    "checkInLongitude" DECIMAL(10,7) NOT NULL,
    "checkInAccuracyMeters" DECIMAL(8,2) NOT NULL,
    "storeLatitudeSnapshot" DECIMAL(10,7),
    "storeLongitudeSnapshot" DECIMAL(10,7),
    "distanceFromStoreMeters" DECIMAL(10,2),
    "verificationStatus" "LocationVerificationStatus" NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedOutLatitude" DECIMAL(10,7),
    "checkedOutLongitude" DECIMAL(10,7),
    "checkedOutAccuracyMeters" DECIMAL(8,2),
    "checkedOutAt" TIMESTAMP(3),
    "checkoutDistanceMeters" DECIMAL(10,2),
    "notes" TEXT,
    "source" "LocationSource" NOT NULL DEFAULT 'SALESPERSON_VISIT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SalesVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RetailerLocation_retailerId_key" ON "RetailerLocation"("retailerId");
CREATE INDEX "RetailerLocation_status_updatedAt_idx" ON "RetailerLocation"("status", "updatedAt");
CREATE INDEX "RetailerLocationHistory_retailerId_createdAt_idx" ON "RetailerLocationHistory"("retailerId", "createdAt");
CREATE INDEX "RetailerLocationHistory_retailerId_version_idx" ON "RetailerLocationHistory"("retailerId", "version");
CREATE INDEX "SalesVisit_salespersonId_checkedInAt_idx" ON "SalesVisit"("salespersonId", "checkedInAt");
CREATE INDEX "SalesVisit_retailerId_checkedInAt_idx" ON "SalesVisit"("retailerId", "checkedInAt");
CREATE INDEX "SalesVisit_verificationStatus_checkedInAt_idx" ON "SalesVisit"("verificationStatus", "checkedInAt");

-- AddForeignKey
ALTER TABLE "RetailerLocation" ADD CONSTRAINT "RetailerLocation_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetailerLocationHistory" ADD CONSTRAINT "RetailerLocationHistory_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesVisit" ADD CONSTRAINT "SalesVisit_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesVisit" ADD CONSTRAINT "SalesVisit_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SalesRep" ADD COLUMN "territory" TEXT;
ALTER TABLE "RetailerLocation" ADD COLUMN "devicePlatform" TEXT;
ALTER TABLE "RetailerLocationHistory" ADD COLUMN "devicePlatform" TEXT;
ALTER TABLE "SalesVisit" ADD COLUMN "devicePlatform" TEXT;

-- Existing retailers remain usable and are explicitly represented as not set;
-- no coordinates are inferred from their postal address.
INSERT INTO "RetailerLocation" ("id", "retailerId", "status", "source", "locationVersion", "updatedAt")
SELECT md5('retailer-location:' || "id")::uuid::text, "id", 'NOT_SET', 'MIGRATION', 0, CURRENT_TIMESTAMP
FROM "Retailer";
