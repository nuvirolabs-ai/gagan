# Historical matrix — superseded by `GAGAN_REAL_WORLD_UAT_FINAL_REPORT_V2.md`

This matrix is retained as the prior run's evidence and draft. The earlier
results must be read with their original test method boundaries. The corrected
native/UI matrix, using the approved template source and isolated databases,
is in `GAGAN_REAL_WORLD_UAT_FINAL_REPORT_V2.md`.

# Gagan Real-World End-to-End UAT Matrix

**Run:** 2026-09-06
**Branch:** `codex/gagan-full-e2e-uat-hardening`
**Base:** `e47e38e99cf08c0d71542ea230815c33dca17a26` (`origin/codex/gagan-staging` at worktree creation)
**Scope:** controlled staging UAT plus local/disposable automated validation. Production, real SAP, real payments/SMS, `main`, and unrelated products are out of scope.

The tables below were drafted before execution. The authoritative executed status for every ID is recorded in **Executed run results** at the end of this document; those results supersede the initial `NOT RUN` placeholders.

## Result vocabulary

- **PASS** — executed with observable evidence and the expected result was confirmed.
- **FAIL** — executed and an unexpected result or regression was observed.
- **BLOCKED** — safe execution was not possible because a required external prerequisite was unavailable; the blocker and evidence must be recorded.
- **NOT SUPPORTED** — the product explicitly does not implement the requested behavior; the contract/evidence must be recorded.
- **NOT RUN** — not yet attempted.

## Environment and evidence register

| Area | Expected | Observed | Result | Evidence |
|---|---|---|---|---|
| Canonical staging remote | current `origin/codex/gagan-staging` | `e47e38e99cf08c0d71542ea230815c33dca17a26` at worktree creation | PASS | `git rev-parse origin/codex/gagan-staging` |
| Isolated worktree | separate clean worktree and branch | `/Users/tanutejas/Documents/Gagan-full-e2e-uat`, `codex/gagan-full-e2e-uat-hardening` | PASS | `git status --short --branch` |
| Local database for destructive automation | disposable `TEST_DATABASE_URL` | absent at initial audit | BLOCKED until provisioned | environment audit |
| Android device | connected physical Android | Moto E13, serial `ZD2229Q3KB` | PASS | `adb devices` |
| Backend staging health | API responds healthy | `/health`, `/health/live`, `/health/ready` all returned HTTP 200 | PASS | hosted API checks |
| Mock OTP/payment/SAP | staging uses mock providers | mock OTP accepted; mock SAP enabled; payment path not exercised | PASS for exercised providers | hosted API checks |
| Hosted credentials/fixture access | controlled UAT identities available | admin, retailer, Ravi, and Nikhil visual-UAT credentials authenticated | PASS | redacted token files under `/tmp` |

## Retailer App

| ID | Scenario / persona | Starting state | Action | Expected backend truth | Expected Admin / Retailer / Salesperson / finance / SAP result | Result | Evidence | Bug / fix / retest |
|---|---|---|---|---|---|---|---|---|
| R-01 | Retailer OTP login | fresh app session | request OTP, submit valid mock OTP | session issued; retailer identity scoped | retailer lands on Home; no cross-tenant data | NOT RUN |  |  |
| R-02 | Retailer session restore | valid persisted session | relaunch app | token refresh/restore succeeds | Home returns without duplicate login | NOT RUN |  |  |
| R-03 | Retailer catalog load | authenticated retailer | open catalog/categories | products visible from canonical catalog | images, SKU, pack, price and stock are coherent | NOT RUN |  |  |
| R-04 | Search/category/product detail | catalog loaded | search, filter category, open SKU | no stale or unrelated products | detail shows canonical pack/price/stock | NOT RUN |  |  |
| R-05 | Cart quantity/edit/remove | product available | add, increase, decrease, remove | cart reflects exact lines and quantities | totals and availability stay consistent | NOT RUN |  |  |
| R-06 | Checkout review | valid cart | open checkout/review | no write before final submit | retailer sees exact final order preview | NOT RUN |  |  |
| R-07 | Fresh retailer order | valid cart, no prior fresh order | submit exactly once | one order created with idempotency protection | Admin queue receives one order; confirmation/history show same ID | NOT RUN |  |  |
| R-08 | Duplicate submit/retry | submit response delayed/retried | repeat same submit/idempotency key | no duplicate order | one timeline/queue entry | NOT RUN |  |  |
| R-09 | Order history/detail | fresh order exists | open history and detail | canonical lifecycle and totals returned | status/amount match Admin and backend | NOT RUN |  |  |
| R-10 | Confirmation | submit succeeded | return to confirmation | order remains canonical after refresh | reference and next action clear | NOT RUN |  |  |
| R-11 | Full stock happy path | sufficient stock/credit | order through fulfillment | reservation/decrement invariants hold | Admin can confirm/pack/dispatch/deliver | NOT RUN |  |  |
| R-12 | Stock shortage | line exceeds available stock | review/submit | order blocked or partial behavior follows contract | clear retailer error; no negative stock | NOT RUN |  |  |
| R-13 | Payment/credit | payment mode configured | submit eligible and ineligible orders | credit/payment state is authoritative | Admin credit state and finance ledger agree | NOT RUN |  |  |
| R-14 | Offline/outbox | device disconnected | browse cached data, submit/retry | safe outbox replay/idempotency | visible pending/sync/error state | NOT RUN |  |  |

## Salesperson App

| ID | Scenario / persona | Starting state | Action | Expected backend truth | Expected Admin / Retailer / Salesperson / finance / SAP result | Result | Evidence | Bug / fix / retest |
|---|---|---|---|---|---|---|---|---|
| S-01 | Salesperson OTP login | fresh app session | request/submit valid mock OTP | salesperson session and scope issued | Home opens with correct identity | NOT RUN |  |  |
| S-02 | Session restore | valid persisted session | relaunch | session restored or safely re-authenticated | no stale persona leakage | NOT RUN |  |  |
| S-03 | Active day/Home | assigned salesperson | open Home | canonical day/route/metrics loaded | Next Visit, route and target values are real | NOT RUN |  |  |
| S-04 | Attendance/start day | before active day | start day | one active day per policy | Home state and audit event update | NOT RUN |  |  |
| S-05 | Route/Next Visit | published route | inspect plan and next stop | ordered stops and assignments match backend | retailer/address/time consistent | NOT RUN |  |  |
| S-06 | Visit start/complete | next stop available | start, capture outcome, complete | visit status/timestamps saved once | retailer timeline and Admin visibility update | NOT RUN |  |  |
| S-07 | Outlets/retailer detail | assigned outlets | search/open retailer | scope-safe retailer data | pricing, credit, visit/order context coherent | NOT RUN |  |  |
| S-08 | Catalog/pricing/inventory | retailer selected | browse catalog and add order | canonical price/stock/credit rules apply | Admin receives attributed order | NOT RUN |  |  |
| S-09 | Fresh salesperson order | valid cart | submit exactly once | one order attributed to salesperson and retailer | Admin queue, retailer history, timeline agree | NOT RUN |  |  |
| S-10 | Reports/timeline | orders/visits exist | switch timeline/performance | aggregates read canonical records | values reconcile with backend | NOT RUN |  |  |
| S-11 | More modules | authenticated user | open attendance/leave/tasks/expenses/issues/profile | writes follow contracts and scopes | audit events where applicable | NOT RUN |  |  |
| S-12 | End day | active day | end day | day closes once with summary | no further invalid visit/order transitions | NOT RUN |  |  |
| S-13 | Offline/outbox | device disconnected | perform supported actions/retry | outbox replays safely | no duplicate visits/orders | NOT RUN |  |  |

## Admin / Order Operations

| ID | Scenario / persona | Starting state | Action | Expected backend truth | Expected Admin / Retailer / Salesperson / finance / SAP result | Result | Evidence | Bug / fix / retest |
|---|---|---|---|---|---|---|---|---|
| A-01 | Admin authentication | admin session available | sign in/open queue | admin scope enforced | Work/Home and Orders load | NOT RUN |  |  |
| A-02 | Queue discovery | fresh order exists | find order by ID/retailer/status | canonical order visible once | value, owner, age, blockage visible | NOT RUN |  |  |
| A-03 | Credit review | credit decision required | inspect/approve/reject | decision transitions once and audits actor | retailer/salesperson status updates | NOT RUN |  |  |
| A-04 | Inventory exception | shortage or mismatch | inspect exception | no unsafe fulfillment transition | clear next action/owner | NOT RUN |  |  |
| A-05 | Partial/cancel | contract-supported order | partial/cancel via allowed action | quantities/status/ledger remain coherent | all surfaces reflect result | NOT RUN |  |  |
| A-06 | Confirm/pack | order ready | confirm then pack | lifecycle transitions are guarded/idempotent | retailer and salesperson see status | NOT RUN |  |  |
| A-07 | Dispatch | packed order | assign/dispatch | dispatch records ownership/time | order leaves fulfillment queue | NOT RUN |  |  |
| A-08 | Delivery/POD success | dispatched order | submit valid POD | delivered state and proof recorded | retailer history and finance update | NOT RUN |  |  |
| A-09 | Delivery/POD failure | dispatched order | submit failed/invalid POD | rejection preserves prior state and reason | retry path clear | NOT RUN |  |  |
| A-10 | Data import | supported CSV/XLSX | preview, validate, apply | bounded validated writes only | history and errors are explicit | NOT RUN |  |  |
| A-11 | SAP status/outbox | mock SAP enabled | inspect/drain twice/retry failure | outbox idempotent, no duplicate SAP effect | sync status/audit visible | NOT RUN |  |  |
| A-12 | Permissions | non-admin/persona mismatch | open protected Admin route/action | authorization denies safely | no data leakage or mutation | NOT RUN |  |  |

## Inventory, fulfillment, warehouse and finance

| ID | Scenario | Expected invariant or behavior | Result | Evidence | Bug / fix / retest |
|---|---|---|---|---|---|
| F-01 | Full-stock order | reserved/available/on-hand values reconcile | NOT RUN |  |  |
| F-02 | Shortage/procurement | no negative stock; exception/needed quantity explicit | NOT RUN |  |  |
| F-03 | Receiving incremental | repeated receipts accumulate exactly once | NOT RUN |  |  |
| F-04 | Warehouse exact pick | picked equals requested and status advances | NOT RUN |  |  |
| F-05 | Warehouse short pick | short reason required; unpicked quantity remains visible | NOT RUN |  |  |
| F-06 | Warehouse over pick | overage rejected or explicitly handled by contract | NOT RUN |  |  |
| F-07 | Multi-wave fulfillment | each wave and remaining quantity reconcile | NOT RUN |  |  |
| F-08 | Multi-warehouse | execute only if supported; otherwise explicit NOT SUPPORTED | NOT RUN |  |  |
| F-09 | Partial collection | ledger and outstanding balance reconcile | NOT RUN |  |  |
| F-10 | Final collection | balance closes once; repeat is idempotent | NOT RUN |  |  |
| F-11 | Credit/cancel/return | approval, reversal and return states preserve audit/ledger invariants | NOT RUN |  |  |

## Cross-surface, safety, quality and resilience

| ID | Scenario | Expected behavior | Result | Evidence | Bug / fix / retest |
|---|---|---|---|---|---|
| X-01 | Cross-surface identity | one order/customer/actor IDs agree everywhere | NOT RUN |  |  |
| X-02 | Audit trail | actor/action/time/reason recorded for state-changing actions | NOT RUN |  |  |
| X-03 | Duplicate action | retries do not duplicate business effects | NOT RUN |  |  |
| X-04 | Offline/reconnect | queued supported action resumes safely | NOT RUN |  |  |
| X-05 | Malformed input | readable validation, no 500/data mutation | NOT RUN |  |  |
| X-06 | Unauthorized action | 401/403 and no side effect | NOT RUN |  |  |
| X-07 | Loading/empty/error | stable geometry, truthful state, retry where useful | NOT RUN |  |  |
| X-08 | Performance | no unacceptable wait, crash, or repeated request loop | NOT RUN |  |  |
| X-09 | Hosted browser smoke | Admin reference routes render and remain usable | NOT RUN |  |  |
| X-10 | Android physical smoke | final standalone APK launches without Metro/local dependency | NOT RUN |  |  |

## Automated release gates

| Area | Command / check | Result | Evidence |
|---|---|---|---|
| Backend tests | `npm test` | NOT RUN |  |
| Backend typecheck | `npm run typecheck` | NOT RUN |  |
| Backend build | `npm run build` | NOT RUN |  |
| Prisma validate | `npx prisma validate` | NOT RUN |  |
| Retailer tests/typecheck | `npm test`, `npm run typecheck` | NOT RUN |  |
| Retailer Android release | fresh standalone build | NOT RUN |  |
| Salesperson tests/typecheck | `npm test`, `npm run typecheck` | NOT RUN |  |
| Salesperson Android release | fresh standalone build | NOT RUN |  |
| Admin tests/typecheck/lint/build | configured scripts | NOT RUN |  |
| Founder regression | configured tests/build if shared contracts affected | NOT RUN |  |
| Git hygiene | diff/status/branch/main/prod checks | NOT RUN |  |

## Fresh APK evidence

| Artifact | Expected | Result | Evidence |
|---|---|---|---|
| Retailer APK | `gagan-retailer-final-uat-<sha>.apk`; package/API standalone | NOT RUN |  |
| Salesperson APK | `gagan-salesperson-final-uat-<sha>.apk`; package/API standalone | NOT RUN |  |
| Device install/launch | physical Android | NOT RUN |  |

## Executed run results

The following is the final executed mapping. `PASS` means the stated backend or hosted contract was exercised; it does not imply that an unperformed native UI step was silently assumed to pass.

### Retailer App

| ID | Result | Evidence / boundary |
|---|---|---|
| R-01 | PASS | Hosted mock OTP request/verify for Mahesh Store (`9999999999` / `123456`); `/auth/me` returned the scoped retailer. |
| R-02 | NOT RUN | Native session-restore relaunch was not completed on the device. |
| R-03 | PASS | Hosted `/home` and `/catalog`: canonical retailer home, 9 grouped product categories, 11 raw variants, stock and prices returned. |
| R-04 | PASS | Category/grouped-catalog data and a real variant detail were exercised through the API; native search/detail UI was not separately captured. |
| R-05 | NOT RUN | Native cart quantity/remove interaction not separately exercised. |
| R-06 | NOT RUN | Native checkout review not separately captured. |
| R-07 | PASS | Fresh retailer order `GGN-00000058`, id `f9b34759-9470-47b7-8a19-1f1a2b537558`, total ₹3,120; Admin found the same order. |
| R-08 | PASS | Replayed the exact retailer `Idempotency-Key`; HTTP 201 returned the same order `58`, with no duplicate order. |
| R-09 | PASS | Hosted retailer `/orders` reflected the delivered lifecycle after Admin POD; retailer and Admin records agreed on order identity/status. |
| R-10 | PASS | Order response, history refresh, and idempotent replay retained the canonical order reference. |
| R-11 | PASS | Order 58 completed through Admin confirm → pack → dispatch → OTP POD → delivered; invoice and ledger side effects were created. |
| R-12 | NOT RUN | No shortage mutation was attempted against shared staging. |
| R-13 | NOT RUN | Credit eligibility was observed, but separate eligible/ineligible payment scenarios were not run. |
| R-14 | NOT RUN | Offline device/outbox replay was not run. |

### Salesperson App

| ID | Result | Evidence / boundary |
|---|---|---|
| S-01 | PASS | Hosted mock OTP request/verify for Ravi and visual-UAT Nikhil; scoped `/rep/me` responses returned. |
| S-02 | NOT RUN | Native session restore was not separately exercised. |
| S-03 | PASS | `/rep/field/today`, `/rep/field/performance`, and `/rep/field/activity-feed` returned real identity-scoped data; the Nikhil fixture currently reported a closed/no-route state. |
| S-04 | NOT RUN | No new attendance/start-day mutation was required or performed. |
| S-05 | BLOCKED | Nikhil’s visual-UAT fixture has no published route on current staging; no direct DB seeding or bypass was used. |
| S-06 | NOT RUN | No visit mutation was performed. |
| S-07 | PASS | Hosted `/rep/retailers` and Mahesh retailer detail returned assigned, scope-safe data. |
| S-08 | PASS | Hosted assigned-retailer catalog returned canonical variant, price, availability, and credit context. |
| S-09 | PASS | Salesperson orders `GGN-00000059` (Nikhil/Bharat, SAP-unlinked fixture) and `GGN-00000060` (Ravi/Mahesh) were created with salesperson attribution; order 60 was completed through delivery. Exact idempotency replay returned the same order. |
| S-10 | PASS | Performance and activity feed reconciled the new salesperson order; feed showed `GGN-00000060` delivered and performance totals increased. |
| S-11 | NOT RUN | More-module writes were not separately run. |
| S-12 | NOT RUN | End-day mutation was not run. |
| S-13 | NOT RUN | Offline/outbox replay was not run. |

### Admin / Order Operations

| ID | Result | Evidence / boundary |
|---|---|---|
| A-01 | PASS | Hosted Admin login for Ops Admin succeeded; protected Admin API required the admin bearer token. |
| A-02 | PASS | Admin fetched and identified fresh orders 58, 59, and 60 by canonical IDs. |
| A-03 | NOT RUN | No fresh credit decision was required by the selected happy-path fixture. |
| A-04 | NOT RUN | No inventory exception mutation was introduced. |
| A-05 | NOT RUN | Partial/cancel flow was not run against shared staging. |
| A-06 | PASS | Orders 58 and 60 transitioned through confirm and pack; invalid re-transition after delivery returned HTTP 409. |
| A-07 | PASS | Orders 58 and 60 were assigned to a route/delivery slot and moved to `out_for_delivery`. |
| A-08 | PASS | Orders 58 and 60 accepted OTP POD and moved to `delivered`; invoice/POD responses were returned. |
| A-09 | PASS | Invalid post-delivery transitions were rejected with HTTP 409 and did not mutate the delivered state. A separate malformed POD failure was not run. |
| A-10 | NOT RUN | Import Center was not exercised in this UAT loop. |
| A-11 | PASS | Mock SAP status/sync returned healthy entity results; linked order outbox drain was replayed twice with no duplicate effect. One unlinked fixture was correctly rejected with an explicit SAP-link error. |
| A-12 | PASS | Unauthenticated protected calls returned HTTP 401; invalid lifecycle actions returned HTTP 409 without unsafe mutation. |

### Inventory, fulfillment, warehouse and finance

| ID | Result | Evidence / boundary |
|---|---|---|
| F-01 | PASS | Full-stock one-line orders 58 and 60 completed with stock/dispatch authorization accepted by the canonical flow. |
| F-02 | NOT RUN | No shortage mutation against shared staging. |
| F-03 | NOT RUN | No receiving mutation. |
| F-04 | NOT RUN | Warehouse exact-pick UI/action not separately exercised; Admin pack was exercised. |
| F-05 | NOT RUN | No short-pick mutation. |
| F-06 | NOT RUN | No over-pick mutation. |
| F-07 | NOT RUN | No multi-wave mutation. |
| F-08 | NOT SUPPORTED | Multi-warehouse behavior was not part of the selected staging contract; no evidence was found that it is exposed by this route. |
| F-09 | NOT RUN | No collection mutation. |
| F-10 | NOT RUN | No final-collection mutation. |
| F-11 | NOT RUN | No credit/cancel/return mutation. |

### Cross-surface, safety, quality and resilience

| ID | Result | Evidence / boundary |
|---|---|---|
| X-01 | PASS | Order 58 linked retailer → Admin → delivery/POD → invoice/outbox; order 60 linked salesperson → retailer detail → Admin → activity/performance → delivery/POD. |
| X-02 | NOT RUN | Full audit-log extraction was not separately performed. |
| X-03 | PASS | Retailer order replay, salesperson order replay, POD replay, and repeated SAP drain were safe and idempotent. |
| X-04 | NOT RUN | Offline/reconnect not exercised. |
| X-05 | PASS | Missing `Idempotency-Key` returned HTTP 400; invalid delivered transitions returned HTTP 409; no 500 or write was observed. |
| X-06 | PASS | Missing Authorization returned HTTP 401 on retailer, rep, and Admin protected endpoints. |
| X-07 | BLOCKED | Desktop browser interaction was blocked by the locked Mac UI; API state checks and physical launch screenshots were still completed. |
| X-08 | PASS | Hosted health endpoints returned HTTP 200; fresh release APK direct launches rendered without a new crash; no request-loop regression was observed in the controlled checks. |
| X-09 | BLOCKED | Hosted HTML shell was reachable, but visual browser navigation was not safely available while the desktop UI was locked. |
| X-10 | PASS | Fresh standalone Retailer and Salesperson release APKs installed/launched on physical Moto E13 without Metro/local runtime dependency. |

### Automated release gates — executed

| Area | Result | Evidence |
|---|---|---|
| Backend tests | BLOCKED | 87 files passed / 31 failed; failures were environment-driven by missing `DATABASE_URL`, secrets, and DB connectivity. No shared DB fallback was used. |
| Backend typecheck | PASS | `backend/npm run typecheck` |
| Backend build | PASS | `backend/npm run build` |
| Prisma validate | BLOCKED | `npx prisma validate` requires missing `DATABASE_URL`; not a source-schema finding. |
| Retailer tests | PASS | 14 files / 56 tests |
| Retailer typecheck | PASS | `mobile/npm run typecheck` |
| Retailer Android release | PASS | `/Users/tanutejas/Desktop/gagan-retailer-final-uat-e47e38e.apk` |
| Salesperson tests | PASS | 18 files / 93 tests |
| Salesperson typecheck | PASS | `rep/npm run typecheck` |
| Salesperson Android release | PASS | `/Users/tanutejas/Desktop/gagan-salesperson-final-uat-e47e38e.apk` |
| Admin tests | PASS | 19 files / 49 tests |
| Admin typecheck/lint/build | PASS | `admin` scripts all green |
| Founder regression | PASS | 4 files / 9 tests and typecheck; no Founder build script is configured |
| Git hygiene | PASS | isolated branch; canonical dirty checkout untouched; no main/production operation |

### Fresh APK evidence — executed

| Artifact | Result | Evidence |
|---|---|---|
| Retailer APK | PASS | `/Users/tanutejas/Desktop/gagan-retailer-final-uat-e47e38e.apk`; 87,013,583 bytes; SHA-256 `1a4160b8463f444ca7c0087eb09b2069db5fbcecc5d287f6292f3f481813e16e`; package `com.gagan.retailer`; bundled API `https://gagan-staging-api.onrender.com`. |
| Salesperson APK | PASS | `/Users/tanutejas/Desktop/gagan-salesperson-final-uat-e47e38e.apk`; 87,870,093 bytes; SHA-256 `397e1591dbd9792ce06c2c98d1a196ad81d6b18f9bc22b9a5aa758d880117851`; package `com.gagan.sales`; bundled API `https://gagan-staging-api.onrender.com`. |
| Device install/launch | PASS | Moto E13 serial `ZD2229Q3KB`; screenshots `/tmp/gagan-retailer-uat-launch.png` and `/tmp/gagan-salesperson-uat-launch.png`. |

## Defect loop log

| Defect | Reproduction | Root cause | Minimal fix | Regression | Retest |
|---|---|---|---|---|---|
| Initial Android release build warning/failure | first fresh native release build | local Java/Android toolchain required the repository compatibility flag; not an app defect | reran with `JAVA_TOOL_OPTIONS=--enable-native-access=ALL-UNNAMED` | Retailer and Salesperson release builds completed | PASS; APKs installed/launched |
| First physical Salesperson launch attempt exited | Expo/development launch path on the connected device | the attempted dev launch lacked the API environment value; the old tombstone was from that attempt, not the fresh release APK | no product-code change; launched the fresh standalone release APK directly | direct release launch resumed and rendered Home with no new crash | PASS; `/tmp/gagan-salesperson-uat-launch.png` |
| Nikhil visual-UAT route unavailable | `/rep/field/route` and `/rep/field/today` on current staging | fixture exists but has no currently published route; no normal UI route-publication path was available, and direct DB writes are prohibited | no bypass; recorded as staging-data blocker | protected route read remained healthy; no source regression identified | BLOCKED |
| Nikhil/Bharat SAP linkage unavailable | drain after Nikhil order | assigned retailer has no `sapCustomerId`; mock SAP correctly rejected the outbox item | no bypass; completed SAP-linked salesperson path with Ravi + Mahesh instead | linked salesperson order drained and reached `sent`; unlinked item remained explainable | PASS for guard; BLOCKED for that fixture |
