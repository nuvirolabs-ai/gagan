# UAT Environment Audit

## Scope and isolation

- Canonical checkout: `/Users/tanutejas/Documents/Gagan` (dirty; not modified).
- UAT worktree: `/Users/tanutejas/Documents/Gagan-full-e2e-uat`.
- UAT branch: `codex/gagan-full-e2e-uat-hardening`.
- Base: `origin/codex/gagan-staging` at `e47e38e99cf08c0d71542ea230815c33dca17a26`.
- No reset, clean, stash, force push, production deploy, real SAP, or main-branch operation is permitted.

## Initial readiness observations

| Check | Result | Notes |
|---|---|---|
| Node/npm | PASS | Node `v26.7.0`, npm `11.19.0` available; repository may require a supported project runtime, to be verified by install/tests. |
| PostgreSQL client | PASS | `psql` available. |
| Disposable DB URL | BLOCKED | `DATABASE_URL`, `TEST_DATABASE_URL`, and `DIRECT_URL` are absent from the current shell; no destructive local DB setup will be attempted against shared data. |
| Android tooling | PASS | ADB at `/Users/tanutejas/Library/Android/sdk/platform-tools/adb`. |
| Physical Android | PASS | Moto E13 connected as `ZD2229Q3KB`. |
| Browser/hosted data credentials | PASS / BLOCKED for visual UI | Hosted Admin, Retailer, Ravi, and Nikhil credentials authenticated; desktop visual browser automation remained blocked while the Mac UI was locked. |
| Staging provider mode | PASS for exercised providers | Mock OTP accepted; mock SAP connector enabled; real payment/SMS were not used. |

## Executed hosted identities and evidence

- Admin: Ops Admin login succeeded against `https://gagan-staging-api.onrender.com`; bearer tokens were kept in redacted local `/tmp` files and are not included in this document.
- Retailer: Mahesh Store, phone `9999999999`, mock OTP `123456`.
- Salesperson: Ravi Kumar, phone `9812345670`, mock OTP `123456`.
- Visual-UAT salesperson: Nikhil Patil, phone `9812367800`, mock OTP `123456`.
- Hosted health: `/health`, `/health/live`, and `/health/ready` each returned HTTP 200.
- Physical device: Moto E13, serial `ZD2229Q3KB`.
- Physical launch screenshots: `/tmp/gagan-retailer-uat-launch.png`, `/tmp/gagan-salesperson-uat-launch.png`.

## Safe-environment blockers

- No `DATABASE_URL`, `TEST_DATABASE_URL`, or `DIRECT_URL` was available. Backend DB-backed tests, Prisma validation, and destructive automation were therefore recorded as blocked rather than pointed at shared staging.
- Current staging visual-UAT Nikhil has no published route. Direct database writes were not used to manufacture one.
- Bharat Provisions, Nikhil's selected assigned retailer, has no `sapCustomerId`. The mock SAP outbox correctly retained that item as unlinked. A complete linked salesperson path was proven with Ravi and Mahesh instead.
- The desktop UI was locked during the browser-automation portion. Hosted HTTP/API checks and physical Android launch checks were completed; visual browser route interaction remains blocked.

## Evidence policy

All state-changing UAT will use product APIs/UI and normal authentication/workflows. Direct database writes are prohibited for workflow advancement. Automated destructive checks require a disposable database; without one they remain blocked rather than using shared staging.
