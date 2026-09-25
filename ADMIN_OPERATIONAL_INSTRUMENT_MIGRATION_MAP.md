# Operational Instrument migration map

## Route inventory

The Admin currently declares 28 route entries in `admin/src/App.tsx`, including
the permission-aware navigation routes, detail routes, compatibility redirect,
no-access state, and wildcard fallback. The shared shell system is applied to
all routes. The new structural visual language is concentrated on Work/Home
and Orders as required by this pass.

| Route | Current functional surface | Migration treatment | Data boundary |
| --- | --- | --- | --- |
| `/` | Work / Home | Operational Instrument Home: command strip, flow map, impact view, pace sparkline, ageing, priority queue, movement | Existing order queues plus existing approvals, collections, proposals, expenses, issues, leave, SAP status |
| `/orders` | Orders queue + selected order | Operational Instrument queue, lifecycle rail, queue health, table, selected workspace, health matrix, journey, timeline, action dock | Existing `api.orders(status)` payloads and existing order mutations |
| `/warehouses` | Compatibility entry | Preserved redirect to `/sap`; no new warehouse module invented | Existing route behavior |
| `/sap` | SAP sync/outbox | Shared shell, table/status/error/loading grammar; SAP remains a system context | Existing SAP status/outbox APIs |
| `/approvals` | Approval queue/detail | Shared shell, typography, table, semantic status, loading/empty/error treatment | Existing approval APIs |
| `/collections` | Collection submissions | Shared shell and semantic treatment | Existing collections APIs |
| `/credit-reviews` | Credit/rating/KYC review | Shared shell and semantic treatment | Existing credit, shadow, and KYC APIs |
| `/kyc` | KYC cases | Shared shell and semantic treatment | Existing KYC APIs |
| `/recovery` | Recovery cases | Shared shell and semantic treatment | Existing recovery APIs |
| `/legal` | Legal escalation | Shared shell and semantic treatment | Existing recovery/legal APIs |
| `/retailers` | Retailer list | Shared shell, tables, forms, status, and empty/error treatment; no page-specific redesign | Existing retailer APIs |
| `/ledger` | Ledger list | Shared shell, tables, numeric alignment, status, and empty/error treatment | Existing ledger APIs |
| `/ledger/:retailerId` | Retailer ledger detail | Shared shell and detail treatment | Existing ledger API |
| `/catalog` | Product catalog/pricing | Shared shell, tables, forms, and status treatment | Existing products, tiers, and pricing APIs |
| `/staff` | Users and roles | Shared shell, tables, forms, and status treatment | Existing staff and roles APIs |
| `/staff/:staffId` | Staff access detail | Shared shell and detail treatment | Existing staff, roles, and delegation APIs |
| `/corrections` | Financial corrections | Shared shell and financial table/form treatment | Existing correction APIs |
| `/locations` | Store locations/history | Shared shell and map/location state treatment | Existing location APIs |
| `/visits` | Sales visits | Shared shell and table/filter treatment | Existing visit APIs |
| `/sales-leader` | Sales leader | Shared shell and existing performance visual treatment | Existing sales-leader API |
| `/sales-organisation` | Sales organisation | Shared shell and hierarchy/table treatment | Existing organisation APIs |
| `/retailer-approvals` | Retailer proposals | Shared shell and queue/status treatment | Existing proposal and tier APIs |
| `/field-team` | Field team/leave/positions | Shared shell and operational table treatment | Existing field-team, leave, and position APIs |
| `/field-planning` | Routes/tasks/targets | Shared shell and planning/form treatment | Existing route, task, staff, retailer, and target APIs |
| `/field-expenses` | Expense queue | Shared shell and finance/status treatment | Existing expense APIs |
| `/service-issues` | Service issues | Shared shell and issue/status treatment | Existing service-issue APIs |
| `/no-access` | Permission empty state | Preserved, with calm explanatory empty state | Auth/permission context |
| `*` | Fallback | Preserved redirect to the first permitted route | Router only |

## Shared propagation

The new shell in `admin/src/App.tsx` supplies the Gagan identity, Operations
console label, permission-aware navigation, current-page breadcrumb, staging
read-only indicator, user avatar, and stable auth-loading workspace. The
binding CSS in `admin/src/index.css` supplies the shared visual tokens and
fallback styling for all existing Admin pages without changing their API
contracts.

The reusable primitives in
`admin/src/components/OperationalPrimitives.tsx` are intentionally small:
`SectionLabel`, `Icon`, `Sparkline`, `FlowMap`, and `AgeDistribution`. They are
used by the redesigned reference surfaces and are available for future Admin
work only under the locked grammar.

## Canonical source and mutation boundary

No additive backend read model or new business field was added. Home derives
its flow, impact, pace, ageing, priority, and movement views from order queues
and the existing Admin work-queue endpoints already available in `api.ts`.
Orders derives its lifecycle rail and queue health from the existing status
queues. Existing order actions (approve, reject, pack, route assignment, and
POD) remain wired to the existing handlers and were not rewritten.

The page names and visual structures are new; the business truth is not.
