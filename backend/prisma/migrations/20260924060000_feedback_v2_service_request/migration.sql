ALTER TYPE "ServiceIssueStatus" ADD VALUE IF NOT EXISTS 'withdrawn';

ALTER TABLE "ServiceIssue"
  ALTER COLUMN "raisedByStaffId" DROP NOT NULL,
  ADD COLUMN "clientReference" TEXT,
  ADD COLUMN "withdrawnAt" TIMESTAMP(3),
  ADD COLUMN "withdrawnByRetailerId" TEXT,
  ADD COLUMN "withdrawnFromStatus" "ServiceIssueStatus";

CREATE UNIQUE INDEX "ServiceIssue_retailerId_clientReference_key"
  ON "ServiceIssue"("retailerId", "clientReference");
