-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'reversed';

-- AlterTable
ALTER TABLE "PaymentReversal" ADD COLUMN     "unallocatedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PaymentReversalAllocation" (
    "id" TEXT NOT NULL,
    "paymentReversalId" TEXT NOT NULL,
    "paymentAllocationId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReversalAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentReversalAllocation_paymentAllocationId_createdAt_idx" ON "PaymentReversalAllocation"("paymentAllocationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReversalAllocation_paymentReversalId_paymentAllocati_key" ON "PaymentReversalAllocation"("paymentReversalId", "paymentAllocationId");

-- AddForeignKey
ALTER TABLE "PaymentReversalAllocation" ADD CONSTRAINT "PaymentReversalAllocation_paymentReversalId_fkey" FOREIGN KEY ("paymentReversalId") REFERENCES "PaymentReversal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReversalAllocation" ADD CONSTRAINT "PaymentReversalAllocation_paymentAllocationId_fkey" FOREIGN KEY ("paymentAllocationId") REFERENCES "PaymentAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentReversal" ADD CONSTRAINT "PaymentReversal_unallocated_bounds_check" CHECK ("unallocatedAmount" >= 0 AND "unallocatedAmount" <= "amount");
ALTER TABLE "PaymentReversalAllocation" ADD CONSTRAINT "PaymentReversalAllocation_amount_positive_check" CHECK ("amount" > 0);

-- Existing environments need the new authority without a destructive reseed.
INSERT INTO "Permission" ("id", "name", "description", "createdAt")
VALUES ('permission-financial-correct', 'financial.correct', 'Issue audited credit notes and payment reversals.', CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "Role" role
CROSS JOIN "Permission" permission
WHERE role."name" IN ('accounts', 'platform_admin')
  AND permission."name" = 'financial.correct'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
