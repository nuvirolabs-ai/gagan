# GAGAN Client Demo Final Polish — Design

## Scope

Create one client-demo checkpoint from canonical Gagan source
`6685565df5398104a7abb68080838a45efad0bcc`, selectively carrying the reviewed
Retailer commerce-polish changes from the compatible donor worktree. The
checkpoint covers visible presentation cleanup, staging display-name cleanup
for dedicated demo fixtures only, final review APK metadata, and evidence
needed for a reversible release freeze.

## Invariants

- The final source remains based on the canonical real-catalogue and
  Jain/Padam routing checkpoint.
- Backend commercial, GST, inventory, routing, pricing, and freight guards
  remain authoritative. Missing configuration continues to render as
  `Ordering setup pending` where applicable.
- Historical orders, invoices, payments, immutable order numbers, audit
  records, staff IDs, retailer IDs, credentials, and SAP identity fields are
  not rewritten or repurposed.
- Only exact, verified staging demo fixtures may receive display-name/status
  changes, and every change is recorded as an old-to-new mapping.
- No production, main, Dogkart, GNV, real SAP, real payment, private receipt,
  or unrelated customer/business record is in scope.

## Approved experience

Retailer Home remains:

`brand → greeting/name → search → three product banners → categories →
products → latest order → outstanding/ledger → order again`.

The live catalogue-subtotal mini-cart is visible only on Home, Products, and
Product Detail. It is hidden on Cart, Review/Checkout, and Order Detail. The
existing CartContext, Cart screen, and orderability guards remain the source of
truth.

Visible active client-demo copy removes test-environment language such as UAT,
Field Ops, Founder UAT, Routing-UAT, test, demo, sample, and temporary labels.
Internal domain names, test fixtures, comments, historical snapshots, and
backend source semantics are retained unless they are rendered to the client.

## Release gates

1. Selective source integration and focused red/green regression tests.
2. Isolated local database full-suite/typecheck/build verification.
3. Read-only identity, recovery/PITR, and before-state verification for the
   exact Render service/database before any scoped staging write.
4. Staging response/Admin verification after display-only updates.
5. Standalone signed APK builds with hosted API, package IDs, higher version
   codes, and embedded source/API identity.
6. In-place Moto E13 installation without uninstall or data clearing, followed
   by visible Retailer and Salesperson review.
7. Stable Admin URL verification and historical-order readability check where
   an authenticated session is available.
8. Annotated immutable tag and release manifest only after all applicable gates
   have evidence.

## Recovery

The source rollback is the pre-freeze canonical SHA and the final branch/tag
relationship. Staging data rollback is limited to reversing the exact recorded
display-name/status mutations by ID; no historical row rewrite is used. APK
rollback is the previously installed review build, retained in the existing
workspace/build archives.
