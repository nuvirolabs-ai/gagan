-- CreateEnum
CREATE TYPE "WorkdayStatus" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('casual', 'sick', 'unpaid', 'other');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "RoutePlanStatus" AS ENUM ('draft', 'published', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "RouteStopStatus" AS ENUM ('pending', 'visited', 'skipped');

-- CreateEnum
CREATE TYPE "VisitPurpose" AS ENUM ('sales_call', 'collection', 'service', 'onboarding', 'merchandising', 'other');

-- CreateEnum
CREATE TYPE "VisitOutcome" AS ENUM ('order_placed', 'no_order', 'payment_collected', 'follow_up_required', 'issue_raised', 'shop_closed', 'decision_maker_unavailable', 'other');

-- CreateEnum
CREATE TYPE "CustomerActivityType" AS ENUM ('order_discussion', 'order_placed', 'payment_discussion', 'collection_completed', 'product_demo', 'stock_check', 'merchandising', 'complaint_raised', 'follow_up_required', 'competitor_observation', 'no_order', 'shop_closed', 'decision_maker_unavailable', 'note');

-- CreateEnum
CREATE TYPE "FieldTaskPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "FieldTaskStatus" AS ENUM ('open', 'in_progress', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('travel', 'fuel', 'food', 'lodging', 'telephone', 'other');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('submitted', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ServiceIssueType" AS ENUM ('damaged_product', 'delivery_issue', 'invoice_issue', 'payment_issue', 'quality_complaint', 'service_request', 'other');

-- CreateEnum
CREATE TYPE "ServiceIssuePriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "ServiceIssueStatus" AS ENUM ('open', 'in_progress', 'resolved', 'closed', 'rejected');

-- CreateEnum
CREATE TYPE "SalesTargetMetric" AS ENUM ('order_value', 'visits', 'collection_value', 'new_customers');

-- AlterTable
ALTER TABLE "AppConfig" ADD COLUMN     "attendanceSelfieRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "locationPingIntervalSeconds" INTEGER NOT NULL DEFAULT 300,
ADD COLUMN     "locationTrackingEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "SalesVisit" ADD COLUMN     "followUpAt" TIMESTAMP(3),
ADD COLUMN     "outcome" "VisitOutcome",
ADD COLUMN     "purpose" "VisitPurpose" NOT NULL DEFAULT 'sales_call',
ADD COLUMN     "routeStopId" TEXT;

-- CreateTable
CREATE TABLE "WorkdaySession" (
    "id" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "status" "WorkdayStatus" NOT NULL DEFAULT 'open',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startLatitude" DECIMAL(10,7) NOT NULL,
    "startLongitude" DECIMAL(10,7) NOT NULL,
    "startAccuracyMeters" DECIMAL(8,2) NOT NULL,
    "startPhotoObjectKey" TEXT,
    "endedAt" TIMESTAMP(3),
    "endLatitude" DECIMAL(10,7),
    "endLongitude" DECIMAL(10,7),
    "endAccuracyMeters" DECIMAL(8,2),
    "endPhotoObjectKey" TEXT,
    "devicePlatform" TEXT,
    "workedMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkdaySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "type" "LeaveType" NOT NULL DEFAULT 'casual',
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'pending',
    "decidedByStaffId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutePlan" (
    "id" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "planDate" DATE NOT NULL,
    "name" TEXT,
    "status" "RoutePlanStatus" NOT NULL DEFAULT 'draft',
    "createdByStaffId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutePlanStop" (
    "id" TEXT NOT NULL,
    "routePlanId" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "RouteStopStatus" NOT NULL DEFAULT 'pending',
    "purpose" "VisitPurpose" NOT NULL DEFAULT 'sales_call',
    "note" TEXT,
    "skipReason" TEXT,
    "visitedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutePlanStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerActivity" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "visitId" TEXT,
    "type" "CustomerActivityType" NOT NULL,
    "notes" TEXT,
    "followUpAt" TIMESTAMP(3),
    "orderId" TEXT,
    "collectionId" TEXT,
    "serviceIssueId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldTask" (
    "id" TEXT NOT NULL,
    "assignedToStaffId" TEXT NOT NULL,
    "createdByStaffId" TEXT,
    "retailerId" TEXT,
    "routePlanId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "FieldTaskPriority" NOT NULL DEFAULT 'normal',
    "status" "FieldTaskStatus" NOT NULL DEFAULT 'open',
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationPing" (
    "id" TEXT NOT NULL,
    "workdaySessionId" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "accuracyMeters" DECIMAL(8,2) NOT NULL,
    "speedMps" DECIMAL(8,2),
    "headingDegrees" DECIMAL(6,2),
    "batteryPct" INTEGER,
    "clientReference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocationPing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldExpense" (
    "id" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "expenseDate" DATE NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "receiptObjectKey" TEXT,
    "receiptContentType" TEXT,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'submitted',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedByStaffId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceIssue" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "raisedByStaffId" TEXT NOT NULL,
    "orderId" TEXT,
    "invoiceId" TEXT,
    "visitId" TEXT,
    "type" "ServiceIssueType" NOT NULL,
    "priority" "ServiceIssuePriority" NOT NULL DEFAULT 'normal',
    "description" TEXT NOT NULL,
    "status" "ServiceIssueStatus" NOT NULL DEFAULT 'open',
    "assignedTeam" TEXT,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesTarget" (
    "id" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "metric" "SalesTargetMetric" NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "targetValue" DECIMAL(14,2) NOT NULL,
    "createdByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkdaySession_workDate_status_idx" ON "WorkdaySession"("workDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkdaySession_salespersonId_workDate_key" ON "WorkdaySession"("salespersonId", "workDate");

-- CreateIndex
CREATE INDEX "LeaveRequest_salespersonId_fromDate_idx" ON "LeaveRequest"("salespersonId", "fromDate");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_fromDate_idx" ON "LeaveRequest"("status", "fromDate");

-- CreateIndex
CREATE INDEX "RoutePlan_planDate_status_idx" ON "RoutePlan"("planDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RoutePlan_salespersonId_planDate_key" ON "RoutePlan"("salespersonId", "planDate");

-- CreateIndex
CREATE INDEX "RoutePlanStop_routePlanId_sequence_idx" ON "RoutePlanStop"("routePlanId", "sequence");

-- CreateIndex
CREATE INDEX "RoutePlanStop_retailerId_createdAt_idx" ON "RoutePlanStop"("retailerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RoutePlanStop_routePlanId_retailerId_key" ON "RoutePlanStop"("routePlanId", "retailerId");

-- CreateIndex
CREATE INDEX "CustomerActivity_retailerId_occurredAt_idx" ON "CustomerActivity"("retailerId", "occurredAt");

-- CreateIndex
CREATE INDEX "CustomerActivity_salespersonId_occurredAt_idx" ON "CustomerActivity"("salespersonId", "occurredAt");

-- CreateIndex
CREATE INDEX "CustomerActivity_type_occurredAt_idx" ON "CustomerActivity"("type", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerActivity_salespersonId_clientReference_key" ON "CustomerActivity"("salespersonId", "clientReference");

-- CreateIndex
CREATE INDEX "FieldTask_assignedToStaffId_status_dueAt_idx" ON "FieldTask"("assignedToStaffId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "FieldTask_retailerId_status_idx" ON "FieldTask"("retailerId", "status");

-- CreateIndex
CREATE INDEX "LocationPing_workdaySessionId_recordedAt_idx" ON "LocationPing"("workdaySessionId", "recordedAt");

-- CreateIndex
CREATE INDEX "LocationPing_salespersonId_recordedAt_idx" ON "LocationPing"("salespersonId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LocationPing_salespersonId_clientReference_key" ON "LocationPing"("salespersonId", "clientReference");

-- CreateIndex
CREATE INDEX "FieldExpense_salespersonId_expenseDate_idx" ON "FieldExpense"("salespersonId", "expenseDate");

-- CreateIndex
CREATE INDEX "FieldExpense_status_submittedAt_idx" ON "FieldExpense"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "ServiceIssue_retailerId_createdAt_idx" ON "ServiceIssue"("retailerId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceIssue_status_priority_createdAt_idx" ON "ServiceIssue"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceIssue_raisedByStaffId_createdAt_idx" ON "ServiceIssue"("raisedByStaffId", "createdAt");

-- CreateIndex
CREATE INDEX "SalesTarget_periodStart_periodEnd_idx" ON "SalesTarget"("periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "SalesTarget_salespersonId_metric_periodStart_periodEnd_key" ON "SalesTarget"("salespersonId", "metric", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "SalesVisit_routeStopId_idx" ON "SalesVisit"("routeStopId");

-- AddForeignKey
ALTER TABLE "SalesVisit" ADD CONSTRAINT "SalesVisit_routeStopId_fkey" FOREIGN KEY ("routeStopId") REFERENCES "RoutePlanStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkdaySession" ADD CONSTRAINT "WorkdaySession_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_decidedByStaffId_fkey" FOREIGN KEY ("decidedByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutePlan" ADD CONSTRAINT "RoutePlan_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutePlanStop" ADD CONSTRAINT "RoutePlanStop_routePlanId_fkey" FOREIGN KEY ("routePlanId") REFERENCES "RoutePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutePlanStop" ADD CONSTRAINT "RoutePlanStop_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerActivity" ADD CONSTRAINT "CustomerActivity_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerActivity" ADD CONSTRAINT "CustomerActivity_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerActivity" ADD CONSTRAINT "CustomerActivity_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "SalesVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerActivity" ADD CONSTRAINT "CustomerActivity_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerActivity" ADD CONSTRAINT "CustomerActivity_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "CollectionSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerActivity" ADD CONSTRAINT "CustomerActivity_serviceIssueId_fkey" FOREIGN KEY ("serviceIssueId") REFERENCES "ServiceIssue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldTask" ADD CONSTRAINT "FieldTask_assignedToStaffId_fkey" FOREIGN KEY ("assignedToStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldTask" ADD CONSTRAINT "FieldTask_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldTask" ADD CONSTRAINT "FieldTask_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldTask" ADD CONSTRAINT "FieldTask_routePlanId_fkey" FOREIGN KEY ("routePlanId") REFERENCES "RoutePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationPing" ADD CONSTRAINT "LocationPing_workdaySessionId_fkey" FOREIGN KEY ("workdaySessionId") REFERENCES "WorkdaySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationPing" ADD CONSTRAINT "LocationPing_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldExpense" ADD CONSTRAINT "FieldExpense_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldExpense" ADD CONSTRAINT "FieldExpense_decidedByStaffId_fkey" FOREIGN KEY ("decidedByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceIssue" ADD CONSTRAINT "ServiceIssue_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceIssue" ADD CONSTRAINT "ServiceIssue_raisedByStaffId_fkey" FOREIGN KEY ("raisedByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceIssue" ADD CONSTRAINT "ServiceIssue_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceIssue" ADD CONSTRAINT "ServiceIssue_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceIssue" ADD CONSTRAINT "ServiceIssue_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "SalesVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTarget" ADD CONSTRAINT "SalesTarget_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
