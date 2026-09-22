# Six-variant readiness checkpoint — 22 September 2026

## Scope and result

This is an incomplete readiness checkpoint, not ordering acceptance. No hosted
product activation, stock insertion, tax update, backend migration or backend
deployment was performed in this investigation. Numeric stored rates were not changed.

The owner approved ordering without a numeric GST constraint for the six named
rice variants, with GST to be added later. This is an explicit pending-GST
exception, not a 0% rate: the order may be quoted and created pre-tax, while
invoice creation remains blocked until a real GST configuration is present.
No GST percentage, HSN or tax-inclusive amount was invented.

## Hosted identity verified read-only

- Render service: `gagan-api`, `srv-dak1ppu1egvs7397s9c0`.
- API: `https://gagan-srat.onrender.com`.
- PostgreSQL: `gagan_staging_9ftt`, schema `public`.
- Runtime environment: `staging`; SAP mode: `mock`.
- Runtime revision observed: `571292a1015d27e7d9e92639d52009619a8ecb21`.
- Database inspections ran inside a READ ONLY transaction and checked the exact
  database, schema and Render service identity before reading business rows.
- No InventorySnapshot rows matched any of these six variant IDs or their three
  product IDs. Quantity, warehouse and freshness therefore remain unverified;
  absence is not treated as zero stock or permission to fabricate inventory.

## Verified commercial values

Gold and Silver have the same following stored, GST-exclusive quintal rates.
All six product/variant records remain published and ordering setup pending.

| Product / ordered pack | Variant ID | Rate / quintal | Derived / kg | Derived master value |
| --- | --- | ---: | ---: | ---: |
| Gagan Broken 30 KG | `1a2c0525-dc34-4cd5-ae91-a0d2cc46881f` | 5400 | 54 | 1620 |
| Gagan Choice 30 KG | `f5ce43fc-19e5-4eff-a42a-79f16d89c1d3` | 8100 | 81 | 2430 |
| Gagan Classic 30 KG | `b833062a-f7c4-486a-bbe0-bbfaad6e6c09` | 9550 | 95.50 | 2865 |
| Gagan Classic 1 KG × 20 | `e57e2b24-78ac-453a-9172-defbb12295b4` | 9950 | 99.50 | 1990 |
| Gagan Classic 5 KG × 4 | `0d8784a9-738b-42af-8fd1-2adf19b437c7` | 9950 | 99.50 | 1990 |
| Gagan Classic 10 KG × 4 | `a29b9d8c-1ba7-4dec-925c-bad913f19a1b` | 9750 | 97.50 | 3900 |

GST/HSN and hosted routing fields are unset. Accepted local decisions already
provide OTHER routing with 1.000 contribution per ordered master for these exact
variants, including the two approved 20 KG boxes. This is reusable mapping, not
an unresolved request for a permanent selling company. SAP material IDs remain
unset and must not be populated with invented internal codes.

## Completed display correction

- Admin commit: `ae3409343eac80792e05af9babe0ca9b13701eca`.
- Existing staging project: `gagan-staging-admin`.
- Deployment: `dpl_GTsWgjy2dUXahMa5DW5g49tMVMS8`.
- Rollback deployment: `dpl_6D4eZJt3a9ws8FisPt3ZFAcTSVSF`.
- Authenticated live Catalog was re-opened after deployment. All six rows showed
  the above quintal rate, kilogram equivalent and correct master equivalent for
  both Gold and Silver. No price editor was submitted.
- Retailer and Salesperson equivalent display changes are local source only;
  they are not yet installed APK changes.

## Verification executed

- Admin: 61 tests; typecheck, lint and build passed.
- Retailer: 81 tests and typecheck passed.
- Salesperson: 197 tests and typecheck passed.
- Backend targeted inventory/catalogue/routing/commercial checks: 67 tests;
  typecheck and build passed. This is not a complete backend-suite claim.
- Disposable local database `gagan_six_readiness_20260922_2158`: 44 migrations
  applied from zero including the draft internal staging inventory migration.
- Moto E13: not connected in the current adb inventory; physical acceptance not run.

## Local work not yet release-ready

The draft internal inventory path separates nullable external SAP identity from
an internal variant identity, restricts selection to staging/test plus mock SAP,
and checks exact product/variant identity. Existing SAP lookup stays authoritative
where an external mapping exists. Import matching excludes internal snapshots.

The draft migration and reader changes have NOT been deployed. Supported
configuration/promotion integration, database-level regression, full regression,
recovery preflight and pinned release remain unfinished. Do not deploy the dirty
working tree or describe the inventory correction as hosted.

## Approved pending-GST behavior

- Decision register revision: `gagan-real-catalogue-owner-approval-r3`.
- Scope is limited to the six named rice variants in the approved decision file.
- The API marks these rows `gst_pending` and the Retailer/Salesperson surfaces
  show `GST pending · invoice blocked until configured`.
- The commercial quote is explicitly pre-tax for this exception and retains a
  null GST snapshot; it is not a substitute for a configured tax rate.
- Invoice creation rejects the accepted quote before any delivery/invoice
  mutation with `gst_configuration_required_before_invoice`.
- Any row not explicitly named in the decision remains subject to the normal
  GST/readiness guard.

## Exact remaining gates

1. Obtain a legitimate warehouse/quantity/freshness source for these six, or an
   explicit bounded mock-stock decision; none was found in matching hosted rows.
2. Complete and verify the separated internal inventory configuration path.
3. Verify recovery before hosted schema/configuration writes.
4. Activate only the scoped variants that pass the revised approved gates;
   test backend quotes/cart and replays, then physical apps when connected.

Production, main, Dogkart, GNV, real SAP and historical commerce remain untouched.
