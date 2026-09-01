# Sales hierarchy — rollout audit

## What changed, and why this document exists

Managers now see only the people inside their reporting tree. That is the
intended behaviour and it is what makes the manager screens correct. It also
means that on the day this ships, **a manager whose `managerId` links have not
been populated sees nothing**, and that will look like an outage rather than a
configuration gap.

This document is how you avoid that. It is generated, not hand-written:

```bash
npm run check:sales-org-readiness -- --report
```

Point it at whichever database you are about to deploy against:

```bash
DATABASE_URL='<staging connection string>' npm run check:sales-org-readiness -- --report
```

## Scope of this audit

**The hosted staging Postgres was not reachable from this machine.** Render
injects `DATABASE_URL` into the service and does not expose it in the
repository, so the numbers below are from the **local development database**
seeded from the same `prisma/seed.ts` plus `scripts/seedStagingHierarchy.ts`.
The staging API itself is up (`/health` → 200), but its database is not
queryable from here.

Run the command above against staging before deploying. It is the same script,
and its output is the same table.

## Audit — local database, four-level fixture applied

```
ACTIVE FIELD STAFF                 5
MANAGERS                           3
SALESPERSONS                       2
UNASSIGNED STAFF                   1
  of which top-level leaders       1
  of which floating                0
DISCONNECTED STAFF                 0
INVALID MANAGER REFERENCES         0
CYCLES                             0
RETAILERS WITH UNASSIGNED SALES REP 0
```

| Employee | Role | Current managerId | Manager name | Direct reports | Depth | Retailers | Unassigned? |
|---|---|---|---|---|---|---|---|
| Vikram Sethi | field_manager | null | — | 1 | 0 | — | yes (top of tree) |
| Sunita Rao | field_manager | `9a3528ea…` | Vikram Sethi | 1 | 1 | — | no |
| Deepak Iyer | field_manager | `829ddef7…` | Sunita Rao | 2 | 2 | — | no |
| Ravi Kumar | salesperson | `8fa9f945…` | Deepak Iyer | 0 | 3 | 9 | no |
| Priya Deshmukh | salesperson | `8fa9f945…` | Deepak Iyer | 0 | 3 | **0** | no |
| Ops Admin | platform_admin | null | — | 0 | 0 | — | yes (not a field role) |

## Findings

### Structural — none

No cycles, no self-management, no dangling manager ids, no disconnected
branches. Two of these are additionally impossible by construction:

- **Invalid manager references** cannot occur: `StaffUser.managerId` is a real
  foreign key with `ON DELETE SET NULL`. Postgres rejects a manager id that
  points at nobody, and deleting a manager detaches their reports rather than
  orphaning them. The check still looks, because a restore from a dump taken
  before the constraint would not be caught by anything else.
- **Cycles are rejected at write time** by `validateManagerAssignment`, which
  walks the prospective manager's chain before committing. They remain possible
  through direct SQL, which is why the check looks for them and why the runtime
  CTEs carry a path guard.

Verified by injecting a real cycle into the database and confirming the check
exits non-zero, then removing it and confirming it exits zero.

### Operational — two, neither blocking

**1. `Ops Admin` is not in the hierarchy.** Correct as it stands: they hold
`platform_admin`, which carries `org.view_all`, so their access does not come
from a reporting line. Listed as unassigned because they genuinely have no
manager, not because anything is wrong.

**2. `Priya Deshmukh` owns zero retailers but carries a ₹4,00,000 target.**
Pre-existing in the seed, unrelated to hierarchy, and it makes her permanently
0% achieved on every manager screen. Worth fixing in the fixture data before a
demo, because it reads as a broken dashboard rather than as an unstocked book.

### Roles that should probably be in the hierarchy but are not

`field_collector` holds field permissions and is treated as field staff by the
readiness check, but no employee currently holds it. If collectors are hired,
they need reporting lines like anyone else — the check will list them as
floating until they have one.

`credit_team`, `credit_team_lead`, `accounts`, `dispatch` and `sales_coordinator`
are deliberately **outside** the sales reporting tree. Their permissions are
functional rather than territorial, and none of them read team-scoped surfaces.
Leave them unassigned.

## Rollout procedure

1. Run the readiness check against staging. Fix anything structural.
2. Populate reporting lines in **Admin → Sales organisation** *before* the
   deploy, not after. The `managerId` column already exists in production
   (the migration is additive and shipped separately), so the org chart can be
   built while the old unscoped behaviour is still live.
3. Re-run the check. Confirm `floating` is 0 and no `field_manager` is listed as
   having no reports.
4. Deploy.
5. Spot-check one manager at each level and confirm they see their own team.

Step 2 is the whole point. Everything else is verification.

## What the check will not do

It will not assign anybody. Reporting lines are an organisational fact that only
the business knows; guessing them from territory strings, order history or name
similarity would produce a chart that looks populated and is wrong, which is
worse than one that is visibly empty.
