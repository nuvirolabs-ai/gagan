# Gagan Admin Operational Instrument V1 — Functional Regression

Date: 2026-09-03  
Branch: `codex/admin-operational-instrument-v1`  
Base: `origin/codex/gagan-staging` at `2561cb4fd6db40751b857ee6c83dea570f5c7cc4`  
Environment: local Admin at `http://127.0.0.1:5188/`, local backend at `http://127.0.0.1:4000/`

## Release conclusion

The approved Admin Operational Instrument visual work is isolated to the Admin frontend and its documentation. No backend source, Prisma schema, worker, mobile app, or canonical business-logic file changed in this branch.

The release gate is **BLOCKED for final staging replacement** because the current local/staging fixture cannot complete a positive order mutation sequence. This is an existing business/data guard, not a regression introduced by the visual work:

- `DispatchAuthorization` has zero active records in the current database.
- The only open approval is for `[FOUNDER UAT] Executive Store` / `GGN-00000493`.
- The approval step-up flow reaches the canonical decision endpoint, which returns `credit_reassessment_blocked` for that fixture.
- The redesigned Orders action reaches the canonical order endpoint, which returns `dispatch_authorization_required` when no active authorization exists.

The read-only order queue, selected-order workspace, API contract, route loading, authentication behavior, and automated regression suites remain healthy. A clean UAT identity with an eligible approval and active dispatch authorization is required before claiming the full approval → confirmed → packed → dispatch → delivery → SAP flow.

## Change-scope audit

### Intentional Admin presentation work

Changed Admin runtime files:

- `admin/index.html`
- `admin/src/App.tsx`
- `admin/src/components/OperationalPrimitives.tsx`
- `admin/src/components/operationalUtils.ts`
- `admin/src/index.css`
- `admin/src/pages/Dashboard.tsx`
- `admin/src/pages/Login.tsx`
- `admin/src/pages/Orders.tsx`

These changes establish the approved Operational Instrument shell, shared visual primitives, loading/error/empty treatment, Home visual read, Order flow/queue/Inspector composition, and the deterministic staging-only Order Pace presentation fallback.

### Documentation and screenshot evidence

The branch also contains the Admin visual audit/system/lock/migration/readiness/UAT documents and captured QA evidence under:

- `ADMIN_ALIGNMENT_AUDIT.md`
- `ADMIN_OPERATIONAL_INSTRUMENT_LOCK.md`
- `ADMIN_OPERATIONAL_INSTRUMENT_MIGRATION_MAP.md`
- `ADMIN_OPERATIONAL_INSTRUMENT_PROPAGATION.md`
- `ADMIN_OPERATIONAL_INSTRUMENT_READINESS.md`
- `ADMIN_OPERATIONAL_INSTRUMENT_UAT.md`
- `ADMIN_OPERATIONAL_INSTRUMENT_WORKTREE.md`
- `ADMIN_VISUAL_AUDIT.md`
- `ADMIN_VISUAL_SYSTEM.md`
- `docs/admin-alignment-qa/`
- `docs/admin-operational-instrument-qa/`
- `docs/admin-operational-instrument-reference/`

### Explicitly unchanged

The diff against the staging base contains no changes under `backend/`, `rep/`, `founder/`, Prisma schema/migrations, SAP connector code, worker code, or shared business services. The original checkout at `/Users/tanutejas/Documents/Gagan` was not reset, stashed, cleaned, or modified by this worktree.

## Order Pace data boundary

`admin/src/pages/Dashboard.tsx` first attempts a cumulative intraday series from canonical `Order.createdAt` values. The current seeded order population contains no records for the current local calendar day, so that series is unavailable in the demo state.

For local development and `VITE_APP_ENV=staging` only, the page then uses `buildStagingDemoPaceSeries(allOrders.length)`. The adapter:

- derives its final point from the current canonical order population;
- produces a deterministic, non-persisted presentation series;
- labels the value `current orders`, not `orders today`;
- shows `current view` rather than an invented comparison;
- is guarded by `import.meta.env.DEV || import.meta.env.VITE_APP_ENV === "staging"`;
- is not an API, database write, analytics read model, or business truth.

The production path cannot enter this staging branch because production builds require an explicit `VITE_API_URL` and do not set the staging environment flag. Production fake data is therefore **not possible through this adapter**.

The Home queue ageing treatment continues to derive from canonical `createdAt` timestamps. The Home system state remains qualitative (`STABLE`, `ATTENTION`, `DEGRADED`, or `UNAVAILABLE`) from the SAP outbox signal and does not invent a health percentage.

## Functional regression matrix

| Area | Existing contract exercised | Result | Evidence / note |
|---|---|---|---|
| Admin authentication | Login, invalid login, session refresh/restoration, logout | **PASS** | Valid local QA identity authenticated; invalid credentials showed `Incorrect email or password`; reload restored Orders; logout removed protected content. |
| Permissions / protected routes | Auth guard and permission-aware route loading | **PASS at route/API level** | Protected content disappeared after logout; all real Admin routes loaded while authenticated; backend permission suites passed. A separate two-role browser identity comparison was not required for this visual-only branch. |
| Work / Home | Existing queue endpoints, SAP status, canonical order population | **PASS** | Home loaded with flow, Order Pace, system state, ageing, command strip, and current queues; no console errors. |
| Orders queue | Existing `api.orders(status)` reads and stage counts/value | **PASS** | Stage rail and table matched current canonical statuses/values; `GGN-00000493` selected successfully. |
| Order Inspector / workspace | Existing `api.order(id)` read and existing action endpoints | **PASS for read path** | Selected order showed identity, health matrix, journey, blockers, related context, and activity. |
| Positive order transition | Approve → confirm → pack → assign dispatch → POD/delivery | **BLOCKED** | Existing fixture returned `credit_reassessment_blocked` in approval and `dispatch_authorization_required` in order action; zero active dispatch authorizations exist. No business workaround or direct database insertion was used. |
| Credit | Approval list, detail, step-up, decision contract | **PASS with fixture guard** | `/approvals` loaded and step-up UI completed; canonical service correctly rejected the current fixture at credit reassessment. |
| Finance / collections | Collections, ledger, correction route reads and backend finance tests | **PASS** | Routes loaded; backend finance/ledger/correction regression coverage passed. No visual branch changed financial calculations. |
| Inventory / fulfilment | Order state reads, pack/dispatch contracts, inventory backend coverage | **PASS for reads; transition blocked** | Queue and workspace loaded; positive movement is gated by the existing authorization prerequisite. |
| Retailers | Retailer list/detail route and API contract | **PASS** | Route sweep loaded `/retailers` without redirect, alert, overflow, or console error. |
| Field operations | Field team/planning/expenses/issues/locations/visits routes and backend coverage | **PASS for route/read coverage** | All implemented field routes loaded; no visual changes were made to field workflows. |
| Users / roles | Staff/roles route and backend permission coverage | **PASS for route/read coverage** | Users & Roles route loaded; backend authorization tests passed. |
| SAP mock / outbox | SAP status route and backend SAP/outbox suite | **PASS for read/contract coverage; E2E blocked** | SAP status loaded and backend SAP/outbox tests passed; a complete order-to-SAP positive mutation could not run without the existing authorization fixture. |
| Import | Existing route/module audit | **NOT APPLICABLE** | No implemented Admin import route was found in the audited route set; no import behavior was changed or claimed. |
| API/UI consistency | Queue counts, order status/value, flow and Inspector values | **PASS for observed reads** | Browser values matched the canonical API/DB snapshot for the selected order and status rail; no calculation logic was added. |

## Automated verification

### Admin

- Tests: **PASS** — 18 test files, 48 tests.
- Typecheck: **PASS** — `tsc -b`.
- Lint: **PASS** — `oxlint --deny-warnings`.
- Production build: **PASS** — TypeScript compilation and Vite build.
- Diff whitespace check: **PASS** — `git diff --check`.

### Backend

- Tests: **PASS** — 117 test files, 811 tests.
- Typecheck: **PASS** — `tsc --noEmit`.
- Production compilation: **PASS** — `tsc`.
- No backend source was changed by this Admin branch.

## Browser verification

Local Admin route sweep: **23/23 implemented routes loaded** while authenticated, with no login redirect, no alert, no horizontal overflow, expected path matching, and no captured console errors.

Audited routes:

`/`, `/approvals`, `/collections`, `/credit-reviews`, `/orders`, `/retailers`, `/retailer-approvals`, `/sales-organisation`, `/sales-leader`, `/catalog`, `/ledger`, `/corrections`, `/recovery`, `/legal`, `/kyc`, `/field-team`, `/field-planning`, `/field-expenses`, `/service-issues`, `/locations`, `/visits`, `/staff`, `/sap`.

Reference viewport evidence is stored in `docs/admin-operational-instrument-qa/` and `docs/admin-alignment-qa/`, including Home, Orders, workspace, healthy/empty states, representative route screens, and 1440×900, 1280×800, and 1024×768 captures.

The local preview should remain available at:

- Admin: `http://127.0.0.1:5188/`
- Backend health: `http://127.0.0.1:4000/health`

## Release decision

| Gate | Status |
|---|---|
| Visual redesign isolated to Admin | **PASS** |
| Business logic changed | **NO** |
| Backend business files changed | **NONE** |
| Admin automated suite | **PASS** |
| Backend regression suite | **PASS** |
| Browser navigation/read smoke | **PASS** |
| Positive order transition E2E | **BLOCKED by existing staging fixture** |
| Staging deployment replacement | **NOT PERFORMED** |
| Production/main touched | **NO** |

Do not replace the existing staging deployment or claim final client/UAT readiness until the staging team supplies or creates a clean, eligible UAT identity with the normal approval and dispatch-authorization prerequisites. No direct database mutation was performed to manufacture that prerequisite.
