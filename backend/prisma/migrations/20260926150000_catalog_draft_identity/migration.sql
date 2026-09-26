-- Keep existing pack sizes with different case counts distinct. Fail closed on
-- genuine normalized duplicates so no catalogue row is changed by migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Product" GROUP BY lower(btrim("name")) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate normalized Product names must be reviewed before catalogue identity migration';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Variant"
    GROUP BY "productId", lower(btrim("unitSize")), "unitsPerCase"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate normalized Variant pack identities must be reviewed before catalogue identity migration';
  END IF;
END $$;

CREATE UNIQUE INDEX "Product_normalized_name_key" ON "Product" (lower(btrim("name")));
CREATE UNIQUE INDEX "Variant_normalized_pack_key" ON "Variant" ("productId", lower(btrim("unitSize")), "unitsPerCase");
