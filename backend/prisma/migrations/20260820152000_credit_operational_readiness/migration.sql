-- Safe singleton defaults unblock clean deployments. Operations can replace
-- these values before launch; zero thresholds do not invent commercial terms.
INSERT INTO "AppConfig" (
  "id", "freeDeliveryThreshold", "minOrderValue", "supportPhone"
)
VALUES ('singleton', 0, 0, '')
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "CreditProfile"
ADD COLUMN "kycVerifiedByStaffId" TEXT,
ADD COLUMN "kycEvidence" JSONB;

UPDATE "CreditProfile"
SET "nextReviewAt" = "accountCreatedAt" + INTERVAL '90 days'
WHERE "nextReviewAt" IS NULL;

-- Protect a policy as soon as it is signed, even before the first order uses it.
CREATE OR REPLACE FUNCTION protect_used_credit_policy_facts()
RETURNS trigger AS $$
BEGIN
  IF (
       EXISTS (SELECT 1 FROM "CreditAssessment" WHERE "policyVersionId" = OLD."id")
       OR EXISTS (
         SELECT 1 FROM "AppConfig"
         WHERE "creditPolicyApprovedVersion" = OLD."version"
           AND "creditPolicyApprovedAt" IS NOT NULL
           AND "creditPolicyApprovedByStaffId" IS NOT NULL
       )
     )
     AND (
       NEW."version" IS DISTINCT FROM OLD."version" OR
       NEW."name" IS DISTINCT FROM OLD."name" OR
       NEW."rules" IS DISTINCT FROM OLD."rules" OR
       NEW."reasonCatalog" IS DISTINCT FROM OLD."reasonCatalog"
     )
  THEN
    RAISE EXCEPTION 'used_or_signed_credit_policy_is_immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- National fixed-date holidays; company-specific and movable holidays remain
-- versioned overrides in WorkingCalendar.
INSERT INTO "WorkingCalendar" ("id", "date", "isWorkingDay", "createdAt")
VALUES
  ('holiday-2026-10-02', DATE '2026-10-02', false, CURRENT_TIMESTAMP),
  ('holiday-2027-01-26', DATE '2027-01-26', false, CURRENT_TIMESTAMP),
  ('holiday-2027-08-15', DATE '2027-08-15', false, CURRENT_TIMESTAMP),
  ('holiday-2027-10-02', DATE '2027-10-02', false, CURRENT_TIMESTAMP),
  ('holiday-2028-01-26', DATE '2028-01-26', false, CURRENT_TIMESTAMP),
  ('holiday-2028-08-15', DATE '2028-08-15', false, CURRENT_TIMESTAMP),
  ('holiday-2028-10-02', DATE '2028-10-02', false, CURRENT_TIMESTAMP)
ON CONFLICT ("date") DO UPDATE SET "isWorkingDay" = false;
