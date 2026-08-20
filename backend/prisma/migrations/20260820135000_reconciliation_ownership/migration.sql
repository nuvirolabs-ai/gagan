-- Every financial difference has an operational owner from the moment it is recorded.
ALTER TABLE "ReconciliationIssue"
ADD COLUMN "ownerRole" TEXT NOT NULL DEFAULT 'accounts';
