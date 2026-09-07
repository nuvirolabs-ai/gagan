# Gagan CURRENT — canonical source and artifact manifest

Status: **canonical local staging source** — not a production release and not a replacement for the immutable release tags.

Created: 2026-09-07 (Asia/Kolkata)

## Source-of-truth decision

The canonical runtime source in this folder is the clean accepted hardened staging integration at:

```text
Branch: codex/gagan-current (local canonical branch; not pushed)
Canonical HEAD: local documentation-only consolidation commit; verify with `git rev-parse HEAD`
Canonical HEAD subject: docs: establish canonical Gagan current checkout
Runtime source parent: dcbc7a933da76eeb10599d757aca8207f7cfaa0f
Runtime source subject: docs: add physical Moto E13 acceptance evidence for gagan-staging-p0-hardened-v1
Remote: https://github.com/nuvirolabs-ai/gagan.git
```

This commit is the exact accepted source branch head:

```text
Accepted branch: codex/gagan-p0-staging-integration
Accepted branch SHA: dcbc7a933da76eeb10599d757aca8207f7cfaa0f
Accepted branch remote SHA: dcbc7a933da76eeb10599d757aca8207f7cfaa0f
```

The accepted branch was verified before consolidation:

- `gagan-staging-p0-hardened-v1` is an annotated tag object `dc58977ac8ad027bd275ff7add775f3ebe616f65` peeled to commit `1859d4e1014d194b35453c4afa044b17452c7840`.
- The frozen staging tag is an ancestor of the accepted branch: **yes**.
- The accepted branch is two documentation/evidence commits beyond the tag: `d633c9f9e14d2f882c7e918e49bdb64e8a5c6d4f` and `dcbc7a933da76eeb10599d757aca8207f7cfaa0f`.
- The accepted branch is an ancestor of the staging tag: **no**; the tag was not moved.
- Local `main` was `2bf864b7a3f5ca3c437ceb3cb59dc9ba95d925d1`; remote `origin/main` was `0a2aadd8d9c6a42d68daac3554bb5b45ce250465`. Neither was modified.
- The runtime scopes `backend`, `admin`, `rep`, `mobile`, `founder`, `gagan-secondary-admin`, `scripts`, and `render.yaml` have **zero changed paths** between the tag commit and the accepted branch head.
- The accepted branch worktree was clean before this canonical checkout was created.

The new canonical branch is local-only. Its only commit beyond the accepted branch is this consolidation manifest/report commit; the application runtime trees remain exactly the accepted runtime. No push, production branch update, production deployment, real SAP connection, or frozen-tag rewrite was performed.

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
