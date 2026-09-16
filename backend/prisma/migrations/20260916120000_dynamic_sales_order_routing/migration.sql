-- Additive only. Existing static seller/GST snapshots and historical
-- transactions are not backfilled or rewritten.
ALTER TABLE "Retailer" ADD COLUMN "deliveryCity" TEXT;
ALTER TABLE "Variant" ADD COLUMN "routingClass" TEXT;
ALTER TABLE "Variant" ADD COLUMN "routingBagEquivalent" DECIMAL(12,3);

-- Dynamic rows are allowed to leave the legacy static seller empty. Legacy
-- rows still require the original seller/GST pair, and unconfigured rows
-- remain seller/GST NULL as before.
ALTER TABLE "Variant" DROP CONSTRAINT "Variant_commercial_valid";
ALTER TABLE "Variant"
  ADD CONSTRAINT "Variant_commercial_valid" CHECK (
    ("sellingEntity" IS NULL AND "gstPercent" IS NULL AND "routingClass" IS NULL AND "routingBagEquivalent" IS NULL)
    OR (
      "sellingEntity" IS NOT NULL
      AND "sellingEntity" IN ('jain_traders','padam_international')
      AND "gstPercent" IS NOT NULL
      AND "gstPercent" BETWEEN 0 AND 100
    )
    OR (
      "sellingEntity" IS NULL
      AND "routingClass" IS NOT NULL
      AND "gstPercent" IS NOT NULL
      AND "gstPercent" BETWEEN 0 AND 100
    )
  );

ALTER TABLE "Variant"
  ADD CONSTRAINT "Variant_routing_configuration_check"
  CHECK (
    "routingClass" IS NULL
    OR (
      "routingClass" = 'LAXMI_TOOR'
      AND "routingBagEquivalent" IS NULL
    )
    OR (
      "routingClass" = 'INSTANT_MIX'
      AND ("routingBagEquivalent" IS NULL OR "routingBagEquivalent" > 0)
    )
    OR (
      "routingClass" = 'OTHER'
      AND "routingBagEquivalent" IS NOT NULL
      AND "routingBagEquivalent" > 0
    )
  );
