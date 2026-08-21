# Gagan

Implementation of [gagan-retailer-app-spec.md](gagan-retailer-app-spec.md).

- `backend/` — Node + Express + TypeScript, Prisma, PostgreSQL
- `mobile/` — Expo — **Gagan Retailer** app (`com.gagan.retailer`)
- `rep/` — Expo — **Gagan Sales** app (`com.gagan.sales`)
- `admin/` — Vite + React — ops dashboard (web)

## App boundaries

The retailer app and the sales app are **separate bundles, installed separately**, each with
its own bundle identifier and its own stored session token. They are connected only through
the shared backend and database — that's how a rep sees a retailer's live credit position and
how an order the rep places shows up in that retailer's own app.

Tokens are scoped (`retailer` / `rep` / `admin`) and signed with the same secret, so a rep
token is rejected by retailer and admin routes and vice versa. A rep can only read or order
for retailers assigned to them (`Retailer.salesRepId`).

Design tokens and a few shared components (`theme.ts`, `components/ui.tsx`, `ProductThumb`)
are **duplicated** in `mobile/` and `rep/` rather than shared through a package. That keeps
each app independently buildable, and the two are expected to diverge — the retailer app is a
storefront, the sales app is a field tool. If they start drifting in ways you don't want,
promote them to a workspace package.

> **Note on running both at once:** in development each app runs through Expo Go, which hosts
> one project at a time, so you switch between them. To have both installed side by side on a
> device you need real builds (`npx expo run:ios` or `eas build`) — the distinct bundle
> identifiers are already set for that.

## Prerequisites

PostgreSQL 16 running locally. For the KYC slice, use a disposable database such as
`gagan_kyc_test`; never run the KYC tests or seed command against the final Supabase URL.

```bash
brew services start postgresql@16
createdb gagan_kyc_test
```

## Backend

```bash
cd backend && npm install && npx prisma migrate dev && npx prisma db seed && npm run dev
```

Runs on `http://localhost:4000`.

The API and scheduled worker are separate production processes:

```bash
cd backend && npm run dev
cd backend && npm run dev:worker
```

Copy `backend/.env.example` to `backend/.env` for local development and replace all placeholder secrets. Production startup rejects mock SMS, payment, and SAP adapters.

### Final Supabase database

The final Gagan database is the Supabase project at
`https://nftxvimumwvhjrmwtlfs.supabase.co` (project reference
`nftxvimumwvhjrmwtlfs`, region `ap-northeast-1`). Use
[`backend/.env.production.example`](backend/.env.production.example) as the deployment
template. Set `DATABASE_URL` in the hosting provider's secret store using the Supabase
session-pooler URL and the database password; never commit the password, service keys, or
provider credentials to GitHub.

Run the database deployment step before starting the API or worker:

```bash
cd backend
npx prisma migrate deploy --schema prisma/schema.prisma
```

The final project has the repository schema and migrations applied. This cutover does not
copy records from the former project; importing historical data is a separate, explicitly
verified operation.

## Verification

Install dependencies in each package, then run the same repository gate used by CI:

```bash
bash scripts/verify.sh
```

The gate type-checks, tests, and builds the backend; validates Prisma; type-checks both Expo apps; and lints/builds the admin web app. CI additionally applies every Prisma migration to an empty PostgreSQL 16 database before running the gate.

## Retailer app

```bash
cd mobile && npm install && npx expo start --ios
```

## Sales app

```bash
cd rep && npm install && npx expo start --ios --port 8092
```

The iOS simulator reaches the backend at `localhost`; the Android emulator uses `10.0.2.2`. For a
physical device, change `BASE_URL` in [client.ts](mobile/src/api/client.ts) to the host machine's LAN IP.

## Admin dashboard

```bash
cd admin && npm install && npm run dev
```

## Test logins

| App | Credentials |
|---|---|
| Retailer (`mobile/`) | phone `9999999999`, OTP `123456` |
| Sales (`rep/`) | phone `9812345670`, OTP `123456` |
| Admin (web) | `admin@gagan.test` / `admin123` |

OTP is mocked — a real SMS provider slots into [auth.ts](backend/src/routes/auth.ts).
The seeded admin password is for local development only.

## KYC and protected evidence (slice 1)

KYC evidence is stored behind the backend, never under a public bucket path. Local development
uses `STORAGE_PROVIDER=local` and `OBJECT_STORAGE_ROOT=.data/evidence`; production requires a
private S3-compatible bucket and short-lived signed reads. Allowed evidence is PDF/JPEG/PNG/WebP,
up to 10 MB per file.

Manual smoke test with the disposable database:

1. Apply migrations and seed: `DATABASE_URL=postgresql://tanutejassaraswat@localhost:5432/gagan_kyc_test npx prisma migrate deploy && npx prisma db seed`.
2. Start the backend with the same `DATABASE_URL`, test JWT secrets, and `STORAGE_PROVIDER=local`.
3. Sign in to the admin portal and open **KYC**. Start a case, upload business registration,
   identity proof, and address proof, then submit it.
4. Approve it only after the step-up code. The retailer becomes `active`; dispatch before approval
   returns the stable `kyc_required` (409) error.
5. Confirm the uploaded files are represented by signed URLs, not `objectKey` or filesystem paths.

Sales staff can start a case for an assigned retailer from the retailer detail screen. The admin
KYC queue owns document upload and review in this slice; the server still enforces assignment,
permissions, required document types, and the dispatch gate.

Field collection receipts use the same private storage boundary. The Sales work screen can attach
a PDF/image or submit a receipt/reference; Accounts sees a short-lived signed link in the queue.
The collector never sends or chooses an object-storage key, and a pending submission never creates
a payment or ledger entry. Only Accounts confirmation with step-up verification settles it.

## Order lifecycle

`placed → confirmed → packed → out_for_delivery → delivered`

Transitions are forward-only and one step at a time; skipping a stage or repeating one
returns 409 rather than silently succeeding, so a double-clicked button can't corrupt state.

**Delivery is where money is created.** Capturing proof of delivery prices the invoice off
the weight that actually arrived (spec §5.6), posts the `LedgerEntry`, and moves the
retailer's balance — all in one transaction, so a failure can't leave an invoice without a
matching balance change. Per line the basis is: delivered weight → delivered cases →
ordered cases, whichever is available first.

Worked example: 1 case of Basmati Rice (1 kg × 12) at ₹5,400 is ₹450/kg. Deliver 11.4 kg
instead of 12 and the retailer is invoiced ₹5,130, not ₹5,400.

## Design notes

The Home screen is built to the reference design, which goes beyond the spec in a few
ways worth knowing:

- **Schemes/offers.** Spec §1 defers a promotions engine. Implemented here as a
  read-only display only: a `Scheme` row with a target and a window, progress computed
  from *delivered* order value. Nothing awards or redeems a discount yet.
- **Case-based pricing.** The spec models loose variants; the design sells cases
  (`1 kg × 30` at `₹3,150/case`). `Variant` therefore carries `unitSize` + `unitsPerCase`,
  and `PriceList.price` is the price of a whole case.
- **Order statuses.** Widened to `placed → confirmed → packed → out_for_delivery →
  delivered` to match the design's 4-stage timeline.
- **Salesman on retailer home.** The spec scopes reps to their own Phase 2 app; the
  design also surfaces the assigned rep to the retailer, so `Retailer.salesRepId` exists now.

`GET /home` returns all of it in one call — the screen has eight data regions and
separate endpoints would mean eight round-trips on open.

Product photography is not wired up (`Product.imageUrl` is null on all seeded SKUs), so
[ProductThumb](mobile/src/components/ProductThumb.tsx) renders a branded stand-in. Drop
in real image URLs and it switches to `<Image>` with no layout change.

## Orders placed by a rep

`createOrderForRetailer()` in [orders.ts](backend/src/lib/orders.ts) is the single path for
creating an order, whether the retailer placed it or a rep did. Pricing always resolves against
the *retailer's* tier and overrides, and the credit check is identical either way — a rep
cannot sell around a retailer's limit. Orders carry `placedBy` and `placedByRepId` so ops can
see who booked them.

## Not yet built

- **Payment gateway.** Payments can be recorded by ops in the dashboard, but the retailer
  cannot pay in-app — spec §9 leaves the UPI provider open.
- **SAP sync layer** (spec §7), pending the version/access decision. All `sap*Id` columns are
  in place and nullable.
- **Cart persistence.** The mobile cart is in-memory, so it clears on app restart and can hold
  a variant that was since removed. Worth moving to AsyncStorage with a validity check.
- **Overdue ageing.** `overdueAmount` is a stored field that payments reduce; nothing ages an
  invoice into it yet. That needs due dates on invoices.
- **Outbound SAP customer creation.** The current SAP connector is inbound-only; newly imported
  customers remain `pending_kyc`. When the outbound customer-create operation is added, it must
  call the same KYC gate before enqueueing the SAP request.
