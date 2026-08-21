CREATE TYPE "InventoryStatus" AS ENUM ('available', 'low', 'unavailable', 'stale', 'unknown');

CREATE TABLE "InventorySnapshot" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT,
  "sapMaterialId" TEXT NOT NULL,
  "warehouseCode" TEXT NOT NULL,
  "onHand" DECIMAL(14,3) NOT NULL,
  "committed" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "available" DECIMAL(14,3) NOT NULL,
  "status" "InventoryStatus" NOT NULL DEFAULT 'unknown',
  "source" TEXT NOT NULL DEFAULT 'sap',
  "syncedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventorySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InventorySnapshot_productId_warehouseCode_idx" ON "InventorySnapshot"("productId", "warehouseCode");
CREATE INDEX "InventorySnapshot_status_syncedAt_idx" ON "InventorySnapshot"("status", "syncedAt");
CREATE UNIQUE INDEX "InventorySnapshot_sapMaterialId_warehouseCode_key" ON "InventorySnapshot"("sapMaterialId", "warehouseCode");

ALTER TABLE "InventorySnapshot" ADD CONSTRAINT "InventorySnapshot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventorySnapshot" ADD CONSTRAINT "InventorySnapshot_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
