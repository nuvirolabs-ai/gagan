# Gagan master audit and implementation matrix

Source brief: `Astra Master Prompt — Gagan Product Audit & Completion.md`.
This is the living Wave 1 matrix, not a completed product acceptance report.
Date: 2026-09-14. Isolated branch: `codex/gagan-product-improvements-v1`.
Base `282864a` is the fetched Field Ops HEAD and descends from canonical `df707fa`.
Existing canonical button edits were carried forward, not discarded.

## Architecture and source of truth inspected

- `backend/src/lib/orders.ts`: both app order writes converge here; retailer lock,
  server prices, inventory validation, credit assessment and SAP outbox.
- `backend/prisma/schema.prisma`: Order has one Invoice; immutable accepted case
  weight is on OrderItem. Current models do not implement mixed-company invoicing.
- `backend/src/modules/invoicing/invoiceService.ts`: delivered-weight financial
  posting; invoice tax is currently zero. Do not relabel current prices as quintal.
- `backend/src/modules/payments/paymentService.ts`: confirmed payment settlement
  locks payment/retailer and allocates FIFO across retailer invoices, not companies.
- `backend/src/modules/customers/retailerProposalService.ts`: current approval
  creates the retailer. New brief's immediate pending-retailer ordering is not yet
  compatible with that flow; do not bypass KYC/credit/SAP guards to simulate it.
- `backend/src/modules/performance`: canonical target/achievement/ranking services;
  `readmodels/salespersonTodayService.ts` aggregates them into Today.
- `backend/src/modules/identity/roleCatalog.ts`: explicit role permissions;
  `org/scope.ts` owns manager hierarchy scope. Do not create parallel team RBAC.
- Retailer `mobile/src/context/CartContext.tsx` and Salesperson
  `rep/src/context/RepContext.tsx` own separate baskets. Session clients are under
  each app's `src/auth`; offline activity uses Salesperson's account-scoped outbox.
- Existing Field Ops, collections, protected evidence, imports, financial,
  location/visit and SAP modules have executable regression coverage. Passing
  service tests is not proof of the full new UI requirements.
- Admin is Vite/React; apps are Expo/React Native. The source-specific Expo v57
  instructions were read before mobile edits. Backend SheetJS/qs security
  dependencies were corrected; no Expo major-version upgrade was made.

## Requirement matrix

`FIXED` below means source plus the specified automated proof, not hosted/device
acceptance. `PARTIAL` includes incomplete audit or acceptance; it does not assert
that an untested capability is absent.

| Requirement | Before | Work done | Current status | Verification / next proof |
|---|---|---|---|---|
| Order retry identity | Same key accepted changed quantities/source | Compare normalized accepted request under retailer lock | FIXED | PostgreSQL changed quantity/persona and parallel conflict tests |
| Duplicate SKU order rows | Duplicate request rows persisted separately | Aggregate validated positive case quantities per SKU | FIXED | Database test: two identical SKU rows become one, same total |
| Quantity validation | HTTP validated, service could admit malformed input | Shared service validation and Int range checks | FIXED | Negative/fractional/empty/overflow tests |
| Order credit read concurrency | Retailer read preceded lock | Reload after lock acquisition | PARTIAL | Credit suite passes; targeted waiting-lock scenario still required |
| Decimal pricing/invoicing | Floating-point rounding at weight billing | Decimal arithmetic through rounding | FIXED | Half-paise tests, historical conversion/invoice/SAP regressions |
| Delivery invoice retry identity | Existing lookup used order OR key without verifying request | Compare saved order/line quantities on replay; reject unpersistable weight precision | FIXED | Three original failures reproduced; PostgreSQL conflict tests pass |
| Quintal rates | Existing accepted prices are per case | Tested explicit-basis quote foundation | PARTIAL | Not connected to persisted pricing, checkout or invoices |
| SKU GST | Invoice tax currently zero | Calculator supports distinct explicit rates | PARTIAL | Admin configuration and accepted tax snapshots pending |
| Final freight plus GST | No order freight contract | Tested final amount; supporting quintals/km never multiplied | PARTIAL | Manager editor, persisted freight quote and both checkout readers pending |
| Company separation | One order/invoice and retailer-level FIFO payments | Owner confirmed ONE combined invoice with company on each line; calculator groups entities | PARTIAL | Persisted SKU/order/invoice/payment/SAP attribution is NOT implemented |
| Entity QR/payment destinations | Not proven | No invented destinations or credentials | BLOCKED | Verified company payment/SAP account mapping required before activation |
| SKU options and live cart | Salesperson showed packs as duplicate products | Reused authoritative grouping with per-SKU selections/quantities | IMPLEMENTED | Moto E13: 1kg and 5kg packs, 2 lines/₹6300, matching saved order33; large catalogue not retested |
| Quantity touch controls | Canonical changes already uncommitted | Actual +/- surfaces enlarged to 44dp; expanded controls below product details | FIXED | Both Review apps physically exercised on Moto E13; no hosted/release acceptance |
| Retailer account-owned cart | One global device cart key | Per-account storage; serialized writes; old unowned data retained | FIXED | 8 storage tests; physical same-account restart retains cart; account-switch device test pending |
| Session resilience | Refresh outage erased login | Only explicit authentication rejection clears session | FIXED | Network/503/malformed-response tests in both apps |
| Salesperson stale cart after revoked login | Identity cleared, basket retained | Clear volatile basket/customer when login is rejected | PARTIAL | Typecheck/tests; physical account switch pending |
| Order summary | Existing order detail; submit only shows alert | Successful Salesperson order opens detail; refresh errors retain last good content | PARTIAL | Physical order33 detail with both packs/amount; company/GST/freight breakdown pending |
| Payment proof and collections | Existing structured collection/evidence modules | Existing full suite rerun | PARTIAL | Company attribution and actual upload/confirmation UI proof required |
| Returns visibility | Not yet traced in full | No substitute refund/return engine built | PARTIAL | Trace canonical return lifecycle before implementing UI |
| Retailer Home height | Physical installed app shows large order hero | Captured baseline only | PARTIAL | Products-first composition and candidate screenshots pending |
| Hide retailer credit limit | Home/ledger/cart exposed headroom | Removed visible limits, kept credit protection | FIXED | Mobile tests pass; Home/cart physically checked; full ledger UI not retested |
| Retailer feedback | Not yet traced in full | None yet | PARTIAL | Route, storage, scope and UI audit required |
| Store location | Existing location and verification services | Existing regression rerun | PARTIAL | Pending-store and first-delivery capture flow proof required |
| Today command centre | Accepted Field Ops source already integrates data | Kept newer source, did not replace with old canonical UI | PARTIAL | New brief composition and real current-day UAT pending |
| Day Start/End, attendance | Existing work sessions and attendance | Existing regression rerun | PARTIAL | Selfie, calendar, permission and end-day device proof pending |
| Foreground/background GPS | Existing tracking/outbox | Existing tests rerun | PARTIAL | Battery/offline/OS background acceptance pending |
| Leave and actual absence | Existing leave/attendance services | Existing regression rerun | PARTIAL | Separate absence policy/UI and full manager decisions pending |
| Visit Out and multiple outcomes | Single outcome; other activities bypassed sales-call explanation | Structured outcomes/reason; legacy primary outcome; reason required without order selection; GPS/submit guard | IMPLEMENTED | PostgreSQL tests and Moto E13 visit in/out, reason alert, two outcomes persisted; selected outcomes remain self-reported |
| Follow-ups | Existing Field Ops follow-up dates/actions | Existing tests rerun | PARTIAL | Current-day reminder and physical calendar proof pending |
| Checkout performance | Existing measurement document, no new timings | Protected submit/credit path audit started | PARTIAL | Comparable three-sample timings still required |
| Needs Attention/outstanding | Existing Today and retailer feeds | Retained Field Ops issue fix | PARTIAL | Cross-screen collection reminder consistency proof pending |
| Pending retailer immediate ordering | Customer created only on approval | Identified current architectural mismatch | PARTIAL | Pending customer, assignment, order verification snapshot, OTP and KYC-safe policy integration |
| Retailer withdrawal/approval decision | Concurrent ordinary updates could overwrite pending state | Conditional decision claim and transactional withdrawal audit | FIXED | Four PostgreSQL races; one decision, no orphan customer; manager UI race not run |
| Phone OTP + mandatory WhatsApp | Proposal input currently has phone/telephone | Inspected proposal input; no fake OTP | PARTIAL | Verified main contact and separate mandatory WhatsApp integration |
| Retailer detail hierarchy | Existing detail/intelligence screens | Preserved accepted implementation | PARTIAL | Current physical hierarchy and attention/order actions pending |
| Issues with evidence/history | Existing issue service and detail screen | Existing suite rerun | PARTIAL | Real upload, resolve/withdraw and audit proof pending |
| Shared image storage | Existing evidence/S3 boundary; R2 runbook | No new unprotected uploader | PARTIAL | Durable provider configuration and real storage acceptance required |
| Task/merchandising evidence | Existing task service | Existing tests rerun | PARTIAL | Camera-current proof, visit/task linkage and access tests pending |
| Survey as tasks | Not yet fully traced | No duplicate system created | PARTIAL | Required-task/reminder lifecycle audit pending |
| Beat planning | Existing published routes and Today linkage | Existing route tests rerun | PARTIAL | Current-day physical plan/deviation/productivity proof pending |
| Value/quantity targets | Existing canonical metrics | Target services inspected, tests rerun | PARTIAL | Confirm physical quantity semantics and management UAT |
| Ranking/achievements | Existing service, target-change dedupe risk found | Domain/read model traced | PARTIAL | Fix stale active achievements; preserve historical recognition |
| Retailer intelligence | Existing baseline/opportunity service | Existing tests rerun | PARTIAL | Daal/Rice, largest order, history and actionable UI proof pending |
| Expenses | Existing submission/review service | Existing tests rerun | PARTIAL | Date/evidence/status and manager UI proof pending |
| Day summary, keyboard, responsive shell | Existing common wrappers | No arbitrary inset changes | PARTIAL | Keyboard and multi-size actual rendering required |
| Brand consistency | Existing shared themes | No random recolouring | PARTIAL | Native screen pass after core correctness |
| Training test/reminders | Not yet traced in full | None yet | PARTIAL | Non-blocking persisted completion and deduplicated reminders pending |
| Manager hierarchy/team/dashboard | Existing scoped read models and RBAC | Existing tests rerun | PARTIAL | All brief's actionable exceptions and actual role UAT pending |
| Retailer/staff mapping | Existing admin/hierarchy domains | Existing tests rerun | PARTIAL | Reassignment audit and company-compatible scope proof pending |
| Central notifications/automation/offers | Not fully traced | None yet | PARTIAL | Recipient, dedupe, schedule, expiry, server-clock and push proof pending |
| Dispatch/transport receipt | Existing delivery/invoice lifecycle | Full backend regression rerun | PARTIAL | Scan, transport details/proof, both apps' final status UAT pending |
| Founder daily brief | Existing founder code not assumed approved | No alternate branch merged | DEFERRED | Underlying commercial and operational data first |
| Offline activities/photos | Existing account-scoped activity outbox | Existing suite rerun; session refresh durability corrected | PARTIAL | Physical queue/reconnect/account isolation and upload retry proof pending |
| Detailed ledger, company-ledger UI, large CRM, referral | Explicitly Phase 2 | Left out of current changes | DEFERRED | No invented referral rules |
| Real SAP/SMS/payment/production | Existing adapters are not live-provider acceptance | No provider switch or deployment | BLOCKED | Authorized account mappings/configuration and provider acceptance |

## Confirmed commercial decisions

Each SKU has one selling entity; mixed carts are allowed. Quoted quintal rates
exclude GST. SKU GST is configurable individually. Manager freight is a final
base amount, GST added separately, with quintals/km recorded. Freight GST must
have its own explicit setting; no assumed zero or product-rate inheritance.
Owner confirmed ONE combined invoice with company detail by line. This is a
decision recorded for implementation, not a delivered accounting feature.

## Current verification boundary

Fresh PostgreSQL `gagan_test_master_final_20260914_01`: all 34 migrations applied
from zero; Prisma validation/status passed. Backend: 125 files / 875 tests,
typecheck/build passed. Admin: 19 files / 49 tests, typecheck, lint, build passed.
Retailer: 15 files / 68 tests, typecheck passed. Salesperson: 26 files / 128 tests,
typecheck passed. Backend production dependency audit: zero reported findings;
mobile dependency findings are not thereby cleared.

Moto E13 `ZD2229Q3KB`: separate debug packages `com.gagan.sales.review` and
`com.gagan.retailer.review`, local UAT API4410 via ADB reverse and Metro.
These are NOT standalone release APKs or hosted staging proof. UAT database
`gagan_uat_master_20260914_01` is separate from destructive test databases.
Native retailer order32, salesperson order33 and a Visit Out were persisted and
read back. See `GAGAN_MASTER_IMPLEMENTATION_REPORT.md` for the evidence boundary.

No production, main, frozen tags, Dogkart, existing APKs or hosted data changed.
No commit/push/deployment is implied by this matrix.
