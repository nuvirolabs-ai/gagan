-- Real catalogue lifecycle/source identity is additive. Existing products and
-- variants remain active until an explicit, reviewed catalogue import retires
-- an identified demo/test record. Null catalogKey preserves legacy identity.
ALTER TABLE "Product"
  ADD COLUMN "catalogKey" TEXT,
  ADD COLUMN "catalogStatus" TEXT NOT NULL DEFAULT 'active';

ALTER TABLE "Variant"
  ADD COLUMN "catalogKey" TEXT,
  ADD COLUMN "catalogStatus" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN "imageUrl" TEXT;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_catalogStatus_valid"
  CHECK ("catalogStatus" IN ('active', 'pending_review', 'archived', 'test'));

ALTER TABLE "Variant"
  ADD CONSTRAINT "Variant_catalogStatus_valid"
  CHECK ("catalogStatus" IN ('active', 'pending_review', 'archived', 'test'));

CREATE UNIQUE INDEX "Product_catalogKey_key" ON "Product"("catalogKey");
CREATE UNIQUE INDEX "Variant_catalogKey_key" ON "Variant"("catalogKey");
CREATE INDEX "Product_catalogStatus_idx" ON "Product"("catalogStatus");
CREATE INDEX "Variant_catalogStatus_idx" ON "Variant"("catalogStatus");

CREATE TABLE "CatalogImportBatch" (
  "id" TEXT NOT NULL,
  "batchKey" TEXT NOT NULL,
  "sourceFileName" TEXT NOT NULL,
  "sourceSha256" TEXT NOT NULL,
  "sourceVersion" TEXT NOT NULL,
  "targetLabel" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'dry_run',
  "summary" JSONB,
  "createdByStaffId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "CatalogImportBatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CatalogImportBatch_batchKey_key" UNIQUE ("batchKey"),
  CONSTRAINT "CatalogImportBatch_status_valid" CHECK ("status" IN ('dry_run', 'applying', 'completed', 'completed_with_errors', 'failed'))
);

CREATE INDEX "CatalogImportBatch_sourceSha256_sourceVersion_idx"
  ON "CatalogImportBatch"("sourceSha256", "sourceVersion");
CREATE INDEX "CatalogImportBatch_status_createdAt_idx"
  ON "CatalogImportBatch"("status", "createdAt");
