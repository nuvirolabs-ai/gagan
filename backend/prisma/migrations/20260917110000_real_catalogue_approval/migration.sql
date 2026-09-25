-- Reviewed real-catalogue decisions are additive metadata on the durable
-- importer batch. No existing product, variant, price or transaction is
-- rewritten by this migration.
ALTER TABLE "Product"
  ADD COLUMN "internalCode" TEXT;

ALTER TABLE "Variant"
  ADD COLUMN "internalCode" TEXT,
  ADD COLUMN "hsnCode" TEXT;

CREATE UNIQUE INDEX "Product_internalCode_key" ON "Product"("internalCode");
CREATE UNIQUE INDEX "Variant_internalCode_key" ON "Variant"("internalCode");

ALTER TABLE "CatalogImportBatch"
  ADD COLUMN "approvalId" TEXT,
  ADD COLUMN "approvalRevision" INTEGER,
  ADD COLUMN "approvalSha256" TEXT,
  ADD COLUMN "approvalSource" TEXT,
  ADD COLUMN "approvalScope" JSONB,
  ADD COLUMN "imageMappingRevision" TEXT;
