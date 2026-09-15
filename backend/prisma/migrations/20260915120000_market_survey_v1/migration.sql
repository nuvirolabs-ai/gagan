CREATE TYPE "SurveyStatus" AS ENUM ('draft', 'active', 'closed');

CREATE TYPE "SurveyAudience" AS ENUM ('all_retailers', 'selected_retailers', 'all_salespersons', 'selected_salespersons');

CREATE TYPE "SurveyQuestionType" AS ENUM ('single_choice', 'multiple_choice', 'yes_no', 'rating', 'number', 'text');

CREATE TYPE "SurveyRespondentType" AS ENUM ('retailer', 'salesperson', 'salesperson_retailer');

CREATE TABLE "Survey" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "SurveyStatus" NOT NULL DEFAULT 'draft',
    "audience" "SurveyAudience" NOT NULL DEFAULT 'all_retailers',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdByStaffId" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SurveyQuestion" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "type" "SurveyQuestionType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "minValue" DECIMAL(14,4),
    "maxValue" DECIMAL(14,4),
    "maxLength" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SurveyOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SurveyAssignment" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "audience" "SurveyAudience" NOT NULL,
    "retailerId" TEXT,
    "salespersonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "respondentType" "SurveyRespondentType" NOT NULL,
    "respondentKey" TEXT NOT NULL,
    "respondentStaffId" TEXT,
    "respondentRetailerId" TEXT,
    "contextRetailerId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SurveyAnswer" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNumber" DECIMAL(14,4),

    CONSTRAINT "SurveyAnswer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SurveyAnswerOption" (
    "answerId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,

    CONSTRAINT "SurveyAnswerOption_pkey" PRIMARY KEY ("answerId", "optionId")
);

CREATE INDEX "Survey_status_startsAt_endsAt_idx" ON "Survey"("status", "startsAt", "endsAt");
CREATE INDEX "Survey_createdByStaffId_createdAt_idx" ON "Survey"("createdByStaffId", "createdAt");
CREATE INDEX "SurveyQuestion_surveyId_position_idx" ON "SurveyQuestion"("surveyId", "position");
CREATE INDEX "SurveyOption_questionId_position_idx" ON "SurveyOption"("questionId", "position");
CREATE UNIQUE INDEX "SurveyAssignment_surveyId_retailerId_key" ON "SurveyAssignment"("surveyId", "retailerId");
CREATE UNIQUE INDEX "SurveyAssignment_surveyId_salespersonId_key" ON "SurveyAssignment"("surveyId", "salespersonId");
CREATE INDEX "SurveyAssignment_surveyId_audience_idx" ON "SurveyAssignment"("surveyId", "audience");
CREATE UNIQUE INDEX "SurveyResponse_surveyId_respondentKey_key" ON "SurveyResponse"("surveyId", "respondentKey");
CREATE UNIQUE INDEX "SurveyResponse_surveyId_idempotencyKey_key" ON "SurveyResponse"("surveyId", "idempotencyKey");
CREATE INDEX "SurveyResponse_surveyId_submittedAt_idx" ON "SurveyResponse"("surveyId", "submittedAt");
CREATE INDEX "SurveyResponse_respondentStaffId_submittedAt_idx" ON "SurveyResponse"("respondentStaffId", "submittedAt");
CREATE INDEX "SurveyResponse_respondentRetailerId_submittedAt_idx" ON "SurveyResponse"("respondentRetailerId", "submittedAt");
CREATE UNIQUE INDEX "SurveyAnswer_responseId_questionId_key" ON "SurveyAnswer"("responseId", "questionId");
CREATE INDEX "SurveyAnswer_questionId_idx" ON "SurveyAnswer"("questionId");
CREATE INDEX "SurveyAnswerOption_optionId_idx" ON "SurveyAnswerOption"("optionId");

ALTER TABLE "Survey" ADD CONSTRAINT "Survey_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SurveyQuestion" ADD CONSTRAINT "SurveyQuestion_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyOption" ADD CONSTRAINT "SurveyOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "SurveyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyAssignment" ADD CONSTRAINT "SurveyAssignment_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyAssignment" ADD CONSTRAINT "SurveyAssignment_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyAssignment" ADD CONSTRAINT "SurveyAssignment_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "StaffUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_respondentStaffId_fkey" FOREIGN KEY ("respondentStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_respondentRetailerId_fkey" FOREIGN KEY ("respondentRetailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_contextRetailerId_fkey" FOREIGN KEY ("contextRetailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "SurveyResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "SurveyQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SurveyAnswerOption" ADD CONSTRAINT "SurveyAnswerOption_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "SurveyAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyAnswerOption" ADD CONSTRAINT "SurveyAnswerOption_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "SurveyOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
