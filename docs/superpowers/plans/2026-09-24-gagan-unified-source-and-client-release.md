# Gagan Unified Source and Client Release Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one verified Gagan source checkpoint containing the accepted catalogue, Feedback-v2, responsive, and target-celebration work, then build and physically smoke-test one current Retailer/Salesperson APK pair from that exact checkpoint.

**Architecture:** Continue in the existing isolated `codex/gagan-client-feedback-v2-reconciled` worktree because its committed lineage descends from the clean catalogue checkpoint `5a632711025f5eb6d42a75e26529ce739f06f982`; do not merge donor branches wholesale. Record the source audit before runtime edits, preserve and test the existing uncommitted target-celebration delta, and use the current backend contract as the authority for orderability, quote, routing, GST, and invoice behavior. Build only with the local Android Studio Gradle toolchain after source verification, then install as an in-place update without clearing app data.

**Tech Stack:** Git worktrees, Node/npm, TypeScript, Vitest, Prisma, disposable PostgreSQL, Expo-generated Android projects, Android Studio JBR, Gradle, adb, apksigner/aapt.

**Spec:** `/Users/tanutejas/.codex/attachments/35f30448-47ac-4d64-ae59-7042a3c2d4d1/Pasted text.txt`

## Global Constraints

- Canonical repository: `/Users/tanutejas/Documents/GAGAN/CURRENT/SOURCE`; selected reconciled worktree: `.worktrees/gagan-client-feedback-v2-reconciled`.
- Keep production, `main`, Dogkart, GNV, real SAP, hosted data, frozen tags, APK history, other worktrees, and uncommitted node_modules untouched.
- Preserve the exact 46-migration lineage, including `20260922180000_internal_staging_inventory`, `20260922200000_pending_gst_ordering`, and `20260924060000_feedback_v2_service_request`; do not restore `20260917150000_staging_inventory_identity`.
- Staging API embedded in both review apps: `https://gagan-srat.onrender.com`; do not deploy or mutate hosted data.
- Preserve package IDs `com.gagan.retailer.review` and `com.gagan.sales.review` and signing certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
- Current device versions are Retailer `1.0.16` / code `17` and Salesperson `1.0.19` / code `19`; any replacements must be at least Retailer code `18` and Salesperson code `20`.
- Build locally with Android Studio/Gradle; do not use EAS, an archive/WhatsApp/download APK, or a generated build from another worktree.
- Do not submit orders or other business transactions unless the physical acceptance step cannot be evidenced otherwise and the current identity is confirmed as a controlled staging test account.
- Before replacing an installed review app, verify its expected review Store profile is signed in on the phone and the installed package signing fingerprint matches the approved fingerprint. If either gate cannot be proven, stop before that app's install; do not uninstall, clear data, or try a different signer.
- If Android reports `UPDATE_INCOMPATIBLE`, stop that app's update path immediately. Do not uninstall or clear data. If a protected historical Store build is unavailable for comparison, builds may still be produced, but do not claim that specific native update path as verified.

## Review Focus

- The current branch must remain a descendant of the exact 46-migration catalogue lineage; the migration ledger must not gain an old or duplicate migration.
- Retailer and Salesperson add/quote controls must continue to follow fresh server orderability and inventory guards; no client-side bypass is acceptable.
- Home and Products focus refreshes must be checked for intentional freshness behavior versus redundant catalogue requests; do not remove freshness checks to improve a benchmark.
- An order must not be presented as a completed visit; only a real checked-in visit followed by explicit checkout may enable the next-retailer action.
- Each installed APK must have the exact unified source identity, approved API, package, increased version code, and matching installed signing certificate before update installation.

---

### Task 1: Record the source and feature audit before runtime changes

**Files:**
- Create: `docs/GAGAN_UNIFIED_SOURCE_AUDIT_2026-09-24.md`
- Read: `docs/CLIENT_FEEDBACK_V2_RECONCILIATION_MATRIX.md`
- Read: `docs/real-catalogue/SIX_VARIANT_READINESS_2026-09-22.md`

- [x] Record the clean canonical checkout (`5a6327…`), reconciled branch head (`ec76fbf…`), its sole working-tree source delta (the target-celebration files), and all known preserved dirty/untracked worktrees.
- [x] For every item in the spec, enter `PRESENT`, `MISSING`, `PARTIAL`, or `CONFLICT`, exact source paths, and whether evidence is source/test-only or still needs physical confirmation.
- [x] Record the audit result that `5a6327…` is an ancestor of `ec76fbf…`, that the reconciled migration directory has exactly 46 migrations, that only `20260924060000_feedback_v2_service_request` is added after `5a6327…`, and that the obsolete inventory migration is absent.
- [x] Record the old APK hashes and source identity from `CURRENT/BUILDS/CLIENT-FINAL-v1/FINAL_CLIENT_PACKAGE_MANIFEST.md`; distinguish source proof from physical acceptance.
- [x] Explicitly flag the focus-triggered Home/catalog fetch and 1.3 font-scale physical check for verification rather than claiming them from code alone.

### Task 2: Preserve and verify the target-celebration delta

**Files:**
- Modify: `backend/src/modules/performance/__tests__/achievements.test.ts`
- Modify: `rep/src/context/FieldContext.tsx`
- Modify: `rep/src/screens/TodayScreen.tsx`
- Create: `rep/src/performance/achievementPresentation.ts`
- Create: `rep/src/performance/__tests__/achievementPresentation.test.ts`

- [x] Run the focused backend achievement tests and salesperson presentation tests against the existing working-tree delta; confirm `TARGET_90` stays a minor progress item, `TARGET_100` is the sole target modal, non-target major events retain their modal, and event dedupe remains backend-owned.
- [x] Run `npm run typecheck` in `backend/` and `rep/`; fix only an actual type/test defect in this scoped delta.
- [x] Keep the backend milestone calculation authoritative and do not add another event/celebration store.

### Task 3: Verify the local contract and full source quality gates

**Files:**
- Test only unless a verified defect is found; any source correction must be paired with a focused regression in the owning package.

- [x] Create a uniquely named disposable local PostgreSQL database after confirming it does not already exist; apply all 46 migrations from zero, then run `npx prisma validate` and `npx prisma migrate status` against that disposable database.
- [x] Run backend `npm test`, `npm run typecheck`, and `npm run build`.
- [x] Run Admin `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- [x] Run Retailer `npm test` and `npm run typecheck`.
- [x] Run Salesperson `npm test` and `npm run typecheck`.
- [x] Run focused local contracts for Broken rice price derivation, GST-pending/no-zero-tax presentation, fresh-inventory addability, quote, dynamic Jain/Padam route, and invoice block in both clients plus the backend authoritative workflow.
- [x] Run `git diff --check`; report fresh test counts, not counts copied from earlier manifests.

### Task 4: Pin one source checkpoint without rewriting history

**Files:**
- Update only the new audit document and the accepted target-celebration source/test files listed in Task 2.

- [x] Review the final diff against `5a6327…`; confirm all Wave 1B, routing, catalogue, Feedback-v2, Admin, Retailer, Salesperson, and responsive changes remain in the same descendant lineage.
- [x] Inspect repository deployment workflows and the existing staging branch binding read-only; Render auto-deploy is disabled and GitHub CI only runs on PRs/`main`. Vercel preview-on-branch behavior is unverified, so per the no-deploy boundary remote pushes are withheld (see the execution ledger ruling).
- [x] Commit the source audit and reviewed celebration delta on the existing `codex/gagan-client-feedback-v2-reconciled` branch as `afce192e3941d04e0389038b2eeb151a68ccae85`; no duplicate worktree or tag was created/moved.
- [x] Prove `afce192e3941d04e0389038b2eeb151a68ccae85` descends from `5a632711025f5eb6d42a75e26529ce739f06f982` and the worktree is clean. Push withheld because the linked Vercel preview behavior remains unverified; the remote is unchanged.
- [x] Fast-forward the clean root `codex/gagan-canonical-product-v1` checkout from exact `5a632711025f5eb6d42a75e26529ce739f06f982` to `afce192e3941d04e0389038b2eeb151a68ccae85`. Push withheld under the same no-hosted-deploy condition.

### Task 5: Build source-attested Android review APKs locally

**Files:**
- Build from the pinned source; generated native files remain worktree-local and are not source edits.
- Create: `/Users/tanutejas/Documents/GAGAN/CURRENT/BUILDS/GAGAN-UNIFIED-LATEST/Gagan-Retailer-LATEST.apk`
- Create: `/Users/tanutejas/Documents/GAGAN/CURRENT/BUILDS/GAGAN-UNIFIED-LATEST/Gagan-Salesperson-LATEST.apk`
- Create: `RELEASE_MANIFEST.md`, `FEATURE_MATRIX.md`, and `evidence/` in that output folder.

- [ ] Verify the output directory does not already exist; do not overwrite historical builds.
- [ ] Generate/update each local Android project using the app's staging-review config and exact environment: `EXPO_PUBLIC_API_URL=https://gagan-srat.onrender.com`, `EXPO_PUBLIC_BUILD_SOURCE_SHA=<full pinned SHA>`, `EXPO_PUBLIC_BUILD_CHANNEL=gagan-unified-client`, and a source version string tied to that SHA.
- [ ] Set Retailer review version code at least `18` and Salesperson review version code at least `20`; use version names `1.0.17` and `1.0.20` respectively unless current native metadata has advanced, in which case increment above the observed installed version.
- [ ] Build `assembleRelease` with `/Applications/Android Studio.app/Contents/jbr/Contents/Home`; do not invoke EAS.
- [ ] Verify both APK packages, version names/codes, embedded API and source SHA, release channel, APK SHA-256, and signing certificate fingerprint before installation.

### Task 6: Install and physically verify the exact pair on Moto E13

**Device:** `ZD2229Q3KB`

- [ ] Confirm the connected device and currently installed package versions immediately before install.
- [ ] Confirm the `gagan-hosted-review` Store profile is signed in before the Retailer update and the `gagan-sales-review` Store profile is signed in before the Salesperson update; record only a yes/no result, not account credentials. If either is absent or cannot be verified, stop before installing that package.
- [ ] Confirm installed package provenance and signer match the expected in-place update path. Treat `UPDATE_INCOMPATIBLE` as a hard stop; never uninstall or clear app data to work around it.
- [ ] Install the Retailer APK as an in-place update without uninstall or data clear; verify installed package/version/signature/source identity.
- [ ] Verify Retailer login/session, Home banner and Outstanding order, Products/six variants/pricing/GST pending, Add/Cart/Review/quote, service-request Withdrawn display where an existing controlled record is available, active-tab scroll-to-top, and safe-area navigation.
- [ ] Install the Salesperson APK as an in-place update without uninstall or data clear; verify installed package/version/signature/source identity.
- [ ] Verify Sales login/session, Today/My Day, retailer/outlet surface, six variants/pricing/GST pending/Add/Review, Add Store Page 2 first field with keyboard, Market Surveys navigation under existing capability, target progress and major/minor celebration policy, and safe-area navigation.
- [ ] Test 1.3 font scaling and any alternate navigation mode only when reversible: record the device's current settings first and restore them exactly afterward.
- [ ] Capture physical evidence into the new release folder. Do not fabricate attendance, visits, GPS, orders, surveys, service requests, or target events.

### Task 7: Assemble and validate the release handoff

**Files:**
- Update: `/Users/tanutejas/Documents/GAGAN/CURRENT/BUILDS/GAGAN-UNIFIED-LATEST/RELEASE_MANIFEST.md`
- Copy: `docs/GAGAN_UNIFIED_SOURCE_AUDIT_2026-09-24.md` to `FEATURE_MATRIX.md`
- Add: physical screenshots and a concise evidence index under `evidence/`

- [ ] Record branch, full source SHA, build timestamp, source files included, API, channel, package/version, APK checksums, signing fingerprint, migration count, fresh test counts, install identities, and physical results.
- [ ] State explicitly that hosted deployment was not performed and production readiness is not claimed.
- [ ] Verify the APKs in the release folder are byte-identical to the just-built artifacts and that the folder contains no credentials or private keys.

---

## Audit findings at plan creation

- Root canonical checkout: clean `codex/gagan-canonical-product-v1` at `5a632711025f5eb6d42a75e26529ce739f06f982`.
- Existing reconciled worktree: `codex/gagan-client-feedback-v2-reconciled` at `ec76fbfa7b07eabd9a46c6dfab813388ba55ffa1`, one committed change ahead of its remote plus the five expected uncommitted target-celebration files; none were modified in this audit.
- The six-variant branch and Feedback-v2 source are separate lineage steps; the reconciled Feedback-v2 branch is a descendant of the canonical catalogue checkpoint and preserves all 46 expected migrations.
- Device versions read directly from Moto E13: Retailer `1.0.16` / code `17`; Salesperson `1.0.19` / code `19`.
- Existing local release APKs in the reconciled worktree report the approved signing certificate fingerprint. Earlier signing-mismatch candidates remain archival evidence and will not be used.
- Physical checks have not been run for this proposed unified checkpoint. The source audit will distinguish existing source/test evidence from new APK/device acceptance.
