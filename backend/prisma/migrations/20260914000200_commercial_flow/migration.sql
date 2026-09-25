-- Additive: legacy prices remain per case and legacy ownership remains unknown.
ALTER TABLE "Variant" ADD COLUMN "sellingEntity" TEXT, ADD COLUMN "gstPercent" DECIMAL(5,2),
 ADD CONSTRAINT "Variant_commercial_valid" CHECK (("sellingEntity" IS NULL AND "gstPercent" IS NULL) OR ("sellingEntity" IN ('jain_traders','padam_international') AND "gstPercent" IS NOT NULL AND "gstPercent" BETWEEN 0 AND 100));
ALTER TABLE "PriceList" ADD COLUMN "rateBasis" TEXT NOT NULL DEFAULT 'case', ADD CONSTRAINT "PriceList_basis" CHECK ("rateBasis" IN ('case','quintal'));
ALTER TABLE "PriceOverride" ADD COLUMN "rateBasis" TEXT NOT NULL DEFAULT 'case', ADD CONSTRAINT "PriceOverride_basis" CHECK ("rateBasis" IN ('case','quintal'));
CREATE TABLE "CommercialQuote" (
 "id" TEXT PRIMARY KEY, "retailerId" TEXT NOT NULL REFERENCES "Retailer"("id"), "snapshot" JSONB NOT NULL,
 "revision" INTEGER NOT NULL DEFAULT 1, "freightConfirmedByStaffId" TEXT REFERENCES "StaffUser"("id"),
 "expiresAt" TIMESTAMP(3) NOT NULL, "acceptedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CommercialQuote_retailerId_createdAt_idx" ON "CommercialQuote"("retailerId","createdAt");
ALTER TABLE "Order" ADD COLUMN "commercialQuoteId" TEXT REFERENCES "CommercialQuote"("id"), ADD COLUMN "commercialSnapshot" JSONB;
CREATE UNIQUE INDEX "Order_commercialQuoteId_key" ON "Order"("commercialQuoteId");
ALTER TABLE "OrderItem" ADD COLUMN "commercialSnapshot" JSONB;
ALTER TABLE "Invoice" ADD COLUMN "commercialSnapshot" JSONB;
ALTER TABLE "InvoiceLine" ADD COLUMN "sellingEntity" TEXT, ADD COLUMN "taxableBase" DECIMAL(14,2), ADD COLUMN "gstPercent" DECIMAL(5,2), ADD COLUMN "taxAmount" DECIMAL(14,2);
ALTER TABLE "Payment" ADD COLUMN "invoiceScopeId" TEXT REFERENCES "Invoice"("id"),
 ADD COLUMN "confirmedJainAmount" DECIMAL(14,2), ADD COLUMN "confirmedPadamAmount" DECIMAL(14,2),
 ADD COLUMN "confirmedByStaffId" TEXT REFERENCES "StaffUser"("id"), ADD COLUMN "confirmedMethod" TEXT,
 ADD COLUMN "confirmedReference" TEXT, ADD COLUMN "requestKey" TEXT, ADD COLUMN "requestFingerprint" TEXT,
 ADD CONSTRAINT "Payment_confirmed_split" CHECK ("invoiceScopeId" IS NULL OR ("confirmedJainAmount" IS NOT NULL AND "confirmedPadamAmount" IS NOT NULL AND "confirmedJainAmount" >= 0 AND "confirmedPadamAmount" >= 0 AND "confirmedJainAmount" + "confirmedPadamAmount" = "amount" AND "confirmedByStaffId" IS NOT NULL));
CREATE UNIQUE INDEX "Payment_requestKey_key" ON "Payment"("requestKey");
ALTER TABLE "PaymentAllocation" ADD COLUMN "jainAmount" DECIMAL(14,2), ADD COLUMN "padamAmount" DECIMAL(14,2),
 ADD CONSTRAINT "PaymentAllocation_split" CHECK (("jainAmount" IS NULL AND "padamAmount" IS NULL) OR ("jainAmount" IS NOT NULL AND "padamAmount" IS NOT NULL AND "jainAmount" >= 0 AND "padamAmount" >= 0 AND "jainAmount" + "padamAmount" = "amount"));
