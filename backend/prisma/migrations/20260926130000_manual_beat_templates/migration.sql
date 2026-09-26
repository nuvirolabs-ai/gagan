CREATE TYPE "BeatTemplateOrigin" AS ENUM ('leader', 'self');

CREATE TABLE "BeatTemplate" (
    "id" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "createdByStaffId" TEXT NOT NULL,
    "origin" "BeatTemplateOrigin" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BeatTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BeatTemplateStop" (
    "id" TEXT NOT NULL,
    "beatTemplateId" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "purpose" "VisitPurpose" NOT NULL DEFAULT 'sales_call',
    "note" TEXT,
    CONSTRAINT "BeatTemplateStop_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BeatTemplate_salespersonId_origin_idx" ON "BeatTemplate"("salespersonId", "origin");
CREATE UNIQUE INDEX "BeatTemplateStop_beatTemplateId_retailerId_key" ON "BeatTemplateStop"("beatTemplateId", "retailerId");
CREATE UNIQUE INDEX "BeatTemplateStop_beatTemplateId_sequence_key" ON "BeatTemplateStop"("beatTemplateId", "sequence");

ALTER TABLE "BeatTemplate" ADD CONSTRAINT "BeatTemplate_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BeatTemplate" ADD CONSTRAINT "BeatTemplate_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BeatTemplateStop" ADD CONSTRAINT "BeatTemplateStop_beatTemplateId_fkey" FOREIGN KEY ("beatTemplateId") REFERENCES "BeatTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BeatTemplateStop" ADD CONSTRAINT "BeatTemplateStop_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
