# Gagan staging: free-tier deployment runbook

This Blueprint is for isolated Gagan staging only. It does not change the
existing Gagan admin, the existing Dogkart admin/backend/database, or any
production deployment.

## Render services

`render.yaml` creates:

- `gagan-staging-api`: Render Web Service, `plan: free`
- `gagan-staging-db`: isolated Render Postgres, `plan: free`

Render does not offer a free background-worker service. The API therefore runs
the existing in-process scheduler only when both of these staging settings are
active:

```text
NODE_ENV=staging
STAGING_RUN_JOBS_IN_API=true
```

This is safe for this staging setup because it has one API instance. Do not
enable it for a multi-replica deployment; use a dedicated worker before doing
that. `SAP_MODE=mock`, so the scheduler's SAP sync and outbox work remain test
only.

## Migration strategy

The API start command runs:

```text
npx prisma migrate deploy && npm start
```

`prisma migrate deploy` applies only pending committed migrations. It does not
reset the database and it does not use `prisma db push`.

## One-time seed

Seeding is intentionally not part of the Blueprint and is never run on every
redeploy. After Render has provisioned `gagan-staging-db` and the API has been
created, copy the database's external connection string from Render and run
these commands once from a trusted local terminal in `backend/`:

```text
DATABASE_URL='<Render external staging connection string>' npx prisma migrate deploy
DATABASE_URL='<Render external staging connection string>' npm run prisma:seed
```

The seed is for staging/demo data only. Do not run it again unless the staging
database is intentionally being reseeded, because the seed script can replace
demo records. Never use `prisma db push` or a reset against this database.

## What is intentionally absent

- No Render `worker` service: free Render does not support free background
  workers, and this setup does not upgrade to a paid plan.
- No production SAP, SMS, payment, storage, or database credentials.
- No Dogkart production API or database dependency.
