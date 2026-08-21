# KYC and Protected Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an auditable retailer KYC workflow with private evidence metadata/storage, staff submission/review, and dispatch/customer-creation gates.

**Architecture:** Prisma owns KYC state and immutable review/audit records. A small `ObjectStorage` interface isolates local disposable storage from the production S3-compatible adapter. Backend routes enforce assignment/permission/step-up rules; mobile/admin clients render server decisions only.

**Tech Stack:** TypeScript, Express, Prisma/PostgreSQL, Zod, Vitest, Expo, React/Vite, S3-compatible object storage.

---

### Task 1: Add KYC and evidence schema

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_kyc_evidence/migration.sql` via Prisma
- Modify: `backend/prisma/seed.ts`
- Modify: `backend/src/modules/identity/roleCatalog.ts`
- Test: `backend/src/modules/kyc/__tests__/kycSchema.test.ts`

- [x] **Step 1: Write the failing schema test**

Assert that a retailer can have one current KYC case, documents/reviews/evidence assets persist, lifecycle defaults to `pending_kyc`, and the demo retailer is explicitly active/verified.

- [x] **Step 2: Run the focused test against `gagan_kyc_test`**

Run `DATABASE_URL=postgresql://tanutejassaraswat@localhost:5432/gagan_kyc_test npx vitest run src/modules/kyc/__tests__/kycSchema.test.ts`. It must fail because the models do not exist.

- [x] **Step 3: Add enums/models/relations and permissions**

Add retailer lifecycle, KYC case/document/review statuses/types, evidence-purpose metadata, contacts, SAP account mapping, and `kyc.view`/`kyc.review` permissions. Keep the existing `kyc.submit` permission for assigned Sales staff.

- [x] **Step 4: Update seed data**

Mark the seeded retailer `active`, keep its existing verified credit profile, and create an approved demo KYC case with three evidence metadata rows without writing real files.

- [x] **Step 5: Apply migration and rerun the test**

Run `DATABASE_URL=... npx prisma migrate dev --name kyc_evidence` and rerun the focused test; expect pass.

### Task 2: Implement private object storage and validation

**Files:**
- Create: `backend/src/platform/storage/objectStorage.ts`
- Create: `backend/src/platform/storage/localObjectStorage.ts`
- Create: `backend/src/platform/storage/s3ObjectStorage.ts`
- Create: `backend/src/platform/storage/storageRuntime.ts`
- Test: `backend/src/platform/storage/__tests__/objectStorage.test.ts`
- Modify: `backend/package.json`

- [x] **Step 1: Write failing storage tests**

Cover opaque server keys, content-type/10 MB limits, checksum verification, local put/read/delete, and short-lived signed reads. The test adapter must never return a public bucket path.

- [x] **Step 2: Run the storage tests and confirm the expected missing-module failure**

Run `npm test -- src/platform/storage/__tests__/objectStorage.test.ts`.

- [x] **Step 3: Implement the interface and local adapter**

Use a configured private root, reject traversal, generate keys with purpose/date/UUID, and return an expiring local token rather than a raw filesystem path.

- [x] **Step 4: Add the S3-compatible adapter**

Use `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`; require private bucket configuration and signed GET URLs. Do not upload during tests.

- [x] **Step 5: Run focused storage tests**

Expect all storage tests to pass with no network access.

### Task 3: Implement KYC service and API authorization

**Files:**
- Create: `backend/src/modules/kyc/kycService.ts`
- Create: `backend/src/modules/kyc/kycRoutes.ts`
- Create: `backend/src/modules/kyc/__tests__/kycService.test.ts`
- Create: `backend/src/modules/kyc/__tests__/kycRoutes.test.ts`
- Modify: `backend/src/app.ts`

- [x] **Step 1: Write failing service tests**

Cover assigned-Sales submission, required document types, submit/reject/request-changes transitions, duplicate document replacement, immutable review rows, audit events, and idempotent approval.

- [x] **Step 2: Write failing route tests**

Cover `/rep/kyc`, `/rep/kyc/:id/documents`, `/rep/kyc/:id/submit`, `/admin/kyc`, `/admin/kyc/:id`, `/admin/kyc/:id/approve`, and `/admin/kyc/:id/reject`; require permissions and recent step-up for review.

- [x] **Step 3: Implement service state machine**

Use transactions and conditional status updates so two reviewers cannot approve/reject the same case. Require business registration, identity proof, and address proof before submission.

- [x] **Step 4: Implement routes and mount them**

Return stable errors (`kyc_required`, `permission_required`, `step_up_required`, `invalid_transition`) and never expose storage paths.

- [x] **Step 5: Run focused KYC tests**

Run the two KYC test files against `gagan_kyc_test`; expect all pass.

### Task 4: Add dispatch/customer-creation gate

**Files:**
- Create: `backend/src/modules/kyc/kycGate.ts`
- Modify: `backend/src/routes/admin/orders.ts`
- Modify: `backend/src/lib/sap/sync.ts`
- Test: `backend/src/modules/kyc/__tests__/kycGate.test.ts`

- [x] **Step 1: Write failing gate tests**

Assert pending/rejected/suspended retailers receive `kyc_required`, while active approved retailers pass; verify customer creation also requires the same gate.

- [x] **Step 2: Implement the shared gate**

Read current retailer lifecycle and approved KYC case in one query and throw a stable domain error.

- [x] **Step 3: Wire dispatch; keep inbound SAP customer creation pending KYC**

Call the gate before an order can transition to dispatch and before SAP customer creation is enqueued. Keep SAP disabled behavior unchanged.

- [x] **Step 4: Run gate and existing dispatch tests**

Expect focused and existing backend tests to pass.

### Task 5: Add focused client/admin surfaces

**Files:**
- Modify: `rep/src/api/staffApi.ts`
- Create: `rep/src/screens/KycCaptureScreen.tsx`
- Modify: `rep/src/screens/RepRetailerDetailScreen.tsx`
- Modify: `admin/src/api.ts`
- Create: `admin/src/pages/Kyc.tsx`
- Modify: `admin/src/App.tsx`
- Test: `rep/src/api/__tests__/kycApi.test.ts`
- Test: `admin/src/pages/__tests__/Kyc.test.tsx`

- [x] **Step 1: Write failing API/UI tests**

Cover Sales KYC status/document submission and Admin pending queue/approve/reject with step-up prompt.

- [x] **Step 2: Implement typed API clients**

Keep evidence upload as metadata-only until the storage upload endpoint is connected; the server remains authoritative.

- [x] **Step 3: Implement compact screens**

Add a focused capture/status card in the staff app and a queue/detail action page in admin; do not add a dashboard.

- [x] **Step 4: Run client tests/typechecks**

Run `npm test` and `npm run typecheck` in `rep` and `admin`.

### Task 6: Verify, document and commit slice 1

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-08-21-kyc-and-evidence-design.md`

- [x] **Step 1: Run the disposable database migration and seed**

Apply all migrations and seed only `gagan_kyc_test`; never use the final Supabase URL.

- [x] **Step 2: Run the full verification gate**

Run `bash scripts/verify.sh` with the disposable database URL and record the result.

- [x] **Step 3: Add manual test instructions**

Document the KYC path and expected stable errors in the README.

- [x] **Step 4: Review for secrets and stale references**

Run `git diff --check`, scan for credentials, and confirm no production database URL was added.

- [x] **Step 5: Commit the slice**

Commit as `feat: add kyc and protected evidence workflow` and stop for user approval before starting slice 2.
