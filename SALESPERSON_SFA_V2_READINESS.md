# Gagan Salesperson SFA V2 Readiness

## Scope

This branch is a staging/device-UAT candidate for the Gagan Salesperson App. It is based on `origin/codex/gagan-staging` at `47a918dd2dc2237d42e0e845a60b1dde658e4a13`, with the integrated implementation committed at `1ab737cf3f50b1cd382456f4e56a0b0b5782cbdf`, and lives in the isolated worktree `/Users/tanutejas/Documents/Gagan-salesperson-sfa-v2`.

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

The local standalone release build is verified with the hosted HTTPS API embedded at `/Users/tanutejas/Desktop/gagan-salesperson-sfa-v2-1ab737c.apk` (SHA-256 `8e12a65308e240baf1046f7084fc838b4ff7af9b603238d054163f0fe9ccaca7`). EAS build `cebd813d-6392-4c74-8fc0-5cbb68e3245e` is queued for the shareable internal-distribution URL; it is not treated as complete until EAS and physical-device verification finish.

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

The remaining release evidence is the clean-identity login sequence and the EAS-hosted install URL. No production data or SAP B1 credentials were used.
