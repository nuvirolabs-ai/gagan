-- Additive: existing visit history is retained, never inferred from free text.
ALTER TABLE "SalesVisit"
  ADD COLUMN "outcomes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "noOrderReason" TEXT;
