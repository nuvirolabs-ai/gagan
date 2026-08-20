# Financial Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make invoices, payments, allocations, balances, and corrections immutable, idempotent, concurrency-safe, and reconcilable.

**Architecture:** Introduce explicit financial documents beside the legacy ledger, dual-write behind tested application services, backfill and reconcile, then cut reads over. Enforce one invoice per order and one settlement per payment at the database level.

**Tech Stack:** Prisma/PostgreSQL, serializable transactions, Vitest integration/concurrency tests, Decimal.js or Prisma Decimal.

---

## File map

- Create: `backend/prisma/migrations/*_financial_core/migration.sql`
- Create: `backend/src/modules/invoicing/{invoiceService,invoiceRepository,types}.ts`
- Create: `backend/src/modules/payments/{paymentService,allocationService,reversalService,reconciliationService}.ts`
- Create: `backend/src/modules/ledger/{ledgerService,balanceProjector,invariants}.ts`
- Create: `backend/src/modules/*/__tests__/*.test.ts`
- Create: `backend/scripts/{backfillFinancialCore,reconcileFinancialCore}.ts`
- Modify: `backend/src/routes/admin/orders.ts`, `backend/src/routes/payments.ts`, `backend/src/routes/admin/retailers.ts`
- Modify: `backend/prisma/schema.prisma`

## Task 1: Add immutable financial schema

- [x] Write migration tests for unique `Invoice.orderId`, unique provider event/reference, unique settlement marker, allocation bounds, reversal links, and append-only ledger constraints enforced by services.
- [x] Add `Invoice`, `InvoiceLine`, `PaymentAllocation`, `FinancialLedgerEntry`, `PaymentEvidence`, `CreditNote`, `PaymentReversal`, and `ReconciliationIssue`.
- [x] Represent money as Decimal(14,2), weights as Decimal(14,3), and use explicit debit/credit direction.
- [x] Apply migration to a disposable database and run schema tests.
- [x] Commit: `feat: add immutable financial schema`.

## Task 2: Implement exactly-once invoice creation

- [x] Write a failing integration test that submits two concurrent delivery completions and expects one invoice, one ledger debit, and one delivered order.
- [x] Implement `createInvoiceForDelivery({ orderId, lines, occurredAt, idempotencyKey })` with PostgreSQL row locks, bounded conflict retry, and unique-order recovery.
- [x] Reuse `buildInvoice` calculation but require every order line to provide a delivered resolution.
- [x] Return the existing invoice for a repeated idempotency key.
- [x] Run the concurrent test repeatedly; expect stable pass.
- [x] Commit: `feat: create delivery invoices exactly once`.

Expected invariant test:

```ts
expect(await prisma.invoice.count({ where: { orderId } })).toBe(1);
expect(await prisma.financialLedgerEntry.count({ where: { invoiceId } })).toBe(1);
```

## Task 3: Implement exactly-once payment settlement and allocations

- [x] Write concurrent webhook tests where two verified callbacks race; expect one successful transition, one payment ledger credit, and one allocation set.
- [x] Implement conditional pending-to-succeeded settlement with PostgreSQL payment and retailer row locks plus bounded conflict retry.
- [x] Allocate oldest invoice date first and persist every allocation.
- [x] Preserve overpayment only as explicit customer credit; reject accidental manual overpayment unless `allowAdvanceCredit` permission/reason is supplied.
- [x] Add unique constraints linking settlement ledger entry to payment.
- [x] Run unit, integration, and concurrency tests.
- [x] Commit: `feat: settle payments exactly once`.

## Task 4: Add reversals, credit notes, and append-only corrections

- [x] Write tests proving correction services leave confirmed invoice and payment ledger entries unchanged.
- [x] Implement full/partial payment reversal and delivery credit-note services with permission, reason, and audit requirements.
- [x] Recalculate allocations through compensating entries, never mutation of historical entries.
- [x] Expose admin correction APIs and focused confirmation UI.
- [x] Run backend and admin end-to-end tests.
- [x] Commit: `feat: add auditable financial corrections`.

## Task 5: Backfill and reconcile legacy data

- [x] Write dry-run tests using a fixture snapshot containing opening invoices, payments, partial payments, and unmatched entries.
- [x] Implement idempotent backfill scripts with dry-run default and explicit `--apply`.
- [x] Generate counts and money totals before/after; create Accounts-owned `ReconciliationIssue` records for ambiguous data.
- [x] Implement `rebuildRetailerBalance(retailerId)` and all-retailer reconciliation without overwriting mismatches automatically.
- [x] Run dry-run, apply, repeated apply, and reconciliation against a disposable copy of current development seed data.
- [x] Commit: `chore: backfill and reconcile financial core`.

## Task 6: Cut API reads/writes over and remove unsafe paths

- [ ] Add characterization API tests for retailer ledger, dues, admin ledger, online payment, manual payment, and delivery invoice.
- [ ] Route all writes through domain services and all reads through the new financial projections.
- [ ] Keep legacy fields read-only for one release; add invariant monitoring comparing legacy and new balances.
- [ ] Remove direct `currentBalance` arithmetic from route handlers.
- [ ] Run full verification and reconciliation suite.
- [ ] Commit: `refactor: cut financial APIs to immutable core`.

## Exit gate

- [ ] Duplicate invoice/payment concurrency tests pass.
- [ ] Ledger rebuild equals cached balances for all clean records.
- [ ] Every difference becomes an owned reconciliation issue.
- [ ] Corrections are compensating events.
- [ ] No route performs read-calculate-overwrite balance mutation.
