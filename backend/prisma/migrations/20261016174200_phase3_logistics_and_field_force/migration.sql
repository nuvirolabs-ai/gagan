-- AlterEnum
ALTER TYPE "SurveyQuestionType" ADD VALUE IF NOT EXISTS 'photo';

-- AlterTable
ALTER TABLE "Variant" ADD COLUMN IF NOT EXISTS "lowStockThreshold" INTEGER DEFAULT 10;

-- AlterTable
ALTER TABLE "Scheme" 
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "ruleType" TEXT NOT NULL DEFAULT 'order_value',
  ADD COLUMN IF NOT EXISTS "minQuantity" INTEGER,
  ADD COLUMN IF NOT EXISTS "qualifyingVariantId" TEXT,
  ADD COLUMN IF NOT EXISTS "rewardType" TEXT NOT NULL DEFAULT 'flat_discount',
  ADD COLUMN IF NOT EXISTS "rewardValue" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "freeVariantId" TEXT,
  ADD COLUMN IF NOT EXISTS "targetAudience" TEXT NOT NULL DEFAULT 'all_retailers',
  ADD COLUMN IF NOT EXISTS "targetTierId" TEXT,
  ADD COLUMN IF NOT EXISTS "targetTerritory" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('receipt', 'spoilage', 'damage', 'discrepancy', 'audit_reconciliation', 'transfer_in', 'transfer_out');

-- CreateTable
CREATE TABLE IF NOT EXISTS "StockMovement" (
    "id" TEXT NOT NULL,
    "warehouseCode" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "previousStock" DECIMAL(14,3) NOT NULL,
    "newStock" DECIMAL(14,3) NOT NULL,
    "reason" TEXT NOT NULL,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateEnum
CREATE TYPE "StockTransferStatus" AS ENUM ('draft', 'in_transit', 'received', 'cancelled');

-- CreateTable
CREATE TABLE IF NOT EXISTS "StockTransfer" (
    "id" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "fromWarehouseCode" TEXT NOT NULL,
    "toWarehouseCode" TEXT NOT NULL,
    "status" "StockTransferStatus" NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StockTransferItem" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "StockTransferItem_pkey" PRIMARY KEY ("id")
);

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('truck', 'tempo', 'three_wheeler', 'van');

-- CreateTable
CREATE TABLE IF NOT EXISTS "DeliveryVehicle" (
    "id" TEXT NOT NULL,
    "regNumber" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "type" "VehicleType" NOT NULL DEFAULT 'tempo',
    "capacityKg" DECIMAL(10,2) NOT NULL,
    "capacityBags" INTEGER NOT NULL DEFAULT 50,
    "driverName" TEXT NOT NULL,
    "driverPhone" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateEnum
CREATE TYPE "DeliveryRunStatus" AS ENUM ('draft', 'loaded', 'out_for_delivery', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE IF NOT EXISTS "DeliveryRun" (
    "id" TEXT NOT NULL,
    "runNumber" TEXT NOT NULL,
    "warehouseCode" TEXT NOT NULL,
    "vehicleId" TEXT,
    "driverName" TEXT NOT NULL,
    "driverPhone" TEXT NOT NULL,
    "status" "DeliveryRunStatus" NOT NULL DEFAULT 'draft',
    "orderIds" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "departureTime" TIMESTAMP(3),
    "completedTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockMovement_warehouseCode_variantId_idx" ON "StockMovement"("warehouseCode", "variantId");
CREATE INDEX IF NOT EXISTS "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "StockTransfer_transferNumber_key" ON "StockTransfer"("transferNumber");
CREATE INDEX IF NOT EXISTS "StockTransfer_fromWarehouseCode_status_idx" ON "StockTransfer"("fromWarehouseCode", "status");
CREATE INDEX IF NOT EXISTS "StockTransfer_toWarehouseCode_status_idx" ON "StockTransfer"("toWarehouseCode", "status");
CREATE INDEX IF NOT EXISTS "StockTransferItem_transferId_idx" ON "StockTransferItem"("transferId");
CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryVehicle_regNumber_key" ON "DeliveryVehicle"("regNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryRun_runNumber_key" ON "DeliveryRun"("runNumber");
CREATE INDEX IF NOT EXISTS "DeliveryRun_warehouseCode_status_idx" ON "DeliveryRun"("warehouseCode", "status");

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryRun" ADD CONSTRAINT "DeliveryRun_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "DeliveryVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
