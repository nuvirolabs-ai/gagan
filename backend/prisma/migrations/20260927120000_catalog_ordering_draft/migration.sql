CREATE TABLE "CatalogOrderingDraft" (
  "variantId" TEXT NOT NULL,
  "values" JSONB NOT NULL,
  "updatedByStaffId" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CatalogOrderingDraft_pkey" PRIMARY KEY ("variantId")
);

ALTER TABLE "CatalogOrderingDraft" ADD CONSTRAINT "CatalogOrderingDraft_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
