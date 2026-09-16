# Gagan Salesperson Canonical Baseline

Status: recovery candidate; promote only after the recorded physical checks
pass.

## Canonical source

- Branch: `codex/gagan-salesperson-canonical-v1`
- Base: `32e9ac85a81802c5fb11a1d8ad49cf43056590a4`
- UX recovery donors: `83f6b1b`, `3a82ee5`, `966e082`
- Frozen reference: `gagan-salesperson-template-v1` (unchanged)
- Canonical staging API for the review build: `https://gagan-srat.onrender.com`

The branch retains the accepted commercial, field, cache, Survey, Admin,
Retailer and 39-migration line. The UX donors were ported dependency by
dependency; no obsolete backend/schema migration or alternate onboarding
contract was imported.

## Review artifact contract

- Package: `com.gagan.sales.review`
- Label: `Gagan Sales Review`
- Standalone APK with embedded JavaScript
- No Metro, local API, USB, or Mac runtime dependency
- VersionCode must be greater than the installed review package
- Every artifact requires a source SHA, build version, API target, certificate
  fingerprint, hash, and physical-device result
- More → Account includes a read-only source/version/API label

The current review APK is the only artifact to use for this baseline after it
is built and verified. Older artifacts remain rollback/history until the
archive index records their disposition.

## Required regression gate

Run from a clean pinned commit:

1. `npm test` and `npm run typecheck` in `rep/`.
2. Existing backend/Admin/Retailer suites only if shared source changes; this
   recovery changes `rep/` and review build configuration only.
3. `git diff --check`.
4. Release APK package/API/source identity verification.
5. Moto E13 checks for keyboard/forms, calendars, Home/My Day, order review,
   offline/reconnect, Survey navigation/context, and account isolation.

## Retired build paths

The following are donor/history only and must not be selected by filename:

- `codex/gagan-salesperson-ux-refinement-v2`
- `codex/gagan-salesperson-ux-v2-apk`
- `codex/gagan-client-uat-ux-reconcile-v1`
- older `gagan-salesperson-*-review*.apk` files without the current manifest

Their commits and artifacts are retained for recovery. No branch is deleted or
renamed by this document. New Jain/Padam routing work must descend from the
immutable baseline tag once created, or from a reviewed descendant that keeps
the same regression gate.

## Explicit exclusions

- No production, `main`, Dogkart, real SAP, commercial contract, pricing,
  GST, freight, invoice/payment, R2, or survey data change.
- No new Survey, audience, answer, or hosted permission mutation.
- No claim of physical active-visit/NOT ORDERING acceptance without a valid
  authenticated route/visit precondition.
