# Production configuration checklist

Do not copy development values. Set these in the deployment secret manager and record the owner and rotation date.

## Required backend values

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL`: final Supabase Postgres pooler URL with SSL; run migrations and verify rollback/restore procedure
- [ ] `JWT_SECRET` and `REFRESH_TOKEN_SECRET`: two independent 32+ character secrets
- [ ] `CORS_ORIGINS`: exact HTTPS admin/client origins only
- [ ] `SMS_PROVIDER`: real provider and credentials (sandbox first)
- [ ] `PAYMENT_PROVIDER`: real provider and webhook secret (sandbox first)
- [ ] `SAP_MODE`: real connector mode only after the handoff values are approved; keep `disabled` until then
- [ ] `STORAGE_PROVIDER=s3`, endpoint/region/bucket/access key/secret key; private bucket and signed URLs
- [ ] `REDIS_URL`: managed Redis for rate-limit/worker coordination if enabled by deployment
- [ ] `DISABLE_JOBS=false` only on the single worker deployment; keep API replicas job-disabled
- [ ] `SENTRY_DSN` or equivalent error monitoring

## Client values

- [ ] Retailer `EXPO_PUBLIC_API_URL=https://...`
- [ ] Salesperson `EXPO_PUBLIC_API_URL=https://...`
- [ ] Admin `VITE_API_URL=https://...`
- [ ] No SAP, database, SMS, payment or storage secret is bundled in a client build.

## Operations gates

- [ ] Supabase PITR/backups enabled and a restore rehearsal recorded
- [ ] TLS, domain, WAF/rate limits and health probes configured
- [ ] API, worker and admin deploy independently; worker has one active owner
- [ ] Database migrations run before application rollout and migration status is clean
- [ ] Alerts for failed SAP outbox, stale inventory, OTP abuse, payment webhook failures and queue backlog
- [ ] On-call owner, escalation path and rollback procedure documented
