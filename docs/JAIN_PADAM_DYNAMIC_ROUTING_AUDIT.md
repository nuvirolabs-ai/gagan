# Jain Padam Dynamic Routing Audit

## Purpose and conclusion

This audit records the current accepted Gagan commercial path before the Jain
Traders and Padam International order-time routing change. The original client
business document is the authority for routing rules. The current source is
the accepted canonical product at commit `1728bc6ce1aad30bbaf528821d7c307cc46c5111`.

The current product has a sound Wave 1B commercial calculation and snapshot
boundary, but it does not yet implement the requested order-time routing. The
current seller is read from `Variant.sellingEntity` while a quote is created.
Delivery geography is not an input to the quote or order command. There is no
stable product routing classification, no threshold calculation, and no
routing explanation snapshot. The implementation work therefore needs a
narrow routing layer before the existing quote/order finalization logic while
leaving pricing, GST, freight, invoice and payment calculations in place.

Mixed Instant Mix quantities remain intentionally unresolved: the source
document combines kilograms and bags without an approved conversion. Affected
mixed-unit carts must be rejected with a structured review-required result;
they must not be guessed into a seller.

## Current flow

```text
Retailer cart                         Salesperson cart
      |                                       |
      +--------------- item quantities ------+
                              |
        POST /commercial/quotes or /rep/commercial/quotes
                              |
                commercial.quoteFor(retailerId, items)
                              |
       Variant.sellingEntity + GST + price/UOM master data
                              |
       calculateCommercialQuote (goods, tax, freight, total)
                              |
             quote snapshot returned to Review Order
                              |
          POST /orders or /rep/orders + quoteId/revision
                              |
        createOrderForRetailer (quote freshness + credit + stock)
                              |
      Order.commercialSnapshot + OrderItem snapshots persisted
                              |
             one canonical customer Order is persisted
                              |
       delivery -> quoteDelivery -> one combined Invoice
                              |
       InvoiceLine.sellingEntity + invoice commercial snapshot
                              |
            payment allocation scoped to that Invoice
                              |
       SAP outbox carries one order payload + commercial snapshot
```

### Current decision points

| Question | Current evidence | Finding |
| --- | --- | --- |
| Where is Jain/Padam decided? | `backend/src/modules/commercial/service.ts`, `quoteFor`; each quote line copies `Variant.sellingEntity`. | Static variant ownership at quote time. |
| What are the inputs? | Retailer ID, variant IDs, quantities, tier/retailer prices, variant GST and weight/UOM fields. | Delivery destination and policy version are absent. |
| Is it dynamic? | `calculateCommercialQuote` receives seller values already selected by `quoteFor`. | No order-context dynamic routing. |
| Does delivery city participate? | `Retailer.shopAddress` is a free-text field; `RetailerLocation` stores coordinates/status. Neither is read by `quoteFor` or order creation for seller selection. | Missing approved delivery-city input/classification. |
| Is ownership static on SKU/product/price/order line? | `Variant.sellingEntity` is nullable; `PriceList` and `PriceOverride` hold rate/rate basis; `OrderItem.commercialSnapshot` and `InvoiceLine.sellingEntity` preserve accepted line data. | Master seller is static; transaction line seller is snapshotted later. |
| Is there a parent/entity-order structure? | `Order` has one optional `CommercialQuote`, one `Invoice`, and one `commercialSnapshot`; no Jain/Padam child-order model. | Existing model is one customer order with entity-attributed lines, not two child Sales Orders. |
| How are mixed carts represented? | One quote snapshot has multiple `entities` and line-level `entity`; one customer order and combined invoice preserve them. | Existing mixed commercial display is usable, but does not derive from the requested routing rules. |
| How does Review Order receive allocation? | Mobile and rep screens call the backend quote endpoint and render `CommercialBreakdown` from `quote.snapshot`. | Backend snapshot is authoritative, but current allocation is static-master driven. |
| How are historical entities preserved? | `Order.commercialSnapshot`, `OrderItem.commercialSnapshot`, `Invoice.commercialSnapshot`, and `InvoiceLine.sellingEntity`. | Existing historical preservation is implemented for accepted Wave 1B quotes. |
| What does SAP assume? | `SapSalesOrderPayload` is one payload per Gagan `Order`; it includes the commercial snapshot. The configured Service Layer connector rejects commercial entity posting until an entity-specific SAP contract exists. | One Gagan payload today; real SAP entity split is not connected. |
| Where are routing tests? | `backend/src/__tests__/commercialQuote.test.ts`, `backend/src/modules/commercial/commercialFlow.test.ts`, and invoice tests cover static entity, GST, freight, snapshots and payments. | No Indore/Laxmi/threshold routing tests exist. |

## Gap matrix

| Business rule | Current implementation | Status | Required correction | Risk |
| --- | --- | --- | --- | --- |
| Indore City overrides every other rule | No delivery-city input or canonical city mapping reaches quote/order creation. | MISSING | Add an approved delivery-destination representation and evaluate the Indore override first. | Incorrect seller, dispatch and invoice attribution. |
| Laxmi Toor Dal always routes Jain | No routing class or stable Laxmi identity. Similar names cannot be safely distinguished. | MISSING | Add stable routing classification/mapping and exclude Laxmi quantity from threshold. | Brand misclassification and wrong legal seller. |
| Remaining products below five bags route Jain | No bag threshold or aggregate contribution. | MISSING | Resolve approved bag/UOM contribution from authoritative product data and route the aggregate. | Threshold bypass or inconsistent seller results. |
| Remaining products at least five bags route Padam | No aggregate threshold. | MISSING | Implement exact boundary and move the entire eligible group to Padam. | Partial or line-order-dependent split. |
| Laxmi plus below-five remaining products is all Jain | No rule engine. | MISSING | Apply Laxmi exclusion and all-Jain result. | Incorrect mixed allocation. |
| Laxmi plus at-least-five remaining products splits Laxmi/Jain and remaining/Padam | Existing line-level entity representation can preserve a split, but does not calculate it. | PARTIAL | Feed a computed allocation plan into the existing commercial snapshot. | UI may show a split that does not match backend policy. |
| Khade Anaj and OTHER Dal participate in the same aggregate | Product category is free text and no routing classification exists. | MISSING | Use stable classification or approved mapping; do not add special per-line thresholds. | Category-specific divergence from client rule. |
| Instant Mix below five KG with Laxmi is Jain | Weight fields exist, but no Instant Mix classification or explicit mixed rule. | PARTIAL | Implement only the unambiguous Laxmi + known Instant Mix below-five-KG case. | Unsafe extension into unresolved mixed-unit cases. |
| Instant Mix mixed with bag products | No approved KG-to-bag conversion. | CONFLICTING | Block affected combinations with a structured unresolved-policy result until business clarification. | Silent incorrect seller assignment. |
| Quantity normalization is backend authoritative | Current order quantity is integer case count; weight per case is available for commercial pricing/invoicing. | PARTIAL | Add a routing contribution contract distinct from invoice weight and snapshot the result. | Weight may be mistaken for bag quantity. |
| Same routing for same authoritative snapshot | Existing quote and order idempotency protect accepted static snapshots. | PARTIAL | Include destination/routing policy/classification/contribution in quote and commit identity. | Retry could route differently after master changes. |
| Review Order shows backend-resolved allocation | `CommercialBreakdown` renders quote lines/entities from the backend snapshot. | PARTIAL | Extend the same snapshot with allocation groups/reason while retaining one review and total. | Client-side reimplementation or stale display. |
| One checkout can create required entity Sales Orders | One Gagan customer `Order` and combined `Invoice` exist; SAP boundary is one payload and no child entity orders. | PARTIAL | Reuse the existing one-order/mixed-line architecture unless an approved SAP child contract is supplied; persist a durable allocation plan. | Duplicate order architecture or unresolved SAP posting semantics. |
| Routing explanation is historically auditable | Financial snapshots include line seller and totals but no routing reason, destination classification, threshold or rule version. | MISSING | Snapshot routing policy version, destination classification, contribution, seller and reason in the order/commercial snapshot. | Historical decisions become unverifiable. |
| Pricing/GST/freight/invoice/payment semantics stay unchanged | Wave 1B engine, combined invoice and invoice-scoped payment tests are present and passing. | IMPLEMENTED | Adapt the resolved seller lines into the existing quote engine; do not rewrite formulas or payment scope. | Commercial regression if routing leaks into calculation logic. |
| SAP remains disconnected and mapping is explicit | Disabled/mock connector boundary exists; real Service Layer rejects entity-specific commercial payload. | IMPLEMENTED | Keep real SAP disconnected; test mock/outbox attribution only and document the real boundary. | Accidental real posting or falsely claiming entity Sales Orders. |

## Quantity model

- Current order quantity is an integer `OrderItem.qtyOrdered` representing the
  selected sellable case/pack. The clients send only `variantId` and integer
  `qty`; they do not send seller, price or threshold decisions.
- `Variant.unitSize`, `unit`, `unitsPerCase`, and `unitWeightKg` support the
  existing case/weight commercial calculation. A `caseWeightKg` is already
  snapshotted on `OrderItem` and in commercial quote lines.
- `PriceList.rateBasis` and `PriceOverride.rateBasis` support `case` and
  `quintal` pricing. This is a pricing basis, not automatically a five-bag
  routing conversion.
- There is no approved bag-equivalent conversion table, quantity precision
  contract, or routing contribution field. Counting cart rows or converting
  kilograms to bags would be unsafe.
- Safe implementation requires an authoritative routing contribution for
  unambiguous supported products, exact decimal arithmetic, duplicate-line
  normalization, and a persisted contribution snapshot. Missing conversion
  data must return a structured readiness error.

## Geography

The accepted schema has `Retailer.shopAddress` as free text plus optional
`RetailerLocation` coordinates and verification metadata. Neither is a
canonical city identifier. The current source has no Indore business-area
table or approved city mapping. Therefore city routing cannot safely use a
substring comparison such as `address.city === "Indore"`.

The implementation must introduce the smallest approved destination input,
preferably a normalized city/business-area value associated with the selected
delivery destination. Until a destination is classified by an approved
mapping, affected orders must be review-required rather than guessed inside
or outside Indore.

## Product classification

The current product seed uses categories such as `Daal`, `Rice`, `Breakfast`
and `Sugar`, while the runtime master stores product names and free-text
categories. It does not have a stable routing class. Static `sellingEntity`
must not be repurposed as a permanent product owner because the same non-Laxmi
SKU can route to either company depending on destination and aggregate
quantity.

The minimal safe classification is expected to distinguish Laxmi Toor and
Instant Mix from the general eligible group, with an explicit contribution
unit for every threshold-participating product. Khade Anaj and OTHER Dal are
examples in the business document, not separate threshold algorithms.

## Instant Mix decision register

The source document explicitly supports Laxmi plus Instant Mix below five KG
when weight is authoritative. It does not define how to combine Instant Mix
kilograms with bag quantities, what exactly five KG means without Laxmi, or
how mixed Instant Mix pack sizes contribute to the five-bag threshold.

For these cases the required business clarification is:

1. Outside Indore, how does 3 KG Instant Mix plus 3 bags of Moong Dal qualify?
2. What entity receives exactly five KG Instant Mix with Laxmi?
3. What happens to Instant Mix without Laxmi or other bag products?
4. How are mixed Instant Mix pack sizes and fractions normalized?
5. If bag products independently reach five, does that cover Instant Mix and
   under which approved conversion?

No code should encode an arbitrary kilogram-to-bag factor. Indore override,
Laxmi-only, Laxmi plus known Instant Mix below five KG, and pure bag-based
rules can proceed independently where their data prerequisites are met.

## Proposed insertion point

The smallest compatible insertion point is the shared backend quote boundary:

1. `POST /commercial/quotes` and `POST /rep/commercial/quotes` accept the
   selected delivery destination context in addition to the cart.
2. `quoteFor` locks/reads authoritative retailer, destination, product
   classification, approved routing mapping, UOM contribution, and prices.
3. A routing domain function resolves a typed allocation plan before calling
   the existing `calculateCommercialQuote`.
4. The quote snapshot contains the routing explanation and resolved seller per
   line. Existing GST, freight, total and entity aggregation logic consumes
   those resolved lines unchanged.
5. `createOrderForRetailer` validates the quote context and persists the same
   routing snapshot with the accepted order, retaining existing credit, stock,
   idempotency and commercial safeguards.
6. Delivery/invoice/SAP continue reading the accepted order snapshot rather
   than current variant master data.

Review Order should render the backend allocation groups from the same quote
snapshot. The clients must never calculate the threshold or seller.

## Initial implementation boundary

The following are safe to implement without a new business decision:

- stable routing metadata and a versioned policy representation;
- approved destination classification plumbing, with unknown destinations
  failing closed;
- Indore all-Jain override;
- stable Laxmi classification and exclusion from the threshold;
- aggregate bag-based `< 5` Jain and `>= 5` Padam decisions;
- mixed Laxmi plus eligible bag-product split;
- deterministic route plan and historical explanation snapshot;
- backend quote/commit integration and Review Order rendering;
- routing tests and preservation of Wave 1B commercial tests.

The following remains blocked pending clarification:

- any mixed Instant Mix kilograms with bag-based products;
- any pure or mixed Instant Mix case whose threshold contribution is not
  explicitly mapped;
- any new real-SAP entity-specific Sales Order posting contract.
