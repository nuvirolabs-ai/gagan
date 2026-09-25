# Jain / Padam dynamic sales-order routing

This policy is implemented as a server-side layer before the existing
`CommercialQuote` calculator. It selects the selling entity for each quote
line; it does not replace pricing, GST, freight, invoice, payment, inventory,
or SAP-outbox logic.

## Authoritative inputs

- `Retailer.deliveryCity` is the explicit operational city used for the
  controlled routing policy. The router never parses `shopAddress`, GPS, route
  names, or the salesperson's current location.
- A city is treated as the approved Indore destination only when its
  case-normalized value is exactly `Indore` or `Indore City`. Suburbs,
  outskirts, districts, nearby cities, and addresses that merely contain the
  word “Indore” are not inferred as Indore by this resolver.
- `Variant.routingClass` is one of `LAXMI_TOOR`, `INSTANT_MIX`, or `OTHER`.
- `Variant.routingBagEquivalent` is the explicit positive contribution of one
  ordered sellable case/unit for `OTHER`. An approved product whose routing
  UOM is BAG is represented by `1.000`; a non-BAG UOM must carry its reviewed
  product-master equivalent. Case/box/pack labels are never converted by
  guessing.
- `INSTANT_MIX` uses the approved fixed conversion of 5 KG = 1 routing bag.
  Its contribution is calculated from the authoritative ordered case weight:
  `orderedKg / 5`. It does not accept a manually supplied bag-equivalent
  override.
- Prices, GST, case weight, and freight remain server-authoritative and are
  frozen into the existing quote/order/invoice snapshots.

## Rules

1. An exact `Indore` or `Indore City` destination routes every line to Jain
   Traders, regardless of threshold, product class, or quantity. Threshold
   contribution is recorded as not applicable for this override.
2. Outside Indore, `LAXMI_TOOR` always routes to Jain Traders and contributes
   zero to the threshold.
3. Outside Indore, all eligible non-Laxmi contributions are aggregated using
   exact decimal arithmetic:
   - approved BAG product: ordered bags × 1;
   - another non-BAG product: ordered quantity × its explicit positive
     `routingBagEquivalent`;
   - Instant Mix: ordered KG ÷ 5, without rounding before comparison.
4. If the aggregate is below 5 routing bags, every eligible remaining line
   routes to Jain. If it is at least 5, every eligible remaining line routes
   to Padam. The threshold moves the entire eligible group; it does not split
   only the excess quantity.
5. Therefore Laxmi plus less than five eligible routing bags is all Jain;
   Laxmi plus five or more keeps Laxmi Jain and routes the remaining eligible
   lines to Padam.
6. Multiple Instant Mix lines contribute their exact decimal ordered-KG ÷ 5
   values to the same aggregate. Examples: 3 KG = 0.6, 10 KG = 2, 24 KG =
   4.8, and 25 KG = 5 routing bags.
7. Missing or invalid classification, destination, weight, or explicit
   non-BAG/BAG contribution returns a structured data-readiness error. No
   seller is guessed and no safe subset of a cart is submitted.

## Compatibility and history

Rows with no routing metadata retain the accepted legacy behavior. Existing
Wave 1B static company configurations remain valid. A cart opts into dynamic
routing when at least one selected SKU has an explicit routing class; the
router then requires the retailer destination and complete routing metadata.

The current routing policy is `jain-padam-v2`. The resolved plan includes the
policy version, normalized destination, exact aggregate, per-line class,
contribution basis, ordered KG where applicable, entity, and reason. It is
persisted inside the existing commercial quote snapshot and copied through
the order, delivery, invoice, and mock SAP payload. Later product-master edits
cannot reinterpret history.

The routing migration is additive and does not backfill existing retailers,
variants, orders, invoices, payments, or ownership values.

## Policy clarification provenance

The Instant Mix rule in this document was updated from the previous temporary
fail-closed ambiguity after the explicit business clarification recorded on
2026-09-16: 5 KG Instant Mix equals 1 routing bag; the exact decimal
`orderedKg / 5` is aggregated with eligible BAG products. This clarification
supersedes the earlier unresolved mixed-unit note for these supported cases.
