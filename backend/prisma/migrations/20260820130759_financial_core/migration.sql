-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('open', 'partially_paid', 'paid', 'voided');

-- CreateEnum
CREATE TYPE "FinancialDirection" AS ENUM ('debit', 'credit');

-- CreateEnum
CREATE TYPE "FinancialLedgerKind" AS ENUM ('invoice', 'payment', 'credit_note', 'payment_reversal');

-- CreateEnum
CREATE TYPE "CreditNoteStatus" AS ENUM ('issued', 'reversed');

-- CreateEnum
CREATE TYPE "ReconciliationIssueStatus" AS ENUM ('open', 'resolved', 'ignored');

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" SERIAL NOT NULL,
    "retailerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "subtotal" DECIMAL(14,2) NOT NULL,
    "taxTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "outstandingAmount" DECIMAL(14,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'open',
    "idempotencyKey" TEXT NOT NULL,
    "sapInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "descriptionSnapshot" TEXT NOT NULL,
    "itemCodeSnapshot" TEXT,
    "deliveredCases" INTEGER,
    "deliveredWeightKg" DECIMAL(14,3),
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialLedgerEntry" (
    "id" TEXT NOT NULL,
    "sequence" BIGSERIAL NOT NULL,
    "retailerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "paymentId" TEXT,
    "creditNoteId" TEXT,
    "paymentReversalId" TEXT,
    "direction" "FinancialDirection" NOT NULL,
    "kind" "FinancialLedgerKind" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balanceAfter" DECIMAL(14,2) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvidence" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'issued',
    "idempotencyKey" TEXT NOT NULL,
    "sapCreditNoteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReversal" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReversal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationIssue" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT,
    "kind" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "expectedAmount" DECIMAL(14,2),
    "actualAmount" DECIMAL(14,2),
    "status" "ReconciliationIssueStatus" NOT NULL DEFAULT 'open',
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReconciliationIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orderId_key" ON "Invoice"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_idempotencyKey_key" ON "Invoice"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_sapInvoiceId_key" ON "Invoice"("sapInvoiceId");

-- CreateIndex
CREATE INDEX "Invoice_retailerId_status_dueDate_idx" ON "Invoice"("retailerId", "status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceLine_invoiceId_orderItemId_key" ON "InvoiceLine"("invoiceId", "orderItemId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_invoiceId_createdAt_idx" ON "PaymentAllocation"("invoiceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_paymentId_invoiceId_key" ON "PaymentAllocation"("paymentId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialLedgerEntry_sequence_key" ON "FinancialLedgerEntry"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialLedgerEntry_invoiceId_key" ON "FinancialLedgerEntry"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialLedgerEntry_paymentId_key" ON "FinancialLedgerEntry"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialLedgerEntry_creditNoteId_key" ON "FinancialLedgerEntry"("creditNoteId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialLedgerEntry_paymentReversalId_key" ON "FinancialLedgerEntry"("paymentReversalId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialLedgerEntry_idempotencyKey_key" ON "FinancialLedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_retailerId_sequence_idx" ON "FinancialLedgerEntry"("retailerId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvidence_objectKey_key" ON "PaymentEvidence"("objectKey");

-- CreateIndex
CREATE INDEX "PaymentEvidence_paymentId_createdAt_idx" ON "PaymentEvidence"("paymentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_idempotencyKey_key" ON "CreditNote"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_sapCreditNoteId_key" ON "CreditNote"("sapCreditNoteId");

-- CreateIndex
CREATE INDEX "CreditNote_invoiceId_createdAt_idx" ON "CreditNote"("invoiceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReversal_idempotencyKey_key" ON "PaymentReversal"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentReversal_paymentId_createdAt_idx" ON "PaymentReversal"("paymentId", "createdAt");

-- CreateIndex
CREATE INDEX "ReconciliationIssue_status_createdAt_idx" ON "ReconciliationIssue"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationIssue_kind_referenceType_referenceId_key" ON "ReconciliationIssue"("kind", "referenceType", "referenceId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_paymentReversalId_fkey" FOREIGN KEY ("paymentReversalId") REFERENCES "PaymentReversal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvidence" ADD CONSTRAINT "PaymentEvidence_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReversal" ADD CONSTRAINT "PaymentReversal_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationIssue" ADD CONSTRAINT "ReconciliationIssue_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Financial documents are append-only business facts. Keep invalid monetary
-- states out even if a future application path bypasses a domain validator.
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_total_nonnegative_check" CHECK ("total" >= 0);
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subtotal_tax_nonnegative_check" CHECK ("subtotal" >= 0 AND "taxTotal" >= 0);
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_outstanding_bounds_check" CHECK ("outstandingAmount" >= 0 AND "outstandingAmount" <= "total");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_due_date_check" CHECK ("dueDate" >= "invoiceDate");

ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_amounts_nonnegative_check" CHECK ("unitPrice" >= 0 AND "lineTotal" >= 0);
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_delivery_resolution_check" CHECK (
    ("deliveredCases" IS NOT NULL AND "deliveredCases" >= 0)
    OR ("deliveredWeightKg" IS NOT NULL AND "deliveredWeightKg" >= 0)
);

ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_amount_positive_check" CHECK ("amount" > 0);
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_amount_positive_check" CHECK ("amount" > 0);
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_one_source_check" CHECK (
    num_nonnulls("invoiceId", "paymentId", "creditNoteId", "paymentReversalId") = 1
);
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_kind_source_check" CHECK (
    ("kind" = 'invoice' AND "invoiceId" IS NOT NULL)
    OR ("kind" = 'payment' AND "paymentId" IS NOT NULL)
    OR ("kind" = 'credit_note' AND "creditNoteId" IS NOT NULL)
    OR ("kind" = 'payment_reversal' AND "paymentReversalId" IS NOT NULL)
);

ALTER TABLE "PaymentEvidence" ADD CONSTRAINT "PaymentEvidence_size_positive_check" CHECK ("sizeBytes" > 0);
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_amount_positive_check" CHECK ("amount" > 0);
ALTER TABLE "PaymentReversal" ADD CONSTRAINT "PaymentReversal_amount_positive_check" CHECK ("amount" > 0);
ALTER TABLE "ReconciliationIssue" ADD CONSTRAINT "ReconciliationIssue_amounts_nonnegative_check" CHECK (
    ("expectedAmount" IS NULL OR "expectedAmount" >= 0)
    AND ("actualAmount" IS NULL OR "actualAmount" >= 0)
);
