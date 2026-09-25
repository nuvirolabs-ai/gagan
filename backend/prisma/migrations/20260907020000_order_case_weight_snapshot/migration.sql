ALTER TABLE "OrderItem" ADD COLUMN "caseWeightKgSnapshot" DECIMAL(24,3);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_positive_case_weight_snapshot"
CHECK ("caseWeightKgSnapshot" IS NULL OR "caseWeightKgSnapshot" > 0);
-- Never infer an old agreement from today's mutable master. Legacy rows stay null.
CREATE FUNCTION preserve_order_case_weight_snapshot() RETURNS trigger AS $$
BEGIN
  IF OLD."caseWeightKgSnapshot" IS NOT NULL
     AND NEW."caseWeightKgSnapshot" IS DISTINCT FROM OLD."caseWeightKgSnapshot" THEN
    RAISE EXCEPTION 'Accepted order case weight is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "OrderItem_preserve_case_weight_snapshot"
BEFORE UPDATE ON "OrderItem" FOR EACH ROW
EXECUTE FUNCTION preserve_order_case_weight_snapshot();
