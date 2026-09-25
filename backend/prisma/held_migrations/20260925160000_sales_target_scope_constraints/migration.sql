-- Held outside prisma/migrations: routine migrate deploy must not contract before
-- evidence-approved classification and a guarded backfill have completed.
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "SalesTarget" WHERE "scope" IS NULL) THEN
    RAISE EXCEPTION 'target_scope_unresolved';
  END IF;
END;
$$;

ALTER TABLE "SalesTarget" ALTER COLUMN "scope" SET NOT NULL;
CREATE UNIQUE INDEX "SalesTarget_salespersonId_scope_metric_periodStart_periodEnd_key"
ON "SalesTarget"("salespersonId", "scope", "metric", "periodStart", "periodEnd");
DROP INDEX "SalesTarget_salespersonId_metric_periodStart_periodEnd_key";

COMMIT;
