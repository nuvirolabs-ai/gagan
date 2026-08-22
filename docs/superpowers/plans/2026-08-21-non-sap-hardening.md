# Non-SAP Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all production blockers that can be solved without real SAP credentials, while preserving the SAP connector boundary for a later Service Layer implementation.

**Architecture:** Add durable database-backed order idempotency, canonical SAP identity/status fields, local warehouse-aware inventory snapshots, and a shared financial summary service. Protect sensitive routes with a bounded server-side limiter, sanitize SAP errors using request IDs, and make the worker the only scheduler owner. Finish with auditable mobile/security/config/UAT documentation and a fresh disposable-database regression run.

**Tech Stack:** Express, TypeScript, Prisma/PostgreSQL, Vitest, Expo 57, React/Vite, existing worker and `SapConnector` abstraction.

---

## Files to read before implementation

- `backend/prisma/schema.prisma`
- `backend/src/lib/orders.ts`
- `backend/src/routes/orders.ts`
- `backend/src/routes/rep.ts`
- `backend/src/lib/sap/connector.ts`
- `backend/src/lib/sap/mockConnector.ts`
- `backend/src/lib/sap/disabledConnector.ts`
- `backend/src/lib/sap/outbox.ts`
- `backend/src/lib/sap/sync.ts`
- `backend/src/routes/payments.ts`
- `backend/src/routes/home.ts`
- `backend/src/routes/admin/retailers.ts`
- `backend/src/routes/admin/sap.ts`
- `backend/src/app.ts`
- `backend/src/jobs.ts`
- `mobile/src/api/retailerApi.ts`
- `mobile/src/screens/CartScreen.tsx`
- `rep/src/api/staffApi.ts`
- `rep/src/screens/RepCatalogScreen.tsx`

## Task 1: Durable order idempotency

**Files:**
- Create: `backend/prisma/migrations/<timestamp>_order_idempotency_and_sap_identity/migration.sql`
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/lib/orders.ts`
- Modify: `backend/src/routes/orders.ts`
- Modify: `backend/src/routes/rep.ts`
- Modify: `mobile/src/api/retailerApi.ts`
- Modify: `mobile/src/screens/CartScreen.tsx`
- Modify: `rep/src/api/staffApi.ts`
- Modify: `rep/src/screens/RepCatalogScreen.tsx`
- Test: `backend/src/modules/credit/__tests__/orderEnforcement.test.ts`
- Test: `backend/src/routes/__tests__/orderIdempotency.test.ts`

- [ ] Add nullable `Order.idempotencyKey` and a unique composite index `(retailerId, idempotencyKey)`; use a migration that preserves existing rows.
- [ ] Write failing tests for sequential replay, concurrent replay, ten concurrent requests, same key across retailers, different keys for one retailer, and assisted salesperson replay.
- [ ] Change both request schemas to require a non-empty `Idempotency-Key` header (accept a body fallback only for backwards-compatible internal callers).
- [ ] Pass the key into `createOrderForRetailer`; inside the existing retailer row-lock transaction, first return the existing order and its approval/dispatch result for the same retailer/key.
- [ ] Handle the unique-constraint race by re-reading the existing order and returning the same response; never create a second outbox row.
- [ ] Generate one UUID per mobile checkout attempt and reuse it for the request retry; generate one UUID per salesperson assisted checkout.
- [ ] Run the focused tests red, implement green, then run all backend tests.

## Task 2: Canonical SAP order identity

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_order_idempotency_and_sap_identity/migration.sql`
- Modify: `backend/src/lib/sap/connector.ts`
- Modify: `backend/src/lib/sap/mockConnector.ts`
- Modify: `backend/src/lib/sap/disabledConnector.ts`
- Modify: `backend/src/lib/sap/outbox.ts`
- Modify: `backend/src/routes/orders.ts`
- Modify: `backend/src/routes/rep.ts`
- Test: `backend/src/lib/sap/__tests__/outbox.test.ts`

- [ ] Add nullable `sapDocEntry`, `sapDocNum`, `sapExternalReference`, `sapSyncStatus`, `sapLastSyncedAt`, `sapErrorCode`, and `sapErrorMessage` to `Order`; add indexes on external reference and sync status.
- [ ] Define `SapOrderSyncStatus` enum with `pending`, `sending`, `sent`, `failed`, `reconciliation_required`.
- [ ] Define immutable external reference as `GGN-${orderNo padded to 8 digits}`; add it at order creation and carry it in `SapSalesOrderPayload`.
- [ ] Extend connector results with synthetic-only mock `docEntry`/string `docNum`; never generate production-looking SAP values in local order creation.
- [ ] Write failing outbox tests for pending, sent, failed, and reconciliation-required transitions, then persist canonical fields in the drain transaction.
- [ ] Keep `sapSalesOrderId` as a backwards-compatible legacy field populated from the canonical result.

## Task 3: Inventory snapshots and checkout validation

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_inventory_snapshots/migration.sql`
- Create: `backend/src/modules/inventory/inventoryService.ts`
- Modify: `backend/src/lib/sap/connector.ts`
- Modify: `backend/src/lib/sap/mockConnector.ts`
- Modify: `backend/src/lib/sap/sync.ts`
- Modify: `backend/src/lib/orders.ts`
- Modify: `backend/src/routes/catalog.ts`
- Modify: `backend/src/routes/rep.ts`
- Test: `backend/src/modules/inventory/__tests__/inventoryService.test.ts`
- Test: `backend/src/modules/credit/__tests__/orderEnforcement.test.ts`

- [ ] Add `InventorySnapshot` with product/variant, SAP material, warehouse, onHand, committed, available, status, source, syncedAt, and unique `(sapMaterialId, warehouseCode)`.
- [ ] Extend `SapStock` with warehouse code and committed quantity; preserve mock defaults with a documented warehouse.
- [ ] Implement upsert sync and freshness calculation; expose `availableQty`, `status`, `warehouseCode`, and `syncedAt` in catalog/rep catalog.
- [ ] Write failing tests for sufficient, exact, insufficient, zero, missing, stale, changed-between-cart-and-submit, and multiple-warehouse cases.
- [ ] Validate inventory inside the same locked order transaction immediately before order creation; reject missing/stale/insufficient data with safe errors.
- [ ] Apply the same path to retailer and salesperson orders.

## Task 4: Shared financial summary

**Files:**
- Create: `backend/src/modules/finance/financialSummary.ts`
- Modify: `backend/src/routes/home.ts`
- Modify: `backend/src/routes/payments.ts`
- Modify: `backend/src/routes/rep.ts`
- Modify: `backend/src/routes/admin/retailers.ts`
- Modify: `backend/src/routes/ledger.ts`
- Test: `backend/src/modules/finance/__tests__/financialSummary.test.ts`
- Test: `backend/src/modules/finance/__tests__/financialReadRoutesCutover.test.ts`

- [ ] Define one summary contract: `outstanding`, `overdue`, `creditLimit`, `creditUsed`, `availableCredit`, `invoiceAgeing`, `source`, `syncedAt`, `isStale`.
- [ ] Use local invoices only when they exist; otherwise return `invoiceAgeing: null`, `source: "cached_retailer_balance"`, and an explicit stale/unavailable marker rather than zero.
- [ ] Make home, payments, salesperson, and admin responses call the same service.
- [ ] Write tests that seed one state and assert identical values in all four API surfaces.

## Task 5: Abuse protection and safe SAP errors

**Files:**
- Create: `backend/src/platform/http/rateLimit.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/routes/orders.ts`
- Modify: `backend/src/routes/rep.ts`
- Modify: `backend/src/routes/admin/auth.ts`
- Modify: `backend/src/routes/payments.ts`
- Modify: `backend/src/routes/admin/sap.ts`
- Test: `backend/src/platform/http/__tests__/rateLimit.test.ts`
- Test: `backend/src/routes/admin/__tests__/sapErrors.test.ts`

- [ ] Implement bounded in-process per-IP/per-subject windows with deterministic test reset; use conservative limits for order, assisted order, admin login, and payment intent.
- [ ] Return 429 with `requestId` and `retryAfterSeconds`; do not log secrets.
- [ ] Add a safe SAP error mapper returning stable code/message/requestId while logging only sanitized technical metadata.
- [ ] Add regression tests asserting raw URLs, payloads, session values, and stack traces never appear in responses.

## Task 6: Connector readiness and worker ownership

**Files:**
- Modify: `backend/src/lib/sap/connector.ts`
- Modify: `backend/src/lib/sap/mockConnector.ts`
- Modify: `backend/src/lib/sap/disabledConnector.ts`
- Create: `backend/src/lib/sap/serviceLayerConnector.ts`
- Modify: `backend/src/lib/sap/index.ts`
- Modify: `backend/src/jobs.ts`
- Modify: `backend/src/server.ts`
- Modify: `backend/src/platform/config/env.ts`
- Test: `backend/src/lib/sap/__tests__/connectorContract.test.ts`
- Test: `backend/src/__tests__/jobs.test.ts`

- [ ] Expand the connector contract for session lifecycle, customers, items, pricing, stock, orders, external-reference lookup, delivery notes, invoices, and financial summary without implementing network calls.
- [ ] Add `SapB1ServiceLayerConnector` as an explicit unsupported placeholder that throws a safe configuration error if selected.
- [ ] Ensure API startup never starts scheduled jobs; only `worker.ts` calls `startScheduledJobs`. Preserve `DISABLE_JOBS=true`.
- [ ] Add a job owner/startup log and tests proving API creation does not schedule jobs.

## Task 7: Mobile audit, UAT, and production configuration documentation

**Files:**
- Create: `MOBILE_SECURITY_AUDIT.md`
- Create: `DEVICE_UAT_CHECKLIST.md`
- Create: `PRODUCTION_CONFIG_CHECKLIST.md`
- Create: `NON_SAP_READINESS.md`
- Create: `SAP_B1_HANDOFF.md`
- Modify: `mobile/package.json`, `mobile/package-lock.json`, `rep/package.json`, `rep/package-lock.json` only for non-breaking compatible upgrades.

- [ ] Run `npm audit --json` in mobile/rep/admin/backend and document each high dependency path, runtime relevance, fixed version, and upgrade decision.
- [ ] Run clean installs, typechecks, tests, Metro startup, and Android exports; do not force an Expo downgrade.
- [ ] Add explicit API environment switching and document no-localhost physical-device setup.
- [ ] Create manual Android/iPhone/device-killed/slow-network/offline/session-expiry checklist.
- [ ] List every production configuration variable, owner, secret status, and current configured state.
- [ ] Make `SAP_B1_HANDOFF.md` contain only required SAP-team inputs and the exact future modules consuming them.

## Task 8: Fresh regression and updated reports

**Files:**
- Modify: `TEST_REPORT.md`
- Modify: `NON_SAP_READINESS.md`

- [ ] Create a new disposable PostgreSQL database, deploy migrations, and seed it.
- [ ] Run backend tests, mobile/rep/admin tests, typechecks, builds, exports, Metro startup, audits, E2E API journeys, idempotency concurrency, inventory, financial consistency, and tenant-negative tests.
- [ ] Record exact command results and new score; never reuse the previous 48/100 score.
- [ ] Commit each complete slice, then final report/docs commit.

