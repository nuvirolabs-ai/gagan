CREATE TYPE "SalesOrderCompany" AS ENUM ('jain_traders', 'padam_international');

CREATE TABLE "CompanySalesOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "company" "SalesOrderCompany" NOT NULL,
    "reference" TEXT NOT NULL,
    "deliveryCity" TEXT NOT NULL,
    "deliveryAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "routeId" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "sapSalesOrderId" TEXT,
    "sapDocEntry" INTEGER,
    "sapDocNum" INTEGER,
    "sapSyncStatus" "SapOrderSyncStatus" NOT NULL DEFAULT 'pending',
    "sapErrorMessage" TEXT,
    "sapLastSyncedAt" TIMESTAMP(3),
    CONSTRAINT "CompanySalesOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanySalesOrder_reference_key" ON "CompanySalesOrder"("reference");
CREATE UNIQUE INDEX "CompanySalesOrder_orderId_company_key" ON "CompanySalesOrder"("orderId", "company");
CREATE UNIQUE INDEX "CompanySalesOrder_id_orderId_key" ON "CompanySalesOrder"("id", "orderId");

ALTER TABLE "CompanySalesOrder" ADD CONSTRAINT "CompanySalesOrder_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "OrderItem" ADD COLUMN "companySalesOrderId" TEXT;
CREATE INDEX "OrderItem_companySalesOrderId_idx" ON "OrderItem"("companySalesOrderId");
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_companySalesOrderId_orderId_fkey"
    FOREIGN KEY ("companySalesOrderId", "orderId") REFERENCES "CompanySalesOrder"("id", "orderId") ON DELETE RESTRICT ON UPDATE NO ACTION;
