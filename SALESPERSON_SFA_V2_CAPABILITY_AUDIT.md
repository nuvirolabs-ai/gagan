# Gagan Salesperson App — SFA V2 Capability Audit

`GAGAN SALESPERSON FUNCTIONAL V2 — FROZEN`

`GAGAN SFA CAPABILITY V2 — FROZEN`

The functional and capability boundaries in this audit are approved for the
staging release. Future changes require a launch defect, real salesperson
feedback, an SAP integration requirement, or an explicit founder request.

Status: implementation audit for `codex/gagan-salesperson-sfa-v2`

Reference source: `origin/codex/gagan-staging` at `47a918dd2dc2237d42e0e845a60b1dde658e4a13`

The attached 33-page SFA PDF is treated as a capability benchmark. Its legacy UI is not copied. The attached mobile references define the V2 visual direction.

## Boundary and source of truth

The clean implementation worktree is `/Users/tanutejas/Documents/Gagan-salesperson-sfa-v2`. The canonical `/Users/tanutejas/Documents/Gagan` checkout contains unrelated user edits and is not modified by this pass. No Admin, Retailer, Founder, production, or SAP B1 code is changed here.

The app continues to use the existing Gagan API and models. Orders remain server-authoritative for price, credit, inventory, and idempotency. Attendance, location, route stops, visits, activities, collections, tasks, expenses, issues, retailer proposals, KYC, schemes, sales kit, targets, ranking, achievements, and performance remain canonical backend capabilities.

## Capability audit

| PDF capability | Current Gagan implementation | V2 treatment | Route / screen | Canonical source | Status |
|---|---|---|---|---|---|
| Attendance: geo-location, attendance, cut-off, holidays/leaves, photo where policy requires | Start/end day, attendance history, location policy and workday state exist; photo is policy-controlled | Preserved; Home gives a clear field-day state and EOD review before mutation | Home, More → My Day | `WorkdaySession`, attendance services, `AppConfig` | PASS — EXISTING |
| Leave management | Leave request, type, dates, reason, status and history exist | Preserved under More with shared loading/error language | More → My Day | `LeaveRequest`, field attendance routes | PASS — EXISTING |
| Salesperson dashboard / performance | Sales, target progress, visits, productivity, collections, category contribution, route completion, ranking and achievements exist | Shared visual language refined; Home prioritizes next action, Activity keeps 7D/30D analytical views | Home, Activity → Performance | `FieldDashboardService`, `TargetService`, performance read model | PASS — IMPROVED UX |
| Configurable home | Legacy SFA asks for a configurable home; Gagan has a deliberate fixed field companion surface | Fixed information architecture is intentional: next visit, sales, route, attention, tasks, actions | Home | Existing salesperson today read model | NOT APPLICABLE — EVIDENCE |
| PJP / daily beat plan | Published route, ordered stops, statuses, retailer coordinates and progress exist | Home now renders the route directly; full plan remains available | Home, More → Route | `RoutePlan`, `RoutePlanStop`, route service | PASS — IMPROVED UX |
| Add new retail outlet / prospect | Proposal flow captures business name, owner, phone, address, notes and optional location; manager approval remains controlled | Preserved; no uncontrolled retailer-master creation | More → Add retailer | `RetailerProposal`, proposal routes | PASS — EXISTING |
| Outlet information | Retailer detail includes identity, contact, tier, credit, outstanding, KYC and location | Expanded existing detail is the pre-call workspace | Retailer detail | `Retailer`, credit read model, location service | PASS — IMPROVED UX |
| Outlet verification / outlet OTP | Gagan uses location capture and verification plus retailer login OTP; it does not have a separate one-time retailer-master OTP contract | Separate OTP semantics are not invented or conflated; location verification is surfaced clearly | Retailer detail | `RetailerLocation`, existing OTP/auth services | PARTIAL — DOCUMENTED LIMITATION |
| Order history | Retailer detail shows recent orders, dates, values, items and statuses, including recent-value bars | Preserved and visually tightened | Retailer detail | `Order`, `OrderItem`, delivery/invoice projections | PASS — EXISTING |
| Discounts and schemes | Retailer-relevant schemes with headline, period, progress, benefit and remaining are available | Preserved and surfaced before ordering | Retailer detail, Sales Kit, catalog context | `Scheme`, scheme read model | PASS — EXISTING |
| Outlet-level reports | Retailer detail exposes recent order trend, average order, cycle, categories, visits, credit and ledger | Kept as compact store intelligence rather than a separate BI module | Retailer detail | `RetailerBaseline`, orders, visits, ledger | PASS — IMPROVED UX |
| Retailer stock taking: own stock, competitor stock, price capture | No canonical retailer-stock-audit model or policy exists in the current Gagan backend; warehouse inventory is a different truth | Not silently fabricated; deferred until Gagan defines ownership, evidence, and review policy | No route added | No compatible canonical model | PARTIAL — DOCUMENTED LIMITATION |
| Secondary order taking | Catalog search, category filter, variants, server pricing, availability, quantity, cart, review and idempotent submission exist | Fast catalog and dark action dock retained; visual palette moved to blue/navy | Retailer detail → Catalog | `Product`, `Variant`, price and inventory read models; `/rep/orders` | PASS — EXISTING |
| Suggested order | Deterministic opportunities and retailer baseline expose reorder signals; no ML recommender is required | Existing opportunities remain the safe suggestion surface; no forced auto-filled cart | Home, Opportunities, Retailer detail | `OpportunityService`, `RetailerBaseline` | PASS — EXISTING |
| Variable discount | No salesperson discount mutation is enabled by Gagan commercial policy | Not exposed; prevents unauthorized commercial truth changes | No route added | Server pricing/policy | NOT ENABLED BY POLICY — EVIDENCE |
| Sales return | Current rep contract has no authorized return-request workflow; returns require inventory/finance ownership | Not added without canonical authorization and accounting behavior | No route added | No compatible rep return command | NOT APPLICABLE — EVIDENCE |
| Picture capture and surveys | KYC/evidence capture exists; no configurable field-survey contract exists | KYC preserved; surveys are not fabricated as a form-builder | KYC, no survey route | `KycCase`, `EvidenceAsset` | PARTIAL — DOCUMENTED LIMITATION |
| Order review and submission | Catalog and checkout use server-authoritative total, credit/inventory validation, stable idempotency key and double-submit lock | Preserved; no pricing calculation duplicated in mobile | Catalog/cart | `/rep/orders`, order domain | PASS — EXISTING |
| Offline and background sync | Identity, assigned retailers, field day, activities, location pings, tasks, issues and expenses have bounded cache/outbox behavior; order submission is online-required | Preserved and labelled honestly; no silent offline order mutation | Home, More, relevant field screens | Secure session, outbox, FieldContext | PARTIAL — DOCUMENTED LIMITATION |
| Digital signature | No approved rep signature contract is present | Not forced onto orders or visits; evidence/signature can be added only with a canonical workflow | No route added | No compatible model | NOT APPLICABLE — EVIDENCE |
| Sales kit / collaterals | Sales kit endpoint and screen exist for approved product/scheme material | Preserved as a quick Home action and More module | Home, More → Sales Kit | `SalesKit` read model / field route | PASS — EXISTING |
| End-of-day report | Start/end day, summary metrics and manager note exist | Home now uses a bottom-sheet review with visit/order/value summary before End My Day | Home, More → My Day | `WorkdaySession`, attendance service, audit | PASS — IMPROVED UX |
| User claims / expenses and KM | Field expenses support type, amount, date, description, optional receipt and status. Foreground location pings exist | Expense flow preserved. Travel distance is only shown when a trusted read model exists | More → Expenses, tracking state | `FieldExpense`, `LocationPing` | PASS — EXPENSES; DATA LIMITATION — KM |
| Distributor / stockist mappings and tasks | Current Gagan salesperson contract is retailer/field-sales oriented; no stockist ownership or permission scope is defined | No DMS/stockist workflows are injected into the rep app | No route added | No compatible canonical contract | NOT APPLICABLE — EVIDENCE |
| Stockist closing stock | Same boundary as distributor tasks | Not added | No route added | No compatible canonical contract | NOT APPLICABLE — EVIDENCE |
| Stockist primary order | Same boundary as distributor tasks | Not added | No route added | No compatible canonical contract | NOT APPLICABLE — EVIDENCE |
| Stockist return and collection | Collections are retailer-facing and existing; stockist return is not a current Gagan responsibility | Existing collections preserved; stockist flow not added | More → Collections | `CollectionSubmission` | NOT APPLICABLE — EVIDENCE |
| Retailer-wise fulfilment | Order status and delivery-related data are visible in retailer/order context; dispatch truth is not rep-mutable | Read-only visibility retained for the salesperson | Retailer detail, order history | `Order`, `Delivery`, invoice projections | PASS — EXISTING |
| Profile | Staff identity, phone, role and manager-scoped capabilities exist | More profile surface preserved; HR identity-document upload is not invented | More | `StaffUser`, `SalesRep` | PASS — EXISTING |
| Notifications / attention | No push-notification contract is assumed; deterministic opportunities and in-app alerts exist | Notification affordance appears only when the API supplies notification events | Home, Opportunities | `OpportunityService`, notification data if available | PARTIAL — DOCUMENTED LIMITATION |

## UX and safety findings

- Home is now a field companion rather than a module grid: the next assigned stop is the first decision, followed by sales progress, quiet metrics, route, quick actions, attention, tasks, and field-day handoff.
- Start visit enters the existing retailer location/check-in workflow. If the store has a verified location, the V2 Home action can hand off with `startVisit`; the detail screen completes the existing location capture and check-in rules. No GPS result is faked.
- The target surface uses the existing configured target. If no target exists, it says so. Milestone dots are presentation-only; the server achievement feed controls any acknowledgement sheet and prevents repeated celebrations.
- No mobile screen computes an order price, bypasses credit, or writes inventory. The mobile checkout still receives the server result and uses an idempotency key.
- Offline behavior is intentionally bounded. Activities, location pings, and supported field submissions can queue. Orders stay online-required because price, credit, and inventory must be checked at submit time.

## V2 visual changes

The shared mobile tokens now use a light neutral canvas, clean white surfaces, blue operational actions, deep navy action surfaces, restrained gold milestones, and green only for genuine success. Shared controls retain safe-area padding, stable skeleton geometry, accessible roles, minimum tap targets, and reduced-motion handling. The redesigned Home is the main V2 reference surface; the shared primitives also carry the visual language into retailers, route, catalog, activity, More, expenses, issues, and attendance screens without changing their business behavior.

## Explicit follow-up gates

The following should remain outside this V2 pass until Gagan provides a canonical business and permission contract: retailer stock audit, competitor price capture, configurable surveys, digital signature, authorized sales return, true distance/KM read model, and distributor/stockist workflows. These are not hidden; they are recorded in the final matrix as limitations or not-applicable capabilities.
