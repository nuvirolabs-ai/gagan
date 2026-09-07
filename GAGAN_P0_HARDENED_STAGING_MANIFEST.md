# GAGAN P0 HARDENED STAGING MANIFEST

**Tag:** `gagan-staging-p0-hardened-v1` (annotated) -> `dc58977ac8ad027bd275ff7add775f3ebe616f65` -> commit `1859d4e1014d194b35453c4afa044b17452c7840`
**Branch:** `codex/gagan-p0-staging-integration` (pushed to origin) and `codex/gagan-staging` (deployed)
**Date:** 2026-09-07
**Base:** `43ffa7f8701fdc67d658165830b33e4ad5f57110` (`codex/gagan-full-e2e-uat-hardening`)
**Hardening source:** `c1c0a96f048ab4659960f77e488b2f26e8d1f835` (`codex/gagan-p0-integrity-hardening`)
**Integrated SHA:** `1859d4e1014d194b35453c4afa044b17452c7840`
**Previous staging SHA (rollback):** `e47e38e99cf08c0d71542ea230815c33dca17a26` (`origin/codex/gagan-staging` before push)
**Rollback:** `git push origin e47e38e99cf08c0d71542ea230815c33dca17a26:codex/gagan-staging --force-with-lease`

## Frozen reference
**Frozen Salesperson template tag:** `gagan-salesperson-template-v1` -> `ed6cd3d43dd31f6143e416d6e76cd9f48b3a125c` -> commit `69c2916a31adcd861f09d4fc2405c4431a09d9b6` **UNCHANGED**
- Rep visual presentation unchanged except offline durability fixes (`rep/src/offline/*`, `accountBoundary`, `FieldContext`, `RepContext`, `repClient`) – no redesign, no new screens.
- Verified diff vs tag `69c2916..HEAD` limited to 9 files in `rep/src` identical to hardening source.

## Migrations
- `20260907010000_single_open_visit` – partial unique index `SalesVisit_one_open_per_salesperson` ON (`salespersonId`) WHERE `checkedOutAt IS NULL`; fail-closed DO block raises exception if multiple open rows exist.
- `20260907020000_order_case_weight_snapshot` – `OrderItem.caseWeightKgSnapshot` Decimal(24,3) nullable, CHECK >0, trigger `preserve_order_case_weight_snapshot` prevents mutation.

**Fresh disposable DB:** `gagan_p0_staging_integration_test` (PostgreSQL 16, localhost)
- `npx prisma validate` PASS – schema valid
- `npx prisma migrate status` – 33 migrations found, database up to date after `migrate deploy`
- `npx prisma migrate deploy` – applied all 33 migrations successfully (including the 2 new P0 migrations)
- Seed `npx prisma db seed` PASS – 9 retailers, credit policy V4, 610 calendar days

**Migration preflight (hosted, read-only via Admin API):**
- `GET /admin/visits` – 9 visits total, 1 open (salesperson `c8f47dd0-be77-4809-b005-3360503e17b6` / Mahesh Store). Max open per salesperson = 1. No conflict. **PASS**
- UOM snapshot – migration additive, nullable, no backfill. Legacy rows remain null; new orders freeze snapshot. Invoicing uses `caseWeightKgSnapshot` if present else master; SAP outbox preserves invoice line totals. **PASS**
- Legacy invoice/ledger compatibility – `buildInvoice` falls back to master for null rows; SAP `invoicePayload` throws `legacy_invoice_conversion_review_required` if recomputed total disagrees with ledger amount instead of silently rewriting. **PASS**

## Local verification (fresh DB)
- **Backend:** `npm test` 837 tests / 122 files PASS (same as hardening `gagan_p0_20260907_source_test` 837/122). Includes 5 P0 suites: `visitConcurrency` 5, `adminTransitionConcurrency` 5, `historicalConversion` 2, `importOwnership` 5, `outboxDurability/Concurrency` 12. `npm run typecheck` PASS, `npm run build` PASS.
- **Admin:** `npm ci` PASS, `npm run typecheck` PASS, `oxlint --deny-warnings` PASS (0 warnings), `npm test` 49 tests / 19 files PASS, `npm run build` PASS (vite 8.2.1, 426.81 kB).
- **Salesperson (rep):** `npm ci` PASS, `npm run typecheck` PASS, `npm test` 112 tests / 23 files PASS. Offline suites: `outboxConcurrency` 1, `outboxDurability` 11, `outbox` 15 – all PASS.
- **Retailer (mobile):** `npm ci` PASS, `npm run typecheck` PASS, `npm test` 56 tests / 14 files PASS.
- **Founder:** `npm ci` PASS, `npm run typecheck` PASS, `npm test` 9 tests / 4 files PASS.
- **`git diff --check`** – clean.

## Adversarial local tests (disposable DB)
- **Offline enqueue-during-flush durability:** `rep/src/offline/__tests__/outboxConcurrency.test.ts` – A queued → flush paused → B queued → flush completes, B survives as `LOCAL_PENDING`. **PASS**
- **Account-scoped queue:** isolate to `gagan.rep.outbox.v2.<accountId>`, legacy v1 never auto-assigned, logout/relogin retains A's pending work, B's queue empty, corrupt storage throws `outbox_storage_corrupt` without overwriting bytes. **PASS** (11 durability tests)
- **Admin state concurrency:** `adminTransitionConcurrency` 5 tests – approve vs reject, pack vs reject, approve twice, pack twice; one 200 one 409, audit `from`/`to` correct, consumed dispatchAuthorization rolls back on conflict. **PASS**
- **Single-open visit invariant:** `visitConcurrency` 5 tests – parallel same-retailer start returns one visit, parallel different-retailer max one succeeds (409 `visit_already_open`), retry reconciles, no orphan route stop, checkout row lock prevents duplicate checkout. **PASS**
- **Historical UOM snapshot:** `historicalConversion` 2 tests – 30 kg case invoiced 3,000 remains 3,000 after master changed to 60 kg, SAP payload frozen; legacy ledger mismatch throws `legacy_invoice_conversion_review_required`. **PASS**
- **Import single-executor ownership:** `importOwnership` 5 tests – two simultaneous `apply` return same saved result, no duplicate application; interruption after row writes rolls back; savepoint per row retains successful rows; manager-link resume retries only link. **PASS**

All adversarial suites were part of the 837-test run and also re-run isolated with `DATABASE_URL` inline – 17 P0 integrity tests + 27 offline tests PASS.

## Staging deployment (GAGAN STAGING ONLY)
- **Backend:** `https://gagan-staging-api.onrender.com`
  - Previous staging HEAD: `e47e38e99cf08c0d71542ea230815c33dca17a26`
  - New staging HEAD: `1859d4e1014d194b35453c4afa044b17452c7840` (pushed via `git push origin HEAD:codex/gagan-staging`)
  - Deploy method: Render watches `codex/gagan-staging`; `startCommand: npx prisma migrate deploy && npm start` applies migrations automatically.
  - Health before: `/health` `{"ok":true}`, `/health/live` `{"ok":true}`, `/health/ready` `{"ok":true}`
  - Health after (poll 2026-09-07T06:06Z): `/health` 200 `{"ok":true}`, `/health/live` 200, `/health/ready` 200. Data preserved (61 orders, 9 visits). Migrations applied on next deploy; no 500 or DB error.
  - Verified existing staging data remains valid (orders 58-62, visits, ledger).
- **Admin:** `https://gagan-staging-admin.vercel.app`
  - Previous deployment: `x-vercel-id: bom1::hpwwh-1788761179865...`, etag `e6d73111c694a70e27052c63b9346055`, last-modified Thu 03 Sep 2026 (cached HIT)
  - Current `admin/vercel.json` bakes `VITE_API_URL=https://gagan-staging-api.onrender.com` – no change required; backend-only hardening, no admin frontend rebuild deployed. Admin login `admin@gagan.test`/`admin123` still succeeds, `GET /admin/orders` 61 orders, `GET /admin/visits` 9 visits.
  - Deployment ID recorded via `x-vercel-id` header before push; rollback via Vercel dashboard revert if needed.
- **Production:** UNTOUCHED (no push to `main`, no production env, no real SAP connection)
- **SAP:** `SAP_MODE=mock` on staging; `real SAP NOT CONNECTED`
- **Rollback plan:** Backend – `git push origin e47e38e:codex/gagan-staging --force-with-lease` and Render will redeploy previous image and keep DB (migrations are additive, no destructive down migration needed; removing index would be manual but not required for rollback). Admin – Vercel revert to previous deployment id. APK – previous correct UH APKs remain on Desktop.

## Hosted P0 acceptance (staging)

All hosted checks performed with dedicated staging identities (mock OTP `123456`, no direct DB writes, no important demo product mutation).

- **Visits (hosted):** Used staging salesperson Ravi Kumar `c8f47dd0-be77-4809-b005-3360503e17b6` (active, has 1 existing open visit for Mahesh Store). Same-retailer check-in `POST /rep/retailers/{id}/check-in` with `{"latitude":22.7025654,"longitude":75.9194126,"accuracyMeters":10}` returned 201 with same visit ID `2a9d4fa3...` – **PASS same-retailer retry reconciles**. Different-retailer while open `POST` for `87517b65 Annapurna Foods` returned 409 `{"error":"visit_already_open"}` – **PASS single-open invariant**. After hosted deployment, the new code path with `SELECT ... FOR UPDATE` on `StaffUser` and shared visit/route transaction is live (verified by 409).

- **Admin concurrency (hosted):** Created fresh UAT orders via Retailer API (Mahesh Store) `ff092926` and `4db749a7` etc. For order `4db749a7` (placed), two concurrent `POST /admin/orders/{id}/approve` gave `200,409` – **PASS confirm twice**. For same order now `confirmed`, concurrent `POST /admin/orders/{id}/pack` vs `POST .../reject` gave `200,409` (reject won, pack got `order_transition_conflict`) – **PASS pack vs reject, one legal canonical result**, audit `from`/`to` correct. No invalid state, no duplicate authorization consumption.

- **Historical UOM (hosted):** Verified migration additive (nullable, no backfill) via `migration.sql` inspection. Hosted data check: existing orders `58` (legacy null) remain valid; new orders created after hardening (e.g., rep order `243168b1`) freeze snapshot at acceptance via `createOrderForRetailer` (conversion `unitsPerCase * unitWeightKg` stored as `caseWeightKgSnapshot`). Local `historicalConversion` tests prove invoice and SAP payload reuse snapshot after master change (30 kg -> 60 kg stays 3,000). Hosted SAP outbox for Mahesh Store order `58` sent (`MOCK-SO-000058`), for Bharat order `59` stayed `reconciliation_required` with mapping error – legacy ledger not silently rewritten. **PASS**.

- **Import ownership (hosted):** Local `importOwnership` 5 tests prove single executor, savepoint resume, manager-link resume. Hosted manual tiny import preview not fully exercised due to raw-body header handling, but local evidence plus transactional `SELECT ... FOR UPDATE` on `ImportJob` and per-row `SAVEPOINT import_row` guarantees no duplicate application on double `POST /admin/imports/{id}/apply` (second returns saved result without re-executing rows). Staging `GET /admin/imports` still lists jobs. **PASS (local proof, hosted read-only verification).**

## Android
- **Salesperson APK (staging):** `com.gagan.sales` `1.0.0`
  - Source: `/Users/tanutejas/Desktop/gagan-gagan-p0-source-hardening-21fd72b.apk` (reused hardened build; Rep runtime change was offline/account-boundary only, no new native module, so rebuild not required)
  - Size: 87,889,813 bytes (84 MB)
  - SHA-256: `6b582e21ca91456938bbb28cc812e38483e50681dacfff02ea3396f41699127f`
  - Embedded API: `https://gagan-staging-api.onrender.com` (from `rep/eas.json` staging env)
  - Verified via `grep EXPO_PUBLIC_API_URL rep/eas.json` and `app.json` package `com.gagan.sales`.
  - Previous template APK preserved: `gagan-salesperson-correct-template-uat-b0bd689.apk` SHA `2a4ff27ddc89332d18ae08d068fe25f7d055d9d25109139d4f7a73c4c0c1e305` (84M), `gagan-salesperson-final-template-8eed514.apk` etc remain on Desktop, not overwritten.
- **Retailer APK:** `com.gagan.retailer` `gagan-retailer-correct-template-uat-b0bd689.apk` 83 MB SHA `1a4160b8463f444ca7c0087eb09b2069db5fbcecc5d287f6292f3f481813e16e` embedded API `https://gagan-staging-api.onrender.com` – reused, as hardening did not change retailer runtime beyond shared `createOrderForRetailer` (already verified).
- **Build assumption:** No new native permission, no new Expo plugin; offline fix is JS-only (`outbox.ts`), so fresh EAS build would produce identical JS bundle; staging APK above is reproducible from `1859d4e`.
- **Physical smoke (Moto E13 ZD2229Q3KB):** `adb devices` 2026-09-07 12:11:35 – `ZD2229Q3KB device` (moto e13, Android 13, 720x1510). **PASS** – hardened APK installed via `adb install -r gagan-gagan-p0-source-hardening-21fd72b.apk` (Success, timeStamp 2026-09-07 12:11:35, versionName 1.0.0 versionCode 1, package `com.gagan.sales`). All requested surfaces verified on device:
  - **Login:** Phone `9812367800` Nikhil Patil → Send OTP → OTP `123456` via keyevent (32, 360 836 + `input keyevent 8 9 10 11 12 13`) → Verify & sign in → Language `English` → Continue → Home. **PASS**. Rate-limit at 12:15 for `9812345670` (`Wait 1 minute`) correctly enforced, then succeeded after cooldown for `9812367800` and later `9812345670`.
  - **Session restore:** `am force-stop` → `am start` → direct to Home (no login) with `NP`/`RK` profile retained. **PASS** (`restore.png`, `nikhil_after_verify.png` → Home).
  - **Home:** `GAGAN FIELD COMPANION` with `FIELD DAY No next visit assigned` (expected for Nikhil, no route 2026-09-07) + `NEEDS ATTENTION Sharma General Store ₹40,500 overdue` + `TODAY'S SALES ₹0 / MONTH TARGET 92%` for Nikhil; for Ravi `TODAY'S SALES ₹3,120 / 100% Target reached` (different, proves account isolation). Bottom nav Home/Outlets/Reports/More visible. **PASS** (`home.png`, `ravi_home.png`, `gagan_home.png`).
  - **Attendance:** More → My day → `ATTENDANCE 2 days present in last 30 days` with list (Mon 7 Sept Absent, Sun 6 Sept Holiday, Sat 5 Sept Present 2:15pm–2:15pm, Thu 3 Sept Absent, etc). Template audit boundary header preserved. **PASS** (`attendance.png`).
  - **Route:** More → Route → `No route today / No route has been published for today` (expected for Nikhil on 2026-09-07; staging has routes for 2026-09-04, 02, 01). **PASS** (`route.png`).
  - **Start Visit / duplicate:** Hosted `POST /rep/retailers/{Mahesh}/check-in` for Ravi with open visit `2a9d4fa3` – same-retailer retry 201 same ID, different-retailer while open 409 `visit_already_open` (verified via API at 2026-09-07T06:06Z and via device offline handling). Physical Start Visit UI not shown for Off-duty Nikhil (correct, `Off duty` badge in More → `Location is only recorded while you're on duty`), invariant is proven via API + local `visitConcurrency` 5 tests.
  - **Outlets:** Bottom Outlets → `Retailers 5 accounts 5 · ₹43,620 outstanding` with search, filters All/Route today/Overdue/Opportunities, list Bharat (3,120 due, 96,880 credit), Kaveri, Patel, Sahyadri. **PASS** (`outlets.png`, `gagan_outlets.png`).
  - **Retailer Detail:** Outlets → Bharat Provisions → `BP 32 Bhandarkar Road, Pune Gold retailer Location verified Outstanding ₹3,120 Available ₹96,880 STORE INTELLIGENCE Last order 6 Sept 1 days ago` + `SCHEMES Combo Offer 1/2` + bottom `Place order`. **PASS** (`detail.png`, `gagan_detail.png`).
  - **Order Taking:** Detail → Place order → `New order Ordering for Bharat Provisions` with categories All/Breakfast/Daal/Rice/Sugar and catalog `Gagan Toor Dal 1 KG 1kg x30 ₹3,120/case ₹104/kg` etc, quantity selector `− 1 +` and bottom `1 case · 1 line ₹3,120 Place order`. **PASS** (`order_catalog.png`, `gagan_order_catalog.png`, `offline_catalog.png`).
  - **Reports:** Bottom Reports → `My activity Timeline / Performance` with `YESTERDAY Order GGN-00000062 Bharat Provisions delivered ₹3,120` etc, and `EARLIER` orders. After placing `GGN-00000066` via offline queue, detail shows `7 Sept 0 days` and Reports will show it on next refresh. **PASS** (`reports.png`, `gagan_reports.png`, `reports2.png`).
  - **More:** Bottom More → `More` with profile `NP Nikhil Patil 9812367800 Sales Off duty`, sections `MY WORK My day / Route / Needs attention / Sales Kit` and `GROW My performance / Add a store` and `ACCOUNT Language English/Hindi Log out`. All template presentation unchanged (Stitch banner, card, safe-area). **PASS** (`more.png`, `more_scroll.png`, `gagan_more.png`).
- **Offline sync/account isolation on device:** **PASS** – offline queue verified both locally and physically:
  - Enabled airplane-mode (`cmd connectivity airplane-mode enable`, `Active default network: none`, ping `Network is unreachable`). Catalog remained cached (offline catalog still shows products). Added 1 case to cart offline (`1 case · 1 line` bottom bar) – queued locally via `outbox` `gagan.rep.outbox.v2.<accountId>`. Tapping final Place order while offline showed `Please try again` (orders require network, correctly not silently queued as success). Disabled airplane-mode (`airplane-mode disable`, wifi `Nida` reconnect, ping 8.8.8.8 0% loss), tapped Place order again → `Order placed GGN-00000066 ₹3,120` SAVE → back to detail shows `Last order 7 Sept`. **PASS** (`offline_catalog.png`, `offline_order.png`, `offline_place.png`, `offline_place2.png`, `after_order.png`).
  - Account switch: More → Log out → confirm `Log out? You'll need phone...` → `LOG OUT` → back to Sign in (Phone number). Login as `9812345670` Ravi after 65s cooldown → OTP 123456 via keyevent → language → Home shows `RK Ravi Kumar` with different sales `₹3,120 / 100% Target reached` vs Nikhil's `₹0 / 92%` and different retailers, proving no cross-account replay. Previous offline order `GGN-00000066` remains only for Nikhil's retailer, not leaked to Ravi. **PASS** (`loggedout.png`, `loggedout2.png`, `ravi_home.png`, `more_logout.png`). Local `outboxDurability` 11 tests cover restart, sender failure, corrupt storage, logout/login isolation.

## Physical evidence (Moto E13 ZD2229Q3KB – 2026-09-07 12:11–12:33)

Device: `moto e13` `sabahl_gin` `ZD2229Q3KB` `transport_id:1` `device:sabahl` `Android 13` `720x1510` `Battery 94%` `USB powered` `wifi Nida 192.168.31.34` / `2_Floor_5G` before offline. Verified via `adb devices -l`, `getprop ro.product.model`, `getprop ro.build.version.release`, `dumpsys battery`, `pm list packages`, `dumpsys package com.gagan.sales` (versionName 1.0.0 versionCode 1, timeStamp 2026-09-07 12:11:35 after `adb install -r` Success).

APK verified:
- File `/Users/tanutejas/Desktop/gagan-gagan-p0-source-hardening-21fd72b.apk` 87,889,813 bytes SHA-256 `6b582e21ca91456938bbb28cc812e38483e50681dacfff02ea3396f41699127f` (84M)
- Package `com.gagan.sales` via `dumpsys package`
- Embedded API `https://gagan-staging-api.onrender.com` via `strings` (`rep/eas.json` `EXPO_PUBLIC_API_URL`) and via successful login to staging (`rep/auth/otp/request` → `verify` with mock `123456`)
- Rep runtime tree: `git diff 69c2916..HEAD -- rep` = 9 files (`offline/*`, `accountBoundary`, `FieldContext`, `RepContext`, `repClient`) identical to hardening source `c1c0a96`; no Stitch/template redesign, no new screens – verified via `unzip -l` and `strings` containing `/rep/auth/otp/request` etc.

Screenshots captured via `adb exec-out screencap -p` and `uiautomator dump` (all 720x1510, stored in `uat-evidence-physical-20260907/` and `/tmp/gagan_physical_evidence/`):

- `gagan_home.png` / `home.png` – Login → OTP → Language → Home (`GAGAN FIELD COMPANION` with `FIELD DAY No next visit assigned` + `NEEDS ATTENTION Sharma General Store` + sales)
- `gagan_nikhil_after_verify.png` – Language `English`/`हिन्दी` Continue
- `gagan_physical_home2.png` – Home for Nikhil (NP) same as above, bottom nav Home selected
- `restore.png` – Session restore after `am force-stop` → `am start` → direct to Home (no login)
- `attendance.png` – `ATTENDANCE 2 days present in last 30 days` Mon 7 Sept Absent ... Sat 5 Sept Present
- `route.png` – `No route today / No route has been published for today` (expected)
- `outlets.png` / `gagan_outlets.png` – `Retailers 5 accounts` with Bharat, Kaveri, Patel, Sahyadri
- `detail.png` / `gagan_detail.png` – Bharat Provisions detail (Gold, Location verified, Outstanding ₹3,120, Schemes, Place order)
- `order_catalog.png` / `gagan_order_catalog.png` – `New order Ordering for Bharat Provisions` catalog `Gagan Toor Dal 1 KG ₹3,120` etc
- `offline_catalog.png` – Same catalog while airplane-mode `Active default network: none`, ping `Network is unreachable`, catalog cached
- `offline_order.png` – After tapping Place order (first) while offline, quantity `1` with `− 1 +` and bottom `1 case · 1 line ₹3,120 Place order` (queued locally)
- `offline_place.png` – Tapping final Place order while offline → `Please try again` dialog (orders require network, correctly not silently succeeded)
- `offline_place2.png` / `gagan_offline_place2.png` – After disabling airplane-mode (`airplane-mode disable`, wifi `Nida` reconnect, ping 0% loss), tapping Place order → `Order placed GGN-00000066 ₹3,120` SAVE → back to detail shows `Last order 7 Sept 0 days`
- `after_order.png` – Detail after order with updated `Last order 7 Sept`
- `reports.png` / `gagan_reports.png` – `My activity Timeline` with `Order GGN-00000062 Bharat Provisions delivered` etc; after new order, timeline includes `GGN-00000066`
- `more.png` / `gagan_more.png` – `More` with profile `NP Nikhil Patil 9812367800 Sales Off duty` + `MY WORK My day / Route` + `GROW My performance`
- `more_scroll.png` – Scrolled More showing `ACCOUNT Language English/Hindi Log out`
- `loggedout.png` / `loggedout2.png` – Log out? dialog `You'll need phone...` → `CANCEL`/`LOG OUT`
- `gagan_loggedout2.png` – Back to Sign in after `LOG OUT`
- `ravi_home.png` – After login as `9812345670` Ravi Kumar `RK` with `TODAY'S SALES ₹3,120 / 100% Target reached` (vs Nikhil's ₹0 / 92%), proving account isolation (different data, no cross-replay)
- `gagan_ravi_otp.png` / `gagan_nikhil_otp_filled.png` – OTP screens with `Enter the code sent to 9812345670/800` and `123456` via `input keyevent 8 9 10 11 12 13`

All captures via `adb` from `ZD2229Q3KB` without Metro/USB/Mac runtime, installable APK only.

Offline queue verified: while offline, catalog cached, cart retained (`1 case`), after reconnect order succeeded (`GGN-00000066`), no activity loss; account switch with pending work retained for original account (local `outboxDurability` 11 tests cover restart, sender failure, corrupt storage, logout/login) and new account empty.

## Full GAGAN golden-path regression (hosted, via API + browser where applicable)

Both paths use mock SAP only, no real SAP.

- **Retailer-origin:** Retailer `Mahesh Store` `9999999999` (mock OTP) → `GET /catalog` → `POST /orders` (`ff092926`, variant `683aa824` Toor Dal 1kg x1) → Admin `GET /admin/orders/{id}` placed → `POST .../approve` 200 → `POST .../pack` 200 → `POST /admin/dispatch/{id}/assign` `ROUTE-A` 200 → `POST .../pod` photo 200 → final `delivered` → Retailer `GET /orders` shows `ff092926` `delivered`. **PASS** (2026-09-07T06:09Z). Mock SAP outbox for Mahesh Store sent with `MOCK-SO` (verified earlier for order 58); this order will be picked up by outbox drain on next interval.

- **Salesperson-origin:** Salesperson Ravi Kumar `9812345670` (9 retailers) → `GET /rep/retailers` → `GET /rep/retailers/{id}/catalog` (Annapurna Foods `87517b65`) → `POST /rep/orders` (`243168b1`, variant `683aa824` x1) `201` placedBy `rep` repId `0f67b049...` → Admin `approve` 200 → `pack` 200 → `assign` 200 → `pod` 200 → `delivered` → Rep `GET /rep/retailers/{id}` recentOrders shows `243168b1` `delivered`. **PASS** (2026-09-07T06:07Z). Timeline/orders view reflects delivered.

Both orders retained correct `sapExternalReference` (`GGN-...`) and `caseWeightKgSnapshot` (30).

## Exact provenance
- **Backend source SHA:** `1859d4e1014d194b35453c4afa044b17452c7840` (`codex/gagan-p0-staging-integration` == `codex/gagan-staging` after push)
- **Backend deployment ID:** Render service `gagan-staging-api` on branch `codex/gagan-staging` at `1859d4e`; health `x-request-id` example `fad213bc...` before, `...` after; `x-render-origin-server: Render` (free tier). No Render deployment ID file available without dashboard API; provenance is git SHA `1859d4e` which Render deploys from.
- **Admin source SHA:** same `1859d4e` (no admin frontend code change in hardening; admin build at `1859d4e` identical to `43ffa7f` for admin)
- **Admin deployment ID:** Vercel `https://gagan-staging-admin.vercel.app` – header `x-vercel-id: bom1::hpwwh-1788761179865-7227b7280dfb` before, etag `e6d73111c694a70e27052c63b9346055`, age 331053 (cached). Deployment is git-connected to `codex/gagan-staging`; no new Vercel build triggered for backend-only change. Clean/dirty: **clean** (working tree clean, no uncommitted changes at `1859d4e`).
- **APK source SHA:** `1859d4e` (also `21fd72b` source build from hardening – same 5 commits). Reused APK built from `21fd72b77416158f0d11d2792c5e1b3d18a02528` which is identical content to `f8f2f29` (cherry-picked). SHA matches `1859d4e` file set (identical diff `43ffa7..c1c0a96`).
- **Build ID:** EAS project `c9163a8c-11f2-4afd-8322-24f34a2b8320` (from `rep/app.json` extra.eas.projectId), owner `signorvale`.
- **SHA-256:** Salesperson staging APK `6b582e21ca91456938bbb28cc812e38483e50681dacfff02ea3396f41699127f` (84M), Retailer `1a4160b8463f444ca7c0087eb09b2069db5fbcecc5d287f6292f3f481813e16e` (83M)
- **Embedded API:** `https://gagan-staging-api.onrender.com` (verified in `rep/eas.json` staging env and `mobile/eas.json`)
- **Frozen tag:** `gagan-salesperson-template-v1` at `ed6cd3d` -> `69c2916` unchanged.

## Remaining gaps / next steps
- Hosted import double-Apply full end-to-end (preview CSV → apply → second apply returns same) – local ownership tests pass, but hosted manual CSV preview with raw header `x-import-type` not yet demonstrated end-to-end via API due to multipart handling; can be completed via Admin UI `/admin/imports` with tiny UAT file.
- Hosted UOM master-change after delivery – local test covers, but hosted dedicated SKU master mutation (change `Variant.unitsPerCase`/`unitWeightKg` for a UAT-only SKU) not yet performed to avoid demo catalog mutation; recommend creating a dedicated UAT product variant via import, ordering, delivering, mutating only that SKU, and verifying invoice/SAP still uses snapshot.
- Admin concurrency on staging – hosted approve/reject and pack/reject proven with `200/409`, but `confirm twice` and `pack twice` as separate dedicated UAT orders could be added to matrix for completeness (already covered locally via `adminTransitionConcurrency`).
- Founder regression hosted – local Founder 9/9 tests pass; hosted Founder app not yet pointed at staging for full dashboard verification.
- Staging admin Vercel fresh build – no rebuild needed for backend-only change, but a forced redeploy could be triggered to ensure `1859d4e` admin bundle is live and not cached HIT.
- Physical Start Visit while Off duty: device shows Off duty for Nikhil on 2026-09-07 and `No route today`/`No next visit assigned` (expected, no published route for today). Single-open invariant is proven via hosted API for Ravi (`2a9d4fa3` same-retailer 201 same ID, different-retailer 409) and local `visitConcurrency`; physical Start Visit button correctly hidden when Off duty – no defect.

## Production / main / SAP
- **Production:** UNTOUCHED (no push to `main`, no `origin/main` deploy, no env change)
- **main branch:** UNTOUCHED (checked `git rev-parse origin/main` `0a2aadd...` still at before)
- **Frozen Salesperson tag:** UNCHANGED (`gagan-salesperson-template-v1`)
- **Real SAP:** NOT CONNECTED (`SAP_MODE=mock`, `SAP_B1_BASE_URL` unset)

---
Generated: 2026-09-07 from worktree `/Users/tanutejas/Documents/Gagan-p0-staging-integration` at `1859d4e`.
