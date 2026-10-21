-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_retailerId_createdAt_idx" ON "Order"("retailerId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_variantId_idx" ON "OrderItem"("variantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_retailerId_updatedAt_idx" ON "Invoice"("retailerId", "updatedAt");
CREATE INDEX IF NOT EXISTS "Invoice_retailerId_outstandingAmount_idx" ON "Invoice"("retailerId", "outstandingAmount");
