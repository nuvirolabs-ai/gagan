# Gagan Secondary Admin — Isolation Plan

## Objective

Create a separate, preview-only Gagan operations admin by reusing the existing Dogkart admin's layout and interaction patterns as a read-only design/code source. The existing Dogkart admin, Dogkart backend, Dogkart database, current Gagan admin, and current Gagan backend remain separate and are not overwritten.

## Phase 1 audit findings

### Dogkart source audit

- Admin frontend: `/Users/tanutejas/Documents/Dogkart/admin`
- Admin entry points: `admin/src/main.tsx`, `admin/src/App.tsx`, `admin/index.html`
- Admin build: Vite + React + TypeScript; commands are `npm run dev`, `npm run build`, `npm run typecheck`, `npm run test`
- Dogkart admin API client: `admin/src/api.ts`; it uses a configurable `VITE_API_URL`, browser cookies for refresh, and in-memory access tokens
- Dogkart admin authentication: `/admin/auth/login`, `/admin/auth/refresh`, `/admin/auth/me`, and protected admin routes
- Dogkart backend: `/Users/tanutejas/Documents/Dogkart/backend`
- Dogkart API deployment adapter: `/Users/tanutejas/Documents/Dogkart/api/index.js`
- Dogkart deployment configuration: `/Users/tanutejas/Documents/Dogkart/vercel.json`
- Dogkart data dependencies: Prisma/PostgreSQL, catalog, inventory, warehouses, retailers, orders, staff, dispatch, collections, credit, KYC, recovery, and SAP/ERP status routes
- Dogkart optional infrastructure found in its backend environment template: Redis, object storage, Sentry, payment/SMS/ERP adapters
- Dogkart visual system: `admin/src/design-system/`, `admin/src/index.css`, operational panels, scope bars, tables, metric cards, charts, and action desks
- Dogkart-specific content found in source includes the Dogkart brand, pet-food products, pet-store terminology, Dogkart order references, and Dogkart-specific demo copy. These are source-only findings and are not copied into the secondary runtime.
- No Dogkart `.env`, production database URL, API key, payment secret, storage secret, JWT secret, or other secret is being copied.

### Gagan source audit

- Current Gagan admin: `/Users/tanutejas/Documents/Gagan/admin`
- Current Gagan backend: `/Users/tanutejas/Documents/Gagan/backend`
- Current Gagan retailer app: `/Users/tanutejas/Documents/Gagan/mobile`
- Current Gagan salesperson app: `/Users/tanutejas/Documents/Gagan/rep`
- Compatible Gagan admin routes include authentication, products/catalog, orders, retailers, retailer ledgers/payments, warehouses/inventory, staff, approvals, KYC, recovery, locations/visits, SAP status/sync, and read-only health probes.
- Gagan product/catalog data is held by the Gagan Prisma/PostgreSQL backend and local catalog media is served from `/catalog-images`.
- Gagan uses its own environment configuration and database. The secondary admin will never use Dogkart's database, API, deployment project, or secrets.

## Intended isolation

### Files copied or reused

The new app may reuse the following Dogkart admin source patterns and neutral UI code:

- layout and navigation grammar from `Dogkart/admin/src/App.tsx`
- design primitives from `Dogkart/admin/src/design-system/primitives.tsx`
- visual tokens and operational CSS patterns from `Dogkart/admin/src/design-system/tokens.css` and `Dogkart/admin/src/index.css`
- metric cards, status badges, table layouts, charts, filters, and action-desk interaction patterns

The copied/adapted app lives at `/Users/tanutejas/Documents/Gagan/gagan-secondary-admin`. Adapted files are owned by the Gagan secondary app and are not imported at runtime from Dogkart.

### Files that will not be modified

- `/Users/tanutejas/Documents/Dogkart/admin`
- `/Users/tanutejas/Documents/Dogkart/backend`
- Dogkart Prisma migrations and database data
- Dogkart `vercel.json` and any existing deployment project
- `/Users/tanutejas/Documents/Gagan/admin` (the current Gagan admin)
- Existing Gagan backend source and migrations, except where a separately requested backend change would be needed later; this preview uses existing routes and explicit demo fallbacks

### New app and deployment target

- Local app: `/Users/tanutejas/Documents/Gagan/gagan-secondary-admin`
- Local dev URL: `http://127.0.0.1:5178/` by default
- Independent deployment target: a new Vercel project named `gagan-secondary-admin`, with its own root directory and environment variables
- Public URL: assigned only after a separately authorized deployment; no existing Dogkart or current Gagan project will be moved, renamed, or reused

### Environment configuration

The new app has its own `.env.example` and ignores local `.env` files. It uses only:

- `VITE_API_URL` — optional Gagan API base URL
- `VITE_DATA_SOURCE` — `demo` or `gagan`
- `VITE_DEMO_MODE` — explicit preview-only demo auth switch

No secret value is stored in the app or template. A production deployment must use a separately provisioned Gagan API and authentication configuration.

### Backend and data strategy

- `DEMO_DATA`: preview-safe, clearly labeled read-only values for the dashboard, operational queues, dispatch, delivery, payments, SAP status, and any route not exposed by the current Gagan API.
- `GAGAN_BACKEND`: existing Gagan API only, accessed through an isolated adapter when `VITE_DATA_SOURCE=gagan`.
- The adapter has no Dogkart URL, project identifier, storage URL, database identifier, or credential fallback.
- The preview UI is read-only: no create/update/delete, payment capture, warehouse mutation, order approval, or other write action is exposed.

## Existing Gagan admin remains untouched

The current Gagan admin remains at `/Users/tanutejas/Documents/Gagan/admin` with its existing entry point, package, dev server, build, routes, and deployment behavior. The secondary admin has a distinct directory, package entry point, environment template, Vite config, and deployment configuration. It is not imported, mounted, redirected, or merged into the current Gagan admin.

## Verification gates

Before handoff, verify:

1. Dogkart working-tree content and commit state are unchanged by this task.
2. Current Gagan admin working-tree content and commit state are unchanged by this task.
3. The secondary app builds independently.
4. A source/bundle scan finds no Dogkart runtime references or production URLs.
5. The browser network path is either `DEMO_DATA` or the configured Gagan API; no Dogkart production host appears.
6. Dashboard, retailers, products, inventory, warehouses, orders, order detail, dispatch, delivery, finance, salespeople, SAP status, and settings/navigation render without pet terminology.
7. Any page not backed by a current Gagan route is visibly marked as demo data.

