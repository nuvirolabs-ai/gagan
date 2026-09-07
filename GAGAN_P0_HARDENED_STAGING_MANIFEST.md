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
- **Physical smoke (Moto E13 ZD2229Q3KB):** `adb devices` 2026-09-07 returned empty – device not connected/authorized at verification time. **BLOCKED** – server/browser work completed, physical install/login/Home/Attendance/Route/Start Visit/Outlets/Detail/Order/Reports/More smoke not executed; mark as physical BLOCKED per spec, to be completed when device present. Local backend `aph`/`app` DBs show retailer/rep login/Home flows still pass via API.
- **Offline sync/account isolation on device:** Not executed physically; local `outbox` tests prove durability and isolation (restart, sender failure, account switch, logout/login, corrupt storage). Will be re-verified when device returns.

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
- Physical Moto E13 smoke: device not attached at `adb devices` check 2026-09-07T06:10Z – needs install of `gagan-gagan-p0-source-hardening-21fd72b.apk` and through login/Home/Attendance/Route/Start Visit/Outlets/Detail/Order/Reports/More, plus offline air-plane mode queue + account switch isolation. Mark **BLOCKED** until device present.
- Hosted import double-Apply full end-to-end (preview CSV → apply → second apply returns same) – local ownership tests pass, but hosted manual CSV preview with raw header `x-import-type` not yet demonstrated end-to-end via API due to multipart handling; can be completed via Admin UI `/admin/imports` with tiny UAT file.
- Hosted UOM master-change after delivery – local test covers, but hosted dedicated SKU master mutation (change `Variant.unitsPerCase`/`unitWeightKg` for a UAT-only SKU) not yet performed to avoid demo catalog mutation; recommend creating a dedicated UAT product variant via import, ordering, delivering, mutating only that SKU, and verifying invoice/SAP still uses snapshot.
- Admin concurrency on staging – hosted approve/reject and pack/reject proven with `200/409`, but `confirm twice` and `pack twice` as separate dedicated UAT orders could be added to matrix for completeness.
- Founder regression hosted – local Founder 9/9 tests pass; hosted Founder app not yet pointed at staging for full dashboard verification.
- Staging admin Vercel fresh build – no rebuild needed for backend-only change, but a forced redeploy could be triggered to ensure `1859d4e` admin bundle is live and not cached HIT.

## Production / main / SAP
- **Production:** UNTOUCHED (no push to `main`, no `origin/main` deploy, no env change)
- **main branch:** UNTOUCHED (checked `git rev-parse origin/main` `0a2aadd...` still at before)
- **Frozen Salesperson tag:** UNCHANGED (`gagan-salesperson-template-v1`)
- **Real SAP:** NOT CONNECTED (`SAP_MODE=mock`, `SAP_B1_BASE_URL` unset)

---
Generated: 2026-09-07 from worktree `/Users/tanutejas/Documents/Gagan-p0-staging-integration` at `1859d4e`.
