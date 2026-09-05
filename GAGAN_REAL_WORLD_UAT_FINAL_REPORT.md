# Gagan Full Real-World End-to-End UAT + Hardening Report

**Run date:** 2026-09-06
**Overall gate:** **BLOCKED — safe controlled UAT substantially passed, but full release sign-off is blocked by missing disposable DB, unavailable desktop browser interaction, and incomplete staging fixture state.**
**Branch:** `codex/gagan-full-e2e-uat-hardening`
**Isolated worktree:** `/Users/tanutejas/Documents/Gagan-full-e2e-uat`
**Verified staging base:** `e47e38e99cf08c0d71542ea230815c33dca17a26`
**Current `origin/codex/gagan-staging`:** `e47e38e99cf08c0d71542ea230815c33dca17a26`

## Executive result

The controlled hosted happy path passed without direct database writes:

`Retailer OTP → catalog → fresh order → Admin discovery → confirm → pack → dispatch → POD delivery → invoice/ledger → mock SAP outbox → synced`

The same operational chain also passed for a salesperson-attributed order using a SAP-linked assigned retailer. Replay checks for retailer order creation, salesperson order creation, POD submission, and SAP outbox drain were idempotent. Protected endpoints rejected unauthenticated access and invalid lifecycle transitions without unsafe mutation.

The run cannot be called complete because two safe prerequisites were unavailable:

1. There is no `DATABASE_URL`, `TEST_DATABASE_URL`, or `DIRECT_URL` for a disposable database. DB-backed integration tests and destructive scenario automation therefore remained fail-closed.
2. The desktop UI was locked, so visual hosted-browser navigation could not be performed through the browser automation surface. The hosted HTML shell and API health were reachable, and physical Android launch evidence was captured.

The current staging data also limits two intended scenarios: the visual-UAT salesperson identity has no published route on current staging, and its assigned Bharat Provisions retailer is not SAP-linked. No direct DB write or unsafe bypass was used.

## Safety and isolation

- Canonical checkout: `/Users/tanutejas/Documents/Gagan`.
- Canonical checkout was dirty before the run and was not modified, reset, cleaned, stashed, reverted, or deleted.
- The run used a separate worktree and branch.
- `main`, production, real SAP, real payments, real SMS, Dogkart, and unrelated products were not touched.
- All staging state changes were made through authenticated product APIs representing normal application workflows.
- No direct database write was used to advance a workflow.
- No destructive test was pointed at shared staging after the disposable DB prerequisite was found absent.

The original canonical dirty-file inventory is recorded in `UAT_ENVIRONMENT_AUDIT.md`; it includes unrelated Admin, Retailer, Founder, and Salesperson changes that were preserved.

## Environment readiness

| Check | Result | Evidence |
|---|---|---|
| Node/npm | PASS | Node `v26.7.0`, npm `11.19.0` |
| PostgreSQL client | PASS | `/usr/bin/psql` available |
| Disposable DB | BLOCKED | no `DATABASE_URL`, `TEST_DATABASE_URL`, or `DIRECT_URL` |
| Android tooling | PASS | Android SDK platform-tools and release toolchain available |
| Physical Android | PASS | Moto E13, serial `ZD2229Q3KB`, Android 13, 720×1600 |
| Hosted API health | PASS | `/health`, `/health/live`, `/health/ready` each HTTP 200 with `{"ok":true}` |
| Hosted Admin shell | PASS | Admin root and `/sap` returned HTTP 200 HTML shell |
| Browser visual automation | BLOCKED | Mac UI was locked during the run |
| Provider mode | PASS for exercised providers | mock OTP accepted; mock SAP connector enabled; real payment/SMS not used |

## Real hosted UAT evidence

### Retailer identity and order

- Retailer OTP request/verify succeeded for Mahesh Store, phone `9999999999`, mock OTP `123456`.
- `/auth/me`, `/home`, `/catalog`, and `/orders` returned scoped data.
- Catalog returned 11 raw variants grouped into 9 product groups/categories.
- Fresh order `GGN-00000058`, id `f9b34759-9470-47b7-8a19-1f1a2b537558`, was created for one canonical variant, total ₹3,120.
- The exact original `Idempotency-Key` was replayed. HTTP 201 returned the same order id and order number; no duplicate was created.
- After Admin fulfillment, retailer history reflected the delivered lifecycle.

### Admin fulfillment and finance

For order 58, the following normal Admin actions succeeded:

1. `approve` → `confirmed`
2. `pack` → `packed`
3. `dispatch/assign` → `out_for_delivery`
4. OTP POD with the canonical order item → `delivered`
5. invoice response returned and ledger side effect created

The identical POD request was replayed and returned the existing invoice/delivery result rather than creating another delivery effect. Invalid attempts to move the delivered order back to `packed` or `confirmed` returned HTTP 409 and did not mutate the delivered state.

### Salesperson order and cross-surface reconciliation

Two salesperson identities were exercised:

- Visual-UAT Nikhil Patil authenticated successfully. His real current staging state has no published route and his assigned Bharat Provisions retailer has no `sapCustomerId`; his order was still created normally and attributed to his salesperson id. The mock SAP guard correctly left that outbox item unlinked rather than inventing a SAP customer.
- Ravi Kumar was used for the complete linked salesperson happy path with Mahesh Store, which has `sapCustomerId: SAP-CUST-1001`.

Ravi order `GGN-00000060`, id `28f84517-21ba-42ce-8467-bb50a4b15cab`, was created with `placedBy=rep` and the correct `placedByRepId`, replayed with the same idempotency key, then completed through Admin confirm, pack, dispatch, OTP POD, and delivered. The salesperson retailer detail, activity feed, and performance response reflected the same order.

### Mock SAP and outbox

- `/admin/sap/status` returned HTTP 200 with the mock connector enabled.
- `/admin/sap/sync` for `all` returned successful customer, material, pricing, and stock sync results.
- Before the linked drain, outbox status showed pending items.
- Linked orders drained successfully; repeated drain produced no duplicate SAP effect.
- Final observed outbox status: `pending=0`, `sent=29`, `failed=23`.
- The failed items are existing or fixture-blocked failures, including the Nikhil/Bharat order whose retailer is not SAP-linked. This is an explicit integration guard, not a fabricated “synced” state.

## Defect loop

| Defect / observation | Reproduction | Root cause | Fix | Retest |
|---|---|---|---|---|
| First native release build did not complete | fresh Android release build | local Java/Android toolchain needed the repository native-access compatibility flag | reran with `JAVA_TOOL_OPTIONS=--enable-native-access=ALL-UNNAMED` | PASS; both APKs built |
| First Expo/dev launch produced an old Salesperson tombstone | attempted development launch on physical device | launch path lacked the API environment value; this was not the fresh standalone release APK | no source change; directly launched the newly built release APK | PASS; release APK resumed and rendered Home with no new crash |
| Nikhil route unavailable | read `/rep/field/today` and `/rep/field/route` | current staging fixture has no published route | no bypass; documented as fixture blocker | BLOCKED, with no product defect established |
| Nikhil/Bharat SAP linkage unavailable | drain Nikhil order | retailer has no `sapCustomerId` | no bypass; used Ravi/Mahesh for complete linked path | PASS for guard, BLOCKED for fixture-specific sync |

No application source defect requiring a code fix was established by the executed loop. The changes on this branch are evidence and continuity documents only.

## Automated gates

| Area | Result | Detail |
|---|---|---|
| Backend tests | BLOCKED | 87 files passed; 31 failed because the environment lacks `DATABASE_URL`, JWT/refresh secrets, and a usable DB. 677 tests passed, 47 skipped, 20 failed; failure pattern is environment setup, not an observed business-regression assertion. |
| Backend typecheck | PASS | `npm run typecheck` |
| Backend build | PASS | `npm run build` |
| Prisma validation | BLOCKED | `npx prisma validate` requires `DATABASE_URL`; no shared staging fallback used |
| Retailer tests | PASS | 14 files, 56 tests |
| Retailer typecheck | PASS | `mobile/npm run typecheck` |
| Salesperson tests | PASS | 18 files, 93 tests |
| Salesperson typecheck | PASS | `rep/npm run typecheck` |
| Admin tests | PASS | 19 files, 49 tests |
| Admin typecheck | PASS | `admin/npm run typecheck` |
| Admin lint | PASS | `admin/npm run lint` |
| Admin build | PASS | `admin/npm run build` |
| Founder tests | PASS | 4 files, 9 tests |
| Founder typecheck | PASS | `founder/npm run typecheck` |
| Founder build | NOT SUPPORTED | no Founder build script is configured in `founder/package.json` |

## Fresh standalone APKs

Both artifacts were built from the verified staging application source on this isolated branch. They are outside Git and were not copied into the repository.

| App | Artifact | Package | API | Size | SHA-256 | Result |
|---|---|---|---|---:|---|---|
| Retailer | `/Users/tanutejas/Desktop/gagan-retailer-final-uat-e47e38e.apk` | `com.gagan.retailer` | `https://gagan-staging-api.onrender.com` | 87,013,583 bytes | `1a4160b8463f444ca7c0087eb09b2069db5fbcecc5d287f6292f3f481813e16e` | PASS |
| Salesperson | `/Users/tanutejas/Desktop/gagan-salesperson-final-uat-e47e38e.apk` | `com.gagan.sales` | `https://gagan-staging-api.onrender.com` | 87,870,093 bytes | `397e1591dbd9792ce06c2c98d1a196ad81d6b18f9bc22b9a5aa758d880117851` | PASS |

Physical install/launch evidence:

- Retailer: `/tmp/gagan-retailer-uat-launch.png`, login screen rendered after direct release launch.
- Salesperson: `/tmp/gagan-salesperson-uat-launch.png`, real Nikhil Home rendered after direct release launch.
- Device: Moto E13 serial `ZD2229Q3KB`.
- No Metro, USB runtime, Mac runtime, or localhost dependency was required for direct release launch.

## Remaining blockers and next safe actions

The UAT can proceed to a clean final sign-off only after:

1. A disposable PostgreSQL database URL is supplied for DB-backed integration/destructive scenarios.
2. The staging visual-UAT identity is given a legitimately published route through the normal fixture/seed mechanism, or a route-enabled staging identity is provided.
3. The SAP-linked salesperson fixture is assigned to a retailer with a canonical `sapCustomerId`, or the fixture is corrected through the normal staging seed path.
4. The desktop UI is unlocked so hosted browser smoke and screenshot evidence can be completed.

No production deployment, main-branch merge, real-SAP action, real payment/SMS action, or canonical-worktree mutation was performed.

## Documents

- `GAGAN_REAL_WORLD_UAT_MATRIX.md` — complete scenario-by-scenario matrix and executed status mapping.
- `UAT_ENVIRONMENT_AUDIT.md` — isolation, toolchain, dirty-worktree, and safe-environment audit.
- This report — consolidated evidence, defect loop, release artifacts, and blockers.
