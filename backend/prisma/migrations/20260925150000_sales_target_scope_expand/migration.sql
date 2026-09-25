CREATE TYPE "SalesTargetScope" AS ENUM ('PERSONAL', 'TEAM');

ALTER TABLE "SalesTarget" ADD COLUMN "scope" "SalesTargetScope";

CREATE TABLE "TargetWriteGate" (
  "name" TEXT NOT NULL PRIMARY KEY,
  "paused" BOOLEAN NOT NULL DEFAULT FALSE
);

INSERT INTO "TargetWriteGate" ("name", "paused") VALUES ('sales_target_writes', FALSE);

CREATE FUNCTION enforce_sales_target_write_gate() RETURNS trigger AS $$
DECLARE
  writes_paused BOOLEAN;
BEGIN
  SELECT "paused" INTO writes_paused FROM "TargetWriteGate" WHERE "name" = 'sales_target_writes';
  IF writes_paused THEN
    IF TG_OP = 'UPDATE'
       AND NEW."scope" IS DISTINCT FROM OLD."scope"
       AND NEW."id" IS NOT DISTINCT FROM OLD."id"
       AND NEW."salespersonId" IS NOT DISTINCT FROM OLD."salespersonId"
       AND NEW."metric" IS NOT DISTINCT FROM OLD."metric"
       AND NEW."periodStart" IS NOT DISTINCT FROM OLD."periodStart"
       AND NEW."periodEnd" IS NOT DISTINCT FROM OLD."periodEnd"
       AND NEW."targetValue" IS NOT DISTINCT FROM OLD."targetValue"
       AND NEW."createdByStaffId" IS NOT DISTINCT FROM OLD."createdByStaffId"
       AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt"
       AND NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'target_writes_paused' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sales_target_write_gate
BEFORE INSERT OR UPDATE OR DELETE ON "SalesTarget"
FOR EACH ROW EXECUTE FUNCTION enforce_sales_target_write_gate();
