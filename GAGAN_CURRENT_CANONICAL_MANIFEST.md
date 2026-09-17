# Gagan CURRENT — canonical source and artifact manifest

Status: **canonical local staging source** — not a production release and not a replacement for the immutable release tags.

Created: 2026-09-07 (Asia/Kolkata); current manifest update: 2026-09-17 (Asia/Kolkata)

## Source-of-truth decision

The canonical runtime source in this folder is the clean consolidated staging candidate at:

```text
Branch: codex/gagan-canonical-product-v1 (pushed feature branch)
Canonical HEAD: 9b1b6f76839c4530928c844dde1cd608e2ad5f68
Canonical HEAD subject: docs: record real catalogue publication checkpoint
Runtime source parent: 2a8e2d2e9288fb9ff4fb1d5e2f38802e50a172a8
Runtime source subject: feat: publish reviewed real catalogue safely
Remote: https://github.com/nuvirolabs-ai/gagan.git
```

This is the active canonical branch head:

```text
Active branch: codex/gagan-canonical-product-v1
Active branch SHA: 9b1b6f76839c4530928c844dde1cd608e2ad5f68
Active branch remote SHA: 9b1b6f76839c4530928c844dde1cd608e2ad5f68
```

The prior immutable `gagan-canonical-product-v1` tag remains at
`1728bc6ce1aad30bbaf528821d7c307cc46c5111` and was not moved. The active
branch is its reviewed Jain/Padam-routing and real-catalogue descendant. The
real-catalogue feature branch and this canonical branch both point to the same
clean pushed commit. No production branch update, production deployment, real
SAP connection, or frozen-tag rewrite was performed.

## Canonical application trees

These tree IDs and tracked-file counts are from the canonical accepted commit. `mobile` is the Retailer app and `rep` is the Salesperson app.

| Product surface | Canonical path | Git tree | Tracked files | Verification boundary |
|---|---|---:|---:|---|
| Backend | `backend/` | `88287d8494e290e4eb88315a2a1ebb0a876436aa` | 354 | Express/Prisma source, migrations, worker, tests |
| Admin | `admin/` | `3eedbc6cc16f0dba5aa9cf9cc1a819a26632441d` | 78 | React/Vite admin source and tests |
| Retailer | `mobile/` | `90316cf7ee0e5f16bdd1e20791123bc41f74a389` | 85 | Expo/Retailer source and tests |
| Salesperson | `rep/` | `ee23d22c47c87a5d19f8fe28f6631b53eed0ce7d` | 110 | Expo/Salesperson source, offline/account-boundary hardening, tests |
| Founder | `founder/` | `16123cc34eb9f69f1483d60bd3a264020e5a6fe3` | 43 | Existing Founder source retained from accepted runtime |
| Secondary Admin | `gagan-secondary-admin/` | `8ac03a1a06881f5ce8c1caf745fbad1d97815787` | 18 | Existing secondary-admin source retained from accepted runtime |

The source checkout intentionally contains no `node_modules`, generated build output, or copied APK inside the tracked application trees. The only local non-source material is under `artifacts/`, which is excluded in the shared worktree-local Git exclude and described below.

## APK provenance

These are the only APKs copied into the canonical folder. Their SHA-256 values were re-calculated after copying and match the accepted staging manifest and the original Desktop files.

| Role | Canonical artifact | Original verified artifact | SHA-256 | Size | Package/API evidence |
|---|---|---|---|---:|---|
| Accepted hardened Salesperson staging APK | `artifacts/apk/gagan-gagan-p0-source-hardening-21fd72b.apk` | `/Users/tanutejas/Desktop/gagan-gagan-p0-source-hardening-21fd72b.apk` | `6b582e21ca91456938bbb28cc812e38483e50681dacfff02ea3396f41699127f` | 87,889,813 bytes | `com.gagan.sales`; `https://gagan-staging-api.onrender.com`; recorded as the hardened build in `GAGAN_P0_HARDENED_STAGING_MANIFEST.md` |
| Accepted Retailer staging APK | `artifacts/apk/gagan-retailer-correct-template-uat-b0bd689.apk` | `/Users/tanutejas/Desktop/gagan-retailer-correct-template-uat-b0bd689.apk` | `1a4160b8463f444ca7c0087eb09b2069db5fbcecc5d287f6292f3f481813e16e` | 87,013,583 bytes | `com.gagan.retailer`; `https://gagan-staging-api.onrender.com`; recorded as the accepted Retailer artifact |
| Frozen Salesperson template reference APK | `artifacts/apk/gagan-salesperson-final-template-8eed514.apk` | `/Users/tanutejas/Desktop/gagan-salesperson-final-template-8eed514.apk` | `b7f7e86a18644e50294f63c296fd294875111b900d9a361fa3f36c9f7440dc94` | 87,879,853 bytes | `com.gagan.sales`; frozen template verification artifact; not the current hardened runtime |

The APKs are copied artifacts, not newly built binaries. The accepted manifest records the hardened Salesperson source/runtime relationship, package ID, staging API, physical Moto E13 acceptance, and the boundary that the hardening change was JavaScript/offline/account-boundary work rather than a new native module. The current source of truth remains the Git runtime tree above.

## Real catalogue publication candidate (2026-09-17)

The active branch includes the reviewed real-catalogue publication path at
`2a8e2d2e9288fb9ff4fb1d5e2f38802e50a172a8`. The source workbook contains 105
unique variants across 46 products. The local rehearsal published 46 products
and 105 variants, produced 91 exact image mappings, 11 approved labelled
placeholders and 3 pending ambiguous image mappings, and wrote 230 price-list
rows while leaving 0 variants orderable until approved tax and inventory
configuration is present. The exact review APK candidates, hashes, package
metadata and physical smoke evidence are recorded in
`/Users/tanutejas/Documents/GAGAN/CURRENT/BUILDS/CANDIDATES/2a8e2d2/RELEASE_MANIFEST.md`.

The intended hosted target is `https://gagan-srat.onrender.com`. Its public
health endpoints returned HTTP 200, but the authorized Render service,
database, migration ledger and recovery boundary were not available in the
accessible browser session. No hosted catalogue migration/import/promotion,
dummy retirement, backend deployment or Admin deployment was performed. The
Moto E13 review apps are installed and launch, but the device still shows the
pre-publication staging catalogue; real-catalogue physical acceptance is
therefore pending hosted activation.

## Frozen Salesperson template reference

The frozen template remains immutable and separate from the moving canonical branch:

```text
Tag object: ed6cd3d43dd31f6143e416d6e76cd9f48b3a125c
Tag:        gagan-salesperson-template-v1
Commit:     69c2916a31adcd861f09d4fc2405c4431a09d9b6
Branch:     codex/gagan-salesperson-final-template
Status:     unchanged; do not move or rewrite
```

The canonical source retains `GAGAN_SALESPERSON_TEMPLATE_V1.md` and `SALESPERSON_TEMPLATE_PORTING_BOUNDARY.md`. Future template evolution must use a new immutable version tag; this consolidation does not port, redesign, or rewrite V1.

## Verification performed in this checkout

- Canonical HEAD is a documentation-only local consolidation commit; its runtime parent is the accepted `dcbc7a933da76eeb10599d757aca8207f7cfaa0f`.
- `git diff dcbc7a933da76eeb10599d757aca8207f7cfaa0f..HEAD` is documentation-only; all runtime scopes listed above are unchanged.
- Backend, Admin, Retailer, and Salesperson roots exist at `backend/`, `admin/`, `mobile/`, and `rep/`.
- Component tree IDs and tracked-file counts were checked against the accepted commit.
- Tag-to-accepted runtime comparison returned zero changed paths for all runtime scopes listed above.
- All three copied APKs were hashed after copying; hashes match the accepted manifest and original Desktop paths.
- The accepted manifest’s recorded backend/Admin/rep/mobile/founder tests, staging checks, and Moto E13 evidence remain part of the canonical source history; this cleanup did not alter application runtime files.

## Safety boundary

This folder is **STAGING / TEST DATA ONLY**. It is not production approval. The accepted evidence still records the remaining production gates: real SAP ownership/connector work, production signing and workers, monitoring/restore proof, real POD/SMS/payment integrations, and broader production UAT.
