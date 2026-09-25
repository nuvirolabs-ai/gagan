-- Close SQL three-valued-logic loopholes; unknown legacy ownership stays NULL.
ALTER TABLE "Variant" DROP CONSTRAINT "Variant_commercial_valid";
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_commercial_valid" CHECK (
 ("sellingEntity" IS NULL AND "gstPercent" IS NULL) OR
 ("sellingEntity" IS NOT NULL AND "sellingEntity" IN ('jain_traders','padam_international')
  AND "gstPercent" IS NOT NULL AND "gstPercent" BETWEEN 0 AND 100)
);
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_commercial_valid" CHECK (
 ("sellingEntity" IS NULL AND "taxableBase" IS NULL AND "gstPercent" IS NULL AND "taxAmount" IS NULL) OR
 ("sellingEntity" IS NOT NULL AND "sellingEntity" IN ('jain_traders','padam_international')
  AND "taxableBase" IS NOT NULL AND "taxableBase" >= 0
  AND "gstPercent" IS NOT NULL AND "gstPercent" BETWEEN 0 AND 100
  AND "taxAmount" IS NOT NULL AND "taxAmount" >= 0
  AND "lineTotal" = "taxableBase" + "taxAmount")
);
CREATE FUNCTION protect_invoice_line_commercial() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD."sellingEntity" IS NOT NULL AND
   ROW(NEW."invoiceId",NEW."orderItemId",NEW."sellingEntity",NEW."taxableBase",NEW."gstPercent",NEW."taxAmount",NEW."lineTotal")
   IS DISTINCT FROM ROW(OLD."invoiceId",OLD."orderItemId",OLD."sellingEntity",OLD."taxableBase",OLD."gstPercent",OLD."taxAmount",OLD."lineTotal")
 THEN RAISE EXCEPTION 'Accepted commercial invoice line is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "InvoiceLine_commercial_immutable" BEFORE UPDATE ON "InvoiceLine" FOR EACH ROW EXECUTE FUNCTION protect_invoice_line_commercial();
