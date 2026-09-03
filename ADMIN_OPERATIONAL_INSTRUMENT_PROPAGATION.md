# Operational Instrument propagation record

## Implemented

The approved reference system is now represented in the isolated Admin
worktree through:

- a light Gagan Operations console shell with a stable top bar and precise
  permission-aware navigation;
- system-first typography, tabular numeric display, semantic status tones,
  restrained borders, limited elevation, and visible focus indicators;
- a stable auth-loading workspace that preserves the page geometry during the
  initial refresh rather than flashing text or zero-valued content;
- a Home operating surface that reads current flow, blockage, impact, age,
  priority, and recent movement from canonical Admin endpoints;
- an Orders operating surface with a stage rail, queue-health summary, age
  distribution, operational table, selected-row instrumentation, health
  matrix, order journey, item ledger, dependency context, activity ledger,
  and sticky next-action dock;
- shared fallback styling for the remaining functional Admin routes so they
  share the same canvas, shell, typography, table, form, status, loading,
  empty, and error grammar.

## Files changed

```text
admin/src/App.tsx
admin/src/index.css
admin/src/pages/Dashboard.tsx
admin/src/pages/Orders.tsx
admin/src/pages/Login.tsx
admin/src/components/OperationalPrimitives.tsx
admin/src/components/operationalUtils.ts
```

## Explicit non-changes

- No backend, Prisma, database, SAP connector, or API contract changes.
- No business calculation, permission, approval, credit, inventory, order,
  retailer, salesperson, Founder, or mobile logic changes.
- No new analytics endpoint or data model.
- No invented trend values or copied reference-prototype values.
- No production deployment and no merge to `main`.
- No propagation into a new bespoke redesign of Retailers, Products,
  Inventory/Warehouse, Finance, Field, SAP, Users, Roles, or Configuration.

## Reference-to-functional translation

The static reference's command strip became links to existing Orders/SAP work
queues. Its business-flow map is populated by the existing order status queues.
Its pace line is a truthful SVG sparkline from exposed `createdAt` values; it
shows an intentional unavailable message when timestamps are absent. Its
impact view is a current-state distribution, not an invented financial model.
Its ageing view uses the existing order timestamps. Its selected-object view
uses existing order, retailer, line-item, delivery, and SAP fields; inventory
is explicitly labelled “Not exposed” because that detail is not in the current
order read model.

## Module propagation matrix

The matrix records the actual existing modules found in the Admin. “Shared
instrument” means the route uses the propagated shell, typography, surfaces,
tables/forms, status tokens, loading geometry, empty/error language, focus
treatment, and desktop breakpoints. “Reference structure” means the route also
uses one of the new flow/impact/age/Inspector/action patterns.

| Page | Canonical API | Primary user/job | Reference pattern applied | Primary action | Inspector use | Visualization use | Loading / empty | Responsive result | Visual QA |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Work / Home | `orders`, `approvals`, `collections`, `retailerProposals`, `fieldExpenses`, `serviceIssues`, `leaveRequests`, `sapStatus` | Ops lead: understand what moved and what needs a decision | Reference structure: command strip, flow map, impact, pace, age, priority, movement | Open next queue | Links into Orders/SAP context | Flow, SVG sparkline, impact bars, age distribution | Stable auth/data skeleton; clear SAP/queue state | 1180/980/760 breakpoints preserve reading order | PASS |
| Orders | `orders(status)` plus existing order mutations | Operations/finance/dispatch: move order safely | Reference structure: lifecycle rail, queue health, operational table, workspace | Existing approve/reject/pack/assign/POD action | Selected order workspace | Stage counts, value readout, age distribution, health matrix, journey | Stable table rows; truthful clear queue | Table remains usable; context stacks below 980px | PASS |
| Approvals | `approvals`, `approval` | Finance/approver: make a controlled decision | Shared instrument decision queue | Existing approval decision/dispute actions | Existing selected approval detail retained | Existing canonical approval facts only | Existing loading/error plus shared styling | Shared desktop table/detail reflow | PASS |
| Collections | `collections` | Accounts: verify submitted collections | Shared instrument ledger/decision queue | Existing confirm/reject collection | Existing selected submission detail | No new chart; no fabricated ageing | Existing clear/error state with shared styling | Shared table reflow | PASS |
| Credit reviews | `ratingProposals`, `shadowComparisons`, `kycPending` | Credit team: review exposure and evidence | Shared instrument risk queue/status matrix | Existing rating/KYC disposition | Existing selected review context | Existing comparison data only | Existing loading/error with semantic tones | Shared table/detail reflow | PASS |
| Retailers | `retailers`, `tiers`, credit/price mutations | Sales/admin: scan retailer account state | Shared instrument customer table | Existing tier/limit/onboard actions | Existing ledger link; no invented retailer detail route | Account values remain tabular | Existing table/loading/error treatment | Long names ellipsize; table remains readable | PASS |
| New retailers | `retailerProposals`, `tiers` | Onboarding reviewer: decide proposal | Shared instrument review queue | Existing approve/reject proposal | Existing proposal detail | No decorative chart | Existing clear/error state | Shared queue reflow | PASS |
| Organisation | `orgTree`, `orgUnassigned`, `orgStaff` | Sales leader: inspect and reassign hierarchy | Shared instrument hierarchy workspace | Existing manager assignment | Existing staff context | Hierarchy itself is the visual | Existing loading/empty/error | Hierarchy stays readable at laptop widths | PASS |
| Sales leader | `salesLeader`, ranking/opportunities, `salesTargets` | Sales leader: monitor team pace | Shared instrument metrics/table | Existing target/performance actions | Existing selected staff context | Existing performance calculations only | Existing loading/empty/error | Shared metric/table reflow | PASS |
| Catalog | `products`, `tiers`, `setPrice` | Catalog owner: inspect SKU and pricing | Shared instrument SKU table/form | Existing price update | Existing product/variant context | No new product grid/chart | Existing loading/error | Table scroll/reflow follows shared rules | PASS |
| Ledger | `retailers`, `ledger`, `recordPayment` | Accounts: inspect retailer balance | Shared instrument ledger | Existing payment recording | Retailer ledger detail route | Tabular INR values; no duplicate calculations | Existing empty/error | Dense ledger remains usable | PASS |
| Corrections | `correctionTargets`, credit-note/reversal actions | Finance: investigate corrections | Shared instrument investigation table | Existing credit note/reversal | Existing selected correction context | Canonical target values only | Existing loading/empty/error | Form sections remain compact | PASS |
| Recovery | `recoveryCases`, `recoveryTimeline`, recovery actions | Collections/legal: progress recovery | Shared instrument investigation/timeline | Existing call/promise/letter actions | Existing recovery timeline | Timeline is the visual record | Existing loading/empty/error | Detail stacks safely | PASS |
| Legal | `recoveryCases`, legal actions | Legal owner: decide escalation | Shared instrument investigation/timeline | Existing legal decision | Existing case timeline | Canonical event timeline | Existing loading/error | Detail stacks safely | PASS |
| KYC | `kycCases`, `kycCase`, KYC actions | Compliance: verify retailer evidence | Shared instrument review/inbox | Existing KYC start/upload/submit/decision | Existing case detail | Evidence state only | Existing loading/error | Form/detail reflow | PASS |
| Team & leave | `fieldTeam`, `leaveRequests`, `liveFieldPositions` | Field manager: see people/attendance | Shared instrument team table | Existing leave decision | Existing field context | Existing position/attendance data | Existing loading/empty/error | Table and context reflow | PASS |
| Routes & tasks | `routePlans`, `fieldTasks`, `salesTargets`, staff/retailers | Field manager: plan work | Shared instrument work queue/forms | Existing route/task/target actions | Existing selected plan/task context | Existing completion/target data | Existing loading/empty/error | Planning sections stack | PASS |
| Expenses | `fieldExpenses`, expense decisions | Finance/field manager: review spend | Shared instrument ledger/decision queue | Existing expense decision | Existing selected expense context | No fabricated trend | Existing loading/empty/error | Table/form reflow | PASS |
| Issues | `serviceIssues`, issue updates | Service lead: resolve store issue | Shared instrument exception queue | Existing issue update | Existing selected issue context | Status/age text only | Existing loading/empty/error | Queue/detail reflow | PASS |
| Store locations | `locations`, `location`, `locationHistory` | Ops: validate store location | Shared instrument location/detail | Existing location correction | Existing location history | Existing location data only | Existing loading/empty/error | Detail reflow | PASS |
| Visits | `visits` | Sales manager: review field activity | Shared instrument activity table | Existing filters/status review | Existing visit context | Existing visit status only | Existing loading/empty/error | Table reflow | PASS |
| Users & roles | `staff`, `roles`, delegation actions | Admin: control access | Shared instrument system administration | Existing add/suspend/role/delegation actions | Existing staff access detail | No decorative visualization | Existing loading/empty/error | Grouped forms reflow | PASS |
| SAP sync | `sapStatus`, `sapOutbox`, sync/drain/retry actions | Integration operator: keep outbox moving | Shared instrument technical operating desk | Existing sync/drain/retry actions | Existing outbox detail/context | Counts/status only | Existing safe error/unavailable language | Tables and controls reflow | PASS |

The route matrix deliberately records “PASS” for visual QA as a route-load and
shared-system verification, not as a claim that every page received a new
bespoke layout. The full structural conversion is intentionally strongest on
the three approved reference surfaces; future page-specific refinement remains
subject to the locked grammar and explicit scope.
