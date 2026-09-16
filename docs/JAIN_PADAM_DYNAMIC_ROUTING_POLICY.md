# Jain / Padam dynamic sales-order routing

This policy is implemented as a server-side layer before the existing
`CommercialQuote` calculator. It selects the selling entity for each quote
line; it does not replace pricing, GST, freight, invoice, payment, inventory,
or SAP-outbox logic.

## Authoritative inputs

- `Retailer.deliveryCity` is explicit operational data. The router never
  parses `shopAddress` or a GPS record.
- `Variant.routingClass` is one of `LAXMI_TOOR`, `INSTANT_MIX`, or `OTHER`.
- `Variant.routingBagEquivalent` is the approved contribution of one ordered
  case to the five-bag threshold. It is required and positive for `OTHER`.
  `INSTANT_MIX` may use it when an approved conversion exists. `LAXMI_TOOR`
  does not contribute to the threshold.
- Prices, GST, case weight, and freight remain server-authoritative and are
  frozen into the existing quote/order/invoice snapshots.

## Rules

1. An exact `Indore` or `Indore City` destination routes every line to Jain
   Traders, regardless of threshold.
2. Outside Indore, `LAXMI_TOOR` always routes to Jain Traders and is excluded
   from the threshold.
3. Outside Indore, the remaining explicitly mapped eligible contribution is
   compared with five bags: below five routes to Jain; five or more routes to
   Padam.
4. Therefore Laxmi plus less than five eligible bags is Jain for all lines;
   Laxmi plus five or more eligible bags keeps Laxmi Jain and routes the other
   lines to Padam.
5. The only weight exception is Laxmi plus Instant Mix below five kilograms
   when no other mixed-unit line is present. That Instant Mix line routes to
   Jain.
6. Other Instant Mix mixed-unit cases without an approved bag conversion fail
   closed with `ROUTING_POLICY_UNRESOLVED`; the cart is retained and no order
   is created.

## Compatibility and history

Rows with no routing metadata retain the accepted legacy behavior. Existing
Wave 1B static company configurations remain valid. A cart opts into dynamic
routing when at least one selected SKU has an explicit routing class; the
router then requires the retailer destination and complete routing metadata.
Missing dynamic data returns a structured error rather than guessing a seller.

The resolved plan, destination, threshold contribution, per-line entity and
reason are persisted inside the existing commercial quote snapshot. That
snapshot is copied through order, delivery, invoice and mock SAP payload
generation, so later product-master edits cannot reinterpret history.

The routing migration is additive and does not backfill existing retailers,
variants, orders, invoices, payments, or ownership values.
