# Jain / Padam dynamic routing — current flow audit

**Audited source:** `codex/gagan-jain-padam-routing-v1` at
`fadc6d8b70cb39ab5a1f93b395572a9e19f6fcd6` (clean; exact pushed routing
acceptance checkpoint).

**Business source:** the byte-preserved DOCX in
`/Users/tanutejas/Documents/GAGAN/CURRENT/DOCS/Commercial/SOURCES/`.
Its SHA-256 is recorded in `BUSINESS_DECISIONS.md`.

## Current supported path

```text
Retailer cart                         Salesperson retailer flow
      |                                       |
      +------ POST /commercial/quotes --------+
             or /rep/commercial/quotes
                              |
                    commercial.quoteFor
                              |
          retailer.deliveryCity + Variant routing metadata
                              |
             resolveSalesOrderAllocation (server)
                              |
                existing calculateCommercialQuote
              (price, GST, freight, total, entities)
                              |
                  CommercialQuote.snapshot
                              |
           existing review / quote acknowledgement
                              |
                    createOrderForRetailer
          (quote freshness, credit, inventory, idempotency)
                              |
              Order + OrderItem commercial snapshots
                              |
                 existing delivery/invoice flow
                              |
        Invoice/InvoiceLine + invoice-scoped payment allocation
                              |
                 existing mock SAP/outbox boundary
```

The routing layer is inserted before the accepted Wave 1B commercial
calculator. It does not replace pricing, GST, freight, invoice, payment,
inventory or SAP boundaries.

## Decision points and evidence

| Question | Current source evidence | Classification | Remaining risk |
|---|---|---|---|
| Where is the seller selected? | `backend/src/modules/commercial/routing.ts` resolves each line; `service.ts` passes the resolved entity to `calculateCommercialQuote`. | IMPLEMENTED and verified | Hosted orders 86/87 and native review matrix agree with the source plan. |
| What is the routing input? | `quoteFor` reads the authenticated retailer and `Retailer.deliveryCity`; each `Variant` supplies `routingClass`, authoritative case weight, and explicit `routingBagEquivalent` where required. | IMPLEMENTED and verified for controlled UAT data | Dedicated Laxmi, OTHER BAG and Instant Mix UAT rows were exercised. |
| Does delivery city participate? | `normalizeCity` evaluates the explicit value before threshold work. It never parses `shopAddress` or GPS. | IMPLEMENTED and accepted for exact case-normalized `Indore`/`Indore City`; all other non-empty canonical city values are outside Indore | Missing city remains blocked by design; no broader geography inference is intended. |
| Is Laxmi excluded from the threshold? | `routing.ts` assigns `LAXMI_TOOR` to Jain and contributes `null`. | IMPLEMENTED | Correct metadata must exist on the SKU. |
| Is the remaining quantity aggregated? | Lines are normalized and sorted in `normalizedLines`; `routing.ts` sums explicit BAG/non-BAG contributions and exact Instant Mix `orderedKg / 5` before applying `< 5` / `>= 5`. | IMPLEMENTED | Product-master configuration remains data-dependent. |
| Are duplicate cart rows safe? | `normalizedLines` combines quantities by stable `variantId`; routing sorts stable IDs. | IMPLEMENTED | Must remain covered in final regression. |
| Is the route deterministic? | Pure resolver, explicit policy version, sorted lines and decimal arithmetic. | IMPLEMENTED | No separate persisted digest field; the plan is embedded in the snapshot. |
| Does review use server output? | `CommercialBreakdown` renders `quote.snapshot`; the clients do not calculate the threshold. | IMPLEMENTED and verified | Native review screenshots for A–H and hosted quote refreshes prove server-provided groups/reasons. |
| Does commit use the reviewed route? | `createOrderForRetailer` locks and validates the quote, copies accepted commercial lines/snapshot, then persists the order. | IMPLEMENTED and verified | Orders 86/87 committed the reviewed split and retained it through invoice. |
| Are historical decisions preserved? | Order, item, invoice and invoice-line commercial snapshots are retained; existing Wave 1B tests cover master edits. | IMPLEMENTED | Legacy rows without routing metadata remain legacy; this must be explicit in Admin/reporting. |
| How are mixed carts represented? | One parent customer order/combined invoice with per-line entity attribution, as in Wave 1B. | IMPLEMENTED | Real SAP entity-specific posting remains disconnected. |
| What does SAP assume? | Existing one-order payload carries the commercial snapshot; real SAP is not connected and mock/outbox is the test boundary. | PARTIAL / INTEGRATION BOUNDARY | No new real-SAP child-order contract is authorized. |

## Code-fix review

The current source contains the smallest intended routing implementation:

- `backend/prisma/migrations/20260916120000_dynamic_sales_order_routing/migration.sql`
  adds only `Retailer.deliveryCity`, `Variant.routingClass` and
  `Variant.routingBagEquivalent` plus validation checks. It does not backfill
  existing data.
- `backend/src/modules/commercial/routing.ts` implements the pure policy,
  exact Instant Mix KG ÷ 5 conversion, and data-readiness errors for missing
  or contradictory master data.
- `backend/src/modules/commercial/service.ts` invokes the router only when at
  least one selected SKU has routing metadata, preserving the legacy
  unconfigured-cart compatibility mode.
- `backend/src/modules/commercial/routes.ts` exposes controlled Admin SKU and
  retailer delivery-city configuration and includes the routing snapshot in
  existing quote responses.
- `rep/src/components/CommercialBreakdown.tsx` and
  `mobile/src/components/CommercialBreakdown.tsx` render the server-provided
  groups/reason without a second client-side routing engine.

## Remaining boundaries

1. The exact routing acceptance used controlled hosted data and proved entity,
   price, GST, freight and invoice readiness for the exercised path. Real SAP
   is intentionally disconnected and remains outside this release.
2. The deployed hosted Admin preview lacks the current delivery-city control;
   exact-city fixture setup used the current-source Admin UI through a local
   staging proxy, with the original value restored afterward.
3. Payment/collection mutation was not repeated in this routing pass; the
   accepted Wave 1B invoice-scoped payment contract remains authoritative.
