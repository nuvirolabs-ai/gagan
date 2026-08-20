# Gagan Production Readiness Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved Gagan production platform in safe, testable slices while keeping the retailer and staff experiences calm.

**Architecture:** Evolve the existing Express/Prisma application into a modular monolith with separate API and worker processes. Keep PostgreSQL as the transactional store, add durable jobs and private object storage, expose identical backend workflows to admin web and the role-aware staff app, and isolate SAP behind idempotent adapters.

**Tech Stack:** TypeScript, Node.js, Express, Prisma, PostgreSQL, Vitest, Supertest, React, Vite, Expo/React Native, Playwright, Redis/BullMQ, S3-compatible object storage, Expo EAS.

---

## Program rules

- Execute plans in dependency order; do not begin a later plan before the previous plan's exit gate passes.
- Use test-driven development for every behavior change.
- Keep migrations additive until reconciliation and cutover are complete.
- Do not let mobile/admin clients calculate authoritative credit, approval, financial, or dispatch decisions.
- Do not enable mock OTP, payment, or SAP adapters in production.
- Commit after every task-sized slice.

## Plan sequence

| Order | Plan | Outcome | Depends on |
|---|---|---|---|
| 1 | `2026-08-20-01-foundation-and-safety.md` | Version control, CI, test harness, app/worker boundary, configuration and health | None |
| 2 | `2026-08-20-02-identity-and-rbac.md` | Staff identity, permissions, delegation, secure sessions and production OTP | 1 |
| 3 | `2026-08-20-03-financial-core.md` | Immutable invoices, payments, allocations, concurrency safety and reconciliation | 1, 2 |
| 4 | `2026-08-20-04-credit-and-approvals.md` | Versioned credit rules, ratings, approval queues, SLA and dispatch authorization | 2, 3 |
| 5 | `2026-08-20-05-kyc-inventory-fulfilment.md` | KYC evidence, SAP-backed inventory, reservations, complete POD and corrections | 2, 3, 4 |
| 6 | `2026-08-20-06-collections-and-recovery.md` | Field collection, Accounts confirmation, recovery cases, promises, letters and legal | 2, 3, 4, 5 |
| 7 | `2026-08-20-07-sap-integration.md` | Production multi-API SAP adapters, inbox/outbox, reconciliation and fail-closed freshness | 3, 4, 5, 6 |
| 8 | `2026-08-20-08-clients-and-production-operations.md` | Complete client UX, secure builds, deployment, observability, backups, UAT and rollout | 1-7 |

## Critical path

```text
Foundation
  -> Identity/RBAC
  -> Financial core
  -> Credit engine and approvals
  -> KYC/inventory/fulfilment
  -> Collections/recovery
  -> SAP adapter cutover
  -> Production rollout
```

Client work begins within the relevant domain plan after the backend contract is covered by integration tests. Cross-domain client polishing happens only in Plan 8.

## Milestone gates

### Gate A: Safe engineering baseline

- All four packages build/type-check in CI.
- Backend unit and integration test commands are deterministic.
- Fresh database migrations apply successfully.
- API and worker start independently.
- Runtime configuration is validated and mock adapters fail closed in production.

### Gate B: Trusted identity and money

- Permission matrix tests cover every staff role.
- OTP/session abuse controls pass.
- One invoice per order and one settlement per payment are database-enforced.
- Duplicate callback/POD concurrency tests pass.
- Ledger can be rebuilt and reconciled from immutable events.

### Gate C: SOP enforcement

- Every numeric and edge rule from `Credit & sales ops.md` has a table-driven test.
- New-customer second/third/fourth invoice behavior passes.
- A-F rating dispatch rules pass.
- Admin web and staff app decide the same approval request atomically.
- SLA escalation and dispute default states pass.

### Gate D: Operational completion

- KYC gates customer creation/dispatch.
- Stock freshness and reservation prevent overselling.
- POD contains real evidence and resolves every line.
- Field collection stays pending until Accounts confirmation.
- Recovery actions are idempotently scheduled by invoice age.
- Recovery letters and legal referrals have complete audit trails.

### Gate E: SAP and production launch

- All required SAP adapters pass contract and sandbox suites.
- Inbox/outbox idempotency and dead-letter recovery pass.
- App/SAP reconciliation has no unexplained differences for the pilot window.
- Monitoring, backup restore, incident runbooks and rollback are exercised.
- UAT and mobile real-device gates pass.

## Scope controls

The program excludes BI dashboards, general multi-tenancy, route optimization, automated legal action, microservices, and a new promotions engine. Any request to add one becomes a separate approved design and plan.

## Execution tracking

- [ ] Plan 1 complete: Foundation and safety
- [ ] Plan 2 complete: Identity and RBAC
- [ ] Plan 3 complete: Financial core
- [ ] Plan 4 complete: Credit and approvals
- [ ] Plan 5 complete: KYC, inventory and fulfilment
- [ ] Plan 6 complete: Collections and recovery
- [ ] Plan 7 complete: SAP integration
- [ ] Plan 8 complete: Clients and production operations
