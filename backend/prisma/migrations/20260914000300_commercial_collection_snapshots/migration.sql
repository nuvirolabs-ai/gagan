ALTER TABLE "CollectionSubmission" ADD COLUMN "invoiceScopeId" TEXT REFERENCES "Invoice"("id"), ADD COLUMN "jainAmount" DECIMAL(14,2), ADD COLUMN "padamAmount" DECIMAL(14,2),
 ADD CONSTRAINT "CollectionSubmission_split" CHECK ("invoiceScopeId" IS NULL OR ("jainAmount" IS NOT NULL AND "padamAmount" IS NOT NULL AND "jainAmount" >= 0 AND "padamAmount" >= 0 AND "jainAmount" + "padamAmount" = "amount"));
CREATE FUNCTION protect_commercial_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD."commercialSnapshot" IS NOT NULL AND NEW."commercialSnapshot" IS DISTINCT FROM OLD."commercialSnapshot" THEN
  RAISE EXCEPTION 'commercial_snapshot_immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER order_commercial_snapshot BEFORE UPDATE ON "Order" FOR EACH ROW EXECUTE FUNCTION protect_commercial_snapshot();
CREATE TRIGGER item_commercial_snapshot BEFORE UPDATE ON "OrderItem" FOR EACH ROW EXECUTE FUNCTION protect_commercial_snapshot();
CREATE TRIGGER invoice_commercial_snapshot BEFORE UPDATE ON "Invoice" FOR EACH ROW EXECUTE FUNCTION protect_commercial_snapshot();
