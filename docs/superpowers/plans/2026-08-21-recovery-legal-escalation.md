# Recovery letters and legal escalation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate private deterministic recovery letters, allow explicit admin legal referrals, and enforce Founder/Director-only settlement or write-off decisions without automatic legal or ledger actions.

**Architecture:** Extend the recovery schema with immutable letter/delivery records, one legal case per recovery case, and one terminal legal decision. Generate a small deterministic PDF in-process, persist it through the existing object-storage interface, and expose only signed reads. Add service/routes and a compact admin queue/detail surface; Day-90 F rating is confirmed by the existing credit worker path, while legal referral remains an explicit admin command.

**Tech Stack:** Prisma/PostgreSQL, TypeScript/Express, existing private object storage, Vitest, React/Vite admin.

---

### Task 1: Add recovery-letter and legal schema

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260821091207_recovery_legal_escalation/migration.sql` and `backend/prisma/migrations/20260821130000_recovery_legal_escalation_key/migration.sql`

- [x] **Step 1: Write schema-backed service tests for letter, delivery, legal case, and decision states.**
- [x] **Step 2: Run the focused tests and confirm they fail because the Prisma models do not exist.**
- [x] **Step 3: Add enums/models and relations with unique idempotency keys, private object metadata, one legal case per recovery case, and one decision per legal case.**
- [x] **Step 4: Apply the migration to `gagan_kyc_test` and regenerate Prisma.**
- [x] **Step 5: Run the focused tests again and confirm they reach service-level failures.**

### Task 2: Build deterministic recovery-letter PDFs

**Files:**
- Create: `backend/src/modules/recovery/recoveryLetterPdf.ts`
- Create: `backend/src/modules/recovery/__tests__/recoveryLetterPdf.test.ts`
- Modify: `backend/src/platform/storage/objectStorage.ts`

- [x] **Step 1: Write a test that renders a fixed input and asserts invoice number, INR amount, three signatory labels, sent date, and seven-day deadline are present in the PDF bytes.**
- [x] **Step 2: Run the test and confirm it fails because the renderer is missing.**
- [x] **Step 3: Implement a deterministic single-page PDF renderer with escaped text, fixed layout, and no runtime-generated identifiers in content.**
- [x] **Step 4: Run the renderer test and confirm it passes.**

### Task 3: Implement letter/delivery/legal services

**Files:**
- Modify: `backend/src/modules/recovery/recoveryService.ts`
- Create: `backend/src/modules/recovery/recoveryLegalService.ts`
- Create: `backend/src/modules/recovery/__tests__/recoveryLegalService.test.ts`

- [x] **Step 1: Add failing tests for private letter storage and idempotent regeneration.**
- [x] **Step 2: Add failing tests for delivery metadata channels and stable idempotency conflict behavior.**
- [x] **Step 3: Add failing tests for explicit legal-case creation, non-admin denial, and Founder/Director-only terminal decisions.**
- [x] **Step 4: Implement letter generation from case/invoice data, signed URL reads, delivery metadata, legal-case creation, and one-way settlement/write-off decisions with audit events.**
- [x] **Step 5: Run the focused service tests and confirm all pass.**

### Task 4: Add recovery/legal API routes

**Files:**
- Modify: `backend/src/modules/recovery/recoveryRoutes.ts`
- Modify: `backend/src/modules/recovery/__tests__/recoveryRoutes.test.ts`
- Modify: `rep/src/api/staffApi.ts` to expose read-only letter/timeline methods used by the staff recovery workflow

- [x] **Step 1: Write route tests for letter generation, signed read, delivery logging, legal referral, and settlement/write-off validation.**
- [x] **Step 2: Run route tests and confirm they fail with missing routes.**
- [x] **Step 3: Add Zod validation and stable service-error mapping; keep legal routes behind `staff.manage`/`legal.decide` as appropriate.**
- [x] **Step 4: Run route tests and confirm they pass.**

### Task 5: Confirm automatic Day-90 F rating without legal creation

**Files:**
- Modify: `backend/src/modules/credit/ratingService.ts`
- Modify: `backend/src/modules/credit/__tests__/ratingService.test.ts`
- Create: `backend/src/worker/processors/__tests__/ratingReview.test.ts`

- [x] **Step 1: Add a failing test proving a Day-90 `legal_90_day_lock` proposal results in confirmed F/advance-payment-only state and no `LegalCase`.**
- [x] **Step 2: Run the test and confirm the current implementation leaves the proposal pending.**
- [x] **Step 3: Add a transactional system-confirmation path only for the legal-90 F trigger; retain manual confirmation for other ratings.**
- [x] **Step 4: Run the rating tests and confirm they pass.**

### Task 6: Add admin legal operations surface

**Files:**
- Modify: `admin/src/api.ts`
- Create: `admin/src/pages/Legal.tsx`
- Create: `admin/src/pages/__tests__/Legal.test.tsx`
- Modify: `admin/src/App.tsx`

- [x] **Step 1: Add a UI test for selecting a recovery case, generating a letter, recording delivery, and creating a legal referral.**
- [x] **Step 2: Run the UI test and confirm it fails because the page/API methods are missing.**
- [x] **Step 3: Implement a compact queue/detail page with explicit action buttons and a settlement/write-off form only when `legal.decide` is present.**
- [x] **Step 4: Run the UI test, typecheck, lint, and build.**

### Task 7: Verify, document, and commit

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-08-20-06-collections-and-recovery.md` to mark Task 7 complete

- [x] **Step 1: Run backend tests, typecheck, build, and Prisma validation against the disposable database.**
- [x] **Step 2: Run mobile, rep, and admin verification.**
- [x] **Step 3: Run `git diff --check` and a staged secret scan; remove generated local evidence files.**
- [x] **Step 4: Commit `feat: add recovery letters and legal escalation`.**

## Exit criteria

- Day-90 F rating can be confirmed by the worker path without creating a legal case.
- Legal referrals occur only through an explicit admin action.
- Letters are deterministic, private, idempotent, and delivery metadata is auditable.
- Settlement/write-off requires `legal.decide`, is one-way, and never mutates the ledger automatically.
