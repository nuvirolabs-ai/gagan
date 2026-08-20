-- Historical opening and SAP invoices may not originate from an app order.
ALTER TABLE "Invoice" ALTER COLUMN "orderId" DROP NOT NULL;
ALTER TABLE "Invoice" ADD COLUMN "legacyLedgerEntryId" TEXT;

CREATE UNIQUE INDEX "Invoice_legacyLedgerEntryId_key" ON "Invoice"("legacyLedgerEntryId");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_legacyLedgerEntryId_fkey"
FOREIGN KEY ("legacyLedgerEntryId") REFERENCES "LedgerEntry"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
