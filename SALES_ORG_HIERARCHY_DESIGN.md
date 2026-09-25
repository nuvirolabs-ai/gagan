# Sales organisation hierarchy — design

Status: design accepted, implemented in this session.
Audited against commit `6373acf` (backend 676 / retailer 31 / salesperson 77 / admin 37 green).

## 1. The existing employee model

`StaffUser` is already the canonical employee. Everything operational hangs off it:

| Concern | Link |
|---|---|
| Identity / login | `phone`, `email`, `employeeRef`, `status`, `DeviceSession.subjectId` |
| Authorisation | `StaffRole` → `Role` → `RolePermission` → `Permission`, plus `RoleDelegation` |
| Field work | `SalesVisit`, `WorkdaySession`, `LeaveRequest`, `RoutePlan`, `CustomerActivity`, `FieldTask`, `LocationPing`, `FieldExpense`, `ServiceIssue` |
| Commercial | `SalesTarget`, `RetailerProposal` |
| Customer ownership | `StaffUser.salesRepId` → `SalesRep` → `Retailer.salesRepId` |
| Admin portal | `StaffUser.adminUserId` → `AdminUser` |

Two things follow, and they decide the whole design:

1. **There is exactly one employee model already.** `SalesRep` is not a second one — it is the
   commercial identity an order is attributed to (`Order.placedByRepId`) and the key retailers are
   assigned by. `AdminUser` is a portal credential. Both are *satellites* of `StaffUser`, which is
   the person.
2. **Both apps already resolve to a `StaffUser` id.** The salesperson app authenticates in the
   `staff` realm; `requireAdminIdentity` looks the admin session up and sets
   `req.staffAuth.staffId`. So a reporting tree anchored on `StaffUser.id` is immediately usable on
   every existing route without a new identity concept.

**Tenancy.** There is no tenant or company column anywhere in the schema, and `AppConfig` is a
`singleton` row. This deployment is single-tenant. "Manager and employee in the same tenant" is
therefore trivially true today; the design keeps a single choke point (`assertAssignable`) where
that check will live when tenancy arrives, and does not invent a tenant model now.

## 2. Current manager-scope limitations

The manager surfaces added in the last two sessions are permission-gated but **not scope-gated**:

| Surface | Today | Consequence |
|---|---|---|
| `AttendanceService.teamAttendance` | every active staff with a `salesRepId` | any `attendance.review` holder sees the whole company |
| `AttendanceService.listLeave` | all leave, filtered only by status | same |
| `ExpenseService.list` | all expenses | same for `expense.review` |
| `IssueService.list` | all issues | same for `issue.review` |
| `TaskService.list` / `RouteService.listPlans` | all | same for `route.manage` |
| `RetailerProposalService.listForReview` | all proposals | same |
| `SalesLeaderService.load` | filtered by `salesRep.territory` **string** | a free-text field, not a reporting relationship |
| `RankingService` | `territory` \| `company` | no notion of "my team" |

`territory` is the only grouping that exists and it is a nullable free-text column on `SalesRep`. It
cannot express depth, it has no owner, and two managers working the same territory are
indistinguishable. Approval routes are worse than the read routes: `decideLeave`, `decide` (expense)
and `approve` (proposal) check only that the reviewer is not the subject — any review-permission
holder can decide for anyone.

## 3. Proposed hierarchy model

One nullable self-relation on the existing employee model:

```prisma
model StaffUser {
  managerId     String?
  manager       StaffUser?  @relation("StaffReporting", fields: [managerId], references: [id], onDelete: SetNull)
  directReports StaffUser[] @relation("StaffReporting")
  @@index([managerId])
}
```

Why this shape:

- **No parallel model.** A reporting line is a property of the employee, not a new entity.
- **Arbitrary depth.** National → Regional → Area → Officer → Salesperson is four edges; the schema
  has no opinion about how many there are, and no title appears anywhere in logic.
- **Titles stay cosmetic.** Roles carry permissions; the edge carries reporting. Priya can be moved
  under Amit with no role change, and a role rename never moves anybody.
- **`onDelete: SetNull`.** Removing a manager orphans their reports to the top rather than blocking
  the delete or cascading a deletion of people.

Invariants, all enforced server-side in one place:

| Invariant | Enforcement |
|---|---|
| No self-management | `managerId !== id` |
| No cycles | walk the prospective manager's chain; reject if the employee appears in it |
| Manager exists and is active | `status = active` lookup; a suspended/revoked manager cannot be assigned |
| Top of tree allowed | `managerId = null` is valid and normal |
| Same tenant | single choke point, no-op while single-tenant |
| Auditable | every change writes an `AuditEvent` |

## 4. Recursive team resolution

PostgreSQL recursive CTE, one query, arbitrary depth, cycle-guarded by an accumulated path:

```sql
WITH RECURSIVE tree AS (
  SELECT id, "managerId", 1 AS depth, ARRAY[id] AS path
    FROM "StaffUser" WHERE "managerId" = $1
  UNION ALL
  SELECT s.id, s."managerId", tree.depth + 1, tree.path || s.id
    FROM "StaffUser" s
    JOIN tree ON s."managerId" = tree.id
   WHERE NOT s.id = ANY(tree.path)     -- a corrupt edge cannot spin forever
     AND tree.depth < $2               -- hard depth ceiling
)
SELECT id, depth FROM tree;
```

The `path` guard means even if a cycle were somehow written directly to the database, resolution
terminates rather than hanging a manager's dashboard. Ancestors use the mirror-image CTE.

Canonical service (`HierarchyService`), used by every module — nobody re-implements this:

- `getDirectReports(managerId)`
- `getAllReports(managerId)` — every descendant, one query
- `getManagementChain(employeeId)` — nearest manager first
- `isInReportingTree(managerId, employeeId)`
- `getManagerTeamRetailers(managerId)` — derived, see §5
- `setManager(...)` — validated + audited

## 5. Retailer ownership

`Retailer.salesRepId` stays the one and only assignment. Manager scope is **derived**, never stored:

```
manager → reporting tree (StaffUser ids)
        → their salesRepIds
        → Retailer.salesRepId IN (…)
```

Moving a salesperson under a different manager changes both managers' retailer scope on the next
read, with no backfill and nothing to keep in step.

## 6. Permission implications

Hierarchy does **not** replace permissions; the two compose:

```
may act = holds the permission  AND  subject is inside the caller's scope
```

Scope resolves to one of:

- **org-wide** — caller holds `org.view_all` (platform admin). Unrestricted.
- **tree** — caller holds the domain permission. Scope = self + all descendants.
- **self** — no review permission. Scope = self only.

Rules:

- A manager with `attendance.review` reviews attendance for their tree only.
- A manager with `expense.review` but *not* `attendance.review` still cannot read attendance —
  scope never grants a domain.
- Employee ids from the client are filters, never grants: an out-of-scope id yields 404/403, and an
  absent id means "my whole scope", resolved server-side.
- Self-approval stays impossible independently of scope.

## 7. Migration strategy

One additive migration: a nullable column, a self-FK and an index. No backfill — every existing
employee starts at the top of the tree, which is exactly today's behaviour (nobody has a manager).
Reversible by dropping the column. No data is rewritten, so it can ship ahead of any org being
modelled.

Behavioural note, called out because it is a real change: once the code ships, a review-permission
holder with **no** reports sees only themselves where they previously saw everyone. That is the bug
being fixed, but it means the org must be populated before managers regain their lists. The admin
Sales organisation screen exists for exactly that.

## 8. API changes

- `GET /admin/org/tree`, `GET /admin/org/unassigned`, `GET /admin/org/staff/:id` (chain, reports,
  manager history), `POST /admin/org/staff/:id/manager` — all behind `org.manage` / `org.view_all`.
- Every existing manager read gains server-derived scope. No route accepts a "team id".
- `GET /admin/sales-leader` scopes to the caller's tree; `?salespersonId=` narrows within it.
- Ranking gains a `team` scope.

## 9. UI changes

- **Admin → Sales organisation**: indented tree, unassigned list, reassignment with cycle
  validation, per-employee manager history.
- **Admin → Sales leader**: the caller's real team; at-risk list opens the employee.
- **Admin → Team member detail**: today, performance, retailers, routes, visits, activities, tasks,
  expenses, issues — each only if the caller holds that permission.
- Manager-facing lists (leave, expenses, issues, proposals) show scoped data with no UI change
  needed beyond what the server returns.

## 10. Performance strategy

- Team resolution is **one** recursive CTE, not one query per level.
- Resolved once per request and passed down; modules take `staffIds`, never a manager id to re-resolve.
- The existing bounded-query work is preserved: `TargetService.bulkActuals` stays 4 grouped queries
  for a whole team, and `OpportunityService` stays 4 for a whole book.
- Benchmark fixture (not seeded): 1 national head, 5 regional, 25 area, 300 salespeople, 20 000
  retailers. Asserts query *counts* stay constant as the team grows — the regression that matters.

## 11. Test strategy

Pure domain (cycle detection, chain, tree shaping) as unit tests; service behaviour against a fake
Prisma; scope and authorisation against real PostgreSQL through the HTTP layer, because that is the
only place the permission middleware, the scope resolver and the query all run together.

Specifically: no manager; direct; nested; multi-level; self-management rejected; cycle rejected;
inactive manager rejected; reassignment; manager A cannot see manager B's team; salesperson cannot
see peers; missing permission still blocked; org-wide sees all; retailer derivation follows a move;
target aggregation; projection unchanged; opportunity aggregation; self-approval still blocked;
reviewer scope enforced on every decision route; and the full existing suite green.
