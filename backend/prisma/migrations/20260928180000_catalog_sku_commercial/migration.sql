ALTER TABLE "Variant" ADD COLUMN "purchaseRate" DECIMAL(12,2);
ALTER TABLE "Variant" ADD COLUMN "purchaseRateBasis" TEXT;
ALTER TABLE "Variant" ADD COLUMN "listRate" DECIMAL(12,2);
ALTER TABLE "Variant" ADD COLUMN "listRateBasis" TEXT;

ALTER TABLE "Product"
  DROP CONSTRAINT "Product_catalogStatus_valid",
  ADD CONSTRAINT "Product_catalogStatus_valid"
    CHECK ("catalogStatus" IN ('active', 'inactive', 'published', 'pending_review', 'archived', 'test'));

ALTER TABLE "Variant"
  DROP CONSTRAINT "Variant_catalogStatus_valid",
  ADD CONSTRAINT "Variant_catalogStatus_valid"
    CHECK ("catalogStatus" IN ('active', 'inactive', 'published', 'pending_review', 'archived', 'test'));
