# Collections and Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give field collectors safe mobile access and automate the SOP recovery path without allowing collectors to alter the ledger.

**Architecture:** Model recovery as invoice-linked cases and required actions generated idempotently by the worker. Model collections as assignments, visits, pending submissions, deposit batches, and Accounts confirmations that call the financial settlement service only after verification.

**Tech Stack:** Prisma/PostgreSQL, worker queue, private object storage, Expo staff app, React admin, PDF generation, Vitest fake timers.

---

## File map

- Create: `backend/src/modules/collections/{assignmentService,visitService,submissionService,confirmationService,depositService}.ts`
- Create: `backend/src/modules/recovery/{caseService,scheduler,promiseService,letterService,legalService}.ts`
- Create: `backend/src/worker/processors/{recoveryScheduler,commitmentEscalation,legalEscalation}.ts`
- Create: migration and table-driven/fake-clock tests
- Create: staff collection/recovery screens and admin confirmation/recovery pages

## Task 1: Add collection and recovery schema

- [ ] Add `RecoveryCase`, `RecoveryAction`, `CallLog`, `PromiseToPay`, `RecoveryLetter`, `LegalCase`, `CollectionAssignment`, `CollectionVisit`, `CollectionSubmission`, `DepositBatch`, and `CollectionConfirmation`.
- [ ] Add uniqueness for one open recovery case per invoice, idempotent scheduled action keys, and one terminal confirmation per submission.
- [ ] Apply migration and commit: `feat: add collection and recovery schema`.

## Task 2: Implement field assignment and visit workflow

- [ ] Write permission/state tests for assignment, accept, check-in, outcome, reassignment, cancellation, and offline retry idempotency.
- [ ] Add route/day APIs and staff Today screens showing only assigned work.
- [ ] Capture optional location with explicit permission and device/server timestamps.
- [ ] Commit: `feat: add field collection assignments and visits`.

## Task 3: Implement pending collection submission

- [ ] Write tests proving a collector submission does not create a Payment, Allocation, or LedgerEntry.
- [ ] Require amount, method, invoice/customer context, receipt/reference evidence, and idempotency key.
- [ ] Support deposit batching and collector submission history.
- [ ] Commit: `feat: submit field collections for confirmation`.

## Task 4: Implement Accounts confirmation and rejection

- [ ] Write concurrent tests proving two Accounts users cannot confirm the same submission twice.
- [ ] Require `collection.confirm`, recent step-up authentication, evidence review, and deposit reconciliation.
- [ ] On approval, create one manual payment through the financial settlement service; on rejection, preserve evidence and reason.
- [ ] Add Accounts queue in admin and staff app.
- [ ] Commit: `feat: confirm collections before ledger posting`.

## Task 5: Implement invoice-age recovery scheduler

- [ ] Write fake-clock table tests for Days 35, 40, 45-48, 49-52, 53-56, 60-69, 70-89, and 90+ from invoice/dispatch date.
- [ ] Generate idempotent `RecoveryAction` rows with role/assignee and deadline.
- [ ] Create mandatory salesperson joint-call tasks and immediate missed-commitment actions.
- [ ] Escalate two missed commitments and 60+ no movement for two weeks.
- [ ] Commit: `feat: automate SOP recovery actions`.

## Task 6: Implement promises, calls, and case timeline

- [ ] Test promise create/keep/miss/supersede, call participant requirements, and evidence/audit.
- [ ] Add compact staff recovery action forms and one chronological admin case timeline.
- [ ] Add optional external call-system reference without making integration required.
- [ ] Commit: `feat: track recovery commitments and calls`.

## Task 7: Generate recovery letters and legal referrals

- [x] Write deterministic PDF content tests for amount, invoices, three signatories, sent date, and seven-day deadline.
- [x] Store signed recovery letters privately and record WhatsApp/SMS/manual sending only as delivery metadata, not approval state.
- [x] Confirm the permanent F rating at Day 90 without automatically creating a legal case; require Founder/Director for settlement/write-off decisions.
- [x] Commit: `feat: add recovery letters and legal escalation`.

## Exit gate

- [ ] Collector cannot mutate ledger under any permission combination.
- [ ] Accounts confirmation settles once.
- [ ] Every recovery day band and escalation has a passing fake-clock test.
- [ ] Case timeline contains calls, promises, visits, letters, decisions, and legal state.
