# Jain / Padam routing decision register

## Source provenance

| Source | Path | SHA-256 |
|---|---|---|
| Authoritative business DOCX | `CURRENT/DOCS/Commercial/SOURCES/Sales Order Creation Logic for Jain & Padam.docx` | `13501182111fae0a1c153f65f9641eee41103555bf1bf59593d2b0e855ce76d2` |
| Routing implementation brief | `CURRENT/DOCS/Commercial/SOURCES/Gagan Jain-Padam Dynamic Sales Order Routing Prompt.md` | `7671384ab86ea1bf0ac0079d7be896e6e365017c4af2c00677ce96ec8b4ef8c6` |

## BD-01 — Instant Mix unit aggregation

**Status: RESOLVED — approved exact conversion.**

The business clarification approves `5 KG Instant Mix = 1 routing bag`.
For every Instant Mix line, the backend uses the authoritative ordered weight
and calculates `orderedKg / 5` with decimal arithmetic and no pre-threshold
rounding. Multiple Instant Mix lines contribute to the same aggregate, and
their exact contribution may be combined with eligible BAG products. This
applies whether or not Laxmi is also present.

Supported boundary examples are: 3 KG = 0.6 routing bag, 10 KG = 2, 24 KG =
4.8, and 25 KG = 5. Laxmi remains Jain and contributes zero. A manually
entered `routingBagEquivalent` is not accepted for Instant Mix because it
could override the approved fixed conversion. Missing/invalid authoritative
weight remains a data-readiness error, not a guessed conversion.

## BD-02 — Indore City membership

**Status: RESOLVED AND ACCEPTED — exact canonical city values.**

The implementation accepts the canonical city value `Indore` or `Indore City`
(case-normalized and whitespace-normalized) as the all-Jain override. Every
other non-empty canonical city is outside Indore for this policy. It does not
use an address substring, GPS, district, suburb, nearby city, or billing city.
An absent city remains a required destination error. The dedicated Kaveri UAT
retailer was reviewed with both exact values on the native Salesperson flow;
its original `Pune` value was restored and verified afterward.

## BD-03 — bag/pack conversion

**Status: RESOLVED — explicit BAG and non-BAG conversion contract.**

For an approved BAG routing UOM, one ordered bag is one routing bag. The
current product master represents this as the explicit `routingBagEquivalent`
value `1.000` per ordered sellable case/unit. A non-BAG UOM must carry its own
reviewed positive product-master equivalent; the backend never infers a case,
box, pack, or weight conversion from display text. Instant Mix is the approved
exception and uses the fixed BD-01 KG ÷ 5 formula instead of this field.

Unconfigured or invalid rows remain blocked with a data-readiness error.

## BD-04 — entity commercial readiness

**Status: VERIFIED FOR CONTROLLED STAGING ACCEPTANCE.**

The existing quote engine still requires entity-specific seller, price and
GST readiness after routing. Orders `GGN-00000086` and `GGN-00000087` proved
the controlled Jain/Padam seller, price, GST, freight and combined-invoice path
in Admin and both native clients. Dispatch/warehouse and external SAP
readiness remain existing contract boundaries. No fallback to the wrong
company is allowed if a resolved entity lacks an approved mapping.

## Engineering decisions (not business approvals)

- Keep the existing one customer-order / combined-invoice model; preserve
  per-line Jain/Padam attribution rather than inventing a second order engine.
- Store routing explanation inside the existing commercial snapshot so quote,
  order, invoice and mock SAP paths use one historical decision.
- Opt a cart into routing only when at least one selected SKU has explicit
  routing metadata; preserve established legacy unconfigured-cart behavior.
- Treat a missing destination/classification/conversion as a structured
  recoverable error, never as an inferred seller.
