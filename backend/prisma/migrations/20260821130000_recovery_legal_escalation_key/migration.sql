-- Add the retry key for explicit legal referrals.
ALTER TABLE "LegalCase" ADD COLUMN "idempotencyKey" TEXT NOT NULL;

CREATE UNIQUE INDEX "LegalCase_idempotencyKey_key" ON "LegalCase"("idempotencyKey");
