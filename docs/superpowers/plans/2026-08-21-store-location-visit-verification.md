# Store Location + Visit Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Add foreground-only retailer store-location capture, salesperson visit verification, immutable location history, and admin visibility without changing ordering or SAP mock behavior.

**Architecture:** Add `RetailerLocation` as the current authoritative location and `RetailerLocationHistory` as append-only history. A `SalesVisit` records each salesperson check-in with the store-coordinate snapshot used for server-side Haversine verification. A backend location service owns coordinate validation, configurable accuracy/radius rules, authorization, versioning, and audit writes; thin REST routes expose retailer, salesperson, and admin workflows. Mobile clients request only while-in-use GPS through `expo-location`, display explicit confirmation/retry states, and never calculate authoritative distance. Admin gets focused retailer-location and visit pages using existing session/RBAC conventions.

**Tech Stack:** Prisma/PostgreSQL, Express/TypeScript/Zod, Vitest/Supertest, Expo React Native (`expo-location`), React/Vite admin.

---

### Task 1: Data model and configuration

**Files:**
- Modify: `backend/prisma/schema.prisma` — add location/visit enums and models/relations.
- Create: `backend/prisma/migrations/20260821170000_store_location_visit_verification/migration.sql` — additive SQL migration with safe defaults for existing retailers.
- Modify: `backend/.env.example` — document accuracy/radius settings.
- Modify: `backend/src/platform/config.ts` or create the existing configuration module discovered during implementation — parse positive thresholds once.
- Test: `backend/src/modules/location/__tests__/locationConfig.test.ts`.

- [ ] Write failing tests for default/configured thresholds and malformed negative/zero values.
- [ ] Run `cd backend && npm test -- src/modules/location/__tests__/locationConfig.test.ts`; confirm the missing module/config failure.
- [ ] Add `LocationStatus`, `LocationSource`, `LocationVerificationStatus`, `RetailerLocation`, `RetailerLocationHistory`, and `SalesVisit` with nullable current location, versioning, snapshots, and indexes. Existing retailers receive `NOT_SET`; no coordinates are generated.
- [ ] Add `STORE_LOCATION_MAX_ACCURACY_METERS`, `VISIT_VERIFIED_RADIUS_METERS`, and `VISIT_REVIEW_RADIUS_METERS` to environment parsing with safe local defaults and an ordering check (`verified <= review`).
- [ ] Apply `prisma generate` and the migration against a disposable database; rerun the focused tests.

### Task 2: Pure location domain functions

**Files:**
- Create: `backend/src/modules/location/locationDomain.ts` — coordinate/accuracy validation, Haversine distance, threshold classification, and stable status labels.
- Test: `backend/src/modules/location/__tests__/locationDomain.test.ts` — valid/invalid coordinates, boundary radii, low accuracy, and missing store cases.

- [ ] Write the failing unit tests first, including exact verified/review/outside boundaries and antimeridian-safe Haversine behavior.
- [ ] Run the focused test file and verify the expected red failures.
- [ ] Implement pure functions with no Prisma/Express imports and no mobile-specific assumptions.
- [ ] Run the focused test file and keep it green before integrating routes.

### Task 3: Backend location/visit service and audit history

**Files:**
- Create: `backend/src/modules/location/locationService.ts` — retailer/self, assigned-salesperson, and admin operations; append history; version changes; server-side check-in/check-out.
- Create: `backend/src/modules/location/locationRoutes.ts` — authenticated retailer, rep, and admin routers with Zod validation and neutral errors.
- Modify: `backend/src/app.ts` — mount route groups and bounded JSON parsing only where needed.
- Modify: `backend/src/modules/identity/roleCatalog.ts` — add narrow `location.view`, `location.capture`, `location.verify`, and `visit.view` permissions, preserving existing permissions.
- Test: `backend/src/modules/location/__tests__/locationService.test.ts`.
- Test: `backend/src/modules/location/__tests__/locationRoutes.test.ts`.

- [ ] Write failing service tests for retailer capture, verified-location overwrite rejection, location-change request, assigned-retailer enforcement, server distance classification, missing store, low GPS accuracy, checkout duration, immutable snapshot, and required admin change reason.
- [ ] Write failing route tests for auth/authorization, coordinate validation, retailer isolation, salesperson isolation, and admin list/history access.
- [ ] Run focused tests and verify they fail for missing service/routes.
- [ ] Implement transaction-backed writes: current location update plus history row, incremented `locationVersion`, actor/source metadata, and `AuditEvent`; verified locations require a change-request path that sets `NEEDS_REVIEW` instead of overwriting.
- [ ] Implement check-in with a store snapshot and `VERIFIED`, `NEEDS_REVIEW`, `OUTSIDE_STORE_AREA`, `STORE_LOCATION_NOT_AVAILABLE`, or `LOW_GPS_ACCURACY`; never mark offline submissions verified.
- [ ] Implement optional checkout with captured coordinates/accuracy/distance and timestamp-only duration.
- [ ] Mount `/location`, `/rep/location`, `/rep/visits`, `/admin/locations`, and `/admin/visits` using existing identity middleware and permission checks.
- [ ] Run focused tests until green, then run all backend tests.

### Task 4: Retailer mobile store-location flow

**Files:**
- Modify: `mobile/package.json` — add the Expo-compatible `expo-location` dependency.
- Modify: `mobile/app.json` or `mobile/app.config.*` — add foreground location permission copy only.
- Modify: `mobile/src/api/retailerApi.ts` — add current-location/status and capture/change-request calls.
- Modify: `mobile/App.tsx` — add a `StoreLocation` stack screen.
- Create: `mobile/src/location/deviceLocation.ts` — permission request and high-accuracy foreground capture adapter.
- Create: `mobile/src/screens/StoreLocationScreen.tsx` — explicit explanation, permission denied/settings/retry, accuracy warning, confirm-before-save, and neutral status UI.
- Test: `mobile/src/location/__tests__/deviceLocation.test.ts` and API tests.

- [ ] Write failing adapter/API tests for permission denied, settings retry, valid capture, and low-accuracy result.
- [ ] Run focused mobile tests and verify red failures.
- [ ] Add only foreground `expo-location` access; do not request background/always permission. Save only after `CONFIRM LOCATION`.
- [ ] Add an Account/Store Details entry and preserve app usability when permission is denied.
- [ ] Run mobile tests and `npm run typecheck`.

### Task 5: Salesperson location capture and visit check-in

**Files:**
- Modify: `rep/package.json` — add `expo-location`.
- Modify: `rep/app.json` or `rep/app.config.*` — add foreground permission copy.
- Modify: `rep/src/api/staffApi.ts` — add retailer-location, capture, verify, check-in, and check-out methods.
- Create: `rep/src/location/deviceLocation.ts` — same foreground adapter contract as retailer app.
- Modify: `rep/src/screens/RepRetailerDetailScreen.tsx` — location status card, capture/verify action, check-in/check-out action, neutral result state.
- Test: `rep/src/location/__tests__/deviceLocation.test.ts`, API tests, and screen/domain tests where existing conventions allow.

- [ ] Write failing tests for assigned retailer access, location capture source, check-in result rendering, and check-out request.
- [ ] Run focused tests and verify red failures.
- [ ] Add the smallest native-feeling card/actions without changing order placement.
- [ ] Run rep tests and `npm run typecheck`.

### Task 6: Admin location and visits views

**Files:**
- Modify: `admin/src/api.ts` — add location/visit/history methods.
- Modify: `admin/src/App.tsx` — add permission-gated Location and Visits routes/nav links.
- Create: `admin/src/pages/Locations.tsx` — retailer location list/detail/history and reason-required correction form.
- Create: `admin/src/pages/Visits.tsx` — filterable visit list with neutral statuses and duration.
- Test: `admin/src/pages/__tests__/Locations.test.tsx` and `admin/src/pages/__tests__/Visits.test.tsx`.

- [ ] Write failing page tests for status rendering, history display, required correction reason, filters, and neutral outside-area copy.
- [ ] Run focused admin tests and verify red failures.
- [ ] Implement focused pages using existing cards/table styles; do not add a map dependency. Raw coordinates are secondary/detail-only.
- [ ] Run admin tests and `npm run typecheck`.

### Task 7: Documentation, device UAT, and regression verification

**Files:**
- Create: `STORE_LOCATION_ARCHITECTURE.md` — data flow, privacy boundary, configuration, and source-of-truth rules.
- Create: `VISIT_VERIFICATION.md` — statuses, Haversine/radius rules, check-in/out semantics, and operational review guidance.
- Create: `LOCATION_DEVICE_UAT.md` — Android/iPhone scenarios for permissions, precision, GPS disabled, indoor, foreground return, and no network.
- Create: `LOCATION_TEST_REPORT.md` — command-backed results and remaining real-device/UAT gaps.

- [ ] Run Prisma migration status, backend tests, mobile tests, rep tests, admin tests, all typechecks, and `git diff --check`.
- [ ] Run a local API smoke test against disposable PostgreSQL with mock SAP/OTP and verify ordering, inventory, outbox, and financial summary remain green.
- [ ] Manually verify no background location permission or coordinate logging was introduced.
- [ ] Commit logical slices: data/domain; backend service/routes; retailer app; salesperson app; admin/docs/QA. Do not merge or push to main.

---

## Self-review against the request

- Data model/history/versioning: Task 1 and Task 3.
- Retailer onboarding/account capture and permission UX: Task 4.
- Accuracy thresholds and server-side distance: Tasks 1–3.
- Salesperson capture, verify, check-in/out: Task 5 and Task 3.
- Admin location/history/visits/filtering: Task 6 and Task 3.
- Change requests and audit trail: Task 3.
- Logistics read API restricted to verified locations: Task 3.
- Privacy/auth/integrity/offline behavior: Tasks 3–5 and docs in Task 7.
- Existing retailers/order/SAP mock regression: Task 7.
- Device UAT documentation: Task 7.
