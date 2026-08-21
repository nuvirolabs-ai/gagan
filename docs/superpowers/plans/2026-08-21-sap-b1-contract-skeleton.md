# SAP B1 Contract Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Prepare a typed, configuration-gated SAP Business One Service Layer boundary without inventing any SAP endpoint, field, warehouse, pricing, UDF or order contract.

**Architecture:** Keep `SapConnector` as the application-facing abstraction. Add a separate B1 package containing typed raw response envelopes, explicit endpoint/field mapping configuration, a mockable HTTPS client with cookie/session ownership, safe typed errors, and pure mapping functions. `SAP_MODE=service-layer` validates configuration at startup but does not call a server until a caller supplies endpoint paths and mappings.

**Tech Stack:** TypeScript, Express/Prisma backend, Zod configuration validation, Node `fetch`, Vitest.

---

### Task 1: Configuration gate

**Files:**
- Modify: `backend/src/platform/config/env.ts`
- Test: `backend/src/__tests__/config.test.ts`
- Create: `backend/src/lib/sap/b1/config.ts`

- [ ] Add typed `SapB1Config` and require the requested values only when `SAP_MODE=service-layer`.
- [ ] Reject non-HTTPS base URLs and missing future values with a named configuration error.
- [ ] Keep disabled/mock/development behavior unchanged.
- [ ] Add failing tests for missing and complete service-layer configuration, then implement and run them.

### Task 2: Typed B1 contracts and safe errors

**Files:**
- Create: `backend/src/lib/sap/b1/types.ts`
- Create: `backend/src/lib/sap/b1/errors.ts`
- Modify: `backend/src/lib/sap/connector.ts`

- [ ] Define generic OData collection envelopes and typed authentication/session, Business Partner, Item, pricing, inventory, order, Delivery Note, Invoice and financial-summary records.
- [ ] Keep raw SAP fields as explicit records and require field mappings instead of guessing property names.
- [ ] Define typed error categories for timeout, unauthorized/session expiry, HTTP failure, malformed response and reconciliation miss.
- [ ] Re-export the new types without changing existing `SapConnector` callers.

### Task 3: Mockable Service Layer transport/session store

**Files:**
- Create: `backend/src/lib/sap/b1/sessionStore.ts`
- Create: `backend/src/lib/sap/b1/httpClient.ts`
- Test: `backend/src/lib/sap/b1/__tests__/httpClient.test.ts`

- [ ] Implement injected-fetch HTTPS transport with timeout, correlation ID, cookie storage, no credential logging and typed error mapping.
- [ ] Add login/session-expiry hooks; a 401 clears the cookie and calls the supplied reauthentication hook once.
- [ ] Write mocked tests for login cookie capture, 401, SAP errors, timeout and correlation IDs.

### Task 4: Pure response parsers and mappings

**Files:**
- Create: `backend/src/lib/sap/b1/parsers.ts`
- Create: `backend/src/lib/sap/b1/mappers.ts`
- Test: `backend/src/lib/sap/b1/__tests__/mappers.test.ts`

- [ ] Parse collection and order responses only through caller-supplied field mappings.
- [ ] Map minimal Gagan retailer/product/order references to B1 DTOs while leaving environment-specific fields in configuration.
- [ ] Test Business Partner, Item and Order parsing, DocEntry/DocNum capture, and explicit rejection of missing configured fields.

### Task 5: Service-layer connector skeleton and wiring

**Files:**
- Modify: `backend/src/lib/sap/serviceLayerConnector.ts`
- Modify: `backend/src/lib/sap/index.ts`
- Test: `backend/src/lib/sap/__tests__/serviceLayerConnector.test.ts`

- [ ] Accept explicit config, endpoint paths and field mappings through constructor injection.
- [ ] Implement safe login/logout and typed read/write seams; no endpoint defaults are supplied.
- [ ] Keep the connector disabled from real network calls until endpoint/mapping config is present; test reconciliation with a mocked client.
- [ ] Ensure direct `getSapConnector()` service-layer selection fails clearly when configuration is absent.

### Task 6: Required-information handoff and verification

**Files:**
- Create: `SAP_B1_REQUIRED_INFO.md`
- Modify: `SAP_B1_HANDOFF.md`

- [ ] List exact SAP-team inputs still required, grouped by authentication, endpoints, field mappings, warehouses, pricing, order requirements, UDFs and UAT.
- [ ] State explicitly that no real SAP integration is complete and all live tests are opt-in.
- [ ] Run backend typecheck, focused B1 tests, full backend tests with the disposable database, and inspect the final diff.

