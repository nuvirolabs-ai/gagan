# KYC, Inventory, and Fulfilment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate new-customer dispatch on verified KYC, expose trustworthy stock, reserve inventory, and produce complete evidence-backed deliveries and corrections.

**Architecture:** Store private evidence through an object-storage abstraction, keep workflow metadata in PostgreSQL, mirror SAP stock locally with freshness, and execute reservation/POD/invoice transitions atomically through domain services.

**Tech Stack:** Prisma/PostgreSQL, S3-compatible storage, malware/file validation, Express multipart upload, React/Expo, Vitest/Playwright.

---

## File map

- Create: `backend/src/platform/storage/{storage,localStorage,s3Storage,signedUrls}.ts`
- Create: `backend/src/modules/kyc/{kycService,documentService,requirements}.ts`
- Create: `backend/src/modules/inventory/{inventoryService,reservationService,freshness}.ts`
- Create: `backend/src/modules/fulfilment/{deliveryService,podService,adjustmentService}.ts`
- Create: new Prisma migration and module tests
- Create: admin KYC/dispatch pages and staff KYC/dispatch screens
- Modify: retailer/order/catalog APIs and POD admin components

## Task 1: Add protected evidence storage

- [ ] Write contract tests for put, signed read, checksum, content-type/size rejection, expiry, and delete-by-retention-policy.
- [ ] Implement `ObjectStorage` interface with local test adapter and production S3 adapter.
- [ ] Scan uploads before persistence, generate server object keys, and never expose bucket paths directly.
- [ ] Add `EvidenceAsset` metadata and audit every access.
- [ ] Commit: `feat: add protected evidence storage`.

## Task 2: Implement retailer/KYC schema and workflow

- [ ] Add `KycCase`, `KycDocument`, `KycReview`, `RetailerContact`, `RetailerSapAccount`, retailer lifecycle/status, and commercial group constraints.
- [ ] Write tests for required documents, submit/review/reject/resubmit, duplicate SAP codes, and access denial.
- [ ] Add salesperson capture screens, admin review queue, and retailer KYC status.
- [ ] Enforce approved KYC before SAP customer creation and first dispatch.
- [ ] Commit: `feat: add verified retailer KYC workflow`.

## Task 3: Persist SAP stock read model and freshness

- [ ] Add `InventorySnapshot` and `InventorySyncState` with location/material uniqueness and source timestamp.
- [ ] Write tests for fresh, stale, missing, and insufficient stock responses.
- [ ] Replace stock sync's report-only behavior with transactional upsert and freshness update.
- [ ] Add stock availability and last-sync status to catalog APIs; stale data is not shown as guaranteed.
- [ ] Commit: `feat: persist inventory availability`.

## Task 4: Implement reservation lifecycle

- [ ] Add `InventoryReservation` with active/released/consumed/expired states and unique order/variant constraint.
- [ ] Write concurrent tests proving two orders cannot reserve the same last stock.
- [ ] Reserve in the allowed/approved order transaction; release on rejection/cancel/expiry; consume on dispatch.
- [ ] Add idempotent expiry processor.
- [ ] Commit: `feat: reserve inventory atomically`.

## Task 5: Require complete POD evidence

- [ ] Add `DeliveryLine`, `PodEvidence`, and delivery transition constraints.
- [ ] Write tests requiring every order line, validating photo/signature asset ownership, validating server OTP expiry, and returning the existing result on duplicate submission.
- [ ] Move POD to `deliveryService.completeDelivery()` and invoke exactly-once invoice service.
- [ ] Update admin/staff POD UI to capture every line and real evidence.
- [ ] Commit: `feat: complete evidence-backed delivery`.

## Task 6: Add delivery corrections, returns, and credit notes

- [ ] Add `DeliveryAdjustment`, `Return`, and links to financial `CreditNote`.
- [ ] Write permission/state tests for shortage, damage, rejection, return receipt, and credit-note amount.
- [ ] Add focused admin correction flow and retailer-visible corrected invoice timeline.
- [ ] Commit: `feat: add controlled fulfilment corrections`.

## Exit gate

- [ ] First dispatch cannot bypass KYC.
- [ ] Stock has freshness and reservations pass concurrency tests.
- [ ] Every delivered line is resolved and real POD evidence is private/audited.
- [ ] Duplicate delivery creates one invoice.
- [ ] Corrections use returns/credit notes, not historical edits.
