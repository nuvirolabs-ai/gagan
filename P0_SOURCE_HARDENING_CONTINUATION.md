# P0 source hardening continuation — 2026-09-07

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
Full backend suite: **825 tests / 119 files pass** on the reviewed, seeded local
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
route rollback and checkout/new-cycle behavior. Full backend: **830 tests / 120
files pass**; typecheck passes. Physical acceptance is not claimed.

## Remaining gates

Historical conversion snapshots and Import Center ownership
are not yet complete. Final fresh-database reconstruction, all application
regressions, offline replays, local UI/device acceptance and push safety remain
separate gates. This document is not a completion or deployment approval.
