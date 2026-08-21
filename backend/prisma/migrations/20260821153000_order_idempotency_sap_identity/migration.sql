-- Durable order replay protection and canonical SAP identity fields.
CREATE TYPE "SapOrderSyncStatus" AS ENUM ('pending', 'sending', 'sent', 'failed', 'reconciliation_required');

ALTER TABLE "Order"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "sapDocEntry" INTEGER,
  ADD COLUMN "sapDocNum" INTEGER,
  ADD COLUMN "sapErrorCode" TEXT,
  ADD COLUMN "sapErrorMessage" TEXT,
  ADD COLUMN "sapExternalReference" TEXT,
  ADD COLUMN "sapLastSyncedAt" TIMESTAMP(3),
  ADD COLUMN "sapSyncStatus" "SapOrderSyncStatus" NOT NULL DEFAULT 'pending';

CREATE UNIQUE INDEX "Order_sapExternalReference_key" ON "Order"("sapExternalReference");
CREATE INDEX "Order_sapSyncStatus_createdAt_idx" ON "Order"("sapSyncStatus", "createdAt");
CREATE UNIQUE INDEX "Order_retailerId_idempotencyKey_key" ON "Order"("retailerId", "idempotencyKey");
