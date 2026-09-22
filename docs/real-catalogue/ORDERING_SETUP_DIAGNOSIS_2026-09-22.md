# Salesperson ordering availability investigation

Verified 2026-09-22 against canonical source HEAD 6685565 and the checked-in
manifest plus owner-approved decisions. No authenticated hosted catalogue or
database read was performed in this investigation. Hosted publication evidence
dated 2026-09-17 is historical, not a fresh runtime verification.

## Cause and contract

RepCatalogScreen loads `/rep/retailers/:id/catalog`. The route returns
`catalogStatus`, `orderable`, `orderingStatus`, `orderingReason`, retailer price,
and inventory availability. catalogueOrderingState returns orderable=true only
for `active`; `published` produces false / pending_setup / Ordering setup pending.
Pack selection depends on the group's SKUs, independently of orderability.
Publication intentionally sets Product and Variant to published, writes reviewed
pack conversions and all-existing-tier prices, and does not activate ordering.
The commercial quote independently requires active Product and Variant records
and rejects other records with catalog_item_not_orderable (409).

## Exact reviewed variant identities

| Product | Internal variant code | Pack | Units/case | Case kg | INR/quintal | Derived INR/case, excluding GST |
|---|---|---|---:|---:|---:|---:|
| Gagan Broken | GAGAN-INT-V-02231e3b302d337360ec2267a0651f8b3592c8c5a2374ca06f1b8521c3d5f84b | 30 KG | 1 | 30 | 5400 | 1620 |
| Gagan Choice | GAGAN-INT-V-6986bb1ebc542536524718be661a0a6a2fce3362cd7d5de3494298f74ce1e820 | 30 KG | 1 | 30 | 8100 | 2430 |
| Gagan Classic | GAGAN-INT-V-a667124b440dc8dbda60a6e6a6b39902bdf280c0c1e08b1f2fbf02a365a38302 | 30 KG | 1 | 30 | 9550 | 2865 |
| Gagan Classic | GAGAN-INT-V-5384545e9b77a863445d7e860b611a9017fc3e9705a6024e035688d2a0f5727e | 1 KG | 20 | 20 | 9950 | 1990 |
| Gagan Classic | GAGAN-INT-V-32f10132475d9334a9348831bdd6581692b2e8c6efe66f06aea4cfadcae95e72 | 5 KG | 4 | 20 | 9950 | 1990 |
| Gagan Classic | GAGAN-INT-V-f682c314a576296a64b08cfda50d2dfad0b4805e65432324652f4fb9289d58f1 | 10 KG | 4 | 40 | 9750 | 3900 |

These are stable internal variant codes, not invented SAP material codes or
freshly verified database UUIDs. Prices above derive from approved source rates;
a selected retailer's override remains authoritative.

## Resolved configuration for all six

- Internal product/variant identity: present.
- Unit: kg; pack quantity, unit weight and case conversion: present.
- Routing conversion: resolved by owner decisions, including the 20 KG BOX rows.
- Image: matched in reviewed source.
- GST percentage: null; gst_percent_requires_approval.
- Inventory mapping: null; inventory_mapping_requires_approval.
- Per-record promotion priceLists: unresolved; price_tier_requires_approval.
- Publication is documented as having written prices to every existing tier.
  The promotion blocker is therefore not evidence that hosted price rows are absent:
  promotion still needs explicit per-record tier decisions. New/missing retailer
  tiers and individual overrides require a current authenticated check.
- Orderable status: publication is intentionally not active promotion.

To activate safely: approve actual GST values; supply verified external material
and warehouse mappings; obtain real fresh available inventory snapshots; resolve
the per-variant target-tier decisions using existing approved quintal rates;
then use guarded promotion. Do not set active directly, invent stock, use internal
codes as SAP mappings, assume GST=0, or relabel quintal rates as case prices.
Promotion requires a positive non-unavailable snapshot no older than one hour.
Salesperson additionally requires availability.status=available and quantity>0.

## Local frontend correction

The card now uses its existing price/orderable/availability guards for both Add
visibility and mutation permission. Blocked cards say Not available for ordering;
raw internal orderingReason is no longer displayed. Pack selection and prices
are preserved. Existing priced saved lines remain reducible/removable.
No backend, tax, inventory, price, API, or checkout semantics were changed.

## Verification

- Regression reproduced: published backend response surfaced the internal message.
- Focused ordering tests: 9 passed; valid/add/increase, published block, null price,
  missing/unknown/stale/unavailable/zero inventory, and saved-line removal.
- Full Salesperson suite: 190/190 passed across 34 files.
- Salesperson typecheck: passed.
- git diff --check: passed.
- No hosted activation, APK build, deployment, commit, or push performed.
- No fresh physical-device or end-to-end order-submission pass claimed.
