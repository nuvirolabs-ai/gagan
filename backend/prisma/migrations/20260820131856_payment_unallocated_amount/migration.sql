-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "unallocatedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_unallocated_nonnegative_check" CHECK ("unallocatedAmount" >= 0);
