-- Field collection stays outside the ledger until Accounts confirmation.
CREATE TYPE "CollectionMethod" AS ENUM ('cash', 'cheque', 'neft', 'upi');
CREATE TYPE "CollectionSubmissionStatus" AS ENUM ('pending', 'confirming', 'confirmed', 'rejected');

CREATE TABLE "CollectionSubmission" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "collectorStaffId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "CollectionMethod" NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" "CollectionSubmissionStatus" NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "paymentId" TEXT,
    "confirmedByStaffId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CollectionEvidence" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CollectionAssignment" (
    "id" TEXT NOT NULL,
    "collectorStaffId" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "CollectionAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CollectionSubmission_idempotencyKey_key" ON "CollectionSubmission"("idempotencyKey");
CREATE UNIQUE INDEX "CollectionSubmission_paymentId_key" ON "CollectionSubmission"("paymentId");
CREATE INDEX "CollectionSubmission_status_submittedAt_idx" ON "CollectionSubmission"("status", "submittedAt");
CREATE INDEX "CollectionSubmission_retailerId_submittedAt_idx" ON "CollectionSubmission"("retailerId", "submittedAt");
CREATE INDEX "CollectionSubmission_collectorStaffId_submittedAt_idx" ON "CollectionSubmission"("collectorStaffId", "submittedAt");
CREATE UNIQUE INDEX "CollectionEvidence_objectKey_key" ON "CollectionEvidence"("objectKey");
CREATE INDEX "CollectionEvidence_submissionId_createdAt_idx" ON "CollectionEvidence"("submissionId", "createdAt");
CREATE UNIQUE INDEX "CollectionAssignment_collectorStaffId_retailerId_key" ON "CollectionAssignment"("collectorStaffId", "retailerId");
CREATE INDEX "CollectionAssignment_collectorStaffId_active_assignedAt_idx" ON "CollectionAssignment"("collectorStaffId", "active", "assignedAt");

ALTER TABLE "CollectionSubmission" ADD CONSTRAINT "CollectionSubmission_retailerId_fkey"
  FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CollectionSubmission" ADD CONSTRAINT "CollectionSubmission_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CollectionEvidence" ADD CONSTRAINT "CollectionEvidence_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "CollectionSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CollectionAssignment" ADD CONSTRAINT "CollectionAssignment_retailerId_fkey"
  FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
