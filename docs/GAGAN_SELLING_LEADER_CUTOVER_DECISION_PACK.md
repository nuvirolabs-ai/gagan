# Selling Sales Leader Cutover Decision Pack (Read-Only Proposal)

Observed 2026-09-25 19:08 UTC through the authorized Render read-only connection:
R's workspace `tea-dajvdg0ae00c73bi74c0`, `gagan-staging-db`
`dpg-dajvi2h5efls73ags3f0-a`, database `gagan_staging_9ftt`, PostgreSQL 18.
The hosted ledger has 52 completed migrations, zero failed migrations, and eight
`SalesTarget` rows. No hosted writes were made for this proposal.

## Historical targets

All rows have period 2026-09-01 through 2026-09-30 and creator
`14fcfb77-bd1d-4458-a433-9438651505ec` (Ops Admin). `P?` means a
PERSONAL candidate, **not** an approved classification. The backfill accepts
only fully approved `PERSONAL` or `TEAM` entries, never `P?` or a null scope.

| Target ID | Owner ID / name | Metric | Value | Created UTC | Updated UTC | Proposal | Evidence and remaining ambiguity |
|---|---|---|---:|---|---|---|---|
| `cbcc647a-50fe-4cbb-84c2-891744786c09` | `c8f47dd0-be77-4809-b005-3360503e17b6` Ravi Kumar | `order_value` | 400000.00 | 09-01 14:48:38.402 | same | P? | Exact owner, metric, amount and period match the historical Ravi UAT fixture's explicit salesperson target; no hosted fixture-execution record. This is the row behind the accepted Team rollup, not a Deepak target. Approval of its historical intent is still required. |
| `f6e1cbed-f9c7-41c0-a870-e61e60e6598c` | Ravi | `visits` | 80.00 | 09-01 14:48:39.246 | same | P? | Same six-row Ravi fixture signature and creator; execution provenance/approval absent. |
| `494763bc-f0af-4560-8575-d5b7753bdd01` | Ravi | `order_count` | 24.00 | 09-01 14:48:39.802 | same | P? | Same fixture signature; execution provenance/approval absent. |
| `2652a6fe-f27e-4e2a-8aa5-8f39007d5ad5` | Ravi | `line_items` | 40.00 | 09-01 14:48:40.353 | same | P? | Same fixture signature; execution provenance/approval absent. |
| `552cb80f-1613-425b-a30c-11262c670e84` | Ravi | `productive_outlets` | 12.00 | 09-01 14:48:40.904 | same | P? | Same fixture signature; execution provenance/approval absent. |
| `894092aa-0899-412d-8194-1f1080d13259` | Ravi | `collection_value` | 150000.00 | 09-01 14:48:41.456 | same | P? | Same fixture signature; target scope does not grant collection permission. Execution provenance/approval absent. |
| `9baa2cb5-d992-4f7c-b5d7-92bcfc37fa2e` | `13a3ee63-2d9b-42b6-a2ad-d11d16973db9` Nikhil Patil | `order_value` | 400000.00 | 09-04 01:33:44.291 | 09-04 02:11:10.297 | unresolved | Creator is Ops Admin and the old Admin form was personal-oriented, but no target audit event identifies this row's writer or reason for revision. Current role/link/amount are insufficient classification evidence. |
| `e4100696-8224-4490-86a8-c7f9f26a3f07` | `5cd4a147-488e-479a-992a-5a99c9457ecb` Rahul Sharma | `order_value` | 400000.00 | 09-11 10:43:25.000 | same | unresolved | Creator is Ops Admin, but no row-specific writer/provenance or approved historical intent. Current role/link/amount are insufficient. |

Ravi's six rows match the historical `backend/scripts/seedFieldUat.ts`
`TARGETS` list and its salesperson-target upsert, including ordering and
values. `backend/prisma/seed.ts` also creates the same canonical Ravi
salesperson metrics. The hosted `AuditEvent` table contains no target event;
source similarity is evidence for a proposal, not proof that either script ran
on these exact rows. Nikhil and Rahul remain unresolved. No row is proposed as
TEAM merely to create a desired screen result. Fresh read-only evidence and
explicit row-by-row approval are needed before any backfill.

The exact drift fingerprint is SHA-256 of JSON.stringify of, in order:
`[id, salespersonId, metric, periodStart ISO, periodEnd ISO,
targetValue fixed to two decimals, createdByStaffId, createdAt ISO,
updatedAt ISO]`. The timestamps above are UTC; the hosted columns are
`timestamp without time zone`, and the observed DB session timezone is UTC.
The guarded audit produces the exact 64-character fingerprint for **every**
row after nullable expansion. The approved JSON must cover the entire fresh
row set and include each fingerprint and nonempty provenance; changed, added,
deleted or duplicate rows fail the transaction. This table is not that
approved JSON and is not an apply instruction.

## Deepak identity proposal

Hosted `StaffUser` `f411e825-59c8-4238-92b7-e2f5ec852747` is Deepak Iyer,
active, currently `field_manager` only, `salesRepId = null`, one direct report
(Ravi), and manager `1faf8778-c827-49ce-b288-d885261e113c`. The normalized
canonical phone search found **zero** `SalesRep` candidates, linked or
unlinked; this is not a name-based match. No Deepak-owned September target was
found. Subject to a fresh readback and separate approval, the proposed atomic
action is: retain this StaffUser and reporting edges, create one SalesRep using
its verified canonical phone, link it, add `salesperson`, retain
`field_manager`, and audit all writes together. Do not assign retailers,
routes, collection rights, or a fabricated target. A new or conflicting
candidate at execution time aborts setup.

## Cutover controls

The active 53rd migration is nullable expansion plus a DB trigger backed by
`TargetWriteGate`. The trigger blocks all `SalesTarget` inserts, deletes and
non-scope updates while paused, including Admin, imports, fixtures/scripts and
older clients. Activation locks `SalesTarget` in `SHARE ROW EXCLUSIVE` mode
before flipping the gate, so in-flight target writes drain. Scope-only updates
are then permitted for the approved backfill. Mapping is re-read and compared
after the gate is active. Release the gate only after readback and API
compatibility; a failed validation leaves the gate on until an explicit
recovery decision. Non-target operations were not promised or tested as
unaffected by this lock.

The final NOT NULL/scoped-uniqueness SQL is held at
`backend/prisma/held_migrations/20260925160000_sales_target_scope_constraints/migration.sql`,
outside Prisma's active migration directory. Render's current start command
is `npx prisma migrate deploy && npm start`; placing the contract in that
directory now would let an ordinary start apply it before approved backfill.
The approved hosted cutover must run expansion, guarded mapping/backfill, and
the held contract in that order, then promote/record the contract as an active
Prisma migration under a separately reviewed source/ledger step. Application
code rollback alone is unsafe once two scopes coexist. Recovery needs the
then-current verified PITR point and fresh logical export; neither is
authorized or refreshed by this local task.

## Older APK policy

Read-only Moto E13 inspection on 2026-09-26 found installed
`com.gagan.sales.review` version 1.0.25/code 25. A read-only pull of its
installed APK had SHA-256
`c9ce7e0a7f4652dce606a115d0571b9289e0dd19ca54637c62e7fa712d9e0827`.
Its Hermes bundle contains the existing account-scoped operational cache key
`gagan.rep.operational.v1.` and `/rep/sales-leader`, but no
`targetScopeVersion` marker. The numeric cache limits below come from the
matching source implementation, not from a decompiled bytecode proof. The
phone was not launched, installed to, or cleared.

The existing operational read cache is account/API-origin partitioned, capped
at four partitions and 512 KiB, and expires Today after 12 hours. The updated
client requires `targetScopeVersion: 2` for a cached Today response and clears
only an incompatible Today snapshot; route data, outbox and session survive.
The existing installed APK cannot run this new invalidation logic. The new
backend therefore keeps legacy Today responses PERSONAL-only and never
substitutes a TEAM target. An old offline snapshot can persist until its
12-hour expiry; do not enable selling-leader mode on that APK. Require a
compatible in-place app update and fresh online identity/Today read before
physical selling-leader acceptance. No device data is to be cleared.
