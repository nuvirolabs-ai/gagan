ALTER TABLE "Invoice"
  ADD COLUMN "companySalesOrderId" TEXT,
  ADD COLUMN "sellingEntity" "SalesOrderCompany",
  ADD COLUMN "firmInvoiceNumber" TEXT,
  ADD COLUMN "billingSnapshot" JSONB;

DROP INDEX "Invoice_orderId_key";
CREATE INDEX "Invoice_orderId_idx" ON "Invoice"("orderId");
CREATE UNIQUE INDEX "Invoice_legacy_order_key" ON "Invoice"("orderId")
  WHERE "companySalesOrderId" IS NULL;
CREATE UNIQUE INDEX "Invoice_companySalesOrderId_key" ON "Invoice"("companySalesOrderId");
CREATE UNIQUE INDEX "Invoice_companySalesOrderId_orderId_key" ON "Invoice"("companySalesOrderId", "orderId");
CREATE UNIQUE INDEX "Invoice_firmInvoiceNumber_key" ON "Invoice"("firmInvoiceNumber");

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_companySalesOrderId_orderId_fkey"
    FOREIGN KEY ("companySalesOrderId", "orderId") REFERENCES "CompanySalesOrder"("id", "orderId")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "Invoice_firm_billing_valid"
    CHECK (
      ("companySalesOrderId" IS NULL AND "sellingEntity" IS NULL AND "firmInvoiceNumber" IS NULL AND "billingSnapshot" IS NULL)
      OR ("companySalesOrderId" IS NOT NULL AND "orderId" IS NOT NULL AND
          "sellingEntity" IS NOT NULL AND "firmInvoiceNumber" IS NOT NULL AND "billingSnapshot" IS NOT NULL)
    );

CREATE TABLE "CompanyInvoiceSequence" (
  "company" "SalesOrderCompany" NOT NULL,
  "financialYear" INTEGER NOT NULL,
  "lastNumber" INTEGER NOT NULL,
  CONSTRAINT "CompanyInvoiceSequence_pkey" PRIMARY KEY ("company", "financialYear")
);

CREATE FUNCTION protect_firm_invoice() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."companySalesOrderId" IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM "CompanySalesOrder" AS company_order JOIN "Order" AS source_order
        ON source_order."id" = company_order."orderId"
      WHERE company_order."id" = NEW."companySalesOrderId"
        AND company_order."company" = NEW."sellingEntity"
        AND source_order."retailerId" = NEW."retailerId"
    ) THEN
      RAISE EXCEPTION 'firm_invoice_company_mismatch';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD."companySalesOrderId" IS NOT NULL AND
    (NEW."companySalesOrderId", NEW."sellingEntity", NEW."firmInvoiceNumber", NEW."billingSnapshot",
     NEW."retailerId", NEW."orderId", NEW."subtotal", NEW."taxTotal", NEW."total",
     NEW."invoiceDate", NEW."dueDate", NEW."currency", NEW."idempotencyKey") IS DISTINCT FROM
    (OLD."companySalesOrderId", OLD."sellingEntity", OLD."firmInvoiceNumber", OLD."billingSnapshot",
     OLD."retailerId", OLD."orderId", OLD."subtotal", OLD."taxTotal", OLD."total",
     OLD."invoiceDate", OLD."dueDate", OLD."currency", OLD."idempotencyKey")
  THEN
    RAISE EXCEPTION 'firm_invoice_immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER invoice_firm_snapshot BEFORE INSERT OR UPDATE ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION protect_firm_invoice();
