# Tenancy — the current invariant and the future boundary

## The invariant today

**One Gagan deployment serves exactly one company.**

There is no tenant, company or organisation column anywhere in the schema, and
`AppConfig` is a single row with the literal id `"singleton"`. Nothing in the
product is multi-tenant, and nothing pretends to be.

This is not being changed. Introducing tenancy now would touch every model and
every query for a requirement nobody has yet.

## Why it is written down

The hierarchy brief asked that a manager and their reports belong to the same
company. Today that is **trivially true** — there is only one company — so the
rule is satisfied by construction rather than by a check. Someone reading
`validateManagerAssignment` and finding no tenant comparison should know it was
considered, not overlooked.

## Where the boundary would go

Reporting scope already funnels through one place, which is what makes the
future change small. Two functions, one file each:

| Function | File | What it would gain |
|---|---|---|
| `validateManagerAssignment` | `backend/src/modules/org/hierarchyDomain.ts` | reject an assignment when employee and manager differ in tenant |
| `ScopeResolver.resolve` | `backend/src/modules/org/scope.ts` | intersect the resolved scope with the caller's tenant |

Every module that reads team-scoped data — attendance, leave, routes, tasks,
expenses, issues, targets, opportunities, proposals, the sales-leader read
model — receives an already-resolved `staffIds` list and never re-derives it.
None of them would change. That is the property worth preserving: **no module
may resolve scope for itself.** The moment one does, tenancy stops being a
two-file change.

The recursive CTEs would additionally need a tenant predicate in both the anchor
and the recursive term, so a tree could never be walked across a boundary even
if a bad edge existed.

## What would still be a real programme

The boundary above covers *authorisation*. Actual multi-tenancy also needs a
tenant column on every root entity, tenant-aware uniqueness (`Retailer.phone` is
globally unique today and would have to become unique per tenant), per-tenant
`AppConfig`, tenant-scoped SAP identifiers, and a migration that assigns the
existing rows to a first tenant.

That is the work. The point of this note is that the *hierarchy* will not be
part of it.
