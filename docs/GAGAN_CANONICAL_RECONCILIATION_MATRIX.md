# Gagan Canonical Product Reconciliation Matrix

**Checkpoint:** `codex/gagan-canonical-product-v1` @ `29f78925af7f5d281e1d8f6b693547c332f49cf2`
(created from the verified Salesperson-canonical source at
`388cbbfc51bde57ed05b1144c5b31c4b0e09fb3d`)

**Purpose:** record which accepted Gagan work is already present in the
canonical source, which donor branches are retained for recovery, and which
historical implementations are intentionally excluded. This is a source and
filesystem reconciliation record; it is not a new product specification.

## Reconciliation result

The canonical source is an independent clean clone of the Gagan repository.
Its history already contains the verified Wave 1B commercial checkpoint, the
Wave 2.1 operational-cache line, the reconciled Market Survey line, the
internal commercial-status line, the Admin authentication/permission fixes,
the field-flow hardening, and the dependency-by-dependency Salesperson UX
recovery. No whole donor branch was copied over the newer source.

Protected references remain unchanged:

- `gagan-salesperson-template-v1` -> `69c2916a31adcd861f09d4fc2405c4431a09d9b6`
- `gagan-salesperson-baseline-v1` -> `b5b92ed61459fd82fd25d8136411794fbf6de3b9`
- `gagan-staging-wave1b-commercial-v1` -> `b8880612f896fccbfaa696516b85d64d9a99ebb9`

## Registered worktree and donor inventory

| Path | Branch | HEAD | State | Component / recovery value | Decision |
|---|---|---|---|---|---|
| `GAGAN/CURRENT/SOURCE` | `codex/gagan-canonical-product-v1` | `29f78925af7f5d281e1d8f6b693547c332f49cf2` | Clean | Whole-product active source | **ACTIVE CANONICAL** |
| `ARCHIVE/WORKTREES-AND-REPOS/Gagan-CURRENT-checkout` | `codex/gagan-current` | `df707fafe6902bd37927a9b18b2d232bd1614ec1` | Dirty: two tracked UI files modified | Main repository, all refs, dirty local UI experiments | **ARCHIVED — PATCH AND SNAPSHOTS PRESERVED** |
| `ARCHIVE/WORKTREES-AND-REPOS/gagan-history-20260916.bundle` | all inventoried refs | all refs | Verified bundle | Branch/tag recovery for retired worktrees | **RECOVERY CHECKPOINT** |
| `Gagan-salesperson-canonical-v1` | `codex/gagan-salesperson-canonical-v1` | `388cbbfc51bde57ed05b1144c5b31c4b0e09fb3d` | Clean before retirement | Prior canonical Salesperson worktree; same source checkpoint | **ALREADY RECONCILED; BRANCH REF PRESERVED** |
| `Gagan-admin-auth-staging-fix` | `codex/gagan-admin-auth-staging-fix` | `c4700b4cabaf2a687dbe1348eeaa80683093ad08` | Clean | Admin sessions and scoped survey permission sync | **ALREADY RECONCILED** |
| `Gagan-market-survey-hosted-fix` | `codex/gagan-market-survey-hosted-fix` | `8b69bef4cd0be0fe8203d4c451799a2ded147515` | Clean | Survey choice-option preservation | **ALREADY RECONCILED** |
| `Gagan-market-survey-cors-fix` | `codex/gagan-market-survey-cors-fix` | `32e9ac85a81802c5fb11a1d8ad49cf43056590a4` | Clean | Permission-aware Salesperson survey navigation and CORS-era fixes | **ALREADY RECONCILED** |
| `Gagan-market-survey-wave2-reconcile-v1` | `codex/gagan-market-survey-wave2-reconcile-v1` | `c1a0c4971b1e3c83028e3e6f447a0cd14f1b194f` | Clean | Survey reconciled onto Wave 2.1 | **ALREADY RECONCILED** |
| `Gagan-wave2-1-operational-cache-v1` | `codex/gagan-wave2-1-operational-cache-v1` | `e62e804e723996ce29a98a3b62e0029ea42f20f4` | Clean | Today/cache/reconnect implementation and evidence | **ALREADY RECONCILED** |
| `Gagan-internal-commercial-status-v1` | `codex/gagan-internal-commercial-status-v1` | `f5eee40a6fb58fed1c92cd808bb9ac9b48ca88af` | Clean | Internal commercial-status overlay | **ALREADY RECONCILED** |
| `Gagan-product-improvements-v1` | `codex/gagan-product-improvements-v1` | `7f86f8f4e4d4a57c1b6b1ff210485ff583536029` | Clean | Wave 1B/Wave 2 audit and accepted product fixes | **ALREADY RECONCILED** |
| `Gagan-client-uat-rc-v1` | `codex/gagan-client-uat-rc-v1` | `aeaf31f6b7f2e39d6f50a8c2d2cb94f8bdcea25a` | Clean | Prior consolidated client-UAT RC | **ALREADY RECONCILED** |
| `Gagan-client-uat-ux-reconcile-v1` | `codex/gagan-client-uat-ux-reconcile-v1` | `207aac67dfc542ac5c36dae65d659f7ea8f8e0e9` | Clean | Earlier UX reconciliation and device evidence | **EQUIVALENT IMPLEMENTATION PRESENT** |
| `Gagan-salesperson-ux-refinement-v2` | `codex/gagan-salesperson-ux-refinement-v2` | `966e082a13bff5c454d6b8c6bfe62cf227405337` | Clean | Older UX donor | **EQUIVALENT IMPLEMENTATION PRESENT; ARCHIVE ONLY** |
| `Gagan-salesperson-ux-v2-apk` | `codex/gagan-salesperson-ux-v2-apk` | `d95e292388cae4b8ab9be54fa10f00c9327dc46a` | Clean | Older UX APK/evidence checkpoint | **ARCHIVE ONLY; ROLLBACK EVIDENCE** |
| `Gagan-salesperson-ux-field-flow` | `codex/gagan-salesperson-ux-field-flow` | `5507d750ffe9eb5692d8d0276f3cbfb514773e73` | Clean | Older field/order/issue and proposal donor | **INCOMPATIBLE PARTS EXCLUDED; ARCHIVE ONLY** |
| `Gagan-client-uat-apks` | `codex/gagan-client-uat-apks` | `dc62182f61e224edd9bcafa8ed85f8c0ee089e78` | Clean | Prior hosted review-build profiles | **SUPERSEDED; ARCHIVE ONLY** |
| `Gagan-client-uat-ux-apk-v1` | `codex/gagan-client-uat-ux-apk-v1` | `c58661c1aba019ebd7d98d9c0278ebb268cca9f8` | Clean | Prior UX build/evidence profile | **SUPERSEDED; ARCHIVE ONLY** |
| `Gagan-market-survey-v1` | `codex/gagan-market-survey-v1` | `bab0f2a432dde18a5e5d454b2672e26425d338a6` | Clean | Earlier standalone Survey implementation | **SUPERSEDED BY RECONCILED SURVEY LINE** |
| `ARCHIVE/WORKTREES-AND-REPOS/Gagan-field-ops-completion-v1` | `codex/gagan-field-ops-completion-v1` | `282864aad132a645290236286d4b1df56526960f` | Untracked final acceptance document preserved | Field Ops/R2 acceptance evidence | **ARCHIVED — UNTRACKED DOCUMENT PRESERVED** |

Every accepted donor commit relevant to the current product was checked for
ancestry or equivalent source behavior before classification. Historical
issue/onboarding routes that were explicitly documented as incompatible are
not restored merely to make the branch history look complete.

## Component-level decisions

| Component | Current canonical treatment | Decision |
|---|---|---|
| Backend | Descends from Wave 1B and includes current field/cache/survey/commercial-status contracts | Keep current source; no backend redeploy in cleanup |
| Admin | Includes current Admin source plus accepted auth and survey-permission ancestry | Keep current source; no alternate Admin branch merge |
| Salesperson | Uses the frozen baseline-compatible recovered runtime and canonical release guard | Preserve `gagan-salesperson-baseline-v1`; no template rewrite |
| Retailer | Current `mobile/` source is present and a fresh hosted-review APK was built from `29f7892` | Keep the traceable artifact under `CURRENT/BUILDS/Retailer`; archive the prior APK |
| Market Survey | Reconciled Wave 2 line and later permission/navigation fixes are ancestors of the current source | Keep current line; do not add obsolete routes or alter hosted audiences |
| Wave 2.1 cache | `Today` cache, force-stop persistence, reconnect, and account isolation are ancestors of current source | Keep current implementation; physical Route acceptance remains a separate claim |
| Wave 1B commercial | Protected tag and descendant source preserve pricing, GST, freight, invoices, payments, R2, and idempotency | No commercial changes |

## Exclusions

- Jain/Padam dynamic routing is not implemented in this consolidation.
- Real SAP, payment providers, SMS, production signing, production deployment,
  Dogkart, and `main` are out of scope.
- The alternate proposal/onboarding histories are retained as recovery
  references where their APIs or migrations conflict with the current source.
- This document does not claim that an existing Retailer APK was built from
  the canonical branch; that must be proven by the new artifact manifest.
