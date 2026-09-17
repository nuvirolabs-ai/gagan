# Real catalogue owner-approval R1 test evidence

Recorded: **17 September 2026**
Branch: `codex/gagan-real-catalogue-v1`
Hosted writes: **none**
APK builds: **none**

## Source inputs

| Input | Evidence |
|---|---|
| Workbook | `1-SKU-WISE-ITEM-LIST-16-09-26-UPDATED.xlsx` |
| Workbook SHA-256 | `f9f69849c37421bd48a0326d50239cb2ebf0ff47b955bc56915556446fa9e5a6` |
| Workbook mapping | `PRODUCT LIST`, header row 2, 111 data rows, 105 unique variants |
| Image index | `docs/real-catalogue/drive-image-index.json` |
| Image-index SHA-256 | `41da39cf271c7cb37f363c39a128cb2d59b4205ee2359ff145cca898dcb3cc2d` |
| Owner approval | `real-catalogue-decisions-owner-approved-r1.json` |
| Approval SHA-256 | `fbbc79780f7cf8f876f01008859ef3fdd5a47462895e2830c71d7aa332915be1` |

The approval file is supplementary input to the importer. The workbook and
image index were not modified.

## Dry-run result

The final import dry-run accepted the workbook and R1 decisions file and
produced the resolved manifest without a database write.

| Measure | Result |
|---|---:|
| Records | 105 |
| Unique products | 46 |
| Active/orderable rows | 0 |
| Pending-review rows | 105 |
| Exact images | 91 |
| Remaining ambiguous images | 3 |
| Remaining missing images | 11 |
| Blocked case conversions | 0 |
| Internal product codes | 46 unique |
| Internal variant codes | 105 unique |
| Approved 20 KG BOX routing decisions | 12 |
| Price basis | GST-exclusive, per quintal |
| Target tier | Unresolved; no price list was written |

The zero active/orderable result is intentional. GST/HSN, target tier and
inventory/material readiness remain unresolved, so the importer does not
make any row orderable through a fallback quote path.

## Local database rehearsal

The rehearsal used fresh disposable PostgreSQL databases on local PostgreSQL
16.15. Migration history was applied from zero and seeded using the
repository-supported seed command.

The source-import apply was run with the explicit local confirmation guard.
It recorded 46 products and 105 variants, including 46 product internal
codes and 105 variant internal codes. A second identical apply returned the
original batch summary and did not create duplicate catalogue identities.

Reviewed routing metadata was deliberately not written into unconfigured
rows: the current commercial constraint requires GST alongside routing. The
promotion phase rejected all 105 rows with `real_catalogue_not_ready_105_rows`
and made no promotion write.

Read-only aggregate after the rehearsal:

| Check | Result |
|---|---:|
| Real products | 46 |
| Real variants | 105 |
| Products with internal codes | 46 |
| Variants with internal codes | 105 |
| Missing internal codes | 0 |
| Routing rows written before promotion | 0 (intentional) |
| Pending real variants | 105 |
| Import batches | 1 |
| Duplicate product codes | 0 |
| Duplicate variant codes | 0 |

## Regression gates

All suites below used fresh local disposable databases. The complete backend
run used the repository's required test-only JWT, refresh, PII and local
object-storage configuration; no hosted credentials were used.

| Area | Result |
|---|---|
| Backend full suite | **PASS — 135 files, 952 tests** |
| Backend catalogue-focused suite | **PASS — 1 file, 13 tests** |
| Backend typecheck | **PASS** |
| Backend production build | **PASS** |
| Prisma validate | **PASS** |
| Prisma migration status | **PASS — 42 migrations, up to date** |
| Admin tests | **PASS — 22 files, 58 tests** |
| Admin typecheck | **PASS** |
| Admin lint | **PASS** |
| Admin production build | **PASS** |
| Salesperson tests | **PASS — 33 files, 181 tests** |
| Salesperson typecheck | **PASS** |
| Retailer/mobile tests | **PASS — 17 files, 74 tests** |
| Retailer/mobile typecheck | **PASS** |
| `git diff --check` | **PASS** |

The first full-suite attempt was intentionally discarded from acceptance
because it reused a focused-test database. It produced stale target totals
and omitted required test-only environment values. A later pristine run from
zero passed all 952 backend tests. The date-sensitive performance fixture was
also corrected so its historical baseline is anchored in the previous
calendar month rather than assuming a fixed current date; this does not
change application behavior.

Founder tests were not run because that package's local dependencies do not
include the test runner (`vitest: command not found`). No Founder or shared
Founder contract was changed in this catalogue work.

## Recovery evidence

A compressed local rehearsal dump was created and restored into a separate
disposable database. The restored database contained 46 internally coded
products, 105 internally coded variants and one catalogue import batch.

| Artifact | Location | SHA-256 |
|---|---|---|
| Resolved owner-approved manifest | `/Users/tanutejas/Documents/GAGAN/ARCHIVE/catalogue-source/20260917-owner-approval-r1/gagan-owner-approved-manifest.json` | `2a85d23aca3a909b9380ecfa4a5edc68554721f9dbe1d4b8303d89e85e1f9e6e` |
| Owner decisions | `/Users/tanutejas/Documents/GAGAN/ARCHIVE/catalogue-source/20260917-owner-approval-r1/real-catalogue-decisions-owner-approved-r1.json` | `537220eb73e3f2d223d9952115cde9fb08c740ff019de116cbba034058de990e` |
| Local rehearsal dump | `/Users/tanutejas/Documents/GAGAN/ARCHIVE/catalogue-source/20260917-owner-approval-r1/gagan_catalogue_owner_r1_20260917_xrlc0v.dump` | `2c0f462c135d0c63c9c95350b6b313fb09b5d3418b47a0ef73d865ddaaa69592` |

This is local disposable evidence only. It is not a hosted backup and does
not authorize a hosted write.

## Current release boundary

No source was reconciled into `GAGAN/CURRENT/SOURCE`, no hosted database was
read or changed in this step, no staging catalogue was activated, and no
dummy product was retired. The feature worktree remains the review location
until GST/HSN, target tier, material/warehouse/inventory and image exceptions
are resolved and a target-specific recovery preflight is completed.
