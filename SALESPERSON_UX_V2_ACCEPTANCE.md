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

Pending replacement build/install. Source tests do not prove Android rendering or hosted
check-in/order completion. Missing hosted route, location or freight preconditions must be
reported BLOCKED, never bypassed. Existing APKs and base apps remain protected.
