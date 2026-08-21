-- Existing orders predate the SAP identity columns. Populate the deterministic
-- external reference used for idempotent SAP reconciliation before production
-- outbox delivery is enabled.
UPDATE "Order"
SET "sapExternalReference" = 'GGN-' || lpad("orderNo"::text, 8, '0')
WHERE "sapExternalReference" IS NULL;
