# Admin permission and session restoration staging fix

Base: `aeaf31f6b7f2e39d6f50a8c2d2cb94f8bdcea25a`.
Branch: `codex/gagan-admin-auth-staging-fix`.

## Diagnosis and boundaries

The accepted Admin frontend calls refresh with credentials included and keeps
access tokens only in memory. The shared cookie writer nevertheless hard-coded
SameSite=Strict, incompatible with the Vercel-to-Render cross-site deployment.
The fix makes cookie policy configurable and selects None only for hosted Admin
cookies, with Secure, HttpOnly, host-only scope, /admin/auth path and the existing
30-day expiry. Local HTTP and all other callers retain Strict. Existing custom
refresh CSRF header, token rotation, revocation and exact CORS remain unchanged.
Browser third-party-cookie policy still requires actual hosted verification.

The source platform_admin catalog includes survey.manage and survey.responses_view.
The prior hosted account read did not include either permission. A fresh read of
the deployed role mapping and complete catalog comparison is still required.
Do not treat the stale-seed explanation as freshly verified hosted evidence.

## Role reconciliation

The broad seed clears transactional data and MUST NOT run against staging.
The new roleSync utility is additive, selects an existing catalog role explicitly,
preserves extra grants and does not touch staff, passwords, role assignments or
business records. Dry-run is default. Applying requires an explicit matching
ROLE_SYNC_EXPECTED_DB_HOST; do not log connection strings or credentials.

After the pinned fix is deployed, inspect the exact account, database identity,
migration count and runtime revision. Then use:

`node dist/modules/identity/syncRolePermissionsCli.js platform_admin --dry-run`

Review every missing relationship before applying the same command with --apply
and the expected database host guard. Record the exact additions and repeat the
dry-run to prove idempotency. Do not synchronize other roles in this task.

## Local verification

All 39 migrations applied to a fresh disposable local PostgreSQL database.
Initial unconfigured and unseeded runs failed for missing local test prerequisites;
no assertions were weakened. With fixtures and local-only JWT, refresh and PII
configuration, the backend suite passed 911 tests before the additional real
login/refresh/me/logout integration test was added. Final full run: 912 tests in
133 files passed, including actual database-backed login, refresh, current /me
permissions and logout revocation. Backend typecheck and build passed.
Admin: 55 tests in 21 files passed; typecheck, lint and build passed. Admin runtime
source is unchanged: changes there are tests only, so no new preview is needed.
No migration files changed. No APK builds.

## Hosted continuation gate

The authorized R (gagantoordal.com) Render window was no longer visible during
this run. Other account windows were not used to modify anything. The owner was
asked to reopen gagan-api, srv-dak1ppu1egvs7397s9c0, in R's workspace.
No hosted role synchronization, password reset, backend deployment, Admin
deployment or Survey creation has occurred in this fix task.

Remaining: fresh hosted role preflight, pinned backend deployment, additive role
sync, real Employee login and /me permission verification, refresh/direct-link
restoration, logout rejection and retained Vercel protection. Do not claim hosted
acceptance or start Survey UAT until these pass.
