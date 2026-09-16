# Jain / Padam dynamic routing — controlled staging acceptance

**Acceptance scope:** the approved Jain/Padam dynamic sales-order routing
policy and its integration with the existing Wave 1B commercial flow. This is
not a production-readiness declaration and does not connect real SAP.

## Source and runtime

- Branch: `codex/gagan-jain-padam-routing-v1`
- Accepted source: `fadc6d8b70cb39ab5a1f93b395572a9e19f6fcd6`
- Remote branch was at the same SHA when this manifest was prepared.
- Hosted API: `https://gagan-srat.onrender.com`
- Recorded hosted deployment: `dep-daleieu1egvs73earu10`
- Public health: `/health`, `/health/live` and `/health/ready` returned HTTP 200.
- Routing migration: `20260916120000_dynamic_sales_order_routing`
- Routing migration SHA-256:
  `7490c50bed9b722bfd41e0e1f9e1e56fe6c0104b6ee2c04ad2cd87b0dab4595c`

The migration is additive. It adds explicit retailer delivery city and variant
routing metadata/checks. It does not backfill or rewrite historical retailers,
variants, orders, invoices, payments, or ownership values.

## Accepted policy

- Exact canonical city `Indore` or `Indore City` routes the entire order to
  Jain Traders.
- Outside those exact cities, Laxmi Toor Dal always routes to Jain Traders and
  contributes zero to the threshold.
- An approved BAG contributes one routing bag per ordered sellable unit.
- Instant Mix contributes exact ordered kilograms divided by five, without
  rounding before threshold comparison.
- All eligible non-Laxmi contributions are aggregated.
- Below five eligible routing bags routes eligible lines to Jain; five or more
  routes eligible lines to Padam.
- The existing backend quote, GST, freight, combined-invoice, payment,
  idempotency, and SAP-outbox contracts remain authoritative downstream.

## Hosted golden paths

### Retailer-origin order

- Retailer: `Field Ops UAT Kaveri`
- Order: `GGN-00000086`
- Laxmi 1 bag → Jain Traders
- Eligible non-Laxmi 5 bags → Padam International
- Freight: Padam International, ₹700 before GST, ₹126 freight GST,
  0.35 quintals / 15 km
- Combined total: ₹6,076
- Admin lifecycle: Placed → Confirmed → Packed → Out for delivery on
  `ROUTE-A` → Delivered
- Combined invoice: `#12`
- Invoice-level totals: Jain ₹1,050; Padam ₹5,026
- Retailer native history/detail: Delivered

### Salesperson-origin order

- Retailer: `Field Ops UAT Kaveri`
- Order: `GGN-00000087`
- Origin: native Salesperson review app
- Salesperson attribution: `Placed from Salesperson` / `by you`
- Laxmi 1 bag → Jain Traders
- Eligible non-Laxmi 5 bags → Padam International
- Freight and GST match order 86
- Combined total: ₹6,076
- Admin lifecycle: Placed → Confirmed → Packed → Out for delivery on
  `ROUTE-A` → Delivered
- Combined invoice: `#13`
- Invoice-level totals: Jain ₹1,050; Padam ₹5,026
- Salesperson native Recent Orders and Order Detail: Delivered
- Retailer native history/detail after refresh/reopen: Delivered

Admin search and Commercial views showed one order/invoice result for each
controlled order. Existing order `GGN-00000085` remained separate. No payment
or collection mutation was performed in this routing acceptance pass.

## Physical Moto E13 policy matrix

Device: `Moto E13 ZD2229Q3KB`.

All cases were reviewed in the installed Salesperson app against the hosted
quote path and stopped before submission unless separately identified above.

| Case | Expected and observed native result |
|---|---|
| A — 3 kg Instant Mix + 3 other bags | 3.600 routing bags; below threshold; Jain |
| B — 10 kg Instant Mix + 3 other bags | 5.000 routing bags; threshold met; Padam |
| C — 25 kg Instant Mix | 5.000 routing bags; Padam |
| D — 24 kg Instant Mix | 4.800 routing bags; Jain |
| E — Laxmi + 10 kg Instant Mix + 2 other bags | Laxmi excluded; 4.000 routing bags; all Jain |
| F — Laxmi + 10 kg Instant Mix + 3 other bags | Laxmi Jain; 5.000 eligible routing bags; remaining lines Padam |
| G — exact city `Indore` | Entire order Jain; exact-city override |
| H — exact city `Indore City` | Entire order Jain; exact-city alias override |

The dedicated Kaveri UAT city was temporarily changed to `Indore` and
`Indore City` through the current supported Admin control for cases G and H,
then restored to its original `Pune` value and verified. The temporary cart
was emptied and the device returned to the clean retailer-detail state.

## Artifact provenance

Salesperson review APK:

- Package: `com.gagan.sales.review`
- Version: `1.0.9`, version code `9`
- SHA-256: `0787049a2747a8577fa65e4617abac50f4aa8e58e9be781c2b7f4e78cf790cda`
- Artifact: `CURRENT/EVIDENCE/20260917-jain-padam-routing-hosted/gagan-salesperson-jain-padam-routing-fadc6d8-v1.0.9.apk`

Retailer review APK:

- Package: `com.gagan.retailer.review`
- Version: `1.0.4`, version code `5`
- SHA-256: `cce6ab478b311a86c89065abef6170ecb21a6d34cd831726abdac7975c01352d`
- Artifact: `CURRENT/EVIDENCE/20260917-jain-padam-routing-hosted/gagan-retailer-jain-padam-routing-fadc6d8-v1.0.4.apk`

Both artifacts contain `https://gagan-srat.onrender.com` and were installed as
compatible updates without uninstalling or clearing application data.

## Automated gates

- Backend full seeded suite: **134 test files / 939 tests passed**.
- Backend typecheck: **PASS**.
- Backend production build: **PASS**.
- Admin suite: **22 test files / 58 tests passed**.
- Admin typecheck, lint and build: **PASS**.
- Salesperson (`rep`) suite: **33 test files / 181 tests passed**.
- Salesperson typecheck: **PASS**.
- Retailer (`mobile`) suite: **17 test files / 74 tests passed**.
- Retailer typecheck: **PASS**.
- Focused routing suite: **20 tests passed**.
- `git diff --check`: **PASS**.

The complete backend suite was run against a newly created local PostgreSQL
database with the supported seed, not against hosted staging.

## Evidence index

Detailed hosted and physical evidence is preserved in:

`CURRENT/EVIDENCE/20260917-jain-padam-routing-hosted/GAGAN_JAIN_PADAM_HOSTED_UAT_20260917.md`

That directory contains the Admin/native order evidence, Retailer and
Salesperson final-status screenshots, cases A–H, the cleared-cart proof and
the exact APK artifacts listed above.

## Safety boundary

- Production: untouched
- `main`: untouched
- Dogkart/GNV: untouched
- Real SAP: not connected
- Historical commercial records: not rewritten
- Existing Wave 1B payment/invoice semantics: preserved
- No additional routing order, invoice, payment, or customer record was
  created for cases A–H

**Controlled Jain/Padam routing acceptance:** PASS.

**Recommended staging acceptance tag:** `gagan-staging-jain-padam-routing-v1`
