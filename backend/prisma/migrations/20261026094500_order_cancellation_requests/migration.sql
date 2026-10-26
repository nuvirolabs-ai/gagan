-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cancellationRequestedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT,
ADD COLUMN IF NOT EXISTS "cancellationRequestedByRepId" TEXT,
ADD COLUMN IF NOT EXISTS "cancellationStatus" TEXT,
ADD COLUMN IF NOT EXISTS "cancellationDecisionNote" TEXT,
ADD COLUMN IF NOT EXISTS "cancellationDecidedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "cancellationDecidedByStaffId" TEXT;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Order_cancellationRequestedByRepId_fkey'
    ) THEN
        ALTER TABLE "Order" ADD CONSTRAINT "Order_cancellationRequestedByRepId_fkey" FOREIGN KEY ("cancellationRequestedByRepId") REFERENCES "SalesRep"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Order_cancellationDecidedByStaffId_fkey'
    ) THEN
        ALTER TABLE "Order" ADD CONSTRAINT "Order_cancellationDecidedByStaffId_fkey" FOREIGN KEY ("cancellationDecidedByStaffId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    END IF;
END $$;
