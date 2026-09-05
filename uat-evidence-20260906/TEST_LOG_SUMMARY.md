# UAT Test Log Summary — 2026-09-06

This is the persistent run-log summary for the evidence directory. It records
the command-level results without storing credentials, tokens, or device
authentication state.

## Environment

- Candidate: `b0bd68911d7fe2c61ccd954ab8b3e4683b0d9054`
- Application DB: `gagan_uat_app_20260905204147`
- Disposable test DB: `gagan_uat_auto_20260905204147`
- Backend health/readiness: HTTP 200 on local port 4100
- Physical Android: Moto E13 `ZD2229Q3KB`, Android 13, 720×1600
- Hosted release API embedded in both APKs: `https://gagan-staging-api.onrender.com`

## Automated result log

| Check | Result |
|---|---|
| Prisma migrations on app DB | PASS — 31 migrations |
| Prisma migrations on auto DB | PASS — 31 migrations |
| `npx prisma validate` | PASS |
| Backend `npm test` on disposable DB | PASS — 118 files, 820 tests, 0 skipped |
| Backend `npm run typecheck` | PASS |
| Backend `npm run build` | PASS |
| Rep `npm test` | PASS — 21 files, 100 tests |
| Rep `npm run typecheck` | PASS |
| Mobile `npm test` | PASS — 14 files, 56 tests |
| Mobile `npm run typecheck` | PASS |
| Admin `npm test` | PASS — 19 files, 49 tests |
| Admin `npm run typecheck` | PASS |
| Admin `npm run lint` | PASS |
| Admin `npm run build` | PASS |
| Founder `npm test` | PASS — 4 files, 9 tests |
| Founder `npm run typecheck` | PASS |
| Founder build | NOT CONFIGURED — no build script in `founder/package.json` |
| `git diff --check` | PASS |

## Read-only invariant log

- Fresh native orders: `GGN-00000040` and `GGN-00000041`; both delivered.
- Each order: `qtyOrdered=2`, `qtyDelivered=2`, `weightDelivered=60.000`,
  unit price ₹3,150, order total ₹6,300.
- Inventory snapshots: 8 rows, 0 negative rows, 0 rows where
  `available != onHand - committed`.
- Fresh invoices: 2, total ₹12,600, outstanding ₹12,600, both open.
- Payments: 0; delivery was not treated as payment.
- SAP: Mahesh mapped order sent as `MOCK-SO-000041`; Patel unmapped order stayed
  `reconciliation_required` with `Order is not fully linked to SAP yet`.
- Audit events: confirm, pack, dispatch, delivery for both orders; SAP sync
  events for the mapped record.

## Physical APK log

- Salesperson APK installed with `adb install -r -d`; package
  `com.gagan.sales`; native hosted login, OTP, language, Home and session
  restore observed; no Metro warning/runtime requirement.
- Retailer APK installed with `adb install -r -d`; package
  `com.gagan.retailer`; standalone hosted login screen observed; no Metro
  warning/runtime requirement.
- Existing app data was not wiped and the approved fallback APK was not
  overwritten.

No screen recording was created in this UAT pass. The persistent screenshot set
contains the native app, Admin browser, SAP integration, and exact-release
launch/status evidence referenced by the final report.
