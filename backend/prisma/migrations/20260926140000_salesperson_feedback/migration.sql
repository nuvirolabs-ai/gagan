CREATE TABLE "SalespersonFeedback" (
  "id" TEXT NOT NULL,
  "retailerId" TEXT NOT NULL,
  "salesRepId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "clientReference" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalespersonFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalespersonFeedback_retailerId_clientReference_key" ON "SalespersonFeedback"("retailerId", "clientReference");
CREATE INDEX "SalespersonFeedback_retailerId_createdAt_idx" ON "SalespersonFeedback"("retailerId", "createdAt");
CREATE INDEX "SalespersonFeedback_salesRepId_createdAt_idx" ON "SalespersonFeedback"("salesRepId", "createdAt");
ALTER TABLE "SalespersonFeedback" ADD CONSTRAINT "SalespersonFeedback_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalespersonFeedback" ADD CONSTRAINT "SalespersonFeedback_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "SalesRep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
