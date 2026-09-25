# Gagan Salesperson SFA V2 Readiness

## Scope

This branch is the staging/device-UAT release line for the Gagan Salesperson
App. The approved Salesperson V2 history was fast-forward integrated from
`origin/codex/gagan-salesperson-sfa-v2` into `codex/gagan-staging` without
conflict. The isolated integration worktree is
`/Users/tanutejas/Documents/Gagan-staging-integration`; the canonical dirty
checkout remains untouched.

The release preserves the existing Gagan backend, retailer ordering contract, inventory/credit authority, attendance and visit rules, field outbox, permissions, hierarchy, mock SAP boundary, and other product surfaces. It does not merge `main`, deploy production, connect SAP B1, or modify the canonical dirty checkout.

## Visual V2

The Salesperson App uses an Apple-native field-companion language:

- light neutral canvas and white readable surfaces;
- deep navy next-visit action surface;
- blue operational actions and navigation;
- restrained gold target milestones;
- green only for genuine completion/success;
- safe-area-aware, touch-sized controls and stable loading geometry;
- Home composed around next visit, target progress, route, quick actions, attention, tasks, and end-of-day handoff.

The Home next-visit action enters the existing retailer location/check-in workflow. It does not fake GPS or bypass on-duty/location rules.

## Capability disposition

The full benchmark mapping is in:

- `SALESPERSON_SFA_V2_CAPABILITY_AUDIT.md`
- `SALESPERSON_SFA_V2_FINAL_MATRIX.md`

The current Gagan field-sales contract passes the core capabilities: attendance, leave, performance, PJP, retailer proposals, retailer intelligence, order history, schemes, secondary ordering, deterministic reorder opportunities, order review/submission, Sales Kit, EOD, expenses, retailer fulfilment visibility, profile, and permissions. Retailer stock audit, competitor capture, surveys, digital signatures, authorized returns, true KM read model, notifications, and stockist/DMS capabilities are explicitly partial or not applicable because no safe canonical contract exists today.

## Freeze status

`GAGAN SALESPERSON FUNCTIONAL V2 — FROZEN`

`GAGAN SALESPERSON VISUAL V2 — FROZEN`

`GAGAN SFA CAPABILITY V2 — FROZEN`

These states are approved and frozen after hosted staging and physical Android
UAT. Future changes require exactly one of:

- a launch-critical defect;
- real salesperson feedback;
- an SAP integration requirement; or
- an explicit founder request.

No additional SFA capability or visual redesign should be started under this
freeze.

## Required release verification

1. Mobile tests, typecheck, and production build.
2. Local web visual inspection of Login, Home, Route, Retailer Detail, Catalog/cart, Activity, My Day, More, Expenses, Issues, Add Retailer, Sales Kit, KYC and permission/offline states.
3. Hosted staging login and canonical order flow with mock SAP.
4. Physical Android install from the standalone APK, including session restore, route, location permission, visit, order, performance, More modules, offline/reconnect and EOD.

The approved standalone release artifact is
`/Users/tanutejas/Desktop/gagan-salesperson-founder-final-5a5656a.apk`
(SHA-256
`dce1fb7fdd8af7ec695c6314842253a7edf6479c5014d365dbefcc6c5f008025`). It
uses package `com.gagan.sales` and the hosted staging API
`https://gagan-staging-api.onrender.com`. It is a standalone release build and
does not require Metro, USB, or the Mac at runtime.

## Physical Android smoke evidence

The standalone APK was installed successfully on the connected Android device (`com.gagan.sales`) and launched explicitly without Metro. The app loaded hosted staging data and remained on the foreground activity without a native or React Native crash.

Verified on-device paths:

- Salesperson session restored and Home loaded.
- Outlets loaded with the seeded multi-store dataset.
- Retailer detail loaded for Annapurna Foods, including credit, outstanding, intelligence, and schemes.
- New order loaded with category filters, product images, prices, and available stock.
- One staging order was placed successfully: `GGN-00000048` for `₹3,120`.
- The placed order appeared in My activity as `Annapurna Foods · placed`.
- Performance and More surfaces loaded after the order flow.

No production data or SAP B1 credentials were used. The staging visual-UAT
fixture and final physical screenshots are recorded in
`SALESPERSON_FOUNDER_VISUAL_ACCEPTANCE.md`.
