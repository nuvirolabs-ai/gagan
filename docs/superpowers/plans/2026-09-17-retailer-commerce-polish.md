# Retailer commerce polish plan

## Goal

Port the approved Retailer Home discovery and live catalogue-subtotal cart
affordance onto the canonical product source without changing backend
commercial or orderability behavior.

## Work sequence

1. Port the donor’s narrowly scoped promotion, mini-cart, catalogue spacing,
   and interaction helpers; keep the donor worktree and canonical history
   untouched.
2. Replace the delivery-status hero presentation with exactly three
   product-discovery promotions and move the latest-order state into a compact
   secondary block beneath them.
3. Make mini-cart visibility an explicit surface policy: Home and Products
   only in the tab shell, plus a shared mini-cart on Product Detail; never on
   Cart, checkout/review, or Order Detail. Keep the existing CartContext total
   labelled as catalogue subtotal.
4. Add regression tests for the approved promotion copy/order, surface
   visibility, catalogue add/remove guards, and existing orderability behavior.
5. Audit the current real-catalogue staging path for SAP-shaped inventory
   coupling. Only if a controlled UAT configuration is otherwise blocked,
   introduce a separate internal inventory identity; do not populate SAP
   identity fields or weaken guards.
6. Run mobile tests/typecheck/build checks and the relevant backend tests. Use
   a fresh local database for any backend change, and only then perform a
   read-only staging verification followed by narrowly scoped UAT configuration
   if the existing approved data supports it.
7. Build one traceable Retailer review APK only if the final mobile source
   requires it, install it in place on Moto E13, and record physical evidence.

## Boundaries

- No production, main, Dogkart, GNV, real SAP, or unrelated app changes.
- No pricing, GST, freight, Jain/Padam routing, invoice, payment, or schema
  redesign.
- No dummy-product restoration or additional retirement.
- No data mutation before exact target, recovery, and migration safety are
  verified.
