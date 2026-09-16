# Jain / Padam data-readiness report

This report describes the source contract and the checks still required
against the authorized Gagan staging database. It does not claim that demo
seed rows prove production readiness.

## Required per-SKU record

| Field | Current source | Required for routing | Readiness |
|---|---|---|---|
| Stable variant/product ID | `Variant.id` / `Product.id` | Always | IMPLEMENTED in schema |
| Routing class | `Variant.routingClass` | Always for a dynamically routed cart | Additive field; actual catalog coverage not yet verified |
| Bag contribution | `Variant.routingBagEquivalent` | Positive for `OTHER`; optional only for the documented Instant Mix exception | Additive field; approved production values not yet verified |
| Ordering UOM / precision | `unitSize`, `unit`, `unitsPerCase`, integer cart quantity | Existing order validation and weight calculation | Existing contract; exact threshold conversion remains BD-03 |
| Commercial seller/GST | `sellingEntity`, `gstPercent` and existing price tables | Required after routing | Existing engine; per-entity readiness must be checked |
| Price basis | `PriceList` / `PriceOverride` `rateBasis` | Required for the accepted commercial quote | Existing Wave 1B contract |
| Case weight | `unitWeightKg × unitsPerCase` | Existing commercial/invoice/SAP snapshot; only used for the approved Instant Mix exception | Existing contract; not a bag conversion |
| Visibility/active state | Existing product/variant flags | Saleability | Must be checked in the staging catalog |
| Dispatch/company mapping | Existing seller/warehouse relationships | Required for accepted order operations | Must be checked before hosted mutation |

## Required destination record

The current routing implementation uses `Retailer.deliveryCity`, an explicit
field that is never inferred from `shopAddress` or device GPS. The following
must be verified before hosted UAT:

- the retailer/address selected by the actor is the one used by quote;
- `Indore`/`Indore City` reflects the approved city boundary, not a casual
  substring or district name;
- unknown/conflicting geography is blocked or corrected;
- billing and delivery geography are not accidentally interchanged;
- address changes force a fresh quote before commit.

## Current readiness classification

| Area | Status | Reason |
|---|---|---|
| Source schema/data path | READY FOR LOCAL REHEARSAL | Migration is additive and validated in the prior source checkpoint. |
| Routing unit tests | READY | Pure policy cases and fail-closed cases are present. |
| Existing commercial formulas | PRESERVED | Wave 1B calculator remains downstream. |
| Actual hosted catalog mapping | NOT VERIFIED | Authorized Render/DB access is not available in current browser session. |
| Approved city mapping | NOT VERIFIED | No canonical geography dataset in supplied sources. |
| Instant Mix mixed-unit policy | BLOCKED | BD-01 is unresolved. |
| Entity-specific SAP posting | NOT APPLICABLE TO THIS RELEASE | Real SAP remains disconnected; mock/outbox attribution only. |
