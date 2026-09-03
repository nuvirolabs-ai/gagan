# Gagan Admin Operational Instrument V1 — Functional Regression

Date: 2026-09-03  
Branch: `codex/admin-operational-instrument-v1`  
Base: `origin/codex/gagan-staging` at `2561cb4fd6db40751b857ee6c83dea570f5c7cc4`  
Environment: local Admin at `http://127.0.0.1:5188/`, local backend at `http://127.0.0.1:4000/`

## Release conclusion

The approved Admin Operational Instrument visual work is isolated to the Admin frontend and its documentation. The golden-path follow-up added two narrow API/SAP integration fixes, normal-path audit events, and one staging-only mock customer mapping; no Prisma schema, worker, mobile app, or canonical business-policy file changed.

The previously blocked positive path is now **PASS locally** using the clean `[UAT GOLDEN PATH] Sunrise Stores` fixture documented in `GAGAN_GOLDEN_PATH_UAT_REQUIREMENTS.md`. The fixture satisfies the existing credit, KYC, pricing, stock, dispatch, and SAP mapping rules through normal APIs.

The run exposed and fixed two narrow integration defects: a JSON-unsafe Prisma `BigInt` in the Admin POD response and stale invoice outbox mappings on retry. Neither changed business policy, financial calculations, or state-transition guards.

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

No Prisma schema/migrations, `rep/`, or `founder/` files changed. Backend changes are limited to `backend/src/routes/admin/orders.ts` (JSON-safe POD response and normal order/dispatch audit events), `backend/src/modules/invoicing/invoiceService.ts` and `backend/src/modules/invoicing/types.ts` (delivery audit event actor propagation), `backend/src/lib/sap/outbox.ts` (current-mapping invoice retry and SAP audit events), `backend/src/lib/sap/mockConnector.ts` (staging-only UAT customer), and the delivery route regression test. The original checkout at `/Users/tanutejas/Documents/Gagan` was not reset, stashed, cleaned, or modified by this worktree.

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
| Positive order transition | Create → confirm → pack → assign dispatch → POD/delivery | **PASS** | Refreshed `GGN-00000889` completed through the normal Admin APIs with active authorization issued at allowed order creation. |
| Credit | Credit snapshot, decision, KYC/limit prerequisites | **PASS** | UAT fixture returned `allowed` with zero outstanding and sufficient credit; existing approval guard remains unchanged and was not bypassed. |
| Finance / collections | Collections, ledger, correction route reads and backend finance tests | **PASS** | Routes loaded; backend finance/ledger/correction regression coverage passed. No visual branch changed financial calculations. |
| Inventory / fulfilment | Order state reads, stock validation, pack/dispatch contracts | **PASS** | Fresh WH-001 stock and normal Admin transitions carried the UAT order through packing and dispatch. |
| Retailers | Retailer list/detail route and API contract | **PASS** | Route sweep loaded `/retailers` without redirect, alert, overflow, or console error. |
| Field operations | Field team/planning/expenses/issues/locations/visits routes and backend coverage | **PASS for route/read coverage** | All implemented field routes loaded; no visual changes were made to field workflows. |
| Users / roles | Staff/roles route and backend permission coverage | **PASS for route/read coverage** | Users & Roles route loaded; backend authorization tests passed. |
| SAP mock / outbox | Customer mapping, sales-order/invoice drain, retry | **PASS** | Mock customer sync linked `SAP-CUST-UAT-1001`; refreshed golden-path sales order recorded `MOCK-SO-000889`, DocEntry `900889`, DocNum `910889`; invoice outbox sent; second drain was empty. |
| Audit / activity | Normal order, dispatch, delivery, and SAP audit events | **PASS** | The refreshed golden-path fixture records six order-level events; the allowed credit path correctly has no approval-request decision event, while KYC approval is recorded on its KYC case. |
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
- Backend changes are limited to the response/outbox fixes, normal-path audit events, and staging-only mock mapping documented above.

## Browser verification

Local Admin route sweep: **23/23 implemented routes loaded** while authenticated, with no login redirect, no alert, no horizontal overflow, expected path matching, and no captured console errors.

Audited routes:

`/`, `/approvals`, `/collections`, `/credit-reviews`, `/orders`, `/retailers`, `/retailer-approvals`, `/sales-organisation`, `/sales-leader`, `/catalog`, `/ledger`, `/corrections`, `/recovery`, `/legal`, `/kyc`, `/field-team`, `/field-planning`, `/field-expenses`, `/service-issues`, `/locations`, `/visits`, `/staff`, `/sap`.

Reference viewport evidence is stored in `docs/admin-operational-instrument-qa/` and `docs/admin-alignment-qa/`, including Home, Orders, workspace, healthy/empty states, representative route screens, and 1440×900, 1280×800, and 1024×768 captures.

The local preview should remain available at:

- Admin: `http://127.0.0.1:5188/`
- Backend health: `http://127.0.0.1:4000/health`

## Golden-path follow-up

The full local golden-path proof is recorded in `GAGAN_GOLDEN_PATH_UAT_REQUIREMENTS.md`:

- Order created through `POST /rep/orders` with normal salesperson authentication and idempotency key.
- Admin confirmed, packed, assigned dispatch, and captured POD through the existing Admin APIs.
- POD retry returned the same invoice, proving exactly-once invoice behavior.
- Customer sync linked the UAT retailer before SAP drain.
- Sales-order and invoice outbox items were sent through `SAP_MODE=mock`.
- Final API and PostgreSQL state agree: delivered, invoice total ₹3,150, authorization used, sales order sent, DocEntry `900889`, DocNum `910889`.
- Second outbox drain returned zero attempts.
- Audit query returned `order.confirmed`, `order.packed`, `dispatch.assigned`, `delivery.completed`, `sap.sales_order_synced`, and `sap.invoice_synced` for the refreshed fixture.

The first POD call exposed an HTTP serialization defect after the transaction committed; the retry after the narrow fix returned HTTP 200 and the same invoice ID. The invoice retry path also initially exposed the stale mapping issue documented in the requirements file; the refreshed mapping was then sent once successfully.

## Release decision

| Gate | Status |
|---|---|
| Visual redesign isolated to Admin | **PASS** |
| Business policy/schema changed | **NO** |
| Normal-path audit instrumentation | **PASS** |
| Admin automated suite | **PASS** |
| Backend regression suite | **PASS** |
| Browser navigation/read smoke | **PASS** |
| Positive order transition E2E | **PASS locally with golden-path fixture** |
| Staging deployment replacement | **NOT PERFORMED** |
| Production/main touched | **NO** |

The local golden-path blocker is resolved. Staging deployment replacement still requires the branch to be pushed, safely integrated into `codex/gagan-staging`, and verified against the hosted environment. No direct database mutation was performed to manufacture business prerequisites.
