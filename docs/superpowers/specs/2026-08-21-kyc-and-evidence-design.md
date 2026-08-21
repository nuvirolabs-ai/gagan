# KYC and Protected Evidence Design

**Status:** Approved for implementation as production slice 1
**Date:** 2026-08-21
**Scope:** Retailer KYC intake, private evidence metadata/storage, staff review, and dispatch/customer-creation gates

## Goal

Give Sales and Credit staff a single auditable KYC workflow: a retailer case is submitted with private documents, reviewed by an authorized staff member, and must be approved before a new customer can be created or an order can be dispatched.

## Boundaries

- The API remains the only authority for KYC state and dispatch gates.
- Evidence files are addressed by opaque server-generated object keys; clients never choose bucket paths or receive public bucket URLs.
- The storage interface supports a local filesystem adapter for disposable development and an S3-compatible adapter for production object storage.
- KYC review is separate from credit rating confirmation, but approval records the reviewer, reason, evidence and timestamp in the audit stream.
- Existing seeded retailers remain usable because the seed explicitly marks the demo retailer active and KYC-verified.
- This slice does not implement SAP customer creation; it exposes a gate that SAP/customer creation code must call.

## Data model

- `Retailer.status`: `pending_kyc`, `active`, `suspended`, or `closed`.
- `KycCase`: one current case per retailer, with `draft`, `submitted`, `in_review`, `approved`, or `rejected` state.
- `KycDocument`: document type, private evidence asset, uploader, status, and rejection reason.
- `KycReview`: immutable approve/reject/request-changes decision with actor and reason.
- `EvidenceAsset`: checksum, content type, size, opaque object key, purpose, and audit timestamps.
- `RetailerContact`: named business contacts associated with the retailer.
- `RetailerSapAccount`: unique retailer-to-SAP account mapping placeholder used by the future adapter.

The initial required document policy is business registration, identity proof, and address proof. The policy is centralized in the KYC service so it can be changed with a migration/configuration update rather than scattered across clients.

## API and authorization

- Sales staff can create/update a case only for assigned retailers and submit documents.
- Credit/Admin staff can list pending cases, inspect a case, approve, reject, or request changes.
- Approval/rejection requires the existing recent step-up middleware and a reason.
- Retailers can view their own KYC status but cannot approve their own case.
- Dispatch/customer-creation gates return a stable `kyc_required` error unless the retailer is active with an approved case and current verification.

## Storage behavior

`ObjectStorage` exposes `put`, `signedReadUrl`, and `delete`. The local adapter writes under a configured private root. The S3 adapter uses a private bucket and short-lived signed GET URLs. Upload validation rejects unsupported content types, files over 10 MB, and checksum mismatches before the metadata transaction is committed.

## Testing and rollout

- Unit tests cover key generation, content/size validation, local storage round trips, KYC state transitions, assignment authorization, required documents, duplicate submissions, review idempotency, audit records, and dispatch/customer gates.
- Integration tests run against disposable PostgreSQL only.
- The final Supabase project receives no seed data during this slice.
- Client screens remain focused: Sales KYC capture/status and Admin KYC review queue/detail. No analytics dashboard is added.
