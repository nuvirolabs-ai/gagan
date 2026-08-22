# Recovery commitments implementation plan

**Status:** Complete on `feature/recovery-commitments` (pending review/merge).

**Goal:** Give authorised sales, field-collection, credit, and admin users one auditable recovery timeline for customer calls and promises to pay without allowing direct ledger mutation.

## Delivered

- [x] Add `CallLog` and `PromiseToPay` records with indexed case history and terminal statuses.
- [x] Add idempotency keys and conflict checks for call and promise writes.
- [x] Make promise creation supersede the previous open promise for a case.
- [x] Make kept/missed transitions transactional and one-way, with audit events.
- [x] Add staff/admin recovery queue and chronological case timeline routes.
- [x] Add role permissions and admin recovery case controls.
- [x] Add service, route, and admin component tests against the disposable local database.

## Verification

```bash
DATABASE_URL=postgresql://tanutejassaraswat@localhost:5432/gagan_kyc_test \
JWT_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
REFRESH_TOKEN_SECRET=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb \
STORAGE_PROVIDER=local OBJECT_STORAGE_ROOT=.data/evidence DISABLE_JOBS=true \
npm test
```

Backend typecheck/Prisma validation, admin build, rep typecheck, and the focused admin recovery test all pass. Production deployment still requires the SAP, notifications, infrastructure, UAT, and rollout slices listed in the production-readiness roadmap.
