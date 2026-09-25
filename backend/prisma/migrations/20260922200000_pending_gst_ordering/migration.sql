-- A reviewed staging row may be orderable before GST is finalized, but only
-- when this explicit flag is set. This does not represent a 0% tax rate.
ALTER TABLE "Variant" ADD COLUMN "gstPendingOrderAllowed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Variant" DROP CONSTRAINT "Variant_commercial_valid";
ALTER TABLE "Variant"
  ADD CONSTRAINT "Variant_commercial_valid" CHECK (
    ("sellingEntity" IS NULL AND "gstPercent" IS NULL AND "routingClass" IS NULL AND "routingBagEquivalent" IS NULL AND "gstPendingOrderAllowed" = false)
    OR (
      "sellingEntity" IS NOT NULL
      AND "sellingEntity" IN ('jain_traders','padam_international')
      AND "gstPercent" IS NOT NULL
      AND "gstPercent" BETWEEN 0 AND 100
      AND "gstPendingOrderAllowed" = false
    )
    OR (
      "sellingEntity" IS NULL
      AND "routingClass" IS NOT NULL
      AND "gstPercent" IS NOT NULL
      AND "gstPercent" BETWEEN 0 AND 100
      AND "gstPendingOrderAllowed" = false
    )
    OR (
      "sellingEntity" IS NULL
      AND "routingClass" IS NOT NULL
      AND "gstPercent" IS NULL
      AND "gstPendingOrderAllowed" = true
    )
  );
