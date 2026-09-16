# Jain / Padam routing decision register

## Source provenance

| Source | Path | SHA-256 |
|---|---|---|
| Authoritative business DOCX | `CURRENT/DOCS/Commercial/SOURCES/Sales Order Creation Logic for Jain & Padam.docx` | `13501182111fae0a1c153f65f9641eee41103555bf1bf59593d2b0e855ce76d2` |
| Routing implementation brief | `CURRENT/DOCS/Commercial/SOURCES/Gagan Jain-Padam Dynamic Sales Order Routing Prompt.md` | `7671384ab86ea1bf0ac0079d7be896e6e365017c4af2c00677ce96ec8b4ef8c6` |

## BD-01 — Instant Mix unit aggregation

**Status: UNRESOLVED — fail closed.**

The business document explicitly specifies Laxmi + Instant Mix below 5 KG,
but also describes a five-unit/bag principle without defining a conversion
between kilograms, bags, cases or mixed Instant Mix pack sizes. The source
therefore implements only the unambiguous Laxmi + known Instant Mix `< 5 KG`
case and returns `ROUTING_POLICY_UNRESOLVED` for affected mixed-unit carts.
No KG-to-bag factor is invented.

Affected examples include Instant Mix with bag products, exactly/above 5 KG
with Laxmi, Instant Mix alone without an approved contribution, and mixed
Instant Mix pack sizes. The cart must be retained and final order submission
blocked until one approved policy is supplied.

## BD-02 — Indore City membership

**Status: PARTIAL — exact explicit value supported; canonical boundary not
verified.**

The implementation accepts the explicit normalized values `Indore` and
`Indore City` as the override. It does not use an address substring, GPS or
billing city. The supplied sources do not include an approved city/territory
mapping or boundary dataset, so other non-empty values are not treated as
proof of being outside the city for a full hosted release. This remains a
data-readiness/product-owner gate.

## BD-03 — bag/pack conversion

**Status: PARTIAL — explicit per-variant bag-equivalent field exists; approved
production mapping is not verified.**

`Variant.routingBagEquivalent` is a positive decimal contribution for
threshold-participating `OTHER` lines. It is not derived from product name,
weight or UI row count. No production conversion table was supplied in the
source pack; unconfigured/invalid rows fail closed.

## BD-04 — entity commercial readiness

**Status: VERIFY BEFORE HOSTED UAT.**

The existing quote engine still requires entity-specific seller, price and
GST readiness after routing. Dispatch/warehouse and external SAP readiness
remain existing contract boundaries. No fallback to the wrong company is
allowed if a resolved entity lacks an approved mapping.

## Engineering decisions (not business approvals)

- Keep the existing one customer-order / combined-invoice model; preserve
  per-line Jain/Padam attribution rather than inventing a second order engine.
- Store routing explanation inside the existing commercial snapshot so quote,
  order, invoice and mock SAP paths use one historical decision.
- Opt a cart into routing only when at least one selected SKU has explicit
  routing metadata; preserve established legacy unconfigured-cart behavior.
- Treat a missing destination/classification/conversion as a structured
  recoverable error, never as an inferred seller.
