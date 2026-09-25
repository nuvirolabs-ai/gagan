CREATE TYPE "RetailerInternalSegment" AS ENUM ('A', 'B', 'C');

ALTER TABLE "Retailer"
ADD COLUMN "internalSegment" "RetailerInternalSegment";
