-- AlterTable
ALTER TABLE "StaffUser" ADD COLUMN     "managerId" TEXT;

-- CreateIndex
CREATE INDEX "StaffUser_managerId_idx" ON "StaffUser"("managerId");

-- AddForeignKey
ALTER TABLE "StaffUser" ADD CONSTRAINT "StaffUser_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
