CREATE TABLE "RetailerProposalOrderIntent" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "submittedByStaffId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "convertedOrderId" TEXT,
    "conversionCommercialQuoteId" TEXT,
    "punchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "convertedAt" TIMESTAMP(3),

    CONSTRAINT "RetailerProposalOrderIntent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RetailerProposalOrderIntentItem" (
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "unitSize" TEXT NOT NULL,
    "unitsPerCase" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,

    CONSTRAINT "RetailerProposalOrderIntentItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RetailerProposalOrderIntent_convertedOrderId_key" ON "RetailerProposalOrderIntent"("convertedOrderId");
CREATE UNIQUE INDEX "RetailerProposalOrderIntent_proposalId_idempotencyKey_key" ON "RetailerProposalOrderIntent"("proposalId", "idempotencyKey");
CREATE INDEX "RetailerProposalOrderIntent_submittedByStaffId_punchedAt_idx" ON "RetailerProposalOrderIntent"("submittedByStaffId", "punchedAt");
CREATE UNIQUE INDEX "RetailerProposalOrderIntentItem_intentId_variantId_key" ON "RetailerProposalOrderIntentItem"("intentId", "variantId");

ALTER TABLE "RetailerProposalOrderIntent" ADD CONSTRAINT "RetailerProposalOrderIntent_proposalId_fkey"
    FOREIGN KEY ("proposalId") REFERENCES "RetailerProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RetailerProposalOrderIntent" ADD CONSTRAINT "RetailerProposalOrderIntent_submittedByStaffId_fkey"
    FOREIGN KEY ("submittedByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RetailerProposalOrderIntent" ADD CONSTRAINT "RetailerProposalOrderIntent_convertedOrderId_fkey"
    FOREIGN KEY ("convertedOrderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RetailerProposalOrderIntentItem" ADD CONSTRAINT "RetailerProposalOrderIntentItem_intentId_fkey"
    FOREIGN KEY ("intentId") REFERENCES "RetailerProposalOrderIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetailerProposalOrderIntentItem" ADD CONSTRAINT "RetailerProposalOrderIntentItem_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
