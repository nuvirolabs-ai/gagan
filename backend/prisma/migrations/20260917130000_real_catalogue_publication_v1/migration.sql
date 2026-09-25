-- Published catalogue rows are visible to authenticated shoppers but remain
-- distinct from `active`, which is the existing orderable lifecycle state.
-- Image status is persisted so placeholders and unresolved image mappings are
-- explicit in both native clients without falling back to unrelated photos.
ALTER TABLE "Product"
  DROP CONSTRAINT "Product_catalogStatus_valid",
  ADD CONSTRAINT "Product_catalogStatus_valid"
    CHECK ("catalogStatus" IN ('active', 'published', 'pending_review', 'archived', 'test'));

ALTER TABLE "Variant"
  ADD COLUMN "catalogImageStatus" TEXT NOT NULL DEFAULT 'exact',
  ADD COLUMN "catalogImageLabel" TEXT;

ALTER TABLE "Variant"
  DROP CONSTRAINT "Variant_catalogStatus_valid",
  ADD CONSTRAINT "Variant_catalogStatus_valid"
    CHECK ("catalogStatus" IN ('active', 'published', 'pending_review', 'archived', 'test'));

ALTER TABLE "Variant"
  ADD CONSTRAINT "Variant_catalogImageStatus_valid"
    CHECK ("catalogImageStatus" IN ('exact', 'placeholder', 'pending'));

CREATE INDEX "Variant_catalogImageStatus_idx" ON "Variant"("catalogImageStatus");
