# Salesperson UX refinement V2

Base: 207aac67dfc542ac5c36dae65d659f7ea8f8e0e9.
Source branch: codex/gagan-salesperson-ux-refinement-v2.
Scope: Salesperson only. Backend, Admin, Retailer, Prisma and 39 migrations unchanged.

## Source acceptance before APK

| Requirement | Result |
|---|---|
| Today's Sales / monthly target first | PASS |
| Next Visit / existing day-state fallback second | PASS |
| Needs Attention third when present | PASS |
| Visits / Done / Coverage fourth | PASS |
| Successful checkout opens canonical Order Detail | PASS |
| Approval acknowledgement opens the same canonical order | PASS |
| Existing Done / Next Retailer preserved | PASS |
| Available Credit removed from profile presentation | PASS |
| Check-in success opens Catalogue | PASS |
| Extra Visit-screen navigation/read wait removed | PASS, source; device latency not yet measured |
| NOT ORDERING in validated open visit context | PASS, source/unit tests |
| Uses existing Visit / ActivityComposer | PASS |
| No outcome written on button press | PASS |
| My Day calendar and leave retained, vertical attendance list removed | PASS |

Exact Home order: header; offline/error notice when applicable; Today's Sales/monthly target and milestones; Next Visit (or existing no-visit/completed-day state); Needs Attention when present; Visits/Done/Coverage; Next up today/route; Quick actions; existing secondary attention/follow-ups; Field day.

## Check-in and continuation audit

Both manual profile check-in and Home's automatic check-in previously navigated to Visit.
Visit performs visits and activity reads before displaying its activity/outcome workspace.
V2 waits for the existing GPS capture and canonical check-in response, then selects the same
retailer basket and navigates directly to Catalogue. No profile refresh is awaited.
Duplicate in-flight taps are blocked. Location and backend rejection are unchanged.
No numeric performance improvement is claimed before physical timing.

Catalogue independently revalidates the authenticated employee's open visit plus existing
activities and recent canonical orders on focus. Missing/rejected reads hide NOT ORDERING.
Closed visits, recorded outcomes, no-order/order activities and orders since check-in hide it.
The action opens the existing Visit composer with retailer and visit IDs; identity remains
session-owned and route linkage remains attached to the existing canonical visit.
No activity/outcome is preselected or submitted. The footer is normal-flow and consumes
one bottom safe-area inset; it does not cover the product list.

Only RepReviewOrderScreen calls createOrder. Its submit lock, checkout key, quote ID/revision,
backend pricing and approval Alert are preserved. The shared continuation helper requires
a canonical order ID and replaces review with OrderDetail. No second detail screen exists.

## Calendar regression correction

The prior physical expense-picker screenshot visibly wrapped dates into six columns.
Percentage-width rounding in DateField caused Saturday to wrap. Explicit seven-cell flex
rows fix geometry without changing date values, bounds, API serialization or timezone policy.
September 2026 Saturday 5 and Wednesday 16 have regression assertions.
Prior screenshot: /Users/tanutejas/Desktop/gagan-sales-review-expense-calendar-207aac6.png.
This is a newly identified prior-build defect, not a new feature.

## Automated evidence

Salesperson: 31 test files, 172 tests PASS.
Typecheck and diff check must be green at the source commit.
Existing cache/account isolation, quote, date and API tests remain in the full suite.
Screen ordering/removal checks are explicitly source-contract checks, not rendered acceptance.
No backend or hosted business-state mutation was used for source acceptance.

## Physical acceptance

Physical checkout found an existing reconciliation defect: quoteFor legitimately returns
null for wholly legacy/unconfigured SKU baskets (backend/modules/commercial/service.ts).
The accepted Review Order code dereferenced quote.id despite canSubmitQuote explicitly
allowing a successfully loaded null quote. The phone reproduced a generic error before
the order request. V2 now omits optional commercial metadata for that existing backend
path and labels it Standard case pricing. Configured commercial baskets still require
the same manager-confirmed quote/revision. No backend rule changed.
Two additional tests cover null quotes and exact quote identity/revision (174 total).

The initial pre-build status above is retained as history. Final device results follow.

## Final checkpoint — 16 September 2026

- UX branch: codex/gagan-salesperson-ux-refinement-v2.
- UX source: 966e082a13bff5c454d6b8c6bfe62cf227405337 (clean, pushed).
- Build branch: codex/gagan-salesperson-ux-v2-apk.
- Exact APK build source: 7f34e204af5db77e56254285dad3a50e0bab79a0.
- Build branch differs from UX runtime only in app.config.js and eas.json.
- Package/label: com.gagan.sales.review / Gagan Sales Review.
- Version: 1.0.3 / versionCode 4.
- Standalone release: YES; embedded JS bundle; no Metro or local API runtime required.
- API: https://gagan-srat.onrender.com.
- APK: /Users/tanutejas/Desktop/gagan-salesperson-ux-v2-966e082.apk.
- SHA-256: 159f75561e5301f206dce353eb18587bb565b48d20d7df7160bbca0a44bfc3ea.
- Size: 87,987,957 bytes.
- Signing certificate SHA-256: fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c.
  Existing compatible review/debug certificate; not production signing.
- Moto E13 ZD2229Q3KB: installed with replace, no uninstall or data clear.
- Final source/build suites: 31 files / 174 tests PASS; typecheck PASS; diff check PASS.
- Release build PASS. Final runtime source tree matches the pushed UX source.
- Bundle contains gagan-srat; old staging hostname and known local API endpoints absent.

The earlier V2 APK gagan-salesperson-ux-v2-3a82ee5.apk is retained as failed-checkout
diagnostic history, not the final review artifact. The original accepted version 1.0.2 APK
gagan-salesperson-client-uat-ux-207aac6.apk is unchanged (SHA-256
26395e51b24f6cf6669b129d9f93bbf67eda0963e525f4d1fdd7609112fbf767).
Both V2 installs used code 4; Android accepted the signed replacement without downgrade
flags, uninstall or clearing data.

### Physical evidence matrix

Final artifact evidence directory:
/Users/tanutejas/Desktop/gagan-salesperson-ux-v2-evidence-966e082

| Scenario | Result / exact limit | Screenshot |
|---|---|---|
| Session restoration | PASS, existing salesperson restored | home.png |
| Home order | PASS: Sales, no-next-visit fallback, attention, metrics | home.png |
| Assigned Next Visit hero | BLOCKED: current identity off duty, no assigned next visit | home.png |
| Profile credit removal | PASS: outstanding retained, available-credit instrument absent | profile.png |
| Catalogue / Review | PASS: one existing full-stock Toor Dal case for Kaveri | review-order.png |
| Canonical order submission | PASS: exactly one UI submission after the fix created GGN-00000083, ₹3,120, qty 1 | order-created-83.png |
| Success immediately opens detail | PASS: retailer, items, quantities, prices, total and Placed state visible | order-created-83.png |
| Commercial Status | PASS for canonical Sales Order Created event on the new order | order-created-83.png |
| Approval acknowledgement | PASS unit/source; physical approval path NOT RUN (this order required none) | — |
| Done / Next Retailer | PASS: button returned to Retailers | order-done-next.png, next-retailer.png |
| My Day | PASS: calendar immediately followed by Leave, no vertical attendance list | my-day.png |
| Today offline / force-stop | PASS: persisted saved-day banner and data after network-off relaunch | home-offline-force-stop.png |
| Reconnect + manual refresh | PASS: banner cleared, sales updated to ₹6,240 reflecting order 83 | home-reconnected.png |
| Check-in → Catalogue timing | BLOCKED: no legitimate active UAT visit; no false GPS check-in created | — |
| NOT ORDERING positive action | BLOCKED on same active-visit precondition; unit/source coverage PASS | — |
| NOT ORDERING negative state | PASS: absent from no-active-visit catalogue | initial V2 catalog-no-active-visit.png |
| Account isolation | Existing full automated tests PASS; physical account switch NOT RUN | — |
| Market Survey | Source unchanged; assignment/permission-based physical submission NOT RUN | — |

Calendar/keyboard evidence was captured before the final checkout-only correction, on the
same V2 calendar/form runtime (unchanged in the final APK):
/Users/tanutejas/Desktop/gagan-salesperson-ux-v2-evidence-3a82ee5

- leave-from-calendar.png / leave-to-calendar.png: seven columns, lower-bound dates disabled.
- leave-selected-dates.png: From 23 September and To 24 September retained exactly.
- expense-calendar.png: Wednesday 16 and Saturday 5 aligned correctly; selecting 5 returned
  Sat, 5 Sept, 2026 to the form.
- add-store-keyboard.png: Continue visible immediately above the keyboard after scrolling.
- No leave/expense/onboarding submission was made; the form was cancelled/left.
- Visit keyboard was not tested without a valid active visit.
- legacy-checkout-failure.png records the reproduced pre-fix generic failure. It is not
  rewritten as a freight blocker: it was a client null-quote dereference before API posting.

### Safety and remaining acceptance

Backend/Admin/Retailer/Prisma/migrations unchanged; 39 migrations. No deployment.
Production, main, frozen tags, Dogkart and real SAP untouched.
Protected package update timestamps unchanged:
com.gagan.sales 2026-09-15 09:46:04;
com.gagan.retailer 2026-09-13 12:03:24;
com.gagan.retailer.review 2026-09-15 22:54:12.
Wi-Fi and mobile data restored to their initial enabled states.
No FATAL EXCEPTION/JavascriptException match in the final bounded 1,500-line log sample;
this is not a claim about every historical device log.

SOURCE/BUILD: PASS.
PHYSICAL UX: PARTIAL, with active-visit check-in/NOT ORDERING acceptance BLOCKED.
READY TO RESUME FINAL CLIENT-UAT: YES, using the final APK and a legitimate active UAT visit.
No full physical acceptance or production readiness claimed.
