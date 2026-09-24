# GAGAN Product Goal State

Updated: 2026-09-24

## Authorized Checkpoint

- Repository/worktree: `/Users/tanutejas/Documents/GAGAN/CURRENT/SOURCE/.worktrees/gagan-client-feedback-v2-reconciled`
- Branch: `codex/gagan-client-feedback-v2-reconciled`
- Starting local HEAD: `39bbaa425bbed654c9a3c2c1050284ca9db83ef1`
- Starting live origin branch SHA: `39bbaa425bbed654c9a3c2c1050284ca9db83ef1` (verified before execution).
- At the start of this checkpoint, no commit or push had been made. Tracked source was clean at start. Existing untracked `GAGAN_PRODUCT_GOAL.md` and `docs/GAGAN_FORENSIC_COMPLETENESS_AUDIT.md` are preserved; the product goal has not been edited.
- No hosted environment, production, SAP, live SMS/payment provider, or APK has been touched.

## Local Test Environment

- Disposable database: `gagan_goal_test_20260924_7b6ea1fc`, PostgreSQL 16.15 on local `127.0.0.1:5432`, owned by local role `tanutejas`.
- `prisma migrate deploy` applied all 46 current migrations successfully; `prisma generate` generated the client from the authorized worktree schema.
- The existing `prisma/seed.ts` ran only against this newly created empty disposable database to populate local test/reference fixtures. It must not be run against any shared, staging, or production database; it clears transactional tables.
- Ignored `backend/.env.test.local` contains only the local DB URL, dummy JWT/refresh/PII keys, `SMS_PROVIDER=mock`, `PAYMENT_PROVIDER=mock`, `SAP_MODE=disabled`, local storage, and `DISABLE_JOBS=true`. Load it explicitly with `DOTENV_CONFIG_PATH=.env.test.local node -r dotenv/config`; normal runtime commands do not implicitly use this file.
- Full backend baseline after correcting the local test config: 140 test files passed, 982 tests passed. An initial attempt exposed the integration DB-name guard and missing local PII key; those were corrected only in this isolated test setup, then the full suite passed.

## Execution Evidence

### GGN-VIS-01

- Source path: `rep/src/screens/RepRetailerDetailScreen.tsx` → `rep/src/api/repClient.ts` → `/rep/retailers/:retailerId/check-in` in `backend/src/modules/location/locationRoutes.ts` → `LocationService.checkIn` → PostgreSQL `SalesVisit`.
- Automated: `backend/src/modules/field/__tests__/fieldIntegration.test.ts`, `backend/src/modules/location/__tests__/visitConcurrency.test.ts`, `locationService.test.ts`, and `locationRoutes.test.ts` passed together (4 files / 36 tests). The integration test now checks authenticated check-in, same-retailer retry idempotency, one persisted open visit, active `/rep/visits` readback, checkout, and closed-visit readback. The PostgreSQL suite also covers concurrent check-ins, invalid/duplicate state, rollback, and database uniqueness.
- App logic: `rep/src/screens/__tests__/feedbackV2Flow.test.ts` passed (4 tests); source reloads `/rep/visits` on focus and restores the open visit into screen state.
- Current status remains `IMPLEMENTED BUT NOT VERIFIED`: local API/database behavior is verified, but hosted, authenticated native UI, GPS permission, physical refresh/relaunch, and exact-source APK acceptance are not run.

### GGN-VIS-02

- Automated: the same backend integration suite proves route progress remains pending after check-in and changes only on explicit checkout. The Rep flow test proves an order stays inside an active visit and “next retailer” is offered only after the matching checkout.
- Current status remains `IMPLEMENTED BUT NOT VERIFIED`: the tests do not create an order through the app/API during the active visit, then read visit and route state back through the full client flow. That acceptance and physical reload remain open.

## Per-Issue Verification Register

The source files, tests and original gap statements are retained in the matching issue row in `GAGAN_FORENSIC_COMPLETENESS_AUDIT.md`. This register tracks execution gates independently; `global suite PASS` is not issue acceptance. The table records the state at this initial checkpoint; later commit references are recorded chronologically below.

| Issue ID | Current status | Source / automated evidence | Local DB/API verification | Hosted | Physical | Commit | Remaining limitation |
|---|---|---|---|---|---|---|---|
| GGN-VIS-01 | IMPLEMENTED BUT NOT VERIFIED | See audit row; local API and app-logic tests listed above. | Authenticated API→PostgreSQL→readback and retry passed. | NOT RUN | NOT RUN | None | Exact-source native check-in, GPS, relaunch and hosted acceptance. |
| GGN-VIS-02 | IMPLEMENTED BUT NOT VERIFIED | See audit row; route integration and Rep flow tests passed. | Check-in/out route persistence passed; order-in-active-visit API sequence not yet exercised. | NOT RUN | NOT RUN | None | Prove order does not close visit through the complete app flow and reload. |
| GGN-VIS-03 | IMPLEMENTED BUT NOT VERIFIED | See audit row; existing outcome tests are part of backend baseline. | Backend DB tests in baseline passed; configurable date/future-task readback not individually accepted. | NOT RUN | NOT RUN | None | Verify chosen follow-up persists and appears in future work. |
| GGN-ORD-01 | PARTIAL | See audit row; backend baseline passed, no issue signoff. | Baseline only; punched-versus-official lifecycle remains unresolved. | NOT RUN | NOT RUN | None | Define one auditable order-intent lifecycle and prove downstream idempotency. |
| GGN-ORD-02 | PARTIAL | See audit row; proposal/order tests in backend baseline passed. | Pending-proposal order capture not implemented or verified. | NOT RUN | NOT RUN | None | Capture demand against pending proposal without bypassing approval. |
| GGN-ORD-03 | PARTIAL | See audit row; no complete source-display acceptance. | Existing attribution fields only; UI/Admin readback incomplete. | NOT RUN | NOT RUN | None | Display app source and salesperson identity on required surfaces. |
| GGN-ORD-04 | IMPLEMENTED BUT NOT VERIFIED | See audit row; app tests not rerun in this checkpoint. | Not applicable beyond baseline. | NOT RUN | NOT RUN | None | Verify native detail navigation/back behavior on final apps. |
| GGN-ORD-05 | PARTIAL | See audit row; backend baseline passed. | No warehouse-role acceptance. | NOT RUN | NOT RUN | None | Establish least-privilege warehouse queue and transitions. |
| GGN-PAY-01 | PARTIAL | See audit row; existing protected collection storage tests in backend baseline. | Backend storage path tests passed; Retailer Pay association absent. | NOT RUN | NOT RUN | None | Add and verify Retailer payment evidence and authorized readback. |
| GGN-PAY-02 | IMPLEMENTED BUT NOT VERIFIED | See audit row; collection suites in backend baseline. | Local backend integration tests passed; no manual full collection readback. | NOT RUN | NOT RUN | None | Verify CASH/CHEQUE/NEFT end-to-end and entity/ledger readback. |
| GGN-PAY-03 | PARTIAL | See audit row; authorization tests in backend baseline. | Backend permissions covered by tests; Admin retailer-collector assignment UI absent. | NOT RUN | NOT RUN | None | Add Admin assignment flow and directly test unauthorized API calls. |
| GGN-PAY-04 | PARTIAL | See audit row; OTP suites passed with injected/mock providers. | No customer/payment-bound collection OTP. | NOT RUN | NOT RUN | None | Resolve applicable business rule, then bind OTP to the collection transaction. |
| GGN-PAY-05 | PARTIAL | See audit row; financial tests in backend baseline. | Invoice/entity allocations exist; retailer-facing company split not accepted. | NOT RUN | NOT RUN | None | Reconcile and expose separate legal-entity balances. |
| GGN-PAY-06 | PARTIAL | See audit row; allocation tests in backend baseline. | Invoice-level accounting exists; retailer selection/explanation absent. | NOT RUN | NOT RUN | None | Add invoice/entity allocation UX at the supported accounting grain. |
| GGN-PAY-07 | IMPLEMENTED BUT NOT VERIFIED | See audit row; earlier focused home tests, not rerun here. | No live balance readback. | NOT RUN | NOT RUN | None | Verify account amount, states and tap-through on app. |
| GGN-PAY-08 | BROKEN | See audit row; no clickable-block test. | No entity-detail endpoint-to-screen interaction verified. | NOT RUN | NOT RUN | None | Make salesperson Outstanding open entity-separated ledger detail. |
| GGN-SAL-01 | PARTIAL | See audit row; target tests passed in backend baseline. | Value/count calculation tests pass; volume metric absent. | NOT RUN | NOT RUN | None | Add quantity/volume metric and reconcile actuals/periods. |
| GGN-SAL-02 | IMPLEMENTED BUT NOT VERIFIED | See audit row; Admin UI test is from initial focused run. | Backend baseline passed; no data reconciliation for a date/team. | NOT RUN | NOT RUN | None | Reconcile daily metrics to canonical orders in authorized runtime. |
| GGN-ROUTE-01 | PARTIAL | See audit row; backend baseline passed. | Current route plans are date-specific; reusable beat unproven. | NOT RUN | NOT RUN | None | Implement scheduled/reusable beat semantics with multi-select. |
| GGN-ROUTE-02 | MISSING | See audit row; no self-create path/test. | No salesperson self-beat endpoint. | NOT RUN | NOT RUN | None | Implement permission-scoped self-management if allowed by policy. |
| GGN-ROUTE-03 | IMPLEMENTED BUT NOT VERIFIED | See audit row; backend baseline passed. | No-beat order path not run against the local DB in this checkpoint. | NOT RUN | NOT RUN | None | Verify assigned eligible retailer order without a route plan. |
| GGN-ADM-01 | PARTIAL | See audit row; staff tests in backend baseline. | No unified setup flow acceptance. | NOT RUN | NOT RUN | None | Join salesperson, retailer, beat, collection and reporting setup. |
| GGN-ADM-02 | IMPLEMENTED BUT NOT VERIFIED | See audit row; parser/Admin tests from initial focused run. | Import-apply persistence not individually verified here. | NOT RUN | NOT RUN | None | Run preview→apply→readback including row failure isolation. |
| GGN-ADM-03 | IMPLEMENTED BUT NOT VERIFIED | See audit row; Admin Catalog test from initial focused run. | Catalogue write/readback not individually verified here. | NOT RUN | NOT RUN | None | Verify manual and bulk paths share validation and persist. |
| GGN-ADM-04 | IMPLEMENTED BUT NOT VERIFIED | See audit row; collection Admin/API coverage in backend baseline. | No authenticated Admin collection review/readback. | NOT RUN | NOT RUN | None | Verify inspect/confirm/reject and ledger consequence. |
| GGN-ADM-05 | IMPLEMENTED BUT NOT VERIFIED | See audit row; attendance and Admin UI tests. | Backend baseline passed; no role-authenticated leave decision readback. | NOT RUN | NOT RUN | None | Verify request, authorized manager decision and history. |
| GGN-ADM-06 | PARTIAL | See audit row; expense tests in backend baseline. | Individual claims exist; per-person cumulative detail absent. | NOT RUN | NOT RUN | None | Add canonical expense history and computed total to staff detail. |
| GGN-ADM-07 | MISSING | See audit row; no segment field/test. | No internal ABC segment schema/API. | NOT RUN | NOT RUN | None | Add protected internal segment without retailer serialization leakage. |
| GGN-TEAM-01 | PARTIAL | See audit row; Admin/team tests in backend baseline. | No Salesperson-app leader authorization/readback acceptance. | NOT RUN | NOT RUN | None | Add role-aware team mode preserving personal work. |
| GGN-MKT-01 | MISSING | See audit row; no task-photo feature test. | No task-linked evidence persistence path. | NOT RUN | NOT RUN | None | Implement protected task evidence and complete readback. |
| GGN-MKT-02 | PARTIAL | See audit row; generic activity tests in baseline. | No marketing-history/evidence association. | NOT RUN | NOT RUN | None | Add relevant activity/evidence history without dumping raw media. |
| GGN-FDB-01 | MISSING | See audit row; no retailer-to-salesperson feedback flow. | No canonical feedback persistence path. | NOT RUN | NOT RUN | None | Reuse an appropriate feedback module or add authenticated linked record. |
| GGN-ISS-01 | IMPLEMENTED BUT NOT VERIFIED | See audit row; service issue suites in backend baseline. | Local API/DB suites passed; cross-app refresh not accepted. | NOT RUN | NOT RUN | None | Verify one canonical state across both apps after resolution. |
| GGN-UX-01 | IMPLEMENTED BUT NOT VERIFIED | See audit row; safe-area unit test in initial focused run. | Not applicable. | NOT RUN | NOT RUN | None | Verify gesture and three-button modes at small screens/font scale. |
| GGN-UX-02 | PARTIAL | See audit row; no performance profile. | Not applicable. | NOT RUN | NOT RUN | None | Profile and fix measured low/mid-range Android bottleneck. |
| GGN-UX-03 | PARTIAL | See audit row; preview unit test in initial focused run. | Not applicable. | NOT RUN | NOT RUN | None | Enforce 20-product cap and View All behavior at threshold. |
| GGN-UX-04 | IMPLEMENTED BUT NOT VERIFIED | See audit row; no native retap acceptance. | Not applicable. | NOT RUN | NOT RUN | None | Verify same-tab retap scroll-to-top and other applicable screens. |
| GGN-UX-05 | IMPLEMENTED BUT NOT VERIFIED | See audit row; no keyboard/device acceptance. | Not applicable. | NOT RUN | NOT RUN | None | Verify page-two first field and keyboard scrolling on device. |
| GGN-UX-06 | BROKEN | See audit row; order assertion absent. | Not applicable. | NOT RUN | NOT RUN | None | Reorder outlet blocks and verify responsive layout. |
| GGN-GEO-01 | MISSING | See audit row; no base-location path. | No home/base coordinate or distance model/API. | NOT RUN | NOT RUN | None | Add approved capture, storage, accurate calculation and admin visibility. |
| GGN-EXP-01 | PARTIAL | See audit row; parser/PDF tests in initial focused run. | No broad export integration. | NOT RUN | NOT RUN | None | Implement required filtered, scoped Excel/PDF exports. |
| GGN-GAM-01 | DEFERRED BY REQUIREMENT | See audit row; no design approved. | N/A | N/A | N/A | None | Preserve deferral; no gamification implementation. |
| GGN-GAM-02 | DEFERRED BY REQUIREMENT | See audit row; do not expand existing milestone work. | N/A | N/A | N/A | None | Preserve dependency on approved GGN-GAM-01. |
| GGN-ANL-01 | DEFERRED BY REQUIREMENT | See audit row. | N/A | N/A | N/A | None | Do not implement analytics page. |
| GGN-OTP-01 | BROKEN | See audit row; mock OTP tests pass, MSG91 runtime status still requires separate verification. | Local mock/session tests pass; no live provider request. | NOT RUN | NOT RUN | None | Preserve mock/staging OTP; do not send messages or add credentials. Propose minimal adapter repair for approval if still needed. |
| GGN-SVC-01 | WITHDRAWN BY REQUIREMENT | See audit row. | N/A | N/A | N/A | None | Keep withdrawn; current ServiceIssue withdrawal is a separate requirement. |

## Next Actions

1. Continue Batch A with GGN-VIS-02: verify the order-create API and visit readback together, then close the remaining screen/navigation acceptance gap.
2. Proceed in the product goal's exact sequence through Batch A, then Batch B onward. Keep deferred/withdrawn IDs unchanged.
3. For schema changes, test this fresh 46-migration database and a separate disposable upgrade database from the preceding accepted schema. Never reset an existing DB.
4. Before hosted writes, re-verify the exact authorized GAGAN staging service/workspace/database and deployed/source identity. No hosted writes are authorized merely by this checkpoint.
5. Build candidate APKs only when needed for physical acceptance; final pair must come from the exact clean, committed, pushed final SHA and go only to the existing authoritative delivery location.
