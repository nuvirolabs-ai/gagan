# Jain / Padam data-readiness report

This report describes the source contract and the controlled UAT checks
completed against the authorized Gagan staging environment. It does not claim
that UAT rows prove production readiness.

## Required per-SKU record

| Field | Current source | Required for routing | Readiness |
|---|---|---|---|
| Stable variant/product ID | `Variant.id` / `Product.id` | Always | IMPLEMENTED in schema |
| Routing class | `Variant.routingClass` | Always for a dynamically routed cart | Controlled Laxmi/OTHER/Instant Mix UAT rows verified |
| Bag contribution | `Variant.routingBagEquivalent` | Positive explicit value for `OTHER` (use `1.000` for approved BAG); not used for Instant Mix | Controlled OTHER BAG values verified; unconfigured rows remain blocked |
| Ordering UOM / precision | `unitSize`, `unit`, `unitsPerCase`, integer cart quantity | Existing order validation; BAG uses 1:1 and Instant Mix uses exact ordered KG ÷ 5 | Existing contract; non-BAG OTHER rows still require explicit contribution metadata |
| Commercial seller/GST | `sellingEntity`, `gstPercent` and existing price tables | Required after routing | Existing engine; per-entity readiness must be checked |
| Price basis | `PriceList` / `PriceOverride` `rateBasis` | Required for the accepted commercial quote | Existing Wave 1B contract |
| Case weight | `unitWeightKg × unitsPerCase` | Existing commercial/invoice/SAP snapshot and exact Instant Mix `orderedKg / 5` routing conversion | Positive authoritative weight verified for controlled Instant Mix rows |
| Visibility/active state | Existing product/variant flags | Saleability | Verified through the hosted catalog-backed native flow |
| Dispatch/company mapping | Existing seller/warehouse relationships | Required for accepted order operations | Jain/Padam readiness verified for controlled orders 86/87; real SAP remains disconnected |

## Required destination record

The current routing implementation uses `Retailer.deliveryCity`, an explicit
field that is never inferred from `shopAddress` or device GPS. The following
were verified for the controlled UAT flow:

- the retailer/address selected by the actor is the one used by quote;
- `Indore`/`Indore City` reflects the approved city boundary, not a casual
  substring or district name;
- unknown/conflicting geography is blocked or corrected;
- billing and delivery geography are not accidentally interchanged;
- address changes force a fresh quote before commit.

## Current readiness classification

| Area | Status | Reason |
|---|---|---|
| Source schema/data path | READY FOR CONTROLLED ACCEPTANCE | Migration is additive and fresh-migrated successfully. |
| Routing unit tests | READY | Pure policy cases cover exact Instant Mix conversion and boundaries. |
| Existing commercial formulas | PRESERVED | Wave 1B calculator remains downstream. |
| Actual hosted catalog mapping | VERIFIED FOR CONTROLLED UAT | Dedicated Laxmi, OTHER BAG and Instant Mix rows were used by both native quote flows. |
| Approved city mapping | VERIFIED FOR CONTROLLED UAT | Exact `Indore` and `Indore City` overrides were reviewed natively; original city restored. |
| Instant Mix mixed-unit policy | RESOLVED FOR APPROVED CASES | 5 KG = 1 routing bag; exact ordered KG ÷ 5 is aggregated with eligible BAG products. |
| Entity-specific SAP posting | NOT APPLICABLE TO THIS RELEASE | Real SAP remains disconnected; mock/outbox attribution only. |
