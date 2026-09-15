# Gagan Market Survey V1 — Local Acceptance Checkpoint

Status: **Implemented for local UAT; hosted staging deployment intentionally not performed.**

This checkpoint adds a reusable, identified Market Survey workflow to the
current Gagan application line. It does not change order, pricing, credit,
inventory, attendance, visit, route, offline, or target calculations.

## Source and scope

- Worktree: `/Users/tanutejas/Documents/Gagan-market-survey-wave2-reconcile-v1`
- Branch: `codex/gagan-market-survey-wave2-reconcile-v1`
- Accepted Wave 2.1 base: `e62e804e723996ce29a98a3b62e0029ea42f20f4`
- Transplanted Market Survey commit: `bab0f2a432dde18a5e5d454b2672e26425d338a6`
- Original Market Survey parent: `5507d750ffe9eb5692d8d0276f3cbfb514773e73`
- Database migration: `20260915120000_market_survey_v1`
- Hosted staging: **not migrated and not deployed**
- Production, `main`, Dogkart, frozen tags, and accepted parent worktrees:
  **untouched**

The implementation is additive. Submitted responses are retained as final
records; response and survey relationships use restrictive deletion where
historical evidence must not disappear.

## Delivered capability

### Admin

- Create and edit draft surveys.
- Configure title, description, date window, audience, questions, required
  state, ordering, options, numeric/rating bounds, and text length.
- Target all or selected retailers, or all or selected salespeople.
- Activate and close surveys.
- Filter survey list by lifecycle status.
- Review identified response records and computed summaries.

### Salesperson and Retailer

- Salesperson access from More / Account and retailer-context access from
  Retailer Detail.
- Retailer access from Account.
- Single choice, multiple choice, yes/no, rating, number, and text answers.
- Clear submitted state with final-answer presentation.
- Online-only submission for V1. The existing offline outbox remains
  domain-specific; survey replay was not added to it without a reviewed
  product contract.

## Backend guarantees

- Only active surveys inside their configured date window are answerable.
- Audience and salesperson-to-retailer assignment are checked server-side.
- Required answers, question ownership, option ownership, cardinality,
  numeric/rating bounds, and text limits are authoritative in the backend.
- A response is identified by survey plus respondent context. A salesperson
  can answer a direct salesperson survey and a retailer-context survey with
  separate durable respondent keys.
- One response is allowed per survey/respondent context.
- Idempotency keys are unique per survey, and the request fingerprint makes a
  same-key changed-payload retry a conflict.
- Concurrent identical first submissions resolve to one response.
- Generic audit metadata records lifecycle and actor context only; answer
  contents are not copied into generic audit metadata.
- Respondent-facing reads omit Admin audience assignments and aggregate
  response counts.

## Verification evidence

### Fresh disposable PostgreSQL

Database: `gagan_uat_market_survey_reconcile_20260915_1800` on local PostgreSQL.

- Full migration history applied from zero: **38 migrations**.
- `prisma validate`: **PASS**.
- `prisma migrate status`: **PASS — database schema is up to date**.
- Local seed completed with the normal repository seed path.
- No hosted database was used or mutated.

Upgrade simulation from the accepted 37-migration Wave 1B/Wave 2.1 state:
**PASS**. Exactly `20260915120000_market_survey_v1` was newly applied.
The four Wave 1B commercial migrations remain present and unchanged. The
unrelated service-issue-lifecycle and retailer-proposal-withdrawal migrations
were not imported.

### Backend

- Full suite: **130 test files, 900 tests passed**.
- Focused commercial/R2/field/cache/survey regression suite: **16 files, 109
  tests passed**.
- Focused Market Survey validation and persistence suite: **2 files, 5 tests
  passed**.
- Typecheck: **PASS**.
- Build: **PASS**.

The reconciled candidate retains the current Wave 2.1 field-issue routing and
does not import the old Market Survey branch's unrelated issue-lifecycle
history. Survey routing is additive on the accepted current application line.

### Admin

- Tests: **20 files, 52 tests passed**.
- Typecheck: **PASS**.
- Lint: **PASS**.
- Production build: **PASS**.

### Salesperson app

- Tests: **29 files, 148 tests passed**.
- Typecheck: **PASS**.

### Retailer app

- Tests: **17 files, 74 tests passed**.
- Typecheck: **PASS**.

## Explicitly deferred from V1

The following are intentionally not represented as completed requirements in
this checkpoint:

- Offline survey submission/replay through the field outbox.
- Anonymous responses.
- Branching/conditional question logic.
- Photo/file answers.
- Exports and scheduled survey notifications.
- Territory or hierarchy audience rules beyond the explicit audience and
  selected-assignment model.
- Hosted staging migration, hosted UAT, and physical-device acceptance.

These are follow-up scope decisions, not hidden implementation claims.

## Local stop gate

**SAFE FOR HOSTED STAGING MARKET-SURVEY UAT: YES — pending a separately
approved migration/deployment review.**

This document records source and disposable-local evidence only. It does not
claim that hosted staging has been migrated, that the hosted Admin has been
deployed, or that either mobile build has been physically accepted.
