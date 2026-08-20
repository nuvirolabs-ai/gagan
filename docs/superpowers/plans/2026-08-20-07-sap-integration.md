# SAP Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect multiple SAP APIs through reliable, idempotent backend adapters with explicit ownership, freshness, dead-letter recovery, and reconciliation.

**Architecture:** Keep canonical commands/events inside the Gagan platform and isolate SAP transport/auth/mapping in adapters. Persist inbound and outbound work, claim it safely across workers, and reconcile each authoritative document before expanding rollout.

**Tech Stack:** TypeScript adapters, Prisma/PostgreSQL inbox/outbox, BullMQ/Redis, SAP HTTP/OData/RFC middleware APIs, contract tests.

---

## Task 1: Finalize canonical contracts and field ownership

- [ ] Create versioned contracts for customer, material, pricing, stock, order prepare/release, delivery, billing, receivable/payment, and credit/block APIs.
- [ ] Add contract tests using sanitized SAP examples and JSON-schema/Zod validation.
- [ ] Encode the approved ownership table as adapter documentation and runtime freshness policies.
- [ ] Commit: `docs: define canonical SAP contracts`.

## Task 2: Replace outbox with claimed durable processing

- [ ] Add `IntegrationInbox`, expanded `IntegrationOutbox`, `IntegrationAttempt`, `ExternalEntityLink`, and `IntegrationReconciliation`.
- [ ] Write multi-worker concurrency tests proving one command is claimed and sent once.
- [ ] Add stable idempotency keys, exponential backoff, next-attempt time, dead-letter state, and payload rebuild on retry.
- [ ] Commit: `feat: harden integration inbox and outbox`.

## Task 3: Implement SAP authentication and transport

- [ ] Define per-API credentials/endpoints/timeouts without storing secrets in the database.
- [ ] Test token refresh, timeout, retryable/non-retryable errors, sanitized logging, correlation IDs, and circuit behavior.
- [ ] Implement production transport selected by validated configuration.
- [ ] Commit: `feat: add production SAP transport`.

## Task 4: Implement master-data adapters

- [ ] Implement customer/KYC, material/packaging, pricing/tax, and stock adapters with contract tests.
- [ ] Enforce unique mappings and create conflict records instead of silent reassignment.
- [ ] Update local read models transactionally and advance watermarks only after success.
- [ ] Commit: `feat: sync SAP master data safely`.

## Task 5: Implement transactional-document adapters

- [ ] Implement order prepare/release, delivery/goods movement, billing/FI, payment posting, and credit/rating/block commands.
- [ ] Test duplicate command response, timeout-after-SAP-commit recovery, rejected business response, missing mapping, and stale authorization.
- [ ] Require acknowledged SAP enforcement before dispatch/payment-based clearance.
- [ ] Commit: `feat: post SAP business documents idempotently`.

## Task 6: Implement reconciliation and operational UI

- [ ] Reconcile customers/materials/pricing/stock freshness, sales orders, deliveries, invoices, receivables, payments, ratings, limits, and blocks.
- [ ] Create owned issues with reason code and remediation; never auto-correct financial mismatches without approved policy.
- [ ] Add admin Integration page for freshness, queues, dead letters, mappings, issues, and safe retry.
- [ ] Commit: `feat: reconcile and operate SAP integrations`.

## Task 7: Sandbox certification and staged cutover

- [ ] Run contract suite against SAP sandbox and retain sanitized evidence.
- [ ] Backfill mappings and reconcile a production-like snapshot.
- [ ] Enable read adapters first, then order prepare/release, delivery, billing, payment, and credit controls one at a time.
- [ ] For each adapter, verify rollback/disable flag and zero unexplained pilot differences.
- [ ] Commit: `chore: certify SAP adapter cutover`.

## Exit gate

- [ ] No client calls SAP directly.
- [ ] Multi-worker processing cannot duplicate a SAP command.
- [ ] Timeout-after-commit is recoverable through idempotency/reconciliation.
- [ ] Required freshness fails dispatch/financial clearance closed.
- [ ] Pilot reconciliation has no unexplained differences.
