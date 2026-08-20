-- AlterTable
ALTER TABLE "ApprovalDispute" ADD COLUMN     "acknowledgedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "ApprovalDispute_one_open_request_idx"
ON "ApprovalDispute"("approvalRequestId")
WHERE "status" IN ('open', 'escalated');
