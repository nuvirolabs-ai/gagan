-- Fail closed: existing conflicts require business reconciliation, never deletion.
DO $$ BEGIN
  IF EXISTS (
    SELECT "salespersonId" FROM "SalesVisit" WHERE "checkedOutAt" IS NULL
    GROUP BY "salespersonId" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Multiple open SalesVisit rows exist; reconcile explicitly before migration';
  END IF;
END $$;
CREATE UNIQUE INDEX "SalesVisit_one_open_per_salesperson"
ON "SalesVisit" ("salespersonId") WHERE "checkedOutAt" IS NULL;
