# Salesperson V2.1 staging UAT

## Fixture

The existing `backend/scripts/seedSalesVisualUat.ts` is the bounded,
idempotent fixture for visual device review. It is not part of the destructive
general Prisma seed and refuses to run unless `NODE_ENV=staging`.

It owns one isolated identity and namespace:

- Salesperson: Nikhil Patil
- Phone: `9812367800`
- Mock OTP: `123456`
- Five assigned Pune retailers with verified coordinates
- A published five-stop route
- Two completed visits and three remaining stops
- Canonical rep orders totalling ₹300,000 against a ₹400,000 monthly order-value target
- One overdue invoice for the attention state
- No pre-recorded target milestone, so the normal read model can earn it once

Run the fixture only against the isolated staging database:

```text
NODE_ENV=staging npm run seed:sales-visual-uat -- --date=YYYY-MM-DD --reopen-day --fresh-achievements
```

The script is intentionally add-only on normal runs. The optional reset flags
are scoped to this fixture identity and date; they do not touch Ravi or other
staging users.

## Functional device path

1. Sign in with the fixture phone and mock OTP.
2. Verify the active-day Home, next stop, compact metrics, route, attention, and bottom navigation.
3. Open New Retailer and validate each required step before submitting.
4. Complete one staging-only retailer proposal with an Aadhaar image. Full Aadhaar remains in memory until upload, then is cleared; the normal response is masked.
5. Verify Admin review groups the proposal and shows only masked Aadhaar plus authorized photo access.
6. Open Reports, switch 7D/30D, switch Sales/Orders/Visits/Collections, and open daily detail.

## Current configuration gate

The repository path requires `PII_ENCRYPTION_KEY` and the Render manifest now
generates it for staging. Hosted Aadhaar/photo UAT is still blocked until
staging configures a persistent private S3-compatible object store. Render
free local disk is ephemeral and must not be presented as a production-grade
identity store. This is an external staging configuration gate; the code does
not fall back to plaintext or a public URL.
