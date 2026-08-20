-- Production-safe reference data. Demo seeding is never required for orders or
-- SLA workers to start safely after `prisma migrate deploy`.
INSERT INTO "CreditPolicyVersion" (
  "id", "version", "name", "active", "rules", "reasonCatalog", "createdAt"
)
VALUES (
  'credit-policy-v4',
  4,
  'Credit & Sales Operations SOP V4',
  (NOT EXISTS (SELECT 1 FROM "CreditPolicyVersion" WHERE "active" = true)),
  '{
    "version": 4,
    "name": "Credit & Sales Operations SOP V4",
    "targetDsoDays": 45,
    "sapOverdueTriggerDays": 60,
    "newCustomerOutstandingCap": 50000,
    "newCustomerMaxOpenBeforeClearance": 3,
    "ratingCOutstandingCap": 100000,
    "ratingDOutstandingCap": 25000,
    "ratingCDOpenInvoiceCap": 3,
    "thirdInvoiceSlaHours": 48,
    "conflictAcknowledgmentWorkingHours": 4,
    "conflictDecisionHours": 24,
    "repeatedApprovalMonthlyCount": 2,
    "cashDiscountPercent": 2,
    "ratingCheckpointGraceDays": 7,
    "legalEscalationDays": 90,
    "recoveryLetterPaymentDays": 7,
    "salesOrderApprovalParameters": [
      "so_price_list_variation",
      "invoice_overdue_60_days",
      "previous_invoice_pending",
      "one_or_more_outstanding"
    ]
  }'::jsonb,
  '{
    "so_price_list_variation": {"title": "Price variation", "message": "The sales-order price differs from the approved price list."},
    "invoice_overdue_60_days": {"title": "Invoice overdue beyond 60 days", "message": "The SAP overdue trigger requires order approval and dispatch hold."},
    "previous_invoice_pending": {"title": "Previous invoice pending", "message": "A previous invoice is not fully paid."},
    "one_or_more_outstanding": {"title": "Outstanding balance", "message": "The customer has one or more outstanding invoices."}
  }'::jsonb,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("version") DO NOTHING;

INSERT INTO "WorkingCalendar" ("id", "date", "isWorkingDay", "createdAt")
SELECT
  'calendar-' || day::date::text,
  day::date,
  EXTRACT(ISODOW FROM day) < 6,
  CURRENT_TIMESTAMP
FROM generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '730 days', INTERVAL '1 day') AS day
ON CONFLICT ("date") DO NOTHING;
