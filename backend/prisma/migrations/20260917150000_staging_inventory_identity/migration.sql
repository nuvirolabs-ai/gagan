-- Controlled staging inventory may use a durable internal identity without
-- fabricating an SAP material code. Existing SAP-linked snapshots remain
-- unchanged and continue to use sapMaterialId.
ALTER TABLE "Product"
  ADD COLUMN "inventoryIdentity" TEXT;

CREATE UNIQUE INDEX "Product_inventoryIdentity_key"
  ON "Product"("inventoryIdentity");

ALTER TABLE "InventorySnapshot"
  ALTER COLUMN "sapMaterialId" DROP NOT NULL,
  ADD COLUMN "inventoryIdentity" TEXT;

ALTER TABLE "InventorySnapshot"
  ADD CONSTRAINT "InventorySnapshot_one_identity_check"
  CHECK (("sapMaterialId" IS NOT NULL AND "inventoryIdentity" IS NULL)
      OR ("sapMaterialId" IS NULL AND "inventoryIdentity" IS NOT NULL));

CREATE UNIQUE INDEX "InventorySnapshot_inventoryIdentity_warehouseCode_key"
  ON "InventorySnapshot"("inventoryIdentity", "warehouseCode");
