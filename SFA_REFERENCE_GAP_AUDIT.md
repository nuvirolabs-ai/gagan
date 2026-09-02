# Gagan Salesperson App - SFA Reference Gap Audit

Status: capability audit for the selective SFA depth pass

Reference: `(SFA) Sales Force Automation .pdf` supplied by the client. The reference is treated as a capability catalogue, not as a visual, navigation, terminology, or implementation template. Gagan keeps its Field Companion language: calm, personal, premium, focused, and operational.

## Status vocabulary

- **EXISTING** - the capability is present at a usable functional level.
- **EXISTING + VISUAL DEPTH NEEDED** - the data and workflow exist, but the field experience needs clearer synthesis or presentation.
- **PARTIAL** - a meaningful slice exists, but the reference capability is broader or not yet complete.
- **MISSING** - no supported Gagan capability was found.
- **DEFERRED BY DESIGN** - intentionally excluded from this pass because it needs a separate product decision or SAP truth.
- **NOT RELEVANT** - the reference capability does not fit the current Gagan field distribution product.
- **BELONGS ELSEWHERE** - better owned by an admin, HR, finance, or service surface than by the salesperson app.
- **BLOCKED BY SAP** - must wait for a reliable SAP B1 contract or synchronized business truth.

## Capability matrix

| Reference capability | Reference purpose | Current Gagan equivalent | Status | Existing canonical model/API | Actual gap | Copy into Gagan | Correct product surface | Priority | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Attendance capture with geo and photo | Prove that a field executive is at work | Start Day, WorkdaySession, attendance status, foreground location sharing | DEFERRED BY DESIGN | `WorkdaySession`, `AppConfig`, field attendance routes | No photo biometric is needed for the current approved flow | NO | Salesperson, only if client confirms | Later | Avoid collecting sensitive imagery without a confirmed business requirement |
| Attendance cutoff, holidays, leave policy | Control when attendance is valid | Start/End Day and leave history | PARTIAL | `WorkingCalendar`, `LeaveRequest`, field attendance routes | Policy administration is not a field-app feature | LATER | Admin / HR plus salesperson status | Medium | Reuse existing workday state; deepen policy in its owner surface |
| Leave application and approval | Let representatives request and managers approve leave | Leave flow and approval permissions exist | EXISTING | `LeaveRequest`, approval routes | No SFA-depth addition required | NO | Salesperson + admin approval | Low | Existing workflow is sufficient for the approved scope |
| Salesman dashboard | Give the rep a daily operating view | Today screen with day status, route, tasks, orders and attention items | EXISTING + VISUAL DEPTH NEEDED | `FieldDashboardService.today()`, Today API | More concise cross-day performance conclusions are needed | YES, selectively | Today / Activity > Performance | High | Add synthesis without creating another dashboard system |
| Configurable home screen | Let an operator arrange modules | Gagan has a fixed Field Companion Today experience | DEFERRED BY DESIGN | Today read model | No need for arbitrary widget configuration in a focused field app | NO | Admin configuration, if ever required | Later | Configuration would add complexity without improving the client demo |
| User profile and identity documents | Maintain rep profile and compliance data | Staff identity, phone, permissions, language and logout | PARTIAL | `Staff`, identity routes | Aadhar/PAN upload and profile administration are not in scope | NO | Admin / HR | Later | Sensitive document management belongs outside the field workflow |
| PJP / beat / route plan | Organize planned retailer calls | Route, route stops, map, route completion and navigation | EXISTING + VISUAL DEPTH NEEDED | `RoutePlan`, retailer locations, customer map, field routes | Historical route completion needs a compact trend conclusion | YES, selectively | Today / Activity > Performance | High | Use existing route truth; do not copy map-heavy reference UI |
| Route optimization | Produce an efficient walking/order sequence | Route stops and navigation are available | PARTIAL | `RoutePlan`, customer map | Backend optimization may not exist as a distinct service | LATER | Backend/admin route planning | Medium | Do not invent optimization claims in the rep UI |
| Add new outlet / prospect | Capture a prospective retailer | Add Retailer and retailer proposal flow | EXISTING | `Retailer`, `RetailerProposal`, proposal routes | No reference-style prospect wizard is required | NO | Salesperson + admin approval | Low | Existing canonical proposal is the source of truth |
| Outlet geographic information | Show store identity and location | Retailer detail, customer map, location verification | EXISTING + VISUAL DEPTH NEEDED | `Retailer`, retailer location, location routes | Store intelligence should surface location state more clearly | YES, selectively | Retailer Detail | High | Add a compact location-verification fact, not a new map module |
| Multiple warehouse selection | Let a rep choose stock source while ordering | Product/catalog and order flow do not expose user-selected warehouse as a free choice | BLOCKED BY SAP | Product, Variant, Inventory, warehouse APIs | Warehouse availability and allocation must be canonical and synchronized | NO | Backend/order allocation + admin | Later | Do not imply stock allocation the app cannot guarantee |
| OTP outlet verification | Verify a new retailer/store number | OTP login and retailer identity exist; store verification is not a separate rep action | PARTIAL | OTP identity routes, `Retailer` | Separate one-time store verification contract is absent | LATER | Salesperson proposal flow / backend | Medium | Requires a clear identity/consent policy |
| Outlet order/stock/sales history | Prepare for a retailer call | Retailer detail includes order history and activity timeline | EXISTING + VISUAL DEPTH NEEDED | `Order`, `OrderItem`, `SalesVisit`, activity feed | Needs last-six-order synthesis and recency/value facts | YES | Retailer Detail | High | This is one of the approved additions |
| Outlet-level schemes and loyalty | Show what matters to a particular retailer | Canonical `Scheme` data is available in the backend | PARTIAL | `Scheme`, catalog/order scheme responses | Retailer/product threshold, benefit and progress need readable presentation | YES | Retailer Detail + Catalog/order context | High | Show only canonical scheme facts; no invented variable discounts |
| Sales reports | Let reps inspect their own performance | Activity > Performance has period metrics and targets | EXISTING + VISUAL DEPTH NEEDED | `FieldDashboardService.performance()`, `SalesTarget` | Current view lacks trend charts, conclusions and selling-day/category breakdown | YES | Activity > Performance | High | Deepen existing experience, do not add an analytics module |
| Retailer stock taking | Record stock on hand and shelf status | No approved Gagan stock-audit workflow | DEFERRED BY DESIGN | Product/inventory models are system truth, not field observations | Needs count, evidence, validation and reconciliation semantics | NO | Separate inventory/merchandising workflow | Later | Explicitly excluded from this pass |
| Competitor stock and price | Capture market intelligence | No approved competitor model or field contract | DEFERRED BY DESIGN | None | Requires new data model and review process | NO | Separate market-intelligence workflow | Later | Not a safe additive demo feature |
| SKU/category ordering | Take a secondary order | Catalog and order-taking flow already exist | EXISTING | `Product`, `Variant`, pricing/catalog routes, `Order` | No capability gap for baseline order taking | NO | Salesperson Catalog / Cart | Low | Preserve current working checkout |
| Suggested order | Help the rep build a basket | Existing deterministic opportunities and retailer baseline | PARTIAL | `RetailerBaseline`, opportunities routes | Suggestions must stay explainable and are not a new AI recommender | LATER | Retailer Detail / Catalog | Later | Keep current opportunities; add only approved intelligence display |
| Sales returns | Record saleable/non-saleable return with batch reason | No approved return workflow in the rep app | DEFERRED BY DESIGN | Order/inventory truth exists but no return contract | Requires authorization, inventory and finance semantics | NO | Admin / backend returns workflow | Later | Must not create an unsafe partial return flow |
| Picture capture and survey forms | Collect merchandising evidence | No approved survey/evidence workflow for sales reps | DEFERRED BY DESIGN | Evidence assets exist only for specific identity/KYC use | Needs schema, storage, consent and review | NO | Separate merchandising workflow | Later | Explicitly excluded |
| Order evaluation and billing | Validate and submit a retailer order | Catalog pricing, credit checks and place-order flow exist | EXISTING | `Order`, pricing, credit and order routes | Existing flow must remain regression-tested | NO | Salesperson Cart / backend | High | Preserve checkout while extending insight around it |
| Offline order taking | Create and submit orders fully offline | Offline identity and bounded outbox exist; order creation remains online-bound | DEFERRED BY DESIGN | Outbox, order APIs | Reliable offline pricing/credit/inventory conflict rules are not complete | NO | Backend/mobile architecture | Later | Do not promise offline financial transactions |
| Digital signature | Capture retailer signature on order | No signature workflow | DEFERRED BY DESIGN | None | Needs legal/consent and document binding | NO | Order/admin | Later | Not required for staging demo |
| Sales Kit / collateral sharing | Give reps approved product and communication material | No dedicated Sales Kit surface found | MISSING | No reusable collateral model found; external URLs can be represented minimally | Need a read-only, canonical list of active collateral | YES | More > Sales Kit | High | One of the approved additions; keep model small |
| End-of-day report and manager comments | Summarize field output and report exceptions | End My Day exists; summary/note depth is limited | PARTIAL | `WorkdaySession`, day metrics, activities, field routes | Needs pre-submit summary and optional auditable note | YES | End My Day | High | One of the approved additions; no chat system |
| Claims, expenses and travel km | Submit field expenses for approval | Expense capture exists | EXISTING | `FieldExpense`, expense routes | Distance calculation is not approved | NO | More > Expenses + admin finance | Low | Keep existing receipt/amount flow; do not add mileage logic |
| Distributor mapping | Manage stockists and distributor relationships | Gagan field app is retailer-facing | NOT RELEVANT | No distributor domain in approved scope | Different business role and data ownership | NO | Admin / distributor app | Later | Not part of the current salesperson role |
| Distributor inventory / primary orders | Manage stockist inventory and primary replenishment | No distributor role in app | BELONGS ELSEWHERE | Product/inventory/order models, no distributor contract | Needs separate authorization and fulfillment semantics | NO | Distributor/admin surface | Later | Avoid mixing primary and secondary sales workflows |
| Collections | Record and confirm retailer collections | Collection submission/confirmation flow exists | EXISTING | `CollectionSubmission`, ledger/payment truth | No approved visualization gap beyond performance trend | NO | More > Collections + Activity | Medium | Existing canonical flow remains authoritative |
| Retailer fulfillment | Track delivered/partial/not delivered reasons | Orders and status history exist; field fulfillment workflow is not a rep responsibility | BELONGS ELSEWHERE | `Order`, fulfillment/admin routes | Needs warehouse/delivery state and reason codes | NO | Admin / warehouse / delivery | Later | Correct owner is operations, not the salesperson visit flow |

## Approved implementation boundary

Only these are implemented in this pass:

1. Activity > Performance visual intelligence, using one aggregated read response built from existing orders, visits, collections, targets, working calendar, route state and product/category data.
2. Store Intelligence within the existing Retailer Detail screen, using retailer baseline and deterministic opportunities.
3. End-of-day summary and optional auditable manager note inside the existing End My Day flow.
4. A lightweight read-only Sales Kit under More, backed by a minimal collateral contract and staging data only.
5. Richer scheme visibility, reading existing canonical `Scheme` records only.

No new AI recommendation engine, production SAP integration, production payment/SMS integration, unrestricted discounting, or full offline order system is introduced.

## Design conclusion

The reference confirms that Gagan already has the right field workflow foundation. The gap is mostly synthesis: help a rep understand what to do next, what happened at a store, how the day is going, and which approved product material or scheme applies. The pass therefore deepens existing surfaces instead of copying the reference application's blue, dashboard-heavy, form-heavy presentation.
