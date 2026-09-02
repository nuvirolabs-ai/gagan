# Founder app architecture

**Pulse gate.** Trends, Decisions, Settings, and briefs are specified, not built.

Founder is a **read projection** over canonical Gagan PostgreSQL. It is not a second Admin and not a second set of orders.

```
Retailer / Salesperson / Admin
        ↓
Existing Gagan backend + PostgreSQL
        ↓
Founder executive read models  (backend/src/modules/founder)
        ↓
GET /founder/pulse
        ↓
founder/  Expo app  — Pulse tab
```

One source of truth. No `FounderOrders` table.

## 1. Canonical data that exists today

| Domain | Where |
|---|---|
| Order / OrderItem | `Order`, `OrderItem` — `orderTotal` is the commercial total |
| Retailer | `Retailer` |
| Product / Variant | `Product`, `Variant`, `PriceList`, `PriceOverride` |
| Inventory | `InventorySnapshot` (local, usually sourced from mock/SAP sync) |
| Fulfilment | `Order.status`, `OrderItem.qtyDelivered`, `Delivery` |
| Payments | `Payment` (`pending`/`succeeded`/…) |
| Collections | `CollectionSubmission` (`pending`/`confirming`/`confirmed`/`rejected`) |
| Outstanding / overdue | `Invoice` + `financialAgeingFor` / `financialSummaryFor` |
| Credit | `CreditAssessment`, `CreditProfile`, `ApprovalRequest` |
| Staff / hierarchy | `StaffUser.managerId` |
| Workday | `WorkingCalendar`, `WorkdaySession` |
| Routes / visits | `RoutePlan`, `RoutePlanStop`, `SalesVisit`, `CustomerActivity` |
| Issues (ops) | `ServiceIssue` — **not** Founder Issues |
| Expenses / proposals | `FieldExpense`, `RetailerProposal` |
| SAP | `SapOutbox`, `Order.sapDocEntry` / `sapDocNum` / `sapSyncStatus` (mock today) |
| Approvals | `ApprovalRequest` + `ApprovalDecision` |
| Dispatch auth | `DispatchAuthorization` |
| Targets | `SalesTarget` (not used on Pulse V1) |

**Not implemented:** procurement, WMS, notification centre, live B1 Service Layer, scheme engine.

## 2. Pulse metrics that can be calculated truthfully

Orders, collections, fill rate, unique blocked value, active retailers, active salespeople, outstanding, overdue, dispatched, invoiced, SAP outbox failure counts, open `legal.decide` approvals.

## 3. Exact source per Pulse metric

See `FOUNDER_METRIC_DEFINITIONS.md`.

## 4. Metrics that depend on real SAP B1

Live B1 stock, B1 AR ageing, B1 DSO, posted B1 invoices as a second ledger. Mock `DocEntry`/`DocNum` are **not** treated as finance truth. Local `InventorySnapshot` is used for inventory pressure even in mock mode because checkout already uses it.

## 5. Unavailable because the module does not exist

Procurement blocked value, warehouse put-away / pick queues, logistics ETA, scheme-driven margin, notification-centre volume.

## 6. Executive read models added

`backend/src/modules/founder/` — period, metrics, blocked (with precedence), health, insights, issues preview, pulse assembly. No new Prisma models.

## 7. Caching / freshness

In-process Pulse cache, 15 seconds, keyed by calendar day. Every payload has `asOf`. `isStale` is true when inventory snapshots used for blocking are older than one hour (`INVENTORY_STALE_AFTER_MS`) or invoice coverage is missing while retailers still show cached balances (outstanding then unavailable).

## 8. Authorization

New permissions: `founder.view`, `founder.decide`.

Granted **only** to role `founder_director`.

`platform_admin` is **not** a Founder. It keeps operational permissions and does not receive `founder.*`.

Staff OTP at `/founder/auth/*` (staff realm). UI hiding is not enough; `requirePermission("founder.view")` on every Founder read.

## 9. Drilldown rules

Pulse shows company totals. Hierarchy drilldown (`StaffUser.managerId`) is deferred until after Pulse approval. Pulse insights may name a `drilldown.kind` for later wiring; V1 does not navigate it.

## 10. Known limitations

- Credit-blocked **checkout refusals** never become orders. They are assessments without `orderId` and are **not** in unique blocked value (must reconcile to open orders).
- Inventory refusals at checkout similarly never become orders.
- Fill rate is undefined until fulfilment starts.
- Company outstanding requires local invoices.
- Expense approval still does not post ledger (frozen V1 limitation).
- Real B1 is not connected.

## 11. Query / performance

One Pulse request. Bounded aggregations: orders in two day windows, collections/payments in those windows, open orders + items + open approvals + snapshots for blocking, invoice sums, workday counts, outbox failed count, founder-level approval count. No per-retailer `financialSummaryFor` loop.

## Blocked value precedence

Primary blocker per order (first match wins):

1. **CREDIT** — open or escalated `ApprovalRequest` on the order
2. **INVENTORY** — remaining unordered qty on a line exceeds `InventorySnapshot.available` (fresh snapshot)
3. **DISPATCH** — `status = packed` (authorised stock waiting to leave)
4. **SYSTEM** — `sapSyncStatus ∈ {failed, reconciliation_required}` **or** remaining qty with missing/stale snapshot

`PROCUREMENT` / `WAREHOUSE` / `LOGISTICS` are not emitted.

Headline = unique blocked value. Tests cover a credit+inventory order counted once.
