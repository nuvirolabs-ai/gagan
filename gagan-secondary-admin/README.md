# Gagan Secondary Admin

An independent, preview-only Gagan operations admin. Its layout and operational interaction grammar reuse neutral patterns from the audited Dogkart admin, but the app has its own source tree, package, environment configuration, brand, data adapter, and deployment configuration.

## Local run

```bash
npm install
npm run dev
```

The default local URL is `http://127.0.0.1:5178/`.

Build and typecheck independently with `npm run build`.

## Data and authentication

The default preview uses explicit `DEMO_DATA` and preview-only demo authentication. It contains no Dogkart credentials, database URL, API key, payment secret, storage secret, or production host. All visible actions are read-only.

`VITE_DATA_SOURCE=demo` is the safe showcase mode. `VITE_DATA_SOURCE=gagan` is reserved for a separately provisioned Gagan API origin; the isolated adapter only knows the Gagan `/admin/products`, `/admin/retailers`, `/admin/orders`, `/admin/warehouses`, and `/health/ready` contracts and falls back visibly to demo records when a protected route is unavailable.

## Deployment

Deploy this directory as a new, independent Vercel project named `gagan-secondary-admin`. Its public URL is intentionally not hardcoded here; assign a new Gagan-owned hostname during an authorized deployment. Do not attach it to the existing Dogkart project or the current Gagan admin project.

## Isolation

- Existing Dogkart admin and backend are outside this directory and are not modified.
- Existing Gagan admin remains at `../admin` and is not imported or redirected.
- The app has no runtime dependency on a Dogkart host or Dogkart database.
- Every preview record is labeled `DEMO_DATA`; live configuration is labeled `GAGAN_BACKEND`.
