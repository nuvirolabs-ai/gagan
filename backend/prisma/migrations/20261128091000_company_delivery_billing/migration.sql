ALTER TABLE "CompanySalesOrder"
  ADD COLUMN "deliveryResolvedAt" TIMESTAMP(3),
  ADD COLUMN "podType" "PodType",
  ADD COLUMN "podCapturedAt" TIMESTAMP(3);

UPDATE "CompanySalesOrder"
SET "deliveryResolvedAt" = "deliveredAt"
WHERE "deliveredAt" IS NOT NULL;
