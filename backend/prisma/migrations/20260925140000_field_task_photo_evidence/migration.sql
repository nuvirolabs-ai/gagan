CREATE TABLE "FieldTaskEvidence" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "retailerId" TEXT NOT NULL,
  "salespersonId" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "accuracyMeters" DECIMAL(8,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FieldTaskEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FieldTaskEvidence_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "FieldTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FieldTaskEvidence_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FieldTaskEvidence_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FieldTaskEvidence_location_all_or_none" CHECK (("latitude" IS NULL AND "longitude" IS NULL AND "accuracyMeters" IS NULL) OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL AND "accuracyMeters" IS NOT NULL))
);

CREATE UNIQUE INDEX "FieldTaskEvidence_objectKey_key" ON "FieldTaskEvidence"("objectKey");
CREATE INDEX "FieldTaskEvidence_taskId_createdAt_idx" ON "FieldTaskEvidence"("taskId", "createdAt");
CREATE INDEX "FieldTaskEvidence_retailerId_createdAt_idx" ON "FieldTaskEvidence"("retailerId", "createdAt");
CREATE INDEX "FieldTaskEvidence_salespersonId_createdAt_idx" ON "FieldTaskEvidence"("salespersonId", "createdAt");
