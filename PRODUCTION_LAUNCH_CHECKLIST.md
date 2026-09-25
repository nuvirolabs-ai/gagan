# Production launch checklist

Do not copy staging mock values.

## Backend

- [ ] `NODE_ENV=production`
- [ ] Postgres with SSL, migrations, PITR
- [ ] Distinct JWT + refresh secrets
- [ ] CORS = exact HTTPS origins
- [ ] Real SMS provider (staging mock forbidden)
- [ ] Real payment provider + webhook secret
- [ ] `SAP_MODE=disabled` until B1 UAT signed off
- [ ] S3 evidence bucket
- [ ] Redis if multi-replica rate limits required
- [ ] Separate API vs worker; one job owner
- [ ] Sentry (or equivalent)

## Clients

- [ ] Retailer / Sales `EXPO_PUBLIC_API_URL` production HTTPS
- [ ] Admin `VITE_API_URL` production HTTPS
- [ ] No secrets in APKs
- [ ] Store listing / TestFlight when distribution starts

## Ops

- [ ] Health probes, TLS, backups restore drill
- [ ] Alerts: SAP outbox failed, OTP abuse, payment webhooks, queue backlog
- [ ] On-call + rollback

## Classification

| Item | Status |
|---|---|
| Staging API/admin/apps | READY (mock adapters) |
| Production secrets | CONFIGURATION NEEDED |
| SMS / payments | CONFIGURATION NEEDED |
| SAP B1 | BLOCKED |
| Apple/Google distribution | CONFIGURATION NEEDED |
| Procurement WMS | NOT REQUIRED for V1 |
