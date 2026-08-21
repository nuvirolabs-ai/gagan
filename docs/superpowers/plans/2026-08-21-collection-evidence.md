# Protected field-collection evidence slice

**Goal:** Make field-collection receipt evidence use the same private storage boundary as KYC.

**Scope:** Collector upload, server-side validation/storage, signed admin reads, and preservation
of the existing pending → Accounts step-up confirmation workflow. The disposable PostgreSQL
database remains the only database used for tests; no Supabase upload or seed is performed.

## Tasks

1. Add failing service/route tests proving client-supplied object keys are rejected, base64
   receipts are stored through the configured object-storage adapter, and API responses expose a
   short-lived signed URL rather than the raw key.
2. Update `CollectionService` to accept receipt bytes, validate/store them with purpose
   `collection_receipt`, and map evidence to safe response metadata. Keep submission idempotency
   and Accounts settlement unchanged.
3. Update collection routes and staff/admin clients to send base64 evidence. Preserve stable
   errors and step-up confirmation semantics.
4. Run focused and full verification against `gagan_kyc_test`, review secrets, commit, and stop
   for approval before the next slice.

## Status

- [x] Service/route tests and protected storage integration
- [x] Sales attachment and admin signed-link surfaces
- [x] Focused tests, typechecks, and full verification
