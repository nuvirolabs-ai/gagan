# Jain / Padam dynamic routing — current flow audit

**Audited source:** `codex/gagan-jain-padam-dynamic-routing-v1` at
`7d0ded2c13343733243b716f15c467f96afc2939` (clean; equals the remote branch
at audit time).

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
| Where is the seller selected? | `backend/src/modules/commercial/routing.ts` resolves each line; `service.ts` passes the resolved entity to `calculateCommercialQuote`. | IMPLEMENTED | Hosted/runtime proof is still pending. |
| What is the routing input? | `quoteFor` reads the authenticated retailer and `Retailer.deliveryCity`; each `Variant` supplies `routingClass` and optional `routingBagEquivalent`. | PARTIAL | `deliveryCity` is explicit text, not a verified canonical geography model. |
| Does delivery city participate? | `normalizeCity` evaluates the explicit value before threshold work. It never parses `shopAddress` or GPS. | IMPLEMENTED for exact `Indore`/`Indore City`; PARTIAL for broader geography | Unknown/conflicting geography is not yet backed by an approved mapping. |
| Is Laxmi excluded from the threshold? | `routing.ts` assigns `LAXMI_TOOR` to Jain and contributes `null`. | IMPLEMENTED | Correct metadata must exist on the SKU. |
| Is the remaining quantity aggregated? | Lines are normalized and sorted in `normalizedLines`; `routing.ts` sums decimal contributions before applying `< 5` / `>= 5`. | IMPLEMENTED | Mapping/conversion readiness is data-dependent. |
| Are duplicate cart rows safe? | `normalizedLines` combines quantities by stable `variantId`; routing sorts stable IDs. | IMPLEMENTED | Must remain covered in final regression. |
| Is the route deterministic? | Pure resolver, explicit policy version, sorted lines and decimal arithmetic. | IMPLEMENTED | No separate persisted digest field; the plan is embedded in the snapshot. |
| Does review use server output? | `CommercialBreakdown` renders `quote.snapshot`; the clients do not calculate the threshold. | IMPLEMENTED | Physical final-artifact proof is pending. |
| Does commit use the reviewed route? | `createOrderForRetailer` locks and validates the quote, copies accepted commercial lines/snapshot, then persists the order. | IMPLEMENTED | Hosted and final APK proof are pending. |
| Are historical decisions preserved? | Order, item, invoice and invoice-line commercial snapshots are retained; existing Wave 1B tests cover master edits. | IMPLEMENTED | Legacy rows without routing metadata remain legacy; this must be explicit in Admin/reporting. |
| How are mixed carts represented? | One parent customer order/combined invoice with per-line entity attribution, as in Wave 1B. | IMPLEMENTED | Real SAP entity-specific posting remains disconnected. |
| What does SAP assume? | Existing one-order payload carries the commercial snapshot; real SAP is not connected and mock/outbox is the test boundary. | PARTIAL / INTEGRATION BOUNDARY | No new real-SAP child-order contract is authorized. |

## Code-fix review

The current source contains the smallest intended routing implementation:

- `backend/prisma/migrations/20260916120000_dynamic_sales_order_routing/migration.sql`
  adds only `Retailer.deliveryCity`, `Variant.routingClass` and
  `Variant.routingBagEquivalent` plus validation checks. It does not backfill
  existing data.
- `backend/src/modules/commercial/routing.ts` implements the pure policy and
  the fail-closed `ROUTING_POLICY_UNRESOLVED` result.
- `backend/src/modules/commercial/service.ts` invokes the router only when at
  least one selected SKU has routing metadata, preserving the legacy
  unconfigured-cart compatibility mode.
- `backend/src/modules/commercial/routes.ts` exposes controlled Admin SKU and
  retailer delivery-city configuration and includes the routing snapshot in
  existing quote responses.
- `rep/src/components/CommercialBreakdown.tsx` and
  `mobile/src/components/CommercialBreakdown.tsx` render the server-provided
  groups/reason without a second client-side routing engine.

## Known unresolved or external gates

1. Instant Mix mixed-unit aggregation is intentionally fail-closed pending
   one approved KG/bag policy.
2. The source currently treats any non-empty non-Indore `deliveryCity` as
   outside Indore. A canonical approved geography table/boundary is not in
   the supplied sources; this is not a safe basis for a full live release.
3. Current staging data mappings and entity-specific dispatch readiness have
   not been verified against the authorized Gagan database in this run.
4. The exact authorized Render account/service is not accessible from the
   current Chrome session, so hosted deployment and hosted ledger/recovery
   verification are not yet run.
5. Final routing APKs and physical Moto E13 acceptance are not yet run for
   this candidate.
