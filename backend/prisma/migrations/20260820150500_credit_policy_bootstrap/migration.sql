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
    "kyc_required":{"title":"KYC required","message":"Customer KYC must be verified before the first dispatch."},
    "so_price_list_variation":{"title":"Price variation","message":"The sales-order price differs from the approved price list."},
    "invoice_overdue_45_days":{"title":"Invoice overdue beyond 45 days","message":"Past-due invoices must be fully cleared before another dispatch."},
    "invoice_overdue_60_days":{"title":"Invoice overdue beyond 60 days","message":"The SAP overdue trigger requires order approval and dispatch hold."},
    "previous_invoice_pending":{"title":"Previous invoice pending","message":"A previous invoice is not fully paid."},
    "one_or_more_outstanding":{"title":"Outstanding balance","message":"The customer has one or more outstanding invoices."},
    "new_customer_second_invoice":{"title":"Second invoice approval","message":"A Sales Coordinator must approve a new customer second invoice."},
    "new_customer_third_invoice":{"title":"Third invoice approval","message":"The Credit Team Lead must approve a new customer third invoice."},
    "new_customer_fourth_blocked":{"title":"Fourth invoice blocked","message":"Invoices one to three must be fully cleared before a fourth dispatch."},
    "new_customer_50000_cap":{"title":"New-customer cap reached","message":"Projected outstanding reaches the new-customer cap."},
    "partial_payment_not_clearance":{"title":"Invoice only partly paid","message":"Partial payment never counts as full invoice clearance."},
    "rating_c_cap":{"title":"Rating C limit reached","message":"Projected outstanding reaches the Rating C limit."},
    "rating_d_cap":{"title":"Rating D limit reached","message":"Projected outstanding reaches the Rating D limit."},
    "rating_cd_open_invoice_cap":{"title":"Open-invoice limit reached","message":"Rating C and D customers cannot have three or more open invoices."},
    "rating_e_locked":{"title":"Rating E locked","message":"Dispatch stays locked until all outstanding is fully cleared."},
    "rating_f_advance_required":{"title":"Advance payment required","message":"Rating F customers may dispatch only against confirmed advance payment."},
    "advance_payment_unconfirmed":{"title":"Advance payment unconfirmed","message":"Accounts must confirm the payment before dispatch."},
    "missing_rating":{"title":"Rating missing","message":"Credit Team Lead confirmation is required before dispatch."},
    "stale_rating":{"title":"Rating review overdue","message":"The rating checkpoint is overdue and requires authorized sign-off."},
    "repeated_monthly_approval":{"title":"Repeated approval","message":"Repeated monthly approval requires Credit Team Lead review."},
    "multiple_sap_accounts":{"title":"Duplicate SAP accounts","message":"Exposure must be consolidated across the customer SAP account codes."}
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
