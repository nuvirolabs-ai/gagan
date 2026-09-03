# Admin Operational Instrument worktree

## Purpose

This worktree locks and propagates the approved Gagan Admin visual reference
without disturbing the primary checkout, the existing Gagan Admin, the
Dogkart project, or the previously used Admin design worktrees.

## Isolation record

| Item | Value |
| --- | --- |
| Repository | `/Users/tanutejas/Documents/Gagan` |
| Source baseline | `origin/codex/gagan-staging` |
| Source baseline commit | `2561cb4` (`Redesign Admin work and orders surfaces`) |
| New worktree | `/Users/tanutejas/Documents/Gagan-admin-operational-instrument` |
| New branch | `codex/admin-operational-instrument-v1` |
| Reference source | `/Users/tanutejas/Documents/Gagan-admin-design-lab` |
| Reference URL | `http://127.0.0.1:5184/` |
| Functional Admin | `/Users/tanutejas/Documents/Gagan-admin-operational-instrument/admin` |

The primary checkout was dirty before this work began. Its pre-existing files
were left in place and are not part of this worktree:

```text
admin/.gitignore
rep/app.json
rep/package-lock.json
rep/package.json
rep/src/auth/secureSession.ts
rep/src/components/companion.tsx
rep/src/components/ui.tsx
rep/src/context/RepContext.tsx
rep/src/screens/RepLoginScreen.tsx
rep/src/screens/TodayScreen.tsx
rep/src/theme.ts
Gagan/
founder/android/
founder/ios/
rep/src/auth/__tests__/otpErrors.test.ts
rep/src/auth/otpErrors.ts
tmp/
```

## Non-touch boundaries

The following were not modified by this worktree:

- the original `/Users/tanutejas/Documents/Gagan` checkout;
- the existing Gagan backend, Prisma schema, database, or SAP connector;
- Retailer, Salesperson, and Founder application code;
- `/Users/tanutejas/Documents/Gagan-admin-approved-reference`;
- `/Users/tanutejas/Documents/Gagan-admin-design-lab`;
- `/Users/tanutejas/Documents/Gagan-admin-native`;
- `/Users/tanutejas/Documents/Gagan-admin-visual-v2`;
- production deployments, credentials, or databases.

The Admin-only implementation changes are isolated to the new worktree. Local
browser QA uses the existing local backend on port 4000 and the local Admin
preview on port 5188; neither changes the backend contract or deployment.

## Lock and tag

The reference lock is recorded in
`ADMIN_OPERATIONAL_INSTRUMENT_LOCK.md`. The local tag
`admin-operational-instrument-v1-reference` is created on the separate lock
commit and is intentionally not pushed.
