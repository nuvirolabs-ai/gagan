-- CreateEnum
CREATE TYPE "CreditRating" AS ENUM ('N', 'A', 'B', 'C', 'D', 'E', 'F');

-- CreateEnum
CREATE TYPE "BillingPattern" AS ENUM ('unknown', 'regular', 'irregular');

-- CreateEnum
CREATE TYPE "CreditAssessmentResult" AS ENUM ('allowed', 'approval_required', 'blocked');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('open', 'escalated', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "ApprovalDecisionResult" AS ENUM ('approved', 'rejected');

-- CreateEnum
CREATE TYPE "ApprovalDisputeStatus" AS ENUM ('open', 'resolved', 'escalated');

-- CreateEnum
CREATE TYPE "DispatchAuthorizationStatus" AS ENUM ('active', 'used', 'invalidated', 'expired');

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_orderId_fkey";

-- CreateTable
CREATE TABLE "CreditPolicyVersion" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "rules" JSONB NOT NULL,
    "reasonCatalog" JSONB NOT NULL,
    "approvedByStaffId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditPolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditProfile" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "rating" "CreditRating" NOT NULL DEFAULT 'N',
    "billingPattern" "BillingPattern" NOT NULL DEFAULT 'unknown',
    "accountCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ratingConfirmedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "cleanInvoiceCount" INTEGER NOT NULL DEFAULT 0,
    "advancePaymentOnly" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "lockReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatingHistory" (
    "id" TEXT NOT NULL,
    "sequence" BIGSERIAL NOT NULL,
    "creditProfileId" TEXT NOT NULL,
    "fromRating" "CreditRating",
    "toRating" "CreditRating" NOT NULL,
    "billingPattern" "BillingPattern" NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "confirmedByStaffId" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RatingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditAssessment" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "orderId" TEXT,
    "policyVersionId" TEXT NOT NULL,
    "result" "CreditAssessmentResult" NOT NULL,
    "requiredPermission" TEXT,
    "projectedExposure" DECIMAL(14,2) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "reasons" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "orderId" TEXT,
    "assessmentId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "approvalType" TEXT NOT NULL,
    "requiredPermission" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'open',
    "requestedByStaffId" TEXT,
    "requestReason" TEXT,
    "deadlineAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalDecision" (
    "id" TEXT NOT NULL,
    "approvalRequestId" TEXT NOT NULL,
    "result" "ApprovalDecisionResult" NOT NULL,
    "actorStaffId" TEXT NOT NULL,
    "reason" TEXT,
    "stepUpSessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalEscalation" (
    "id" TEXT NOT NULL,
    "approvalRequestId" TEXT NOT NULL,
    "fromPermission" TEXT NOT NULL,
    "toPermission" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalEscalation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalDispute" (
    "id" TEXT NOT NULL,
    "approvalRequestId" TEXT NOT NULL,
    "status" "ApprovalDisputeStatus" NOT NULL DEFAULT 'open',
    "raisedByStaffId" TEXT NOT NULL,
    "writtenPosition" TEXT NOT NULL,
    "counterPosition" TEXT,
    "resolvedByStaffId" TEXT,
    "resolution" TEXT,
    "acknowledgmentDueAt" TIMESTAMP(3) NOT NULL,
    "decisionDueAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalDispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchAuthorization" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "approvalRequestId" TEXT,
    "status" "DispatchAuthorizationStatus" NOT NULL DEFAULT 'active',
    "issuedByStaffId" TEXT,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DispatchAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkingCalendar" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "isWorkingDay" BOOLEAN NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkingCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditPolicyVersion_version_key" ON "CreditPolicyVersion"("version");

-- CreateIndex
CREATE INDEX "CreditPolicyVersion_active_idx" ON "CreditPolicyVersion"("active");

-- CreateIndex
CREATE UNIQUE INDEX "CreditProfile_retailerId_key" ON "CreditProfile"("retailerId");

-- CreateIndex
CREATE UNIQUE INDEX "RatingHistory_sequence_key" ON "RatingHistory"("sequence");

-- CreateIndex
CREATE INDEX "RatingHistory_creditProfileId_sequence_idx" ON "RatingHistory"("creditProfileId", "sequence");

-- CreateIndex
CREATE INDEX "CreditAssessment_retailerId_createdAt_idx" ON "CreditAssessment"("retailerId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditAssessment_orderId_createdAt_idx" ON "CreditAssessment"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_createdAt_idx" ON "ApprovalRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalRequest_requiredPermission_status_createdAt_idx" ON "ApprovalRequest"("requiredPermission", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalRequest_retailerId_createdAt_idx" ON "ApprovalRequest"("retailerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalDecision_approvalRequestId_key" ON "ApprovalDecision"("approvalRequestId");

-- CreateIndex
CREATE INDEX "ApprovalEscalation_approvalRequestId_createdAt_idx" ON "ApprovalEscalation"("approvalRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalDispute_status_acknowledgmentDueAt_idx" ON "ApprovalDispute"("status", "acknowledgmentDueAt");

-- CreateIndex
CREATE INDEX "ApprovalDispute_approvalRequestId_createdAt_idx" ON "ApprovalDispute"("approvalRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "DispatchAuthorization_orderId_status_idx" ON "DispatchAuthorization"("orderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DispatchAuthorization_orderId_version_key" ON "DispatchAuthorization"("orderId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "WorkingCalendar_date_key" ON "WorkingCalendar"("date");

-- Only one policy may govern new decisions. Historical versions remain immutable.
CREATE UNIQUE INDEX "CreditPolicyVersion_one_active_idx"
ON "CreditPolicyVersion" ((1))
WHERE "active" = true;

-- A subject cannot fork into competing approval conversations. Closed requests
-- remain as audit history and a later reassessment may open a new request.
CREATE UNIQUE INDEX "ApprovalRequest_one_open_subject_idx"
ON "ApprovalRequest"("subjectType", "subjectId", "approvalType")
WHERE "status" IN ('open', 'escalated');

-- There can only be one usable dispatch authority for an order at a time.
CREATE UNIQUE INDEX "DispatchAuthorization_one_active_order_idx"
ON "DispatchAuthorization"("orderId")
WHERE "status" = 'active';

ALTER TABLE "CreditProfile" ADD CONSTRAINT "CreditProfile_clean_invoice_count_check"
CHECK ("cleanInvoiceCount" >= 0);
ALTER TABLE "CreditAssessment" ADD CONSTRAINT "CreditAssessment_projected_exposure_check"
CHECK ("projectedExposure" >= 0);

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditProfile" ADD CONSTRAINT "CreditProfile_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingHistory" ADD CONSTRAINT "RatingHistory_creditProfileId_fkey" FOREIGN KEY ("creditProfileId") REFERENCES "CreditProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditAssessment" ADD CONSTRAINT "CreditAssessment_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditAssessment" ADD CONSTRAINT "CreditAssessment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditAssessment" ADD CONSTRAINT "CreditAssessment_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "CreditPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "CreditAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "ApprovalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalEscalation" ADD CONSTRAINT "ApprovalEscalation_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "ApprovalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDispute" ADD CONSTRAINT "ApprovalDispute_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "ApprovalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchAuthorization" ADD CONSTRAINT "DispatchAuthorization_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchAuthorization" ADD CONSTRAINT "DispatchAuthorization_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "CreditAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchAuthorization" ADD CONSTRAINT "DispatchAuthorization_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "ApprovalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
