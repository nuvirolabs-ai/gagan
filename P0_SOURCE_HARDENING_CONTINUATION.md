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

## Remaining gates

Visit durability, historical conversion snapshots and Import Center ownership
are not yet complete. Final fresh-database reconstruction, all application
regressions, offline replays, local UI/device acceptance and push safety remain
separate gates. This document is not a completion or deployment approval.
