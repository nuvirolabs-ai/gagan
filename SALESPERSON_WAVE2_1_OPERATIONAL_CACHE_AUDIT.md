# Salesperson Wave 2.1 — Operational Read Cache Audit

**Date:** 2026-09-15
**Source:** `codex/gagan-wave2-1-operational-cache-v1` at `7f86f8f4e4d4a57c1b6b1ff210485ff583536029`
**Mode:** source and current-contract audit before implementation

## Scope and non-goals

Wave 2.1 is limited to a bounded, account-scoped recovery path for the
Salesperson Today and Route read screens during temporary connectivity loss.
It does not change write contracts, the mutation outbox, authentication,
permissions, commercial calculations, orders, collections, invoices, R2 or
SAP.

## Current treatment and gap

| Area | Current treatment | Problem | Proposed treatment | Performance/accessibility risk | Affected screens |
|---|---|---|---|---|---|
| Canvas/shell | `AppScreen` and the shared viewport policy provide the normal-flow shell | No read-cache concern; adding screen-level bottom space would regress the prior P0 fix | Leave shell and inset ownership unchanged | Low | All screens; implementation only touches Today/Route read state |
| Today read | `FieldContext.refresh()` calls `/rep/field/today`; state is memory-only | A transient transport failure leaves no usable current-day view after remount/reopen | Persist the server response as a display-only Today snapshot after successful reads; recover only for eligible transient failures | AsyncStorage I/O is bounded and off the render path | Today |
| Route read | `RouteScreen.load()` calls `/rep/field/route`; any error sets `route` to `null` | Temporary loss turns a previously available itinerary into the empty/no-route state | Persist the current route response and recover the same account’s fresh-enough snapshot only for eligible transient failures | Same bounded local I/O; no write replay | Route |
| Identity | `RepContext` binds the authenticated staff ID through `setRepAccount()`; no company/tenant dimension is present in `StaffIdentity` | A generic device key would permit account crossover | Cache key and envelope include the actual staff ID and normalized API origin; optional current-account guard is checked before every read/write | None beyond key length | Today/Route |
| Error taxonomy | `isOfflineTransportError()` distinguishes transport errors from all `SessionFetchError` HTTP responses | 5xx outage is not eligible for the current fallback, while 401/403/4xx must remain hard failures | Add an operational-read classifier: transport errors and 5xx only; 401/403/other 4xx and malformed payloads never use cache | Improves safety; no user-visible auth weakening | Today/Route |
| Freshness | No persisted freshness metadata | Stale data cannot be identified or bounded | Store capture time, enforce a 12-hour maximum age, and show a restrained “saved view” message with capture time | No animation or polling added | Today/Route |
| Bounds/cleanup | No operational read snapshots | Unbounded growth would be unsafe for shared devices | Keep one Today and one Route snapshot per account/API origin, cap serialized payloads, and retain at most four account partitions; prune older partitions on save | Pruning is infrequent and serialized | Today/Route |
| Corrupt storage | No persisted payload to validate | Future malformed data could crash a screen or fabricate a route | Validate version, account, origin, timestamp and JSON-object shape; ignore/remove invalid entries | Fails closed to the normal error/empty state | Today/Route |
| UX state | Today shows a generic `OfflineBanner` only when `error` exists; Route has no banner | The user cannot distinguish a saved read from a current server read | Reuse the existing banner with explicit cached/stale wording; clear it after a successful online response | Text-only state; accessible to screen readers | Today/Route |
| Actions | Today/Route actions call existing server APIs or local maps | Cached display must not imply that writes are offline-safe | Preserve action routes and server gates; maps remains local/read-only, skip/open-store/start-visit remain online/server-authoritative | No new optimistic UI | Today/Route |
| Loading/repeated focus | Today uses `createSingleFlight`; Route uses focus reload | Repeated focus can trigger duplicate reads but no cache policy exists | Keep the existing Today single-flight and add a small Route request guard; online reads replace the snapshot atomically | No continuous work | Today/Route |

## Cache contract

- **Stored domains:** only the JSON response objects needed by the current
  Today and Route renderers. They are display snapshots, never a local source
  for mutations or commercial calculations.
- **Key:** a versioned namespace containing the authenticated staff ID and
  normalized API origin. The envelope repeats both values and is rejected if
  either does not match the current cache instance.
- **Freshness:** snapshot age is measured from the capture timestamp. A
  snapshot older than 12 hours is expired and is not rendered as fallback.
- **Storage bound:** at most one Today and one Route snapshot per account/API
  origin; each serialized envelope is capped at 512 KiB and the device keeps
  at most four account partitions. An oversized write is skipped without
  affecting the online response.
- **Identity lifecycle:** account namespaces prevent cross-account reads; the
  current-account callback prevents a request from an old session from writing
  or reading after an account switch. The existing mutation outbox remains
  independently durable and is not deleted by this feature.
- **Fallback eligibility:** transport failures and HTTP 5xx failures only.
  Authentication failures, authorization failures, other 4xx responses,
  malformed server payloads and account mismatch never fall back.
- **Corruption:** malformed or incompatible cache data is ignored and removed
  where possible. The screen stays in its existing error/empty state; no
  fabricated route or target is produced.

## Acceptance evidence to collect

Automated tests will cover online population, transient fallback, empty/expired
cache, account isolation, logout/account change, malformed data, bounds,
repeated focus and the complete error taxonomy. The existing commercial/order
test suites must remain green. The Moto E13 acceptance will verify online
Today/Route, reopen during temporary loss, reconnect/focus recovery, and safe
account switching without any write-side mutation.

## Explicitly unchanged

No Prisma schema or migration, backend route, authentication contract, offline
mutation queue, commercial API, order/payment/collection/invoice/R2/SAP logic,
attendance or visit write contract is part of this slice.
