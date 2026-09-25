# Gagan — next operations plan

**Assessment only. Nothing here is implemented, and nothing here should be built
until it is separately agreed.** The purpose is to say what the system already
is, what it is not, and what the honest next increment would be.

## 1. What exists today

Gagan is currently a **demand-side** system. It is strong from the retailer's
intent to the salesperson's day, and thin after the order is accepted.

| Area | State | Canonical models |
|---|---|---|
| Customer master | Solid | `Retailer`, `Tier`, `RetailerProposal`, KYC, locations |
| Catalogue and pricing | Solid | `Product`, `ProductVariant`, `PriceList`, `PriceOverride` |
| Ordering | Solid | `Order`, `OrderItem`, approvals, credit checks |
| Credit and collections | Solid | `LedgerEntry`, `Payment`, allocations, reversals, recovery, legal |
| Field sales | Solid, new | workday, routes, visits, activities, tasks, expenses, issues |
| Performance | Solid, new | `SalesTarget`, ranking, opportunities, achievements |
| Sales organisation | New this cycle | `StaffUser.managerId`, reporting scope |
| **Inventory** | **Read-only mirror** | `InventorySnapshot` — synced from SAP, never written by Gagan |
| **Warehouse** | **Not modelled** | none — only a `warehouseCode` string on `InventorySnapshot`; the admin Warehouses page renders the same read-only SAP pulse as the overview |
| **Dispatch / delivery** | **Thin** | `Delivery` holds a slot, a POD type and a nullable `routeId` **string**; there is no delivery-route, vehicle or driver model, and no picking, packing or loading |
| **Procurement** | **Absent** | no purchase order, no supplier, no goods receipt |
| **Finance** | **Partial** | receivables are real; no payables, no GL, no costing |

## 2. The gap, stated plainly

The order-to-cash chain has a hole in the middle:

```
retailer orders  →  order approved  →  ???  →  delivery recorded  →  payment collected
                                       ▲
                                   nothing here
```

Between "approved" and "delivered" there is no allocation, no pick list, no
dispatch document and no stock decrement. Inventory is a snapshot Gagan reads and
never changes, so two salespeople can both sell the last case and the system will
not notice until SAP does.

That is a deliberate and defensible position while SAP B1 remains the system of
record. It stops being defensible the moment Gagan is expected to answer "can I
promise this today?".

## 3. Assessment by area

### Warehouse operations
Not modelled at all. A warehouse exists only as a `warehouseCode` string on an
inventory snapshot; there is no `Warehouse` table, no locations, no stock ledger,
no adjustments and no cycle counts. The admin's Warehouses screen renders the
read-only SAP pulse, which is honest but is not warehouse management. Building
this means deciding
whether Gagan **owns** stock truth or continues to mirror SAP. Those are opposite
architectures and the choice cannot be deferred much longer.

### Procurement
Entirely absent, and correctly so — purchasing is SAP's today. The realistic
Gagan role is *demand signalling*: turning field-observed depletion into a
suggested indent, not issuing purchase orders.

### Inventory
The one genuine near-term risk. `InventorySnapshot` carries a `syncedAt` and the
catalogue already degrades to "stale" past a threshold, which is honest. What is
missing is **soft allocation**: reserving stock against an accepted order so the
same case is not sold twice between syncs. This is the smallest change with the
largest payoff, and it does not require Gagan to own stock truth.

### Dispatch and logistics
`Delivery` records the *outcome* — a slot, a proof-of-delivery type and capture
time, an actual weight — but not the work: no allocation, no pick, no pack, no
load. `routeId` is an untyped nullable string with nothing on the other end, so
even the route it claims is not modelled. A dispatch document tying an order to a
vehicle and a driver is the missing link. Note this is *delivery* routing and is
unrelated to `RoutePlan`, which is a salesperson's beat.

### Finance
Receivables are genuinely good: ledger, allocations, reversals, credit policy,
recovery, legal escalation. Payables, GL posting and costing are absent. They
should stay absent — that is an ERP's job, and duplicating a GL is how a
distribution app becomes an unmaintainable accounting package.

### Sales operations
Now the strongest area. With reporting hierarchy in place, the remaining gaps are
**quota planning** (cascading a national number down the tree, rather than
setting each target by hand) and **incentive calculation**, which needs a policy
decision before any code.

## 4. What the next increment should be

In order, smallest and highest-value first.

1. **Soft stock allocation.** Reserve on order acceptance, release on rejection
   or expiry. Removes the double-sell. Does not make Gagan the stock owner.
2. **Dispatch document.** Order → allocation → dispatch → delivery, so the chain
   is continuous and traceable end to end.
3. **Quota cascade.** Use the reporting tree that now exists: set a number at the
   top, split it downward, and show what is uncascaded. The read model for this
   already ships (`targets.rollup` vs `targets.assigned`).
4. **Field-signalled indent.** Turn observed out-of-stocks into a suggestion for
   whoever does buy, without Gagan issuing purchase orders.

## 5. What should not be built

- A general ledger, or anything that duplicates SAP's accounting.
- A second inventory truth, unless the decision to leave SAP is made explicitly.
- Procurement, unless purchasing genuinely moves out of SAP.
- Anything requiring background location, biometric attendance, or ML forecasting
  — all previously ruled out and none of them made more necessary by this plan.

## 6. The decision that gates everything

**Does Gagan mirror SAP's stock, or own it?**

Every item in §4 is small and safe under "mirror". Every item becomes a large
programme under "own". This plan assumes mirror, and item 1 is deliberately the
strongest thing achievable without changing that answer.
