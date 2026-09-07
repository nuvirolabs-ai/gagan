# P0 source hardening — final local checkpoint — 2026-09-07

Source-only work on `codex/gagan-p0-integrity-hardening`, starting at
`c9b0eae27bd482b2f61a88684e1778eca367818e`. No deployment, staging merge, tag,
provider connection or accepted presentation change is authorized here.

## Admin state concurrency

Reproduced all four original races against disposable PostgreSQL through the
HTTP router: approve/reject, pack/reject, approve/approve, pack/pack. A read barrier
made both handlers observe the same old state; the original implementation
accepted both requests (200/200). Expected-state conditional updates now accept
one and reject the competing stale action (200/409). One audit event records the
actual accepted `from` and `to` states. Existing permissions and authorization
requirements remain unchanged.

Dispatch assignment also conditionally owns the packed state; a conflict throws
inside the transaction so any consumed dispatch authorization rolls back.
POD already locks and rechecks the order in the invoice transaction. Adjacent
credit approval/dispute decisions now cannot rewind confirmed or later orders;
their expected-state claim and all review side effects share one transaction.

Evidence: `backend/src/modules/invoicing/__tests__/adminTransitionConcurrency.test.ts`
and existing delivery/approval suites. Focused approval/race suite: 21 tests pass.
Final full backend suite: **837 tests / 122 files pass** on the reviewed, seeded local
`gagan_p0_20260907_source_test` database. Typecheck passes. This is automated
database-backed/HTTP evidence, not physical or employee-browser acceptance.

Initial environment failures are retained as limitations of those attempts:
an unseeded database lacked required role/catalog fixtures; a subsequent run
lacked `PII_ENCRYPTION_KEY`. Supported local seed and a generated process-local
test encryption key resolved these prerequisites without weakening guards.
No hosted data or production credentials were used.

## Single-open visit and atomic route linkage

Reproduced duplicate same-store visits, parallel different-store visits, orphan
visits on route-hook failure and duplicate checkout. Staff-row serialization,
visit-row checkout lock and one shared visit/route transaction close these paths.
Same-store retries return the same open visit; another store returns 409.
Route settlement uses pending-state ownership and does not overwrite skipped work.
Original check-in time is retained for route reconciliation on later retries.

Migration `20260907010000_single_open_visit` adds a partial unique index on
salesperson for rows with no checkout. The local preflight found zero conflicts;
SQL explicitly refuses conflicting existing rows. It scans/builds an index and
can block writes; shared staging still requires read-only preflight and a planned
migration window. No historical rows are closed, deleted or backfilled. Old
runtime duplicate starts may receive constraint errors, so coordinated runtime
rollout is required. Removing the index would remove durability, not restore data.

Five database tests verify same/different-store races, direct-writer constraint,
route rollback and checkout/new-cycle behavior. Final full backend: **837 tests / 122
files pass**; typecheck passes. Physical acceptance is not claimed.

## Final local verification

The ordered source-hardening phases required for this branch are complete:
offline durability/account isolation, Admin transition CAS, single-open visit
and replay protection, historical conversion snapshots, and Import Center
single-executor/resumable application. No backend business rule was broadened,
the frozen Salesperson presentation was not replaced, and no staging or
production deployment was performed.

Fresh local database: `gagan_p0_20260907_final_test`, reconstructed from zero,
33 migrations applied, supported seed run, Prisma validation and migration
status clean. New migrations are `20260907010000_single_open_visit` and
`20260907020000_order_case_weight_snapshot`.

Final application regressions: Admin 49/49 tests, Rep 112/112, Retailer 56/56,
Founder 9/9; Admin typecheck/lint/build and Rep/Retailer/Founder typechecks pass.
The focused integrity suites and all Gagan offline suites pass as recorded
above. `git diff --check` is clean for tracked content.

Exact local release candidate: [gagan-gagan-p0-source-hardening-21fd72b.apk](/Users/tanutejas/Desktop/gagan-gagan-p0-source-hardening-21fd72b.apk),
package `com.gagan.sales`, version `1.0.0`/versionCode `1`, size 87,889,813
bytes, SHA-256 `6b582e21ca91456938bbb28cc812e38483e50681dacfff02ea3396f41699127f`.
Its embedded API is `https://gagan-staging-api.onrender.com`. It was not
installed because the known Android device was not connected/authorized.

This remains a source-hardening checkpoint, not staging deployment approval or
physical-device acceptance.

## Historical commercial conversion

Reproduced a 30kg case accepted for 3,000 becoming a 1,500 invoice when the master
was changed to 60kg before delivery. New accepted OrderItems now freeze only the
necessary `caseWeightKgSnapshot` (kilograms per priced case). Both mobile origins
use the same acceptance service. Existing case price and delivered-weight billing
rules are unchanged; no alternate product master or UOM system was introduced.
The database prohibits modification/removal of an already-populated snapshot.

Migration `20260907020000_order_case_weight_snapshot` adds one nullable Decimal,
a positive-value check and an immutability trigger. No row backfill or table data
rewrite. Existing orders remain explicitly legacy/null; for uninvoiced legacy
lines, the established current-master conversion remains the compatibility policy,
not a claim to recover a missing historic agreement. Once an invoice is issued,
its saved line amounts and delivery quantities are authoritative for SAP retries.
For older ledger-only documents with no saved invoice lines, a recomputed amount
that disagrees with the issued ledger amount is held with
`legacy_invoice_conversion_review_required`, never silently rewritten or sent.

The migration is additive but coordinated app rollout is needed: an old writer
can still create null legacy rows. Dropping snapshot data would destroy accepted
conversion evidence and is not a safe rollback strategy. Shared staging data
preflight and deployment are not performed in this source-only session.

Database regression captures an order through the canonical acceptance service,
changes only the dedicated fixture SKU, delivers/invoices, and regenerates SAP
payload after a further master change. Invoice and payload stay at 3,000. The
legacy mismatch test verifies the old ledger remains unchanged. This is local
integration evidence, not a real SAP or employee UI claim.
# Import Center ownership checkpoint

Two concurrent applies and interruption after row writes were reproduced against
PostgreSQL before correction. ImportJob row ownership now spans row changes,
inventory effects, result and completion audit in one transaction. Completed
replay returns the saved result without executing rows again. A terminated
transaction leaves its pre-apply state, not unrecorded committed business writes.
Existing legacy applying/failed records are not blindly reclaimed: their old
partial effects require explicit inspection. No new queue or claim migration.

Gagan retains valid-row application with savepoints and durable per-row results. Retry skips already-successful rows. A failed manager link records its completed identity step and retries only the link, preserving create-only behavior and preventing duplicate staff. Five database tests cover ownership, interruption, partial-row resume, invalidated source and manager-link resume. Full backend before the fifth targeted case: 836 tests / 122 files pass; the five-case targeted suite, typecheck and build pass. Final fresh-db suite is still required.

These are source/database checkpoints, not hosted or physical acceptance.
