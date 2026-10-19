-- AlterTable Order
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "remarks" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "transportName" TEXT;
