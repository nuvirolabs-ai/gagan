# Gagan Wave 2.1 — Operational Read Cache Acceptance

**Date:** 2026-09-15  
**Feature branch:** `codex/gagan-wave2-1-operational-cache-v1`  
**Parent checkpoint:** `7f86f8f4e4d4a57c1b6b1ff210485ff583536029`  
**Environment:** existing hosted staging API configured in the Salesperson release build  
**Device:** Moto E13, `ZD2229Q3KB`

## Result boundary

The implementation is limited to read recovery for the current Today and
Route screens. No backend, Prisma migration, authentication, permission,
commercial, order, payment, collection, invoice, R2, SAP, attendance-write,
visit-write or mutation-outbox code was changed.

## Root cause and correction

Before Wave 2.1, Today held the latest response only in React memory and
Route discarded its current route on any request failure. A process restart or
temporary connectivity loss therefore removed a usable operational view.

The correction adds one shared `operationalReadCache` policy used by both
screens. A successful server read replaces the account-scoped snapshot. Only
transport failures or HTTP 5xx failures may consult it. Authentication,
authorization, business 4xx, malformed responses and account mismatches fail
closed to the existing error/empty state.

## Cache contract

| Item | Accepted behavior |
|---|---|
| Cached domains | Today response required by the current renderer; Route itinerary required by the current renderer |
| Identity key | Versioned key includes authenticated staff ID and normalized API origin; envelope repeats both and rejects mismatches |
| Account switch/logout | Current-account guard prevents old requests from reading or writing; separate account namespace prevents cross-account reads; mutation outbox is untouched |
| Freshness | Maximum age is 12 hours; expired snapshots are never rendered and are removed where possible |
| Per-account bound | One Today and one Route snapshot in one envelope |
| Device bound | Serialized envelope maximum 512 KiB; at most four account partitions, with older partitions pruned on save |
| Storage safety | Corrupt/incompatible entries are ignored and removed best-effort; storage write failures do not fail live data or fabricate a successful cache read |
| Secret boundary | Payloads containing access/refresh tokens, passwords, secrets, API keys, authorization or cookies are rejected |
| Write behavior | Read-only cache writes only; no optimistic or offline business mutation is introduced |
| User indicator | Existing restrained offline banner identifies a saved Today/Route view and capture time; successful online refresh clears it |

## Fallback classification

- **Eligible:** network transport failures and `SessionFetchError` statuses
  500–599.
- **Not eligible:** 400–499 responses, including 401/403; explicit business
  rejection; malformed server payload; account mismatch; expired/corrupt
  cache.
- **Actions:** map navigation remains local/read-only; visit, skip, retailer
  detail, order and other write actions retain their existing online/server
  authorization gates. Cached data does not authorize or replay any action.

## Files changed

- `rep/src/offline/operationalReadCache.ts` — bounded cache, validation,
  account/origin keying, cleanup and shared read policy.
- `rep/src/offline/networkErrors.ts` — operational-read fallback taxonomy.
- `rep/src/api/repClient.ts` — exposes the resolved API origin for cache
  identity namespacing; request contracts unchanged.
- `rep/src/context/FieldContext.tsx` — Today online population and transient
  fallback.
- `rep/src/screens/RouteScreen.tsx` — Route online population, fallback and
  visible saved-state indicator.
- `rep/src/offline/__tests__/operationalReadCache.test.ts` — focused policy
  and failure-mode coverage.
- `SALESPERSON_WAVE2_1_OPERATIONAL_CACHE_AUDIT.md` — pre-implementation audit.

**Backend changed:** NO  
**Prisma migrations:** NONE

## Automated acceptance

Salesperson suite and focused cache tests:

```text
29 test files passed
148 tests passed
```

Salesperson strict typecheck: PASS  
`git diff --check`: PASS

Covered explicitly: online Today/Route population, transient fallback,
empty cache, account A/B isolation, logout/account guard, expiry, malformed
cache, online replacement, visible stale classification, 4xx/auth rejection,
repeated reads, storage write failure, payload size bound, and account
partition pruning. Existing order/commercial test files remained green.

## Physical Moto E13 evidence

Exact release artifact built from this worktree and installed in place over
`com.gagan.sales` without uninstalling the existing package. The app launched
from the embedded release bundle after the local launcher process was closed.

- Online Today after reconnection, with the saved banner cleared:
  `/tmp/gagan-wave2-1-evidence/06-moto-e13-reconnected-online.png`
- Offline reopen after online population, airplane mode and force-stop:
  `/tmp/gagan-wave2-1-evidence/04-moto-e13-airplane-reopen.png`
- Cold/standalone launch evidence:
  `/tmp/gagan-wave2-1-evidence/01-moto-e13-launch.png`
- Current Route screen:
  `/tmp/gagan-wave2-1-evidence/08-moto-e13-route-screen.png`
- More screen / existing outbox visibility:
  `/tmp/gagan-wave2-1-evidence/07-moto-e13-more.png`

Observed offline screen: `Offline` and `You're offline. Showing your saved
day from 9:46 am. Refresh when connected.`; the real Today content remained
rendered after process restart and no crash occurred. After connectivity was
restored and the app was reopened, the banner disappeared and current online
content rendered.

The current authenticated hosted persona has **no route published today**.
The physical Route-cache fallback could therefore not be exercised without
creating or mutating route fixture data. The actual online Route screen showed
`No route today` and `No route has been published for today.` The Route
fallback remains covered by the exact structural cache/error tests, but native
route fallback evidence is **BLOCKED by the current server precondition**, not
claimed as PASS.

Account-isolation was verified in the injected-storage automated tests. A
second authenticated device persona was not available for physical switching,
so no business data was mutated to manufacture that proof.

## Exact APK evidence

| Item | Value |
|---|---|
| APK source tree | `/Users/tanutejas/Documents/Gagan-wave2-1-operational-cache-v1/rep` |
| Build output | `/Users/tanutejas/Documents/Gagan-wave2-1-operational-cache-v1/rep/android/app/build/outputs/apk/release/app-release.apk` |
| Package | `com.gagan.sales` |
| Version | `1.0.0` / versionCode `1` |
| Embedded API | `https://gagan-staging-api.onrender.com` |
| Release size | 84 MiB |
| SHA-256 | `d52f056b962869aaa42408fdca2f5b4a471d94966157cc1d2f659779907ea90b` |
| Physical install | PASS |
| Standalone launch | PASS; embedded bundle, no Metro required after install |

## Acceptance status

| Gate | Result |
|---|---|
| Bounded account-scoped Today cache | PASS |
| Bounded account-scoped Route cache | PASS in automated acceptance; physical route state BLOCKED by no-route fixture |
| No fallback for auth/permission/business 4xx | PASS |
| Corrupt/oversized/storage-failure safety | PASS |
| Existing commercial/order behavior | PASS in Salesperson suite |
| Physical Today offline/reconnect | PASS |
| Physical Route offline/reconnect | BLOCKED — current hosted persona has no published route |
| Backend/schema/migrations changed | NO |
| Ready for merge/deploy | NO — this branch is a review checkpoint only |
