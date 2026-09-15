# Gagan Client-UAT Release Candidate v1

Status: SOURCE READY / HOSTED STAGING NOT VERIFIED / REPLACEMENT SALESPERSON APK BUILT / PHYSICAL UAT PARTIAL

This manifest records the consolidated Gagan source checkpoint prepared for
the next client-UAT APK task. It is not a production release, a hosted
staging acceptance, or a physical-device acceptance.

## Source lineage

Feature branch:

`codex/gagan-client-uat-rc-v1`

Source checkpoint before this manifest commit:

`f5eee40a6fb58fed1c92cd808bb9ac9b48ca88af`

That checkpoint is a direct descendant of the accepted Market Survey
reconciliation line. The manifest commit is the final documentation
checkpoint for this RC; use `git rev-parse HEAD` on this branch for the exact
reconstructable source SHA.

Verified ancestors:

| Capability | Ref | Ancestor result |
| --- | --- | --- |
| Wave 1B commercial runtime | `b8880612f896fccbfaa696516b85d64d9a99ebb9` / `gagan-staging-wave1b-commercial-v1` | PASS |
| Wave 2.1 operational/cache runtime | `b6d2d233f2747cdb6a4db623b62088508e90ae72` | PASS |
| Market Survey reconciliation | `c1a0c4971b1e3c83028e3e6f447a0cd14f1b194f` | PASS |
| Internal Commercial Status workflow | `f5eee40a6fb58fed1c92cd808bb9ac9b48ca88af` | PASS |

The Internal Commercial Status branch was proven to have:

- immediate parent `a1d61cd0a7e49d44ef38359576597d884b87da48`;
- `a1d61cd0…` directly descended from `c1a0c497…`;
- no merge-base divergence or unrelated ancestry between the Market Survey
  checkpoint and the two intended status commits.

The last fetched `origin/codex/gagan-staging` ref was:

`35a9cb737376f4f1ab85219fd583dbfded147a80`

It is recorded for provenance only. This RC was not merged into or pushed to
that branch.

## Consolidated capabilities

The RC preserves the accepted:

- Jain Traders / Padam International ownership model;
- backend-authoritative quotes, GST, freight, mixed orders, combined invoice,
  invoice-scoped balances and explicit payment allocation;
- payment idempotency, cross-invoice protection and R2 evidence boundary;
- Today operational read cache, force-stop cache, reconnect behavior and
  account isolation;
- Market Survey question types, audiences, lifecycle, validation,
  immutable submissions, idempotency, Admin responses and summaries;
- field operations, route, visit, issue routing and current mobile flows;
- internal commercial status overlay, permissions, Admin visibility,
  salesperson timeline/status visibility and retailer privacy boundary.

The internal status layer remains an overlay. Canonical order, approval,
payment, invoice, delivery, credit and SAP state remain authoritative.

Historical retailers and historical payments are not backfilled with
fabricated `ACCOUNT_OPENED` or `ADVANCE_PAYMENT_RECEIVED` events.

## Migration ledger

Final migration count: `39`

Migrations added after the 38-migration Market Survey predecessor:

`20260915150000_internal_commercial_status_v1`

Market Survey migration preserved unchanged:

`20260915120000_market_survey_v1`

Migration SHA-256 values:

| Migration | SHA-256 |
| --- | --- |
| `20260915120000_market_survey_v1/migration.sql` | `1f81da9711f1b55dfb3e49aaebbda15faa35a5f5691dc7535ddb8a453d557294` |
| `20260915150000_internal_commercial_status_v1/migration.sql` | `d56b80cc9c5c660bb5a63648db79a6ed92aa9d324ade55e04b9e621d8e060f99` |

Rejected duplicate/old-lineage migration directories are absent:

- `20260915090000_service_issue_lifecycle`: absent;
- `20260915100000_retailer_proposal_withdrawal_safety`: absent.

Migration diff from `c1a0c497…` contains only the Internal Commercial Status
migration. No unrelated migration was introduced.

## Local database acceptance

Fresh database:

- database: `gagan_client_uat_rc_20260915`;
- all 39 migrations from zero: PASS;
- Prisma validation: PASS;
- Prisma migration status: PASS;
- backend seed and representative fixtures: PASS.

Upgrade database:

- database: `gagan_client_uat_upgrade_20260915`;
- constructed at the 38-migration Market Survey predecessor: PASS;
- candidate status before upgrade: exactly one pending migration,
  `20260915150000_internal_commercial_status_v1`: PASS;
- upgrade applied only that migration: PASS;
- final migration status: up to date at 39 migrations: PASS.

Existing-data compatibility database:

- database: `gagan_client_uat_compat_20260915`;
- representative accepted data seeded before the status migration: PASS;
- before migration: 9 retailers, 31 orders, order total `1017150.00`, 0
  invoices, 0 payments;
- after migration: same retailer/order counts and totals, 0 commercial status
  events, 0 held orders: PASS;
- no historical account-opened or advance-payment status was fabricated.

The compatibility check proves the additive migration does not rewrite the
canonical data present in the predecessor state. The zero invoice/payment
counts are a property of the repository seed fixture; they are not a claim
about hosted staging.

## Local regression results

All results below were run from the consolidated RC worktree, not copied from
an older branch:

| Surface | Tests | Typecheck | Other gate |
| --- | --- | --- | --- |
| Backend | 131 test files / 907 assertions passed | PASS | build PASS, Prisma validate/status PASS |
| Admin | 20 test files / 52 assertions passed | PASS | lint PASS, production build PASS |
| Salesperson | 29 test files / 148 assertions passed | PASS | typecheck PASS |
| Retailer | 17 test files / 74 assertions passed | PASS | typecheck PASS |

`git diff --check`: PASS.

The backend suite initially attempted to run against an empty fresh database;
the six fixture-dependent integration files were then rerun after the
supported repository seed and passed. This was an environment setup issue,
not a product failure.

## Hosted infrastructure gate

The repository contains the following intended configuration references:

- Admin: `https://gagan-staging-api.onrender.com` through
  `VITE_API_URL`;
- Salesperson review build configuration: `https://gagan-staging-api.onrender.com`;
- Retailer build configuration: `https://gagan-staging-api.onrender.com`.

Public read-only checks performed:

- `https://gagan-staging-api.onrender.com/health`: HTTP 200, `{"ok":true}`;
- `https://gagan-staging-api.onrender.com/health/live`: HTTP 200,
  `{"ok":true}`;
- `https://gagan-staging-api.onrender.com/health/ready`: HTTP 200,
  `{"ok":true}`;
- `https://gagan-srat.onrender.com/health`: HTTP 200, `{"ok":true}`;
- `https://gagan-srat.onrender.com/health/live`: HTTP 200,
  `{"ok":true}`;
- `https://gagan-srat.onrender.com/health/ready`: HTTP 200,
  `{"ok":true}`;
- `https://gagan-staging-admin.vercel.app`: HTTP 200.

These public responses prove reachability only. They do not prove that the
two API hostnames are the same service, that either service is backed by the
correct database, or that either runtime contains this RC.

The available authenticated Chrome Render session is visibly scoped to the
Dogkart workspace/service. A Gagan Render workspace/service, attached
database, migration ledger and recovery configuration were not available in
that session. Therefore the following gates remain open:

- Gagan Render account/service identity: NOT VERIFIED;
- canonical Gagan backend hostname: NOT PROVEN;
- current hosted source SHA/deployment ID: UNKNOWN;
- attached Gagan PostgreSQL database: UNKNOWN;
- hosted migration count and pending migrations: UNKNOWN;
- backup/PITR/restore evidence: UNKNOWN;
- hosted baseline and deployment: NOT RUN.

No hosted database was mutated, no hosted migration was applied, and no
backend or Admin deployment was attempted.

## APK preparation for the next task

### Salesperson review APK

- required: YES;
- source: final `codex/gagan-client-uat-rc-v1` checkpoint;
- target API after hosted provenance is verified:
  `https://gagan-staging-api.onrender.com`;
- proposed isolated Android package: `com.gagan.sales.review`;
- proposed app label: `Gagan Sales Review`;
- proposed version: `1.0.1`;
- proposed Android versionCode: `2`;
- build type: standalone release APK;
- expected physical checks: login/session restore, Today online/cache,
  force-stop cache, reconnect, account isolation, route/visit, retailer
  detail, order status/timeline, Market Survey, internal status presentation,
  keyboard and bottom navigation.

The proposed `.review` package follows the existing isolated-review naming
convention and is intentionally not applied in this no-build task.

### Retailer review APK

- required from this RC: NO;
- reason: `mobile/` has no source diff between `c1a0c497…` and the internal
  status checkpoint;
- existing Retailer app still requires later physical backward-compatibility
  and privacy verification.

APKs built at the earlier consolidated-RC checkpoint: `NO`.

Physical Android UAT at the earlier consolidated-RC checkpoint: `NOT RUN`.

## Deployment and safety boundary

- source branch pushed: `NO`;
- hosted backend deployed: `NO`;
- hosted Admin deployed: `NO`;
- hosted migrations applied: `NO`;
- APKs built: `NO`;
- production touched: `NO`;
- main touched: `NO`;
- Dogkart touched: `NO`;
- frozen Wave 1B tag moved: `NO`;
- frozen Salesperson template changed: `NO`;
- real SAP connected: `NO`;

Next gate: verify the correct Gagan Render account/service, canonical
hostname, attached PostgreSQL, migration ledger and recoverable backup. Only
after those gates pass should this branch be pushed and a controlled staging
deployment considered. The next task may then build the Salesperson review
APK from the exact final RC SHA; this task intentionally built neither APK.

## Replacement Salesperson review APK and physical UAT (2026-09-16)

This section records the subsequent replacement-APK build worktree and device
evidence. It does not alter the consolidated RC source checkpoint above and
does not claim hosted deployment acceptance.

Build worktree/branch:

`/Users/tanutejas/Documents/Gagan-client-uat-ux-apk-v1`

`codex/gagan-client-uat-ux-apk-v1`

UX source used for the application code:

`207aac67dfc542ac5c36dae65d659f7ea8f8e0e9`

That source is the verified UX-reconciliation checkpoint descended from the
consolidated RC `aeaf31f6b7f2e39d6f50a8c2d2cb94f8bdcea25a`. The only source
changes after that checkpoint are the guarded hosted review build profile in
`rep/app.config.js` and `rep/eas.json`; no Backend, Admin, Retailer, Prisma,
or migration files changed.

APK:

- path: `/Users/tanutejas/Desktop/gagan-salesperson-client-uat-ux-207aac6.apk`;
- package: `com.gagan.sales.review`;
- label: `Gagan Sales Review`;
- version: `1.0.2`;
- Android versionCode: `3`;
- build/profile commit: `0a259dfff389364cc41a87fd772f417fcad4c922`;
- size: `87985217` bytes;
- SHA-256: `26395e51b24f6cf6669b129d9f93bbf67eda0963e525f4d1fdd7609112fbf767`;
- API target: `https://gagan-srat.onrender.com`;
- forbidden API string checks: `gagan-staging-api.onrender.com`, localhost and
  loopback targets absent;
- standalone release: PASS;
- installed on Moto E13 `ZD2229Q3KB`: PASS;
- launch/session restore: PASS;
- old review APK from `dc62182f61e224edd9bcafa8ed85f8c0ee089e78`: SUPERSEDED,
  preserved;
- Retailer APK: unchanged and not superseded.

Physical evidence:

- Home, More, Outlets, Retailer Detail, Reports/Timeline, Reports/Performance,
  and Order Detail: PASS;
- My Day attendance calendar: PASS;
- Leave From calendar and To calendar: PASS;
- Expense date calendar: PASS;
- Add Store keyboard and scroll-to-Continue: PASS;
- Expense keyboard and scroll-to-submit: PASS;
- Service Issue list, detail, create form, keyboard and visible action: PASS;
- catalogue add, increment, decrement and delete controls: PASS;
- quote-aware Review Order screen: PASS;
- internal Commercial Status presentation on canonical Order Detail:
  `Sales Order Created` visible: PASS;
- Today offline cached state after force-stop: PASS;
- reconnect after network restoration and relaunch: PASS;
- bottom navigation, back navigation, scrolling and sticky actions: PASS;
- crash check after the run: no `FATAL EXCEPTION`, `AndroidRuntime` or
  `ReactNativeJS` fatal output observed; package remained foreground after
  relaunch: PASS.

Evidence screenshots:

- [Home](/Users/tanutejas/Desktop/gagan-sales-review-home-final-207aac6.png)
- [offline cached Home](/Users/tanutejas/Desktop/gagan-sales-review-home-offline-207aac6.png)
- [My Day calendar](/Users/tanutejas/Desktop/gagan-sales-review-myday-207aac6.png)
- [Leave From calendar](/Users/tanutejas/Desktop/gagan-sales-review-leave-from-calendar-207aac6.png)
- [Leave To calendar](/Users/tanutejas/Desktop/gagan-sales-review-leave-to-calendar-207aac6.png)
- [Expense calendar](/Users/tanutejas/Desktop/gagan-sales-review-expense-calendar-207aac6.png)
- [Add Store keyboard](/Users/tanutejas/Desktop/gagan-sales-review-add-store-keyboard-207aac6.png)
- [Add Store keyboard with Continue reachable](/Users/tanutejas/Desktop/gagan-sales-review-add-store-keyboard-cta-207aac6.png)
- [Issue keyboard](/Users/tanutejas/Desktop/gagan-sales-review-issue-keyboard-207aac6.png)
- [Catalogue quantity controls](/Users/tanutejas/Desktop/gagan-sales-review-catalog-quantity-207aac6.png)
- [Review Order](/Users/tanutejas/Desktop/gagan-sales-review-order-review-207aac6.png)
- [Order Detail and internal status](/Users/tanutejas/Desktop/gagan-sales-review-order-detail-207aac6.png)
- [Reports Performance](/Users/tanutejas/Desktop/gagan-sales-review-performance-207aac6.png)
- [More](/Users/tanutejas/Desktop/gagan-sales-review-more-207aac6.png)

Data-dependent physical blocks:

- route/Start Visit: `BLOCKED` — the authenticated hosted persona was off
  duty and the device displayed `No route today` / `No route has been
  published for today`; no route was fabricated;
- full native order submission: `BLOCKED` — the device reached Review Order,
  but the real backend quote displayed `Waiting for manager freight`, so the
  order was not submitted through an unapproved bypass;
- Market Survey response flow: `BLOCKED` — no visible active survey or
  survey-response entry was available for this authenticated persona;
- EOD action: `BLOCKED` — the persona was already off duty and no EOD action
  was exposed in the tested state;
- Login form keyboard: `NOT RUN` — the existing authenticated session was
  preserved; search and all available editable form keyboards were tested.
