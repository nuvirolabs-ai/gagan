# Gagan Wave 2 — reconciliation audit

**Mode:** read-only source and evidence reconciliation\
**Date:** 2026-09-15\
**Product:** Gagan Salesperson application and supporting backend/Admin
surfaces\
**Scope:** reconcile the existing field-operations capability against the
accepted Wave 1B commercial checkpoint before starting Wave 2 implementation.

No product code, schema, migration, deployment, hosted data, or staging
configuration was changed by this audit.

## Executive result

The accepted Wave 1B branch is the correct current application baseline. The
historical Field Ops branch is an ancestor of that branch, not a parallel
implementation that needs to be merged. Its committed field workflows are
already present in the Wave 1B source lineage.

The post-Field-Ops changes in Wave 1B are materially important and must win in
any future Wave 2 work:

- mixed Jain Traders and Padam International commercial ownership;
- authoritative rate-basis and GST-aware quotes;
- manager-confirmed final freight and freight GST;
- one combined invoice with ownership retained per line;
- invoice-scoped Jain and Padam payment allocation;
- native quote reconciliation and order detail;
- visit outcomes and mandatory no-order explanations;
- account-scoped mobile baskets and sessions;
- durable protected evidence storage and restart-safe collection evidence;
- proposal and order integrity/concurrency protections.

The safe recommendation is therefore not to port the historical Field Ops
branch wholesale. Wave 2 should extend the current Wave 1B contracts in small,
dependency-aware slices. Any change to the current mobile screens must
preserve the Wave 1B quote, order, payment, invoice, R2, identity and account
boundary contracts.

## Source and provenance record

### Current accepted Wave 1B source

| Item | Verified value |
|---|---|
| Worktree | /Users/tanutejas/Documents/Gagan-product-improvements-v1 |
| Branch | codex/gagan-product-improvements-v1 |
| HEAD | b8880612f896fccbfaa696516b85d64d9a99ebb9 |
| Remote branch | origin/codex/gagan-product-improvements-v1 |
| Working tree | Clean; ignored evidence files only |
| Accepted tag | gagan-staging-wave1b-commercial-v1 |
| Tag target | b8880612f896fccbfaa696516b85d64d9a99ebb9 |
| Commercial backend implementation | 614556c ancestry, integrated into current HEAD |
| Native quote reconciliation | 76c7b3205756a449d4b6f48b0d10cc482da5f8d8 |
| Hosted collection/R2 backend correction | adfd8b58fe35d9980a973ffbedd0fb5d12200035 |
| Evidence confidence | VERIFIED SOURCE and DOCUMENTED ACCEPTANCE |

The abbreviated client SHA supplied in earlier acceptance material,
76c7b3205756a449d4b6f48b0d10cc482da5f8, resolves in this repository to the
full commit shown above.

### Historical Field Ops source

| Item | Verified value |
|---|---|
| Worktree | /Users/tanutejas/Documents/Gagan-field-ops-completion-v1 |
| Branch | codex/gagan-field-ops-completion-v1 |
| HEAD | 282864aad132a645290236286d4b1df56526960f |
| Remote branch | origin/codex/gagan-field-ops-completion-v1 |
| Working tree | Not clean because of one untracked acceptance document only |
| Merge base with accepted Wave 1B | 282864aad132a645290236286d4b1df56526960f |
| Field branch unique source commits | None relative to current Wave 1B |
| Evidence confidence | VERIFIED SOURCE; DOCUMENTED HISTORICAL DEVICE/UAT EVIDENCE |

The field branch is an ancestor of the current Wave 1B branch. The current
Wave 1B branch is not an ancestor of the field branch because Wave 1B continued
with later commercial and acceptance work. This is the critical ancestry
result.

The historical Field Ops implementation commits are already in the current
source lineage:

- 1a5f5e3154d4e3fa7e289718ec9cbfc4af481534 — backend-supported field
  workflows;
- 2fbb4d417829bdd060a4e0d67c8b3daac13b7664 — Salesperson field workflows;
- 35a9cb737376f4f1ab85219fd583dbfded147a80 — unresolved issues surfaced in
  Today;
- 8c86973326abfd1e432bd388d550cae5726df41f — stable My Day hook order;
- cc49fa9f4ba35b6799fb0f984bb86025b9526801 — unreachable-host activity
  failures queue offline;
- d6fc991b7ebd7d5d2825246cf88f3ffa576e6c0c — one-open-visit protection and
  atomic route linkage.

### Wave 1B commits after the Field Ops merge point

| Commit | Reconciled effect |
|---|---|
| b910d72 | order, invoice and proposal integrity protection |
| 953a27e | account/session and catalogue-selection corrections |
| 9c5c995 | multiple visit outcomes and mandatory no-order explanations |
| 614556c | mixed-entity commercial flow and invoice-scoped payment foundation |
| 4d0c672 | deliberate freight-company selection |
| 77ec9b0 | safe quote recovery after pricing and expiry failures |
| c95bb82 | authoritative commercial quote in both review apps |
| dd418f2 | local commercial acceptance evidence |
| 76c7b32 | native quote reconciliation |
| 61a6fac | quote reconciliation acceptance evidence |
| 211a367 | hosted R2 acceptance boundary |
| adfd8b5 | bounded collection receipt evidence payloads |
| b888061 | final hosted Wave 1B acceptance documentation and checkpoint |

These changes are not present on the historical Field Ops branch and must not
be lost by copying older mobile or API files forward.

## Evidence boundary

The reconciliation uses three evidence levels:

- VERIFIED SOURCE: the current repository contains the route, service, model,
  screen or test.
- DOCUMENTED ACCEPTANCE: a prior acceptance report records that an interface or
  runtime was exercised. This remains useful evidence but is not a fresh run in
  this audit.
- MOTO / HOSTED VERIFIED: the exact current artifact and environment were
  exercised on the physical device or hosted runtime.

This audit is source-only. It does not promote historical device evidence to a
fresh Wave 2 device acceptance result. In particular, the current Wave 1B
branch has not been rebuilt or reinstalled as part of this read-only audit.

The principal evidence documents are:

- GAGAN_WAVE_1B_ACCEPTANCE.md;
- GAGAN_MASTER_IMPLEMENTATION_REPORT.md;
- GAGAN_MASTER_REQUIREMENT_MATRIX.md;
- GAGAN_REAL_WORLD_UAT_CAPABILITY_AUDIT.md;
- /Users/tanutejas/Documents/Gagan-field-ops-completion-v1/GAGAN_FIELD_OPS_V1_FINAL_ACCEPTANCE_CLOSURE.md;
- /Users/tanutejas/Documents/Gagan-field-ops-completion-v1/GAGAN_FIELD_OPS_V1_FINAL_FOUR_BLOCKERS_REPORT.md.

## Wave 2 capability reconciliation

The following matrix covers the 25 capability areas requested for the
reconciliation. Field Ops state refers to the historical branch and its
acceptance material. Current Wave 1B state is the accepted source and its
documented Wave 1B evidence.

| # | Capability | Current Wave 1B status | Field Ops status | Relationship | Recommendation |
|---:|---|---|---|---|---|
| 1 | Attendance and day lifecycle | COMPLETE | COMPLETE | SAME; current source retains field implementation | KEEP_CURRENT; refresh physical UAT later |
| 2 | Leave request and manager decisions | COMPLETE | COMPLETE | SAME | KEEP_CURRENT |
| 3 | Route planning and route execution | COMPLETE | COMPLETE | SAME | KEEP_CURRENT; deepen reporting only if approved |
| 4 | Customer or retailer timeline | COMPLETE | COMPLETE | SAME | KEEP_CURRENT |
| 5 | Visit check-in and check-out | COMPLETE | PARTIAL in older acceptance wording | WAVE1B_NEWER because outcomes and no-order policy are newer | KEEP_CURRENT |
| 6 | Geolocation and store verification | COMPLETE | COMPLETE | SAME | KEEP_CURRENT; device proof remains separate |
| 7 | Location tracking | PARTIAL operationally, COMPLETE source | PARTIAL operationally, COMPLETE source | SAME; foreground and bounded tracking only | KEEP_CURRENT; no background GPS without policy |
| 8 | Mandatory no-order reason | COMPLETE | PARTIAL in older flow | WAVE1B_NEWER | KEEP_CURRENT |
| 9 | Follow-up presets and custom dates | COMPLETE | COMPLETE | SAME | KEEP_CURRENT |
| 10 | Collections | COMPLETE for Wave 1B invoice-scoped collection | PARTIAL/basic in historical acceptance | WAVE1B_NEWER; commercial contract supersedes old collection UI assumptions | KEEP_CURRENT; manual UAT only |
| 11 | Receipt and evidence handling | COMPLETE for accepted R2 evidence path | PARTIAL in historical run | WAVE1B_NEWER | KEEP_CURRENT; do not port old local-storage assumptions |
| 12 | Expenses | COMPLETE source | COMPLETE source | SAME | KEEP_CURRENT |
| 13 | Tasks | COMPLETE source | COMPLETE source | SAME | KEEP_CURRENT |
| 14 | Service issues | COMPLETE source | COMPLETE source | SAME; current Today attention fix is later accepted source | KEEP_CURRENT |
| 15 | Needs Attention | COMPLETE source | COMPLETE source | SAME with current source corrections | KEEP_CURRENT; verify cross-screen presentation |
| 16 | Retailer proposal or Add Store | COMPLETE source | COMPLETE source | WAVE1B_NEWER integrity and proposal protections | KEEP_CURRENT |
| 17 | Proposal withdrawal | COMPLETE source | COMPLETE source | WAVE1B_NEWER concurrency protection | KEEP_CURRENT |
| 18 | Manager or team visibility | PARTIAL | PARTIAL | SAME; scoped pages exist, unified operating cockpit is not complete | MANUAL_RECONCILE; extend current Admin |
| 19 | Offline operational cache | PARTIAL | PARTIAL | SAME; no historical branch supplies a complete persistent read cache | REIMPLEMENT a bounded cache contract |
| 20 | Offline activity and location outbox | COMPLETE source | COMPLETE source | SAME; current account-scoped durable queue is authoritative | KEEP_CURRENT |
| 21 | Reconnect and retry behavior | PARTIAL | PARTIAL | SAME; covered writes are bounded, not every field mutation | MANUAL_RECONCILE; extend only named operations |
| 22 | Account isolation | COMPLETE source | PARTIAL in older device evidence | WAVE1B_NEWER | KEEP_CURRENT; fresh device proof later |
| 23 | Customer history and retailer detail | COMPLETE source | COMPLETE source | SAME; current commercial order detail is newer | KEEP_CURRENT |
| 24 | Salesperson order detail and final status | COMPLETE source | PARTIAL in older acceptance wording | WAVE1B_NEWER | KEEP_CURRENT; fresh native visibility UAT |
| 25 | Reports, performance and target views | COMPLETE source | COMPLETE source | SAME; current source has reports and target data | KEEP_CURRENT; refine synthesis later |

### What the 25-row matrix means

No requested Wave 2 field workflow is completely absent from the current
source. The genuine gaps are depth and proof gaps: a persistent read cache,
broader retry coverage, and a more unified manager exception view. They are
not reasons to port the historical branch.

The COMPLETE labels mean a current route/model/screen contract exists and the
accepted evidence supports that it is a real product capability. They do not
mean that every device size, offline transition or hosted persona has been
freshly re-run.

## Full 57-group traceability update

The prior audit supplied a 57-group normalized baseline. The stable update keys
below preserve that grouping and map each group back to the original CSV rows
or the unnumbered feedback notes. They are display keys for this reconciliation,
not a new product taxonomy.

Status meanings:

- IMPLEMENTED + VERIFIED: current source plus relevant accepted evidence
  supports the capability.
- IMPLEMENTED BUT NEEDS UAT: current source is present, but required latest
  native, hosted or persona-specific proof is not current.
- PARTIAL: a meaningful contract exists, but a required slice is missing,
  intentionally bounded, or not safe to claim.
- MISSING: no appropriate current Gagan contract was found.
- DEFERRED / PHASE 2: explicitly paused or outside approved current scope.
- NEEDS BUSINESS DECISION: implementation would change ownership, legal money
  movement, identity policy or another unresolved product contract.

| ID | CSV source row(s) | Requirement | Product surface | Current Wave 1B status | Existing implementation and exact evidence | Exact remaining gap | Recommended next action |
|---|---|---|---|---|---|---|---|
| W2-01 | 1 | Jain Traders and Padam International ownership by SKU and invoice line | Backend, Admin, Retailer, Salesperson | IMPLEMENTED + VERIFIED | Variant sellingEntity; commercial quote and immutable invoice-line ownership; Wave 1B mixed-order acceptance | No new gap in accepted contract | Keep current contract; add only reporting views later |
| W2-02 | 25-26 | Company payment destinations, QR routing and paid/free semantics | Backend, Admin, Retailer | NEEDS BUSINESS DECISION | Entity split is persisted and explicit payment allocation exists; no approved canonical QR/destination contract is accepted | Legal destination, SAP account mapping and provider ownership are not specified | Decide payment destination ownership before building QR or provider flow |
| W2-03 | 27, 60 | Separate Jain and Padam ledger visibility | Backend, Admin, Salesperson | PARTIAL | Invoice-level entity balances and payment allocations exist; Wave 1B acceptance proves invoice-specific balances | Dedicated two-entity ledger presentation is not a separate accepted surface; row 60 explicitly says Phase 2 | Define reporting view later without changing settlement truth |
| W2-04 | 2, unnumbered pricing notes | Quintal or weight-aware rates | Backend, Admin, both mobile apps | IMPLEMENTED + VERIFIED | PriceList and PriceOverride rate basis; commercial quote freezes conversion and basis; mixed quote evidence | Broader SAP price-master synchronization remains mock/staging | Keep backend quote as authority; validate more real SAP mapping later |
| W2-05 | 3, 22 | SKU GST and invoice charge arithmetic | Backend, Admin, both mobile apps | IMPLEMENTED + VERIFIED | Variant GST, quote tax, immutable invoice snapshots and Wave 1B arithmetic tests/evidence | Production statutory tax configuration and SAP tax-code mapping remain external | Keep current calculation; obtain tax-code decision before production |
| W2-06 | 3, unnumbered freight notes | Manager freight and freight GST | Backend, Admin, both mobile apps | IMPLEMENTED + VERIFIED | Final freight amount, quintals/km context, explicit freight-company selection and separate freight GST; accepted quote evidence | No automatic distance/rate engine is implied | Keep manager-confirmed final amount; do not multiply context fields |
| W2-07 | 4, 32, survey notes | Market survey receive, complete, remind and submit | Salesperson, Backend, Admin | MISSING | No current survey builder, answer contract or Admin survey lifecycle was found; task model is not a survey model | Survey schema, assignment, reminder and answer ownership do not exist | Design as a separate business slice only after requirements are approved |
| W2-08 | 5, 33, notification notes | Individual, broadcast, in-app, push and automated notifications | Backend, Admin, Salesperson, Retailer | PARTIAL | Notification model and contextual Today attention/follow-ups exist; no complete push/broadcast/automation contract is accepted | Provider, recipient, schedule, read state and dedupe policy are incomplete | Keep contextual attention; decide notification contract before building push |
| W2-09 | 6, 34, unnumbered quantity notes | Large, usable quantity add/delete controls | Retailer, Salesperson | IMPLEMENTED + VERIFIED | Shared mobile controls were enlarged and exercised in prior Moto E13 evidence; current apps retain them | Fresh Wave 2 release-device proof is not part of this audit | Do not rebuild; include in regression |
| W2-10 | 7, unnumbered live-cart notes | Live cart visibility while adding products | Retailer, Salesperson | IMPLEMENTED + VERIFIED | Account-scoped carts and current cart/review flows; Wave 1B native quote/review acceptance | No new gap in current contract | Preserve basket/account boundary |
| W2-11 | 8, payment-proof notes | Payment proof attachment and evidence visibility | Retailer, Salesperson, Backend, Admin | IMPLEMENTED + VERIFIED | Collection evidence path, private object storage, signed retrieval and restart durability in Wave 1B acceptance | Real provider/storage production configuration remains separate | Keep R2 private-object contract; do not add public upload |
| W2-12 | 9, 43, 56, visual notes | Retailer banner, day-complete state and Today composition | Retailer, Salesperson | IMPLEMENTED + VERIFIED | Accepted visual/template work and current Today/Field Companion composition; no new architecture required | Visual acceptance must still be rerun for future builds | Freeze presentation; treat future changes as visual UAT only |
| W2-13 | 11, expense notes | Expense date capture and display | Salesperson, Admin | IMPLEMENTED BUT NEEDS UAT | FieldExpense, expense routes and mobile form include date/status; field source and tests present | Latest exact current-device/date-format proof is not current | Run focused UAT; no source port |
| W2-14 | 12, profile notes | Remove obsolete location warning/copy | Salesperson | IMPLEMENTED + VERIFIED | Current Field Companion source and accepted visual corrections do not treat the warning as an operational feature | No functional gap | Keep current wording; do not reintroduce stale copy |
| W2-15 | 13, 35, attendance-calendar notes | Attendance history and calendar-style absence view | Salesperson, Backend, Admin | IMPLEMENTED BUT NEEDS UAT | WorkdaySession, attendance history routes, leave calendar/date helpers and My Day screens | Historical evidence covers flow but not a fresh current Wave 1B device run | Re-run native UAT; preserve workday/leave distinction |
| W2-16 | 14, 31, leave notes | Leave request, dates, pending/rejected/approved/withdrawal and manager action | Salesperson, Admin, Backend | IMPLEMENTED + VERIFIED | LeaveRequest, field routes, Admin decisions; historical Field Ops acceptance records submit, approve, reject and withdraw | Current hosted persona/date policy proof is not refreshed | Keep current implementation; UAT with dedicated persona |
| W2-17 | 15, manager notes | Staff hierarchy and manager ownership | Backend, Admin, Manager | IMPLEMENTED BUT NEEDS UAT | StaffUser.managerId, hierarchy service, scoped field Admin pages and permissions | Role-specific sales/credit/dispatch ownership needs current manager-role UAT | Verify with authenticated manager personas; do not create parallel RBAC |
| W2-18 | 16, unnumbered multi-outcome notes | Check-in/out, multiple outcomes and no-order reason | Salesperson, Backend | IMPLEMENTED BUT NEEDS UAT | SalesVisit.outcomes, noOrderReason, visitOutcome.ts, location routes and current Wave 1B commit 9c5c995; tests cover outcomes | Latest exact current release-device run is not recorded in this audit | Re-run current native check-in/out and replay cases |
| W2-19 | 17, location notes | Store location capture, optionality and later correction | Salesperson, Admin, Backend | IMPLEMENTED BUT NEEDS UAT | RetailerLocation, history, capture/verify/correct routes, Customer Map and location screens | Device and pending-store correction proof needs refresh | Keep location history and server permission boundaries |
| W2-20 | 18, SKU notes | One product with multiple pack/SKU options | Retailer, Salesperson, Backend | IMPLEMENTED + VERIFIED | Variant catalogue and grouped Salesperson selection; accepted Moto evidence and catalogSelection tests | Large catalogue regression is not current Wave 2 evidence | Keep grouped selection; do not duplicate product rows |
| W2-21 | 19, day notes | Start Day and End Day with an active work session | Salesperson, Backend, Admin | IMPLEMENTED + VERIFIED | WorkdaySession, attendance routes, Today/My Day/EOD flow and Field Ops acceptance | New-device UAT not rerun here | Preserve online mutation and cached read semantics |
| W2-22 | 20, 39, target notes | Value, quantity, order, visit and collection targets | Backend, Admin, Salesperson | IMPLEMENTED BUT NEEDS UAT | SalesTarget, performance read models, target routes, Activity/Performance screens | Period and quantity semantics need manager/persona confirmation | Run target-setting and progress UAT; keep canonical target service |
| W2-23 | 21, 38 | Ranking, gamification and sales-person rank | Salesperson, Backend, Admin | PARTIAL | Ranking and achievement services and screens exist; target-change/stale-achievement risk is documented | Full reward policy, ranking explanation and durable historical UX are not complete | Harden existing achievements after policy review; no new game layer |
| W2-24 | 22, theme notes | Brand-consistent visual language and button geometry | Retailer, Salesperson | IMPLEMENTED + VERIFIED | Accepted Salesperson template and Retailer theme source; prior physical button-size evidence | New builds still require visual regression | Freeze visual system; no Wave 2 feature work |
| W2-25 | 23, 42, 55 | Achievement visibility, persistence and historical recognition | Salesperson, Backend | IMPLEMENTED BUT NEEDS UAT | AchievementEvent dedupe, FieldContext celebrations and performance surfaces; current source retains dismissed-session behavior | Exact cross-refresh and historical-target UI proof is not current | Run focused regression and fix only if a reproducible defect remains |
| W2-26 | 24, beat-plan notes | Beat planning and published route execution | Admin, Salesperson, Backend | IMPLEMENTED + VERIFIED | RoutePlan, RoutePlanStop, route Admin pages, Today/Route screens and historical physical route acceptance | Fresh current branch physical route screenshot is not part of this audit | Keep current route contract; improve analytics only later |
| W2-27 | 28, 39 | End-of-day sales summary across salespeople | Admin, Manager, Salesperson | IMPLEMENTED BUT NEEDS UAT | Field dashboard/team route progress, Performance and EOD summary exist | A single all-salesperson end-of-day command view remains incomplete | Validate current manager pages; extend current Admin if approved |
| W2-28 | 29, attendance photo notes | Attendance picture and location | Salesperson, Backend, Admin | PARTIAL | Location and workday coordinates exist; current approved flow does not require biometric selfie capture | Photo policy, retention and consent are not approved; historical audit avoided biometric capture | Keep foreground location; business decision before adding photo attendance |
| W2-29 | 30, offline-location notes | Location through the workday while offline | Salesperson, Backend | PARTIAL | Foreground tracking pings and account-scoped location outbox; no background GPS contract | Continuous/background semantics, battery and privacy policy remain bounded | Keep current foreground model; do not imply continuous offline tracking |
| W2-30 | 36, Add Store notes | Add a new retailer through controlled proposal | Salesperson, Admin, Backend | IMPLEMENTED BUT NEEDS UAT | RetailerProposal, four-step AddRetailer screen, Admin approval and guarded fields; Field Ops acceptance | Fresh current Wave 1B device and manager approval proof is not current | Re-run current proposal UAT; keep approval boundary |
| W2-31 | 46 | Outlet-level report | Salesperson, Backend | IMPLEMENTED BUT NEEDS UAT | Performance read model and Activity reports; SFA matrix records outlet/report capability | Latest report rendering and data interpretation need current device evidence | Verify native report with real assigned data |
| W2-32 | 47, POP/collateral notes | Sales Kit and approved collateral sharing | Salesperson, Backend, Admin | IMPLEMENTED BUT NEEDS UAT | salesKit service, SalesKitScreen, More/Home access and read-only collateral contract | Physical share behavior and current staging content need proof; WhatsApp provider is not a new system | UAT current Sales Kit; preserve read-only contract |
| W2-33 | 48, issue-search notes | Searchable retailer selection for service issues | Salesperson, Backend | IMPLEMENTED BUT NEEDS UAT | IssuesScreen has retailer preset/search and issue service supports retailer linkage | Current device proof with large retailer lists is not current | Run list/search UAT; do not create a second retailer picker |
| W2-34 | 49, issue-lifecycle notes | Issue detail, resolve/withdraw, evidence and history | Salesperson, Admin, Backend | PARTIAL | ServiceIssue, issue detail/list, Admin issue status and evidence boundaries exist | Complete close/withdraw reason and image lifecycle need a single accepted contract | Reconcile status vocabulary before extending |
| W2-35 | 50, 54, attention notes | Need Attention reason and contextual action | Salesperson, Backend, Retailer | IMPLEMENTED BUT NEEDS UAT | visibleAttentionItems, Today feed, overdue/follow-up/service-issue feeds and retailer detail context | Cross-screen consistency needs current device proof | Run attention scenarios; keep one backend read model |
| W2-36 | 51, 53, collection notes | Cash/cheque/collection entry and contextual Collect action | Salesperson, Admin, Backend | IMPLEMENTED + VERIFIED | Collection routes, permission/step-up tests, field Collect flow and Wave 1B native payment/R2 acceptance | Real payment provider remains out of scope | Keep current collection contract; no provider integration |
| W2-37 | 52, checkout timing notes | Checkout and visit completion performance | Salesperson, Backend | PARTIAL | Existing performance evidence and protected submit/check-out path | Comparable current three-sample timings are not in this audit | Measure before changing code |
| W2-38 | 53, Collect notes | Collect action has clear purpose and retailer context | Salesperson, Backend | IMPLEMENTED + VERIFIED | StaffHomeScreen and collection API prefill/permission behavior; Wave 1B collection acceptance | No new canonical calculation gap | Keep current contextual action |
| W2-39 | 54, retailer-alert notes | Retailer detail mirrors attention reason and alert | Salesperson, Backend | IMPLEMENTED BUT NEEDS UAT | Retailer detail and Today both consume attention/follow-up/service data | Fresh cross-screen proof is missing | Run one overdue/follow-up/issue fixture through both screens |
| W2-40 | 55, achievement notes | Achievement collapse, re-open and persistence | Salesperson, Backend | IMPLEMENTED BUT NEEDS UAT | AchievementEvent and FieldContext celebration retention; current Today handles earned events | Exact tap/cancel and performance-history behavior needs device verification | Verify; do not introduce duplicate achievement storage |
| W2-41 | 56, Today notes | Today page as the field command centre | Salesperson, Backend | IMPLEMENTED + VERIFIED | Current Today read model, active-day hierarchy, route, attention, metrics and accepted visual evidence | No source capability is absent; future improvements are synthesis | Freeze current Home; extend only with approved requirement |
| W2-42 | 57, task-photo notes | Task-linked POP, dangler and shelf photos | Salesperson, Backend, Admin | PARTIAL | Task model and evidence/storage components exist in adjacent workflows | Complete task-specific camera, compression, review and completion contract is not proven | Define evidence contract before implementation |
| W2-43 | 58, pending-retailer ordering | Order before manager approval for salesperson-created retailer | Salesperson, Backend, Admin | PARTIAL | Proposal creation and assignment exist, but current order path requires approved/eligible retailer semantics | Immediate ordering would alter KYC, credit, SAP customer and order eligibility | Product decision required; do not bypass approval guards |
| W2-44 | 59, retailer-page notes | Retailer detail hierarchy: identity, check-in, intelligence, outstanding, scheme | Salesperson, Backend | IMPLEMENTED + VERIFIED | RepRetailerDetailScreen, Store Intelligence, outstanding, schemes and activity; accepted Field Companion hierarchy | Fresh visual regression not run | Keep current detail composition |
| W2-45 | 60, Jain/Padam ledger notes | Dedicated two-entity outstanding and ledger detail | Salesperson, Backend, Admin | DEFERRED / PHASE 2 | Current invoice-specific balances are authoritative; CSV row explicitly says Phase 2 | Dedicated ledger view must not replace payment allocation truth | Defer until reporting requirements are approved |
| W2-46 | 61, withdrawal notes | Safe pending retailer withdrawal with confirmation | Salesperson, Admin, Backend | IMPLEMENTED + VERIFIED | Proposal withdrawal route, confirmation UI and proposal concurrency tests; current branch retains integrity correction | Fresh current-device confirmation is not re-run | Keep current flow; run UAT only |
| W2-47 | 44, WhatsApp/OTP notes | Phone confirmation and mandatory WhatsApp verification | Salesperson, Backend, Admin | NEEDS BUSINESS DECISION | OTP login exists; proposal has phone fields; no accepted separate WhatsApp verification contract | Consent, provider, number ownership, fallback and KYC semantics are unresolved | Decide identity policy and provider before building |
| W2-48 | EOD notes | EOD summary, manager note and keyboard-safe completion | Salesperson, Backend, Admin | IMPLEMENTED BUT NEEDS UAT | End-day summary/note fields, EOD flow, keyboard-safe corrections and Field Ops evidence | Current exact device/keyboard proof needs refresh | Run current physical UAT; no new feature |
| W2-49 | responsive/keyboard notes | Small-screen, bottom navigation and keyboard behavior | Retailer, Salesperson | IMPLEMENTED BUT NEEDS UAT | Corrected viewport/inset shell, mobile UI tests and prior Moto E13 evidence | Multi-size current release proof is not in this audit | Run 360/390/430 classes and Moto E13 regression |
| W2-50 | no-order/issue notes | Mandatory explanation when no order or service issue is raised | Salesperson, Backend | IMPLEMENTED + VERIFIED | visitOutcome.ts, SalesVisit.noOrderReason, current Wave 1B outcome tests and Visit screen | Only fresh native proof remains | Keep current validation |
| W2-51 | intelligence notes | Daal/Rice intelligence, largest order and cumulative context | Salesperson, Backend | IMPLEMENTED BUT NEEDS UAT | Retailer baseline/opportunity and Store Intelligence services/screens | Exact metric definitions and current retailer-data presentation need UAT | Verify against canonical order history; no new AI recommender |
| W2-52 | manager/team notes | Sales leader and manager team workspace | Admin, Backend, Manager | PARTIAL | fieldAdminRoutes, FieldTeam, FieldPlanning, SalesLeader, scoped hierarchy metrics | No single actionable exception/attendance/collection/team cockpit covers every requested action | Extend current Admin only after workflow priorities are fixed |
| W2-53 | survey-task notes | Survey represented as a task with reminders | Salesperson, Admin, Backend | MISSING | Field tasks exist, but no survey assignment/answer schema or reminder contract was found | Task-to-survey response and reminder semantics are absent | Design separately; do not alias generic tasks |
| W2-54 | offers/push notes | Timed offers and automated notification delivery | Backend, Admin, both mobile apps | PARTIAL | Contextual opportunities/attention data exists; no durable offer scheduler/push provider contract | Scheduling, expiry, audience, dedupe and provider delivery are not accepted | Business decision before implementation |
| W2-55 | pending-payment notes | Checkout and retailer detail reminder for outstanding collection | Salesperson, Backend, Retailer | PARTIAL | Outstanding/attention and collection context exist; Wave 1B invoice-level balances are correct | Exact reminder wording, timing and cross-screen policy need confirmation | Extend existing attention read model if approved |
| W2-56 | 45, returns notes | Sales return visibility, initiation, approval and financial effect | Salesperson, Retailer, Admin, Backend | DEFERRED / PHASE 2 | No approved Gagan return command or financial-return contract; current invoice/payment truth must not be reused as a return engine | Quantity, authorization, stock, credit and SAP return policy are absent | Defer; no partial return UI |
| W2-57 | offline/order-detail notes | Offline field actions, reconnect, account isolation, history and order detail | Salesperson, Backend | PARTIAL | Durable account-scoped activity/location outbox, session recovery, cart boundary and current OrderDetail exist; orders remain online-bound by design | Persistent read cache is incomplete and current device reconnect/account-switch proof is not fresh | Build a bounded read-cache/retry contract only after Wave 2 foundation |

### Status count reconciliation

The previous audit count was supplied as:

| Status | Previous |
|---|---:|
| IMPLEMENTED + VERIFIED | 6 |
| IMPLEMENTED BUT NEEDS UAT | 5 |
| PARTIAL | 24 |
| MISSING | 14 |
| DEFERRED / PHASE 2 | 3 |
| NEEDS BUSINESS DECISION | 5 |
| **Total** | **57** |

The updated count for the current accepted Wave 1B source and documented
evidence boundary is:

| Status | Updated |
|---|---:|
| IMPLEMENTED + VERIFIED | 20 |
| IMPLEMENTED BUT NEEDS UAT | 18 |
| PARTIAL | 13 |
| MISSING | 2 |
| DEFERRED / PHASE 2 | 2 |
| NEEDS BUSINESS DECISION | 2 |
| **Total** | **57** |

The movement out of MISSING and PARTIAL is primarily the result of the Field
Ops implementation being present in the current branch, not a new feature
merge in this audit. The movement into IMPLEMENTED BUT NEEDS UAT is deliberate:
source presence and historical evidence are not being presented as a fresh
current-device or current-hosted run.

## Requirements whose status changed

The following are the rows whose classification changed because of work after
the original traceability baseline. Rows not listed retain their previous
classification, subject to the evidence-boundary terminology above.

| ID | Old status | New status | Why | Exact latest evidence |
|---|---|---|---|---|
| W2-01 | PARTIAL | IMPLEMENTED + VERIFIED | Wave 1B made selling entity a persisted SKU and invoice-line fact | schema.prisma; commercialQuote.ts; Wave 1B mixed-order acceptance |
| W2-04 | PARTIAL | IMPLEMENTED + VERIFIED | Rate basis and accepted conversion are frozen in the commercial quote | PriceList.rateBasis; CommercialQuote; quote tests/evidence |
| W2-05 | PARTIAL | IMPLEMENTED + VERIFIED | SKU GST is configured per variant and frozen into invoice arithmetic | Variant.gstPercent; invoice snapshot fields; commercial tests |
| W2-06 | PARTIAL | IMPLEMENTED + VERIFIED | Manager final freight, context fields, company selection and freight GST are now one quote contract | commercial service; Admin Commercial page; accepted mixed quotes |
| W2-09 | PARTIAL | IMPLEMENTED + VERIFIED | Enlarged quantity controls were physically exercised and retained in current mobile lineage | mobile UI source; prior Moto E13 evidence |
| W2-10 | PARTIAL | IMPLEMENTED + VERIFIED | Live basket/review is account-scoped and part of the accepted two-app quote flow | CartContext; RepContext; Wave 1B native quote evidence |
| W2-11 | PARTIAL | IMPLEMENTED + VERIFIED | R2 private evidence write and signed retrieval are accepted in Wave 1B | Wave 1B acceptance; collection evidence routes |
| W2-12 | PARTIAL | IMPLEMENTED + VERIFIED | Approved Field Companion and retailer visual corrections are present in current source | current mobile/rep screens; accepted visual records |
| W2-14 | PARTIAL | IMPLEMENTED + VERIFIED | Obsolete location warning was removed from current Field Companion surfaces | current rep source and visual acceptance records |
| W2-16 | PARTIAL | IMPLEMENTED + VERIFIED | Leave submit/decision/withdraw is implemented and documented as accepted | LeaveRequest; field routes; Field Ops closure evidence |
| W2-18 | PARTIAL | IMPLEMENTED BUT NEEDS UAT | Multiple outcomes and no-order explanations were added after the baseline, but current Wave 1B device proof is not fresh | 9c5c995; visitOutcome.ts; VisitScreen.tsx; tests |
| W2-20 | PARTIAL | IMPLEMENTED + VERIFIED | Multi-pack selection and duplicate-product prevention are in the accepted app | catalogSelection.ts; Moto E13 evidence |
| W2-21 | PARTIAL | IMPLEMENTED + VERIFIED | Start/End Day and active work sessions were completed in Field Ops and retained | WorkdaySession; attendance routes; Field Ops acceptance |
| W2-24 | PARTIAL | IMPLEMENTED + VERIFIED | Approved mobile theme and control geometry are frozen in current lineage | approved template records; current mobile UI source |
| W2-26 | PARTIAL | IMPLEMENTED + VERIFIED | Published beat plans and physical route execution were accepted in Field Ops | RoutePlan; RoutePlanStop; Field Ops route evidence |
| W2-30 | MISSING | IMPLEMENTED BUT NEEDS UAT | Controlled Add Retailer proposal flow and four-step source now exist | RetailerProposal; AddRetailerScreen.tsx; Field Ops acceptance |
| W2-32 | MISSING | IMPLEMENTED BUT NEEDS UAT | Read-only Sales Kit was added in the field lineage | salesKit.ts; SalesKitScreen.tsx |
| W2-36 | PARTIAL | IMPLEMENTED + VERIFIED | Collection submission, exact invoice allocation and evidence are now accepted | collection service/routes; Wave 1B native collection acceptance |
| W2-38 | PARTIAL | IMPLEMENTED + VERIFIED | Collect action is contextual and uses the canonical collection contract | StaffHomeScreen.tsx; staffApi.ts; collection tests |
| W2-41 | PARTIAL | IMPLEMENTED + VERIFIED | Today composes route, workday, metrics, attention and next action | salespersonTodayService.ts; TodayScreen.tsx; accepted Field Companion evidence |
| W2-44 | PARTIAL | IMPLEMENTED + VERIFIED | Retailer detail hierarchy and intelligence are present in current source | RepRetailerDetailScreen.tsx; retailer detail routes |
| W2-46 | PARTIAL | IMPLEMENTED + VERIFIED | Proposal withdrawal is governed and concurrency-tested | retailerProposalService.ts; proposal concurrency tests |
| W2-50 | PARTIAL | IMPLEMENTED + VERIFIED | No-order and multi-outcome validation became an explicit current contract | visitOutcome.ts; locationRoutes.ts; outcome tests |
| W2-51 | MISSING | IMPLEMENTED BUT NEEDS UAT | Store intelligence/opportunity surfaces were added without a separate recommender | field intelligence services; RepRetailerDetailScreen.tsx |

The remaining rows are intentionally not promoted: they either retain their
prior status, remain a product decision, or need a fresh proof run rather than
more source.

## A. Safe to port

There is no substantial Field Ops source delta to port: the field branch is
already an ancestor of current Wave 1B. The safe “port” set is therefore
limited to isolated, non-contractual evidence or presentation refinements
that are proven against the current source:

1. Field Ops acceptance test cases for route, leave, visit and EOD can be
   reused as regression scenarios.
2. Field Ops screen-level UAT scripts can be rerun against a current
   Wave 1B-built APK.
3. Any future helper that does not touch commercial quote/order/payment
   contracts may be manually reapplied after review.

Do not cherry-pick the Field Ops branch for product code. Doing so would add
no unique committed source and would make provenance less clear.

## B. Manual reconcile

These areas exist in both the field lineage and current Wave 1B but require
contract-aware validation before any future change:

- collections and evidence: Wave 1B invoice-scoped Jain/Padam allocation wins;
- order detail: Wave 1B commercial snapshots and quote reconciliation win;
- retailer detail: current commercial context must remain intact;
- visit screens: current mandatory outcomes/no-order reason wins;
- Add Retailer: current proposal, Aadhaar and secure evidence boundary wins;
- account/session handling: current Wave 1B account boundary wins over older
  ownerless storage assumptions;
- Reports and Today: current read models win; do not replace with an older
  screen solely for visual parity;
- route and attendance: current backend contracts win, while historical device
  scripts can be reused for proof.

## C. Already present — no action

The following are already in the current accepted source and should not be
rebuilt as Wave 2 features:

- Start Day and End Day;
- leave request and withdrawal;
- route and route-stop linkage;
- check-in/check-out and visit history;
- follow-up presets and custom calendar;
- issue and task entry;
- expenses;
- Sales Kit;
- targets and performance;
- retailer intelligence;
- account-scoped field outbox;
- protected collection evidence;
- proposal withdrawal;
- one-open-visit protection;
- commercial quote, combined invoice and invoice-scoped payment split.

## D. Obsolete or do not port

Do not port or revive:

- any pre-Wave1B order or quote response that exposes client-submitted price,
  tax or totals as authoritative;
- ownerless mobile outbox keys or old global cart storage;
- local/non-durable evidence assumptions;
- the historical “one outcome” visit UI when current outcomes and no-order
  reason are required;
- any Salesperson screen from a pre-commercial branch that does not render the
  accepted commercial quote and invoice snapshot;
- Dogkart procurement, warehouse, receiving, returns or fulfilment concepts;
- the alternate Gagan Founder application as if it were part of current
  Salesperson Wave 2;
- alternate Gagan onboarding migrations without a product decision;
- a configurable widget home or a second dashboard system;
- offline financial order submission.

## E. Genuinely missing or incomplete

The following are actual missing or depth gaps, not reasons to copy the Field
Ops branch:

1. A bounded persistent read cache for operational data such as the latest
   Today payload, route, assigned retailers and safe retailer history.
2. A unified manager exception view combining day state, route completion,
   collections, overdue attention and service issues.
3. A complete survey-as-task contract with answer storage and reminders.
4. A complete push/broadcast/offer scheduler and provider contract.
5. A task-specific merchandising image contract, if the business confirms it.
6. Full current-device proof for reconnect, account switching and multi-size
   rendering.

The first two are the only technical foundation candidates that can be
started without a new ownership or money-movement decision. Surveys,
notifications, task photos, QR/payment destinations, immediate ordering for
unapproved retailers and sales returns require separate product decisions.

## Migration reconciliation

### Current schema already in the accepted branch

The current migration chain includes the field-operations tables and
constraints before the Wave 1B additions:

- 20260831165213_field_operations_workday;
- 20260901070501_performance_intelligence_proposals;
- 20260901082334_sales_org_hierarchy;
- 20260903120000_add_import_jobs;
- 20260904090000_retailer_proposal_v2_1;
- 20260907010000_single_open_visit;
- 20260907020000_order_case_weight_snapshot;
- 20260914000100_visit_outcomes;
- 20260914000200_commercial_flow;
- 20260914000300_commercial_collection_snapshots;
- 20260914000400_commercial_integrity_checks.

No duplicate Field Ops migration needs to be added. The Field Ops branch
contains the same earlier field migrations because it is the ancestor.

### Compatibility findings

- visit_outcomes is additive. Legacy visits have no inferred outcome and must
  not be rewritten from free-form notes.
- single_open_visit is an existing durable invariant. Future visit changes must
  preserve its partial unique index and route linkage.
- order_case_weight_snapshot is nullable for legacy orders and protected
  against mutation. Future billing work must use the snapshot where present and
  an explicit legacy policy where absent.
- commercial_flow is additive but introduces ownership, quote, tax, freight,
  invoice-line and payment references. Legacy ownership remains unknown; no
  historical Jain/Padam backfill is safe without source data.
- commercial_collection_snapshots and commercial_integrity_checks protect
  accepted commercial facts. They must not be bypassed by a Wave 2 UI or
  alternate service.
- ImportJob is already durable and the current apply service locks the job row,
  resumes row-level progress and prevents duplicate apply audit. No second
  importer or migration should be introduced.

### Migration rule for Wave 2

Do not create a Wave 2 migration merely to duplicate a field table that is
already present. A future persistent read cache should be a clearly scoped
mobile cache or an additive server read model, not a second route, retailer,
visit, order, quote or payment store. Any migration that would infer historical
ownership, rewrite invoice totals or make legacy null snapshots pretend to be
current values must be rejected.

## Workflow trace against current source

### Field day

The current path is:

Staff login → Today read model → Start Day → route/retailer → check-in →
activity/order/collection/issue → check-out with outcomes → End Day.

The backend has corresponding field routes and models. The route stop is linked
to the visit by the existing location service. The current source also
requires the no-order reason in the applicable no-order paths. Historical Field
Ops evidence covers the main route and leave flows; a fresh Wave 1B device run
is still a proof task, not a source gap.

### Commercial order

The current path is:

Assigned retailer → catalogue → account-scoped basket → authoritative quote →
manager freight confirmation where required → review → order submission →
combined invoice → entity-scoped collection/evidence.

Both mobile apps use the backend quote rather than client totals. A later Wave
2 field screen must not reconstruct Jain, Padam, tax, freight or outstanding
values locally.

### Retailer proposal

The current path is:

Add Retailer → governed fields/evidence → proposal submission → Admin review →
approval/rejection → withdrawal where still pending.

Immediate ordering for an unapproved proposal is not a harmless UI shortcut. It
would change customer identity, credit, SAP mapping and order eligibility.

### Exceptions

- Offline field activity and location pings are bounded and account-scoped.
- Financial order and collection submission remain online-bound.
- Evidence is private and retrieved through the accepted storage path.
- No approved Gagan procurement, receiving, return, multi-warehouse or
  multi-wave workflow exists.
- Real SAP B1, real SMS and real payment providers remain external blockers.

## Gagan SAP B1 ownership boundary

| Domain | Current authority | Evidence classification |
|---|---|---|
| Customer and retailer identity | Gagan canonical database, with SAP mapping fields | LOCAL CANONICAL plus mock mapping |
| Product, variant and ownership | Gagan canonical variant and pricing records | LOCAL CANONICAL; ownership now persisted |
| Price, GST and freight quote | Gagan commercial quote service | LOCAL CANONICAL accepted transaction snapshot |
| Stock availability | Inventory snapshots and current order guards | MOCK/SYNCED boundary; not real SAP authority |
| Order and invoice | Gagan order/invoice transaction with mock SAP outbox | LOCAL CANONICAL transaction plus mock integration |
| Payment and collection | Gagan invoice/payment allocation and ledger records | LOCAL CANONICAL; no real payment provider |
| Credit and outstanding | Gagan credit/ledger contracts | LOCAL CANONICAL with accepted invoice-scoped allocation |
| Return, procurement and warehouse operations | No approved Gagan contract | NOT IMPLEMENTED; do not import Dogkart semantics |
| SAP B1 | Connector and mock/outbox interfaces | REAL SAP B1 NOT INTEGRATED |

The reconciliation therefore does not recommend a second financial authority,
client-side price calculation, or SAP-shaped feature set inside the Salesperson
app.

## Mobile quality and Admin usability

### Mobile

The current source has native screens for Login, Today, My Day, Route,
Retailers, Retailer Detail, Catalogue, Cart, Order Review, Order Detail,
Collections, Activity/Reports, Expenses, Issues, Add Retailer, Sales Kit and
More/Profile. The current source includes the corrected viewport/inset
ownership, account-scoped session/cart behavior, durable field outbox and
commercial quote reconciliation.

Historical Moto E13 evidence exists for:

- Field Companion composition;
- route and visit;
- quantity controls;
- native commercial order/review;
- collection and evidence in the accepted Wave 1B run.

It does not constitute a fresh Wave 2 run of every current artifact. The next
device gate should be a bounded regression of the current accepted APK, not a
redesign.

### Admin

The current Admin surface has dedicated routes/pages for:

- field team and attendance;
- field planning and routes;
- expenses;
- service issues;
- collections;
- commercial configuration;
- order lifecycle;
- retailer approvals;
- locations and visits;
- sales leader/team reporting;
- imports.

It is a set of scoped operating pages rather than one fully unified manager
cockpit. This is why manager/team visibility remains PARTIAL rather than
MISSING. The correct next step is to compose existing read models and queues,
not to create a second Admin application.

## Real test and acceptance boundary

### Verified in current source or accepted evidence

- Field routes, models and screens are in the current lineage.
- Field outbox tests cover durable writes, account partitioning, corruption,
  retries and concurrency.
- Visit concurrency and outcome tests exist.
- Proposal concurrency tests exist.
- Wave 1B commercial tests cover quote, tax, freight, combined invoice,
  invoice-scoped entity split, payment replay and evidence boundaries.
- Wave 1B documented acceptance reports native two-app quote/review and hosted
  commercial/R2 behavior.
- Current branch is clean and the accepted tag points to the recorded
  checkpoint.

### Not freshly verified by this audit

- current Wave 1B APK on Moto E13 for every field screen;
- current hosted route/leave/collection persona setup;
- multi-size keyboard and bottom-nav rendering;
- continuous/background GPS;
- a survey or push-notification contract;
- an unapproved-retailer order path;
- return workflow;
- real SAP, SMS or payment provider behavior.

These are not silently treated as failures. They are proof gaps, product gaps
or external integration boundaries as classified above.

## Reusable Distribution OS extraction

The reusable parts are contracts and invariants, not a copied Gagan UI:

1. Scoped field identity: staff account, manager hierarchy, operation
   capability and server-resolved scope.
2. Workday state: start/end session, route date, route-stop linkage and
   auditable activity.
3. Operational timeline: typed activity with retailer/order/collection/issue
   links and optional follow-up.
4. Bounded offline writes: durable, account-partitioned, idempotent
   activity/location queue with honest failure states.
5. Commercial quote boundary: server-authoritative prices, tax, conversion,
   freight and accepted revision.
6. Financial transaction boundary: one invoice can retain line-level legal
   ownership while payment allocation remains invoice-scoped and explicit.
7. Evidence boundary: private object storage, signed retrieval, actor and
   reference metadata.
8. Admin operating surfaces: queue, decision, scope, audit and exception views
   backed by the same domain services.

Gagan-specific elements that must not be generalized without mapping are the
Jain/Padam legal ownership, SAP B1 mapping, retailer proposal/KYC policy,
current collection semantics and the intentional absence of warehouse
fulfilment.

## Prioritized gaps

### Must build or harden before broader Wave 2

1. A bounded persistent mobile read cache for Today, route, assigned retailers
   and safe history, with explicit freshness and invalidation rules.
2. A unified manager exception read model/page composed from existing
   attendance, route, collection, issue and attention services.
3. A current-device regression harness for account switch, reconnect, keyboard,
   route, visit and order-detail visibility.
4. Target and achievement consistency checks that preserve historical events
   while avoiding stale active achievement display.
5. Explicitly document the current online-only boundary for order and
   collection writes in the mobile UI.

### Needs UAT only

- attendance/day/leave current-device run;
- route and visit outcome current-device run;
- follow-up custom-date run;
- current Add Retailer and withdrawal run;
- current Sales Kit and issue-search run;
- current Reports/target/achievement run;
- cross-screen Need Attention run;
- current collection receipt and private-evidence run;
- Moto E13 account-switch and reconnect run;
- 360, 390 and 430 class layout run.

### Needs a business decision first

- mandatory WhatsApp verification and its provider/consent policy;
- company QR/payment destinations and SAP account ownership;
- ordering for unapproved/pending retailer proposals;
- survey answer/reminder ownership;
- push/broadcast/timed-offer delivery policy;
- task photo retention and review contract;
- dedicated two-entity ledger presentation if it goes beyond current
  invoice-scoped reporting.

### Defer / Phase 2

- sales returns and financial return disposition;
- full offline order submission;
- background/continuous GPS;
- procurement, receiving, warehouse and multi-wave fulfilment;
- configurable home widgets, referrals and gamification expansion;
- real SAP B1, real SMS and real payment-provider integration.

## Proposed next 25 tasks

These are a plan only. No task was implemented by this audit.

1. Freeze current Wave 1B quote, invoice, payment, evidence and account
   boundary contracts as Wave 2 non-regression fixtures.
2. Define mobile read-cache object allowlist and freshness metadata.
3. Add cache invalidation rules for logout, account switch, 401 and stale
   commercial quote state.
4. Add source-level tests for cache partitioning and legacy-cache rejection.
5. Persist or safely restore latest Today and route read payload where current
   architecture permits.
6. Add a cache indicator and honest stale/offline messaging.
7. Build a manager exception read-model specification from existing endpoints.
8. Verify manager hierarchy and field scope for attendance, route, collection,
   issue and overdue retailer data.
9. Compose current Admin team view without changing existing mutation
   permissions.
10. Add authenticated manager UAT cases for each scoped exception.
11. Add achievement consistency regression for target changes and history.
12. Run current Moto E13 field-day, route, visit and EOD regression.
13. Run current Moto E13 reconnect and account-switch regression.
14. Run current Moto E13 retailer detail, order detail and collection
   visibility regression.
15. Run current Moto E13 Add Retailer, withdrawal and evidence regression.
16. Run current Moto E13 Reports, target and achievement regression.
17. Run current Moto E13 issue search, task and expense regression.
18. Run small, typical and large Android layout classes.
19. Reconcile proof-only discrepancies without changing accepted business rules.
20. Decide whether a survey is a first-class model or a governed task subtype.
21. Decide whether notifications are in-app-only or include push/broadcast.
22. Decide the legal/payment destination model for Jain and Padam.
23. Decide the policy for ordering against pending retailer proposals.
24. Define a separate Phase 2 return contract if returns remain required.
25. Reissue a Wave 2 acceptance matrix only after the above evidence and
   decisions are recorded.

## Unintegrated work disposition table

| Product | Worktree/branch | Capability | Current product has equivalent? | Existing implementation quality | Integration risk | Recommended disposition | Priority |
|---|---|---|---|---|---|---|---|
| Gagan | /Users/tanutejas/Documents/Gagan-field-ops-completion-v1 / codex/gagan-field-ops-completion-v1 | Attendance, route, visits, leave, tasks, issues, expenses, Sales Kit | Yes; branch is an ancestor of current Wave 1B | Committed source is already integrated; one untracked historical closure doc remains | Low for source, high only if copied blindly over Wave 1B mobile/commercial files | KEEP_CURRENT; retain branch as historical evidence reference | High |
| Gagan | origin/codex/gagan-p0-integrity-hardening | Offline, Admin state, visit, UOM, import hardening | Not fully; diverged P0 branch has unique commits not in current Wave 1B | Source-level corrections exist but branch diverges at 43ffa7f; not part of Wave 2 field lineage | High if merged without ancestry-aware review; could collide with Wave 1B commercial work | MANUAL_RECONCILE in separate P0 hardening scope; do not port during Wave 2 audit | High |
| Gagan | /Users/tanutejas/Documents/Gagan-CURRENT / codex/gagan-current | Older canonical UI and shared app files | Superseded by current Wave 1B checkpoint for this audit | Dirty with UI edits and remote branch gone | High provenance and regression risk | KEEP AS ARCHIVE/REFERENCE; do not merge | Medium |
| Gagan | origin/feature/founder-pulse-quiet-instrument | Founder daily brief and management pulse | No accepted equivalent in current Salesperson product | Separate Founder product work with its own UI and contract | High; alternate Founder backend/UI lineage is not current Gagan Salesperson | DEFER; product decision and contract rebase required | Medium |
| Gagan | origin/feature/sales-retailer-form-24 | Alternate onboarding/proposal implementation | Partial equivalent exists in current controlled proposal | Existing implementation is a competing proposal contract, not a drop-in patch | High migration/API/schema collision risk | PRODUCT DECISION REQUIRED; do not merge migrations | High |
| Gagan | origin/codex/data-import-center-v1 | Import templates and Import Center UI | Yes; current Wave 1B contains importer contract and apply ownership | Earlier UI/source is superseded by current import service and accepted Admin | Medium if copied over commercial/Admin state | KEEP_CURRENT; port only isolated template improvements after review | Low |
| Gagan | origin/codex/admin-operational-instrument-v1 | Admin operating/instrument UI | Equivalent scoped Admin pages exist | Useful historical Admin composition, not current accepted runtime | Medium visual/route regression risk | REBASE/PORT selected read-only composition only after founder approval | Medium |
| Gagan | origin/codex/gagan-salesperson-v2-2-material-motion | Material/motion visual refinement | Current Wave 1B already has approved visual baseline | Separate visual experiment; not part of current Wave 1B acceptance | High if visual changes alter frozen template or touch geometry | DROP for Wave 2 capability reconciliation; keep only as historical reference | Low |

## Consolidation plan

Do not perform this consolidation as part of the audit.

1. Keep gagan-staging-wave1b-commercial-v1 and the approved Wave 1B source
   immutable as the current commercial reference.
2. Keep codex/gagan-field-ops-completion-v1 as historical evidence only; it has
   no unique committed field source to integrate.
3. Resolve the separate Gagan P0 hardening branch in its own safety review
   before any Wave 2 work depends on it. Do not infer from its documentation
   that its unique commits are already in Wave 1B.
4. Make a product decision on the alternate onboarding/proposal contract before
   comparing migrations or API shapes.
5. Keep Founder pulse work separate until its backend contracts are rebased or
   explicitly abandoned.
6. Keep Admin/Data Import visual experiments separate from accepted runtime
   until a bounded port is reviewed.
7. Use current Wave 1B branch as the only Wave 2 implementation base.
8. After Wave 2 acceptance, archive or clean up old worktrees only after source,
   evidence, APK and deployment provenance is preserved. No worktree should be
   deleted merely because it is not current.

## Final decision

**SAFE TO START WAVE 2 IMPLEMENTATION: YES**

The exact first implementation slice should be:

> **Wave 2.1 — bounded, account-scoped operational read cache and current
> Today/route fallback, with no change to commercial order, payment, invoice,
> quote, evidence, visit or permission contracts.**

Before coding that slice, lock the cache allowlist, freshness behavior,
logout/account-switch invalidation and stale-data disclosure. Then add the
manager exception read-model work only after the cache contract is tested.

The historical Field Ops branch should not be merged. The accepted Wave 1B
branch remains the source of truth.

**Production:** not assessed as ready by this audit.\
**Hosted deployment:** not performed.\
**Data mutation:** none.\
**Dogkart:** not modified or used as proof.\
**Frozen Salesperson tag:** unchanged.
