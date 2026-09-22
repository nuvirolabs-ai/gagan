-- Existing SAP snapshots are unchanged. Internal stock is explicitly UAT and
-- variant-bound; no stock or catalogue rows are created by this migration.
ALTER TABLE "InventorySnapshot" ADD COLUMN "internalMaterialId" TEXT;
ALTER TABLE "InventorySnapshot" ALTER COLUMN "sapMaterialId" DROP NOT NULL;
CREATE UNIQUE INDEX "InventorySnapshot_internalMaterialId_warehouseCode_key"
  ON "InventorySnapshot"("internalMaterialId", "warehouseCode");
ALTER TABLE "InventorySnapshot" ADD CONSTRAINT "InventorySnapshot_identity_source_check"
  CHECK (
    ("sapMaterialId" IS NOT NULL AND "internalMaterialId" IS NULL)
    OR
    ("sapMaterialId" IS NULL AND "internalMaterialId" IS NOT NULL
      AND "variantId" IS NOT NULL AND "source" = 'staging_uat')
  );
