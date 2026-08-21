# Non-SAP production readiness

Status: **PASS WITH ISSUES — ready for controlled pilot after configuration gates**.

## Verified in this pass

- Retailer OTP login, catalog, inventory availability, checkout validation and order history.
- Salesperson OTP login, assigned-retailer isolation, retailer detail and recent orders.
- Admin authentication, order visibility, SAP outbox visibility and mock SAP drain.
- Retailer and salesperson order creation use the same idempotency contract. Replaying a key returns the original order; it does not create another order or outbox row.
- Every order has a deterministic external reference (`GGN-########`). A migration backfills this for historical orders.
- SAP identity fields are persisted independently from local order status: DocEntry, DocNum, external reference, sync status, last sync time and safe error fields.
- Inventory snapshots are warehouse-aware and stale/unavailable/insufficient stock is rejected before an order is created.
- Home, dues, ledger, admin and salesperson surfaces use the same financial-summary contract.
- Rate limits protect admin login, payment intent, retailer order and salesperson order routes. SAP errors returned to clients contain a request ID and safe code, not connector details.
- API and background worker are separate processes. Only `src/worker.ts` starts scheduled jobs; the API process does not schedule them.
- Tenant isolation tests cover retailer-to-retailer and salesperson-to-unassigned-retailer access.

## Remaining non-SAP gates

1. Run device UAT on real Android/iOS hardware using the checklist in `DEVICE_UAT_CHECKLIST.md`.
2. Provision production secrets, HTTPS API origins, backups, object storage, managed Redis and observability using `PRODUCTION_CONFIG_CHECKLIST.md`.
3. Resolve the mobile dependency audit before a public release. Expo/Metro currently reports 8 high and 7 moderate advisories and requires a planned Expo upgrade; do not run an unreviewed major upgrade during pilot preparation.
4. Connect a real SMS provider, payment provider and object-storage bucket, then run their sandbox tests.
5. Deploy API, worker and admin separately to staging and repeat the full UAT against staging.

## Current scores

- Backend: 251 automated tests passing.
- Retailer: 6 automated tests passing.
- Salesperson: 9 automated tests passing.
- Admin: 11 automated tests passing.
- Backend, mobile and salesperson typechecks pass; admin typecheck and production build pass.
- Mock SAP E2E passed. Real SAP remains a release blocker and is tracked in `SAP_B1_HANDOFF.md`.
