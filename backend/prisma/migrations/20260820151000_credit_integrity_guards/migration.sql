-- Bind enforcement approval to the exact policy version and record the
-- authoritative result of a dispute.
ALTER TABLE "AppConfig"
ADD COLUMN "creditPolicyApprovedVersion" INTEGER;

ALTER TABLE "ApprovalDispute"
ADD COLUMN "outcome" "ApprovalDecisionResult";

-- Every retailer must enter the credit lifecycle at N. KYC remains unverified
-- until evidence is explicitly confirmed in the protected onboarding flow.
INSERT INTO "CreditProfile" (
  "id", "retailerId", "rating", "billingPattern", "accountCreatedAt",
  "cleanInvoiceCount", "advancePaymentOnly", "createdAt", "updatedAt"
)
SELECT
  'credit-profile-' || retailer."id",
  retailer."id",
  'N'::"CreditRating",
  'unknown'::"BillingPattern",
  retailer."createdAt",
  0,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Retailer" retailer
WHERE NOT EXISTS (
  SELECT 1 FROM "CreditProfile" profile WHERE profile."retailerId" = retailer."id"
);

-- Once a policy has generated evidence, its factual contents are immutable.
-- Activation can still move between versioned rows through the `active` flag.
CREATE OR REPLACE FUNCTION protect_used_credit_policy_facts()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "CreditAssessment" WHERE "policyVersionId" = OLD."id")
     AND (
       NEW."version" IS DISTINCT FROM OLD."version" OR
       NEW."name" IS DISTINCT FROM OLD."name" OR
       NEW."rules" IS DISTINCT FROM OLD."rules" OR
       NEW."reasonCatalog" IS DISTINCT FROM OLD."reasonCatalog"
     )
  THEN
    RAISE EXCEPTION 'used_credit_policy_is_immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CreditPolicyVersion_protect_used_facts"
BEFORE UPDATE ON "CreditPolicyVersion"
FOR EACH ROW EXECUTE FUNCTION protect_used_credit_policy_facts();
