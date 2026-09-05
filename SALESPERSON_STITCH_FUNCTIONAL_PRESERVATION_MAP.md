# Salesperson Stitch Functional Preservation Map

## Governing boundary

The native Gagan app remains the functional specification. Stitch changes presentation only. Existing hooks, API clients, mutations, permissions, validation, offline/outbox behavior, secure storage boundaries, and navigation contracts remain authoritative.

Source baseline: `e47e38e99cf08c0d71542ea230815c33dca17a26`.

## Application-level contracts

| Area | Existing source of truth | Required preservation |
|---|---|---|
| Authentication | `RepContext.tsx`, `RepLoginScreen.tsx`, `repClient` session store | OTP request/verify, session restoration, unauthorized handling, logout, permission-derived navigation. |
| Field state | `FieldContext.tsx` and `repApi.today()` | Today payload, route, targets, metrics, celebrations, tasks, attention, tracking, outbox, loading/error/refresh states. |
| Offline/outbox | `FieldContext.tsx`, `repApi.logActivity`, `sendPings`, outbox flush | Queue behavior, retry/failure state, reconnect refresh, no fabricated online success. |
| Permissions | `staffCapabilities.ts`, `RepTabs`, route guards | Capability-based tabs and actions; no new links to unavailable screens. |
| Location | `expo-location` helpers and `RepRetailerDetailScreen.tsx` | Permission state, GPS reading, check-in/out, location verification, route navigation handoff. |
| Touch geometry | Shared `AppScreen`, `TactilePressable`, navigator tab button | Visible control must equal native interactive control; no detached transforms or duplicate bottom insets. |
| Secure identity data | `AddRetailerScreen.tsx`, `KycCaptureScreen.tsx`, `secureSession.ts` | Aadhaar masking/encryption and private-photo-storage boundary remain unchanged. |

## Screen and workflow matrix

| Screen / workflow | Native route/source | Read APIs / data | Mutations / actions | Permissions and state requirements |
|---|---|---|---|---|
| Home | `Today` / `TodayScreen.tsx` | `FieldContext` → `repApi.today()`; staff/session; language | `startDay`, `endDay`, `setTaskStatus`, refresh, celebration dismissal, navigation to route/store/activity/sales kit/more/opportunities | `canRunFieldDay`; preserve active, before-start, complete, no-route, loading, offline, error, no-attention states. |
| Plan / Route | `Route` / `RouteScreen.tsx` | `repApi.route()` | `skipRouteStop`, retailer detail navigation, refresh | Field-day route scope; skip requires existing reason validation. |
| Outlets | `Retailers` / `RepRetailersScreen.tsx` | `repApi.retailers()` plus `FieldContext.today()` route/opportunity sets | Search/filter, Add Retailer navigation, retailer detail navigation, refresh | `canOrderForRetailers`; preserve all/route/overdue/opportunity filters and empty/loading/error states. |
| Retailer Detail | `RepRetailerDetail` / `RepRetailerDetailScreen.tsx` | `retailer`, `getLocation`, `visits`, `customerActivities`, `retailerBaseline`, `opportunities`, `today`, `schemes` | `checkIn`, `verifyLocation`/`captureLocation`, Visit navigation, KYC navigation, issues navigation, catalog navigation | Retailer scope, location permission, visit state, commercial truth. |
| Visit | `Visit` / `VisitScreen.tsx` | `visits`, `customerActivities` | `checkOut`, outcome/activity logging | Preserve check-out validation, GPS, outcome, activity timeline, offline behavior. |
| Order Taking / Catalog | `RepCatalog` / `RepCatalogScreen.tsx` | `retailer`, catalog/products, pricing, stock, schemes through existing client | Quantity changes, cart state, `repApi.createOrder(...)` | Preserve pricing, pack/SKU, stock, credit, cart, order submission and idempotency. |
| Cart / Order Review | Existing catalog flow in `RepCatalogScreen.tsx` | Current screen state plus canonical retailer/order constraints | Review, submit, success/error | Preserve confirmation, field validation, backend response, and no duplicate submissions. |
| Orders | Existing navigation/data contracts where available | Activity/order data and retailer context | Existing order navigation only | No new fake orders; preserve order identity/status formatting. |
| Reports / Timeline | `Activity` / `MyActivityScreen.tsx` | `activityFeed`, `performance`, `targets`, `ranking`, `achievements` | Tab selection, 7D/30D, metric selection, daily detail modal, refresh | `canRunFieldDay`; canonical series only; no fabricated chart values/comparisons. |
| Attendance / Leave | `MyDay` / `MyDayScreen.tsx` | `attendance`, `leaveRequests` | `requestLeave`, `cancelLeave`, refresh | Preserve leave validation and attendance history. |
| Tasks | Home task rows / existing task components | `FieldContext.today()` | `repApi.setTaskStatus` | Preserve completion mutation, refresh and offline error. |
| Expenses | `Expenses` / `ExpensesScreen.tsx` | `repApi.expenses()` | `submitExpense` | Preserve amount/date/category validation, receipt behavior, error/loading. |
| Issues | `Issues` / `IssuesScreen.tsx` | `issues`, `retailers` | `raiseIssue` | Preserve retailer selection, issue type, description, status and refresh. |
| New Retailer | `AddRetailer` / `AddRetailerScreen.tsx` | `retailerProposals()` | `proposeRetailer`, `withdrawRetailerProposal`, KYC/photo flow | Preserve all four steps, 19 fields, server validation, salesperson attribution, Aadhaar masking/encryption, private storage, approval, draft and request states. |
| KYC | `KycCapture` / `KycCaptureScreen.tsx` | `retailer`, `kycCase` / `startKyc` | `uploadKycDocument`, `submitKyc` | Preserve truthful blocked state if private storage is unavailable; never fake upload success. |
| Sales Kit | `SalesKit` / `SalesKitScreen.tsx` | `repApi.salesKit()` | None beyond refresh/navigation | Preserve canonical materials and loading/empty/error. |
| More / Profile | `More` / `RepAccountScreen.tsx` | `RepContext`, `FieldContext`, language, outbox | `logout`, `flushOutbox`, language selection, navigation | Preserve staff/rep identity, duty/offline state, sync retry, language and logout. |
| Customer Map | `CustomerMap` / `CustomerMapScreen.tsx` | `customerMap` | Retailer detail navigation | Preserve location-based scope and unavailable-location behavior. |
| Approvals / rating review | `Approvals`, `ApprovalDetail`, `RatingReviews` | approvals, rating proposals, step-up | Decide approval, dispute, step-up, confirm rating | Preserve manager-only permission and step-up security. |
| Collections / staff work | `StaffHome` when capabilities require it | collection retailers/submissions | submit/confirm collection, step-up | Preserve non-salesperson capability path; visual system may be shared but logic remains unchanged. |
| Language selection | `LanguageSelection` | language context | `setLanguage` | Preserve first-run language behavior. |

## State preservation checklist

- Loading geometry remains stable; no temporary fake zero values.
- Empty states explain the real unavailable/empty condition.
- Errors preserve user input and expose retry.
- Offline/outbox states remain truthful and actionable.
- Conditional Home sections collapse to zero height when absent.
- Bottom navigation remains normal-flow with exactly one layout owner.
- Native touch bounds track visible controls at center tap.
- Stitch sample values are never copied into production presentation logic.
