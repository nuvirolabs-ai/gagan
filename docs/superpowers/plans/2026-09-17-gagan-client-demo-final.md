# GAGAN Client Demo Final Polish, Freeze, and Delivery

> **For the implementation agent:** Required reading: use the `superpowers:executing-plans` skill and complete the tasks in order, preserving the stated scope boundaries.

**Goal:** Produce a single frozen client-demo source checkpoint, clean active
client-facing test naming, and deliver exact Retailer/Salesperson APKs plus the
verified stable Admin URL with evidence.

**Architecture:** Start at canonical SHA `6685565df5398104a7abb68080838a45efad0bcc`.
Port only the reviewed Retailer Home/mini-cart and narrowly-scoped backend
inventory-identity deltas. Keep backend orderability authoritative. Apply
display-name changes only to explicitly identified staging demo fixtures after
exact Render/database and recovery checks. Build both apps from the final
committed source with the hosted staging API and non-secret build identity.

**Tech stack:** TypeScript, React Native/Expo, Express/Prisma/PostgreSQL,
Vite/React admin, Vitest, Gradle/Android SDK, Render/Vercel staging.

## Task 1: Integrate reviewed commerce changes

- Add the donor’s focused commerce contract tests first.
- Port the reviewed Home hierarchy, three product promotions, mini-cart route
  visibility, and bounded inventory identity changes from the donor commits.
- Run focused tests and inspect the diff for unrelated changes.

## Task 2: Remove active presentation leaks

- Add a regression test covering active Retailer/Salesperson presentation files
  and translations.
- Replace visible Field Ops/Field Day/Product demo copy with client-facing
  retail-sales language while preserving internal field-domain APIs and tests.
- Keep realistic names already present in source fixtures; only change hosted
  records after the live audit proves they are dedicated demo fixtures.

## Task 3: Verify locally in isolation

- Generate Prisma client and use a fresh explicitly named local PostgreSQL
  database.
- Run backend migrations, full backend suite, typecheck, and build; run Admin,
  Retailer, and Salesperson tests/typechecks/builds.
- Record setup failures separately from product regressions.

## Task 4: Audit and, if justified, update staging

- Verify the exact Render profile/service/database and recovery/PITR boundary.
- Capture sanitized before-state by exact IDs for candidate demo retailers,
  staff, active products, variants, and relevant order references.
- Apply only scoped display-name/status changes if candidates are unambiguously
  dedicated demo fixtures. Do not rewrite historical records or seed broadly.
- Re-read authenticated API/Admin responses and re-audit visible labels.

## Task 5: Build and inspect final APKs

- Commit the final source before building.
- Build standalone signed APKs for `com.gagan.retailer.review` and
  `com.gagan.sales.review`, using `https://gagan-srat.onrender.com`, higher
  version codes than the installed builds, and the existing signing identity.
- Verify package/version/code/signing certificate/SHA-256 and embedded source
  and API identity.
- Install in place on Moto E13 `ZD2229Q3KB` without uninstalling or clearing
  data; verify the installed package metadata and visible journeys.

## Task 6: Freeze and deliver

- Verify the existing stable Admin project URL and authenticated behavior when
  an existing session permits it.
- Create the client-delivery folder with both APKs and a secret-free
  `RELEASE_MANIFEST.md`.
- Check for `gagan-staging-client-demo-v1`; create and push the annotated tag
  only if absent and only after all release gates pass.
- Push the final branch and report exact pass/fail evidence and blockers.
