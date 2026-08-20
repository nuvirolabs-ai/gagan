# Identity and RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mock, role-specific authentication with secure retailer and staff identities, granular permissions, delegation, and revocable device sessions.

**Architecture:** Keep retailer and staff identity realms separate while using one session service. Resolve effective permissions on the backend, place them in short-lived access tokens, persist rotating refresh-token families, and require step-up authentication for sensitive decisions.

**Tech Stack:** Prisma/PostgreSQL, Express, Zod, JWT, bcrypt/crypto, SMS provider adapter, Expo SecureStore, Vitest/Supertest.

---

## File map

- Create: `backend/prisma/migrations/*_identity_rbac/migration.sql`
- Create: `backend/src/modules/identity/{types,permissions,sessionService,otpService,staffAuth,retailerAuth}.ts`
- Create: `backend/src/modules/identity/providers/{provider,mockSmsProvider}.ts`
- Create: `backend/src/api/routes/{staffAuth,retailerAuth,adminStaff}.ts`
- Create: `backend/src/modules/identity/__tests__/{permissions,sessionService,otpService}.test.ts`
- Modify: `backend/prisma/schema.prisma`, `backend/src/app.ts`
- Modify: `mobile/src/api/client.ts`, `mobile/src/context/AuthContext.tsx`
- Modify: `rep/src/api/repClient.ts`, `rep/src/context/RepContext.tsx`, `rep/App.tsx`
- Modify: `admin/src/api.ts`, `admin/src/AuthContext.tsx`

## Task 1: Add identity and permission schema

- [x] Write a schema-level test asserting unique staff phone/email, unique role/permission names, unique active refresh-token hashes, and bounded role delegation dates.
- [x] Run `cd backend && npm test -- identity-schema`; expect red because models are absent.
- [x] Add `StaffUser`, `Role`, `Permission`, `StaffRole`, `RolePermission`, `RoleDelegation`, `DeviceSession`, `OtpChallenge`, and `StepUpChallenge` with indexes on status, user, expiry, and token family.
- [x] Seed the nine approved roles and explicit permissions without assigning broad admin rights to operational roles.
- [x] Run `npx prisma validate`, apply the migration to a disposable database, and rerun the schema test; expect pass.
- [x] Commit: `feat: add staff identity and RBAC schema`.

Core permission constants:

```ts
export const Permissions = {
  ORDER_CREATE_FOR_RETAILER: "order.create_for_retailer",
  KYC_SUBMIT: "kyc.submit",
  APPROVAL_SECOND_INVOICE: "approval.second_invoice",
  APPROVAL_THIRD_INVOICE: "approval.third_invoice",
  CREDIT_RATING_CONFIRM: "credit.rating_confirm",
  CREDIT_BLOCK: "credit.block",
  COLLECTION_SUBMIT: "collection.submit",
  COLLECTION_CONFIRM: "collection.confirm",
  DISPATCH_EXECUTE: "dispatch.execute",
  LEGAL_DECIDE: "legal.decide",
  STAFF_MANAGE: "staff.manage",
} as const;
```

## Task 2: Implement effective permission resolution and delegation

- [x] Write table-driven tests for direct role permissions, multiple roles, expired delegation, future delegation, revoked user, and permission denial.
- [x] Implement `effectivePermissions(staffId, at)` returning a stable set plus active delegation IDs.
- [x] Implement `requirePermission(permission)` middleware that returns 403 with `permission_required` and never trusts client-provided roles.
- [x] Add audit events for role assignment, removal, delegation creation, and delegation revocation.
- [x] Run identity unit/integration tests; expect pass.
- [x] Commit: `feat: enforce staff permissions and delegation`.

## Task 3: Implement expiring OTP challenges and abuse controls

- [x] Write tests for single use, five-minute expiry, resend cooldown, attempt limit, normalized Indian phone numbers, unknown-account neutral response, and production-provider selection.
- [x] Define `SmsProvider.sendOtp(phone, code, correlationId)` and mock it only in non-production environments.
- [x] Store only an HMAC/hash of the OTP; never log the code.
- [x] Add endpoint/account/IP rate limits and return stable 202 responses for OTP requests.
- [x] Verify callback-free OTP tests pass with a fake clock.
- [x] Commit: `feat: add secure OTP challenge flow`.

## Task 4: Implement rotating sessions and step-up authentication

- [x] Write tests for 15-minute access tokens, 30-day rotating refresh families, refresh replay revoking the family, device logout, all-device logout, suspended user, and step-up expiry.
- [x] Implement access-token claims `{ sub, realm, sessionId, permissions, iat, exp }` and hashed refresh tokens.
- [x] Add `/auth/refresh`, `/auth/logout`, `/auth/sessions`, `/auth/sessions/:id/revoke`, and `/auth/step-up` for the correct realm.
- [ ] Require step-up claim for payment confirmation, credit override, block, rating confirmation, and legal decision permissions.
- [x] Run auth API tests; expect pass.
- [x] Commit: `feat: add revocable rotating sessions`.

## Task 5: Add staff management API and admin UI

- [x] Write API tests for staff list/create/suspend, role assignment, delegation, and permission denial.
- [x] Add admin routes under `/admin/staff` and `/admin/roles`.
- [x] Add focused admin pages `admin/src/pages/Staff.tsx` and `StaffDetail.tsx`; avoid a permissions matrix dashboard by using a role selector and delegation list.
- [x] Add Playwright coverage for create user, assign role, suspend session, and delegate approval authority.
- [x] Commit: `feat: manage staff roles and delegations`.

## Task 6: Migrate client sessions to secure storage

- [x] Add Expo SecureStore to retailer and staff apps and test session restore/revocation adapters.
- [x] Move access/refresh tokens from AsyncStorage to Keychain/Keystore; migrate by deleting legacy token keys after first secure login.
- [x] Change API base URLs to typed environment configuration and require HTTPS outside development.
- [x] Make the staff app navigation derive from server-returned permissions.
- [x] Use secure admin cookie sessions or memory-held access tokens with refresh cookie; remove persistent localStorage bearer tokens.
- [x] Run both mobile type checks and admin build/Playwright smoke tests.
- [ ] Commit: `feat: secure client sessions and role-aware staff shell`.

## Exit gate

- [x] Mock OTP cannot run in production.
- [x] No OTP or bearer/refresh token is logged or stored in plaintext.
- [x] Every staff endpoint has a permission test.
- [x] Delegations expire automatically.
- [ ] Sensitive actions require recent step-up authentication.
- [x] Retailer, staff, and admin sessions cannot be interchanged.
