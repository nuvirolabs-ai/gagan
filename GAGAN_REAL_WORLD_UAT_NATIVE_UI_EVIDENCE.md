# Gagan Real-World UAT — Corrected Native/UI Evidence

**Run date:** 2026-09-06
**Worktree:** `/Users/tanutejas/Documents/Gagan-full-e2e-uat`
**Branch:** `codex/gagan-full-e2e-uat-hardening`
**Candidate commit:** `b0bd68911d7fe2c61ccd954ab8b3e4683b0d9054`
**Persistent screenshots:** `uat-evidence-20260906/`

This document separates what an installed application visibly proved from API,
read-only database, automated integration, or fixture evidence. It is the
native/UI companion to `GAGAN_REAL_WORLD_UAT_FINAL_REPORT_V2.md`.

## Method labels

- **NATIVE UI** — a real installed Android application was operated by taps,
  text entry, scrolling, relaunch, or normal in-app navigation and the visible
  result was captured.
- **BROWSER UI** — the local Admin was operated through the supported browser
  UI using a separate headless Chrome context. It is not an HTTP-only claim.
- **DIRECT API TEST** — an authenticated HTTP request was made directly. It
  proves the contract only, not employee UI discoverability or rendering.
- **AUTOMATED INTEGRATION** — a repository test exercised the route/service,
  database, authorization, or idempotency behavior.
- **READ-ONLY VERIFICATION** — a query or inspection observed state without
  advancing it.
- **NOT RUN** — safe execution was not attempted.

## Correct application source

| Surface | Exact source | What was tested |
|---|---|---|
| Salesperson | frozen tag `gagan-salesperson-template-v1`, peeled target `69c2916a31adcd861f09d4fc2405c4431a09d9b6`; verified runtime source in its manifest `8eed514315c8e8d3e971f8b1793171e20ba119ce` | integrated into candidate commit and built/installed |
| Retailer | candidate commit `b0bd68911d7fe2c61ccd954ab8b3e4683b0d9054` | local debug native golden path; exact hosted-release launch |
| Admin | candidate commit `b0bd68911d7fe2c61ccd954ab8b3e4683b0d9054` | local Admin browser UI |
| Backend | candidate commit `b0bd68911d7fe2c61ccd954ab8b3e4683b0d9054` | local app server and disposable automated-test DB |
| Shared/build configuration | candidate commit; no backend files changed relative to `origin/codex/gagan-staging` | release bundles inspected for API URL/package |

The tag was fetched and verified ancestry-aware. The annotated tag object is
`ed6cd3d43dd31f6143e416d6e76cd9f48b3a125c`; its peeled commit is the expected
`69c2916a31adcd861f09d4fc2405c4431a09d9b6`. The candidate is a merge of that
tag into the UAT branch; no conflict or blind `rep/` overwrite occurred.

## Isolated environment used for native and browser UAT

| Environment | Value | Boundary |
|---|---|---|
| Application UAT DB | `gagan_uat_app_20260905204147` | local Admin, Retailer, Salesperson candidate |
| Disposable automated DB | `gagan_uat_auto_20260905204147` | destructive/database-backed tests only |
| Local backend | `http://127.0.0.1:4100` | mock OTP, mock SAP, mock SMS/payment; jobs disabled |
| Local Admin | `http://127.0.0.1:5179` | browser UI against the application UAT DB |
| Android device | Moto E13, serial `ZD2229Q3KB`, Android 13, 720×1600 | physical evidence |
| Hosted release API | `https://gagan-staging-api.onrender.com` | bounded standalone-release smoke only |
| Hosted Admin | `https://gagan-staging-admin.vercel.app` | not mutated during this corrected local golden path |

Both local databases were created with unique run-specific names, migrated
with the repository's 31 reviewed migrations, and protected by local-only
ignored environment files. Docker was not available; the existing local
PostgreSQL 16 service was used. No shared acceptance, production, Dogkart, or
hosted database was used for automated cleanup.

## Native Retailer-origin order — local application UAT

**Persona:** local retailer fixture
**Order:** `GGN-00000041`, Mahesh Store, ₹6,300, two canonical Gagan Toor Dal
cases
**Method:** NATIVE UI for creation and status; BROWSER UI for Admin operations;
READ-ONLY VERIFICATION for final invariants.

| Step | Native/UI observation | Evidence |
|---|---|---|
| Login | Retailer app opened, phone and mock OTP were entered, language was selected, and the retailer Home rendered | `uat-evidence-retailer-local-launch.png`, `uat-evidence-retailer-otp-filled.png`, `uat-evidence-retailer-after-language.png` |
| Catalog | Catalog opened and the canonical Toor Dal product was selected | `uat-evidence-retailer-catalog.png` |
| Quantity/cart | Quantity was changed to two and the cart total updated | `uat-evidence-retailer-quantity-two.png`, `uat-evidence-retailer-cart-review.png` |
| Submit | The normal retailer confirmation action created order `GGN-00000041` | `uat-evidence-retailer-order-created.png` |
| Employee discovery | Admin Orders queue was used to find the fresh order by queue/retailer/status; the ID was not externally handed to Admin as the discovery mechanism | `uat-evidence-admin-select-retailer-order.png` |
| Fulfillment | Admin UI approved, packed, assigned ROUTE-A, captured POD photo, and completed delivery | `uat-evidence-admin-approved-retailer-order.png`, `uat-evidence-admin-packed-retailer-order.png`, `uat-evidence-admin-capture-delivery-dialog.png` |
| Status after reopening | Retailer app order history and native order details showed `Delivered`, delivered weight, invoice value, route, and POD | `uat-evidence-retailer-order-history-after-admin.png`, `uat-evidence-retailer-delivered-order-details.png` |

This is a complete native Retailer-origin golden path in the isolated local
application environment. The mock SAP step was performed later from the local
Admin SAP integration surface, not from the Retailer app.

## Salesperson-origin order — local application UAT

**Persona:** staging-only Nikhil field fixture
**Order:** `GGN-00000040`, Patel Mart, ₹6,300, two canonical Gagan Toor Dal
cases
**Method:** NATIVE UI for login/day/route/visit/catalog/order/status; BROWSER UI
for Admin operations; READ-ONLY VERIFICATION for final invariants.

| Step | Native/UI observation | Evidence |
|---|---|---|
| Login/session | Salesperson app opened through the native OTP/language flow and the correct identity Home rendered | `uat-evidence-rep-local-login.png`, `uat-evidence-rep-otp-filled.png`, `uat-evidence-rep-home-active-top.png` |
| Active day/route | Home showed the active-day state, Next Visit, field metrics, and route; the Patel stop was opened | `uat-evidence-rep-home-active-top.png`, `uat-evidence-rep-home-lower-1.png`, `uat-evidence-rep-start-visit.png` |
| Visit/retailer | Start Visit led to Patel Mart detail; retailer intelligence and order action were visible | `uat-evidence-rep-retailer-detail-patel.png` |
| Catalog/order composition | Catalog opened, a quantity of two was selected, and the order review showed the canonical price | `uat-evidence-rep-order-catalog.png`, `uat-evidence-rep-quantity-two.png`, `uat-evidence-rep-order-review.png` |
| Submit | The normal salesperson order action created `GGN-00000040` attributed to the salesperson | `uat-evidence-rep-order-created.png`, `uat-evidence-rep-retailer-orders.png` |
| Employee discovery | Admin Orders queue found the new salesperson order and processed it normally | `uat-evidence-admin-approved-salesperson-order.png`, `uat-evidence-admin-packed-salesperson-order.png`, `uat-evidence-admin-assign-route-dialog.png`, `uat-evidence-admin-delivered-salesperson-order.png` |
| Native delivered status | After Admin completion, the Salesperson app was left/reopened and its Timeline displayed `Order GGN-00000040` and `Patel Mart · delivered` | `uat-evidence-rep-delivered-order-after-admin.png` |

The current Salesperson surface exposes delivered status in the activity
Timeline. A separate tapped order-detail screen for the Salesperson order was
not evidenced; that is recorded as a UX visibility gap, not silently upgraded
to an order-detail PASS.

## Local Admin employee UI

The local Admin browser was authenticated as Ops Admin and used for the
employee-side queue and operational actions. This was **BROWSER UI**, not a
direct HTTP shortcut.

| Action | Result | Evidence |
|---|---|---|
| Home/Orders queue | PASS; queue loaded and fresh Retailer/Salesperson orders were visible | `uat-evidence-admin-home.png`, `uat-evidence-admin-initial.png` |
| Retailer order approve → pack | PASS | `uat-evidence-admin-approved-retailer-order.png`, `uat-evidence-admin-packed-retailer-order.png` |
| Salesperson order approve → pack | PASS | `uat-evidence-admin-approved-salesperson-order.png`, `uat-evidence-admin-packed-salesperson-order.png` |
| Route assignment | PASS; ROUTE-A selected in the normal assignment dialog | `uat-evidence-admin-assign-route-dialog.png` |
| POD and delivery | PASS; delivery proof dialog submitted through the UI | `uat-evidence-admin-capture-delivery-dialog.png`, `uat-evidence-admin-delivered-salesperson-order.png` |
| SAP status/master pull/drain | PASS for mapped Mahesh; Patel remained pending with the expected mapping error | `uat-evidence-admin-sap-master-sync.png`, `uat-evidence-admin-sap-drain-after-mapping.png` |

## Native standalone release artifacts

These are separate from the local-debug candidates used for the full local
golden paths. Both were built from the exact corrected candidate commit, with
the hosted staging API embedded, and installed without uninstalling or wiping
the existing app data.

| App | Artifact | Package | API | Size | SHA-256 | Physical result |
|---|---|---|---|---:|---|---|
| Salesperson | `/Users/tanutejas/Desktop/gagan-salesperson-correct-template-uat-b0bd689.apk` | `com.gagan.sales` | `https://gagan-staging-api.onrender.com` | 87,879,853 bytes | `2a4ff27ddc89332d18ae08d068fe25f7d055d9d25109139d4f7a73c4c0c1e305` | PASS: installed, opened without Metro, hosted login/OTP/language/Home/session restore |
| Retailer | `/Users/tanutejas/Desktop/gagan-retailer-correct-template-uat-b0bd689.apk` | `com.gagan.retailer` | `https://gagan-staging-api.onrender.com` | 87,013,583 bytes | `1a4160b8463f444ca7c0087eb09b2069db5fbcecc5d287f6292f3f481813e16e` | PASS: installed and opened the standalone hosted-login screen without Metro; full retailer golden path is proven on the isolated local candidate |

The exact release APKs were not committed to Git. The previously approved
fallback `/Users/tanutejas/Desktop/gagan-salesperson-final-template-8eed514.apk`
was preserved.

## Corrected labels for prior evidence

The previous report is retained, but these are the authoritative labels for
orders 58, 59, and 60:

| Prior claim | Correct method label | What it actually proves |
|---|---|---|
| Order 58 created through an HTTP request | DIRECT API TEST | API order creation/idempotency and subsequent API/Admin contract; not native Retailer UI |
| Order 59 created through an HTTP request | DIRECT API TEST | API salesperson attribution and SAP-unlinked fixture guard; not native Salesperson UI |
| Order 60 created through an HTTP request | DIRECT API TEST | API salesperson happy-path lifecycle; not native UI order creation |
| API history returned Delivered | DIRECT API TEST | canonical API status; not a native delivered-status display |
| Admin fetched an order by supplied ID | READ-ONLY VERIFICATION / DIRECT API TEST | lookup by known identifier; not independent queue discovery |
| `401` without a token | AUTOMATED INTEGRATION / DIRECT API TEST | authentication rejection; not complete role authorization |
| Standalone APK opened login/Home | NATIVE UI | launch and visible screen only; not a full workflow |

The new orders 40 and 41 are the native/UI golden-path records for this
corrected run.

## Evidence boundaries

- Local native flows and Admin browser actions were executed against the
  isolated application UAT DB.
- The local mock SAP connector was exercised through the real Admin integration
  screen. The outbox worker/connector behavior remains an integration step, not
  an employee action.
- The exact hosted-release Salesperson APK proved hosted login, Home, and
  session restore, but its current hosted fixture showed a completed-day state;
  the active-route visual state was therefore proven by the correctly seeded
  local candidate rather than falsely claimed from hosted data.
- No real SAP, payment provider, SMS provider, production database, or
  production DNS was used.
