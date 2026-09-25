ALTER TABLE "Payment"
  DROP CONSTRAINT "Payment_confirmed_split";

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_confirmed_split" CHECK (
    "invoiceScopeId" IS NULL OR (
      "confirmedJainAmount" IS NOT NULL AND
      "confirmedPadamAmount" IS NOT NULL AND
      "confirmedJainAmount" >= 0 AND
      "confirmedPadamAmount" >= 0 AND
      "confirmedJainAmount" + "confirmedPadamAmount" = "amount" AND
      ("confirmedByStaffId" IS NOT NULL OR "channel" = 'online')
    )
  );
