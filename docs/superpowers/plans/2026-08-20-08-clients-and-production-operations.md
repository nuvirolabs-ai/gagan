# Clients and Production Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the calm retailer/staff/admin experiences and establish secure builds, deployment, observability, recovery, performance, UAT, and controlled rollout.

**Architecture:** Clients remain thin renderers of backend state and reason-coded actions. Production uses isolated API/worker/admin/mobile releases, managed PostgreSQL/Redis/object storage, structured telemetry, progressive feature flags, and rehearsed rollback.

**Tech Stack:** Expo/EAS, React Native Testing Library, Vite/React, Playwright, Docker, managed PostgreSQL/Redis/S3, OpenTelemetry-compatible monitoring.

---

## Task 1: Complete retailer production journeys

- [ ] Add typed API contracts and tests for KYC status, stock freshness, credit reasons, approval-held orders, invoice details, payment state, notification center, returns/corrections, and support.
- [ ] Replace development payment simulation with provider handoff and webhook-driven polling/deep link return.
- [ ] Add empty/loading/error/offline states and duplicate-tap protection.
- [ ] Run retailer component, navigation, end-to-end, and real-device smoke tests.
- [ ] Commit: `feat: complete retailer production journeys`.

## Task 2: Complete role-aware staff journeys

- [ ] Implement Today work cards for Sales, Field Collection, Approvals, Accounts, Dispatch, and multi-role switcher.
- [ ] Add KYC capture, retailer order, recovery call, promise, collection visit/submission, approval decision, Accounts confirmation, and POD flows.
- [ ] Queue only safe draft operations offline; financial/approval submissions require online server acknowledgment.
- [ ] Test permission visibility and backend denial for every role.
- [ ] Commit: `feat: complete role-aware staff app`.

## Task 3: Complete focused admin operations

- [ ] Add operational pages for staff, KYC, approvals, credit/rating, recovery, collections, payments/corrections, dispatch, integrations, audit, and policy configuration.
- [ ] Use queue/detail/action layouts with search and pagination, not analytics dashboards.
- [ ] Add Playwright journeys for each sensitive action and accessibility checks.
- [ ] Commit: `feat: complete admin operations console`.

## Task 4: Add notifications and deep links

- [ ] Add in-app/push/SMS delivery records and idempotent worker sends.
- [ ] Add retailer notification center and role-aware staff notification inbox.
- [ ] Deep-link only to entities the current session may access.
- [ ] Test retry, deduplication, read state, revoked access, and provider failure.
- [ ] Commit: `feat: deliver actionable notifications`.

## Task 5: Package production infrastructure

- [ ] Add backend Dockerfile with non-root runtime and separate API/worker commands.
- [ ] Add deployment manifests for API, worker, admin, PostgreSQL connection, Redis, object storage, secrets, and migrations.
- [ ] Add EAS profiles for development, preview, and production with HTTPS environment URLs and release channels.
- [ ] Add production startup checks that reject mock adapters and missing monitoring/security config.
- [ ] Commit: `ops: package production deployments`.

## Task 6: Add telemetry, alerts, and runbooks

- [ ] Emit JSON logs, correlation IDs, error events, request/job metrics, and integration/payment/ledger counters.
- [ ] Add liveness/readiness, graceful shutdown, queue and database metrics.
- [ ] Configure actionable alerts for SLA, queue age, SAP freshness/dead letters, payment reconciliation, ledger invariants, collection backlog, and database health.
- [ ] Write and exercise runbooks for SAP/payment outage, queue backlog, balance mismatch, failed migration, restore, rollback, and compromised device.
- [ ] Commit: `ops: add production observability and runbooks`.

## Task 7: Validate backups, migrations, security, and performance

- [ ] Restore a production-shaped backup into an isolated environment and verify application invariants.
- [ ] Run migration up/down-forward recovery rehearsal; production rollback uses forward fixes where destructive down migration is unsafe.
- [ ] Run dependency, secret, container, authorization, upload, rate-limit, and session security tests.
- [ ] Load-test retailer catalog/home, order decision, staff queues, payment callbacks, and workers at agreed pilot and growth volumes.
- [ ] Add pagination/indexes for observed slow queries.
- [ ] Commit: `test: certify production resilience and performance`.

## Task 8: UAT, pilot, and rollout

- [ ] Create signed UAT scripts for Retailer, Sales, Credit, Accounts, Dispatch, Field Collection, and Founder/Director.
- [ ] Run credit shadow mode and resolve every unexplained mismatch.
- [ ] Pilot with bounded retailer/staff cohorts and feature flags.
- [ ] Require launch-gate evidence, rollback owner, and monitoring confirmation before each expansion.
- [ ] Remove mock/legacy code only after verified production cutover and reconciliation.
- [ ] Commit: `chore: complete production rollout gates`.

## Exit gate

- [ ] All three clients pass critical end-to-end and accessibility checks.
- [ ] Production builds use secure URLs/storage and no mock flow.
- [ ] Backup restore, rollback, alerts, and runbooks are exercised.
- [ ] UAT is signed by every operational role.
- [ ] Pilot reconciliation and launch gates pass before broad rollout.
