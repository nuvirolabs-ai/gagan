# Gagan Salesperson SFA V2 Readiness

## Scope

This branch is a staging/device-UAT candidate for the Gagan Salesperson App. It is based on `origin/codex/gagan-staging` at `47a918dd2dc2237d42e0e845a60b1dde658e4a13` and lives in the isolated worktree `/Users/tanutejas/Documents/Gagan-salesperson-sfa-v2`.

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

## Freeze candidates

`GAGAN SALESPERSON FUNCTIONAL V2 — FROZEN`

`GAGAN SALESPERSON VISUAL V2 — FROZEN`

`GAGAN SFA CAPABILITY V2 — FROZEN`

These labels should be finalized only after hosted staging E2E and physical Android UAT are green. Future work after freeze is limited to a launch-critical defect, real field-user feedback, or an SAP requirement.

## Required release verification

1. Mobile tests, typecheck, and production build.
2. Local web visual inspection of Login, Home, Route, Retailer Detail, Catalog/cart, Activity, My Day, More, Expenses, Issues, Add Retailer, Sales Kit, KYC and permission/offline states.
3. Hosted staging login and canonical order flow with mock SAP.
4. Physical Android install from the standalone APK, including session restore, route, location permission, visit, order, performance, More modules, offline/reconnect and EOD.

No APK is considered ready until it is a standalone staging build with the hosted HTTPS API embedded and the above verification status reported honestly.
