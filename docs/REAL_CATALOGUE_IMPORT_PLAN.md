# Real catalogue import plan

This checkpoint implements a dry-run-first, source-aware import boundary. It
does not replace the accepted catalogue on hosted staging because the supplied
master is not commercially complete enough to do that safely.

## Current mechanism

Run from `backend/`:

```text
npm run catalogue:real -- --input=<xlsx> --image-index=../docs/real-catalogue/drive-image-index.json --manifest=../docs/real-catalogue/real-catalogue-manifest.json
```

The command is a dry run unless `--apply` is explicitly supplied. Applying
requires all of:

- `--actor=<staff-id>`;
- `--target=disposable-local` or the explicit `gagan-staging` label;
- `REAL_CATALOGUE_CONFIRM=REAL_CATALOGUE_V1`;
- a target identity guard. Staging additionally requires
  `REAL_CATALOGUE_ALLOW_STAGING` and a database name beginning with
  `gagan_staging_`.

The staging target also rejects any manifest with a `pending_review` record.
The explicit local rehearsal target may persist pending rows for inspection,
but a hosted apply cannot publish an incomplete catalogue.

Each run has a deterministic source checksum/batch key. The
`CatalogImportBatch` record makes a completed or completed-with-review replay
return the previous summary rather than creating duplicates. Product and
variant identities use stable source-derived `catalogKey` values. Existing
internal IDs are reused only when that exact key already exists; a dummy ID is
never repurposed by name.

## Lifecycle

New source rows remain `pending_review` until a reviewed commercial
configuration exists. The additive migration defaults legacy products and
variants to `active`, preserving current accepted behaviour. The customer,
salesperson, home, and order paths now expose/filter only active catalogue
rows; inactive rows remain visible through the Admin `view=all` path for audit.
New order creation and quote creation also reject inactive/review-only rows.

No existing product is retired by this checkpoint. The workbook lacks a
completeness certificate and commercial identity mapping, so a broad retirement
would risk hiding valid historical/current items. Confirmed demo/test product
retirement is deferred until the owner supplies a complete reconciliation and
an explicit allowlist. Historical orders, invoices, payments and approved UAT
orders remain untouched.

## Promotion prerequisites

Before any active catalogue promotion or hosted write, obtain and review:

1. stable SKU/SAP code for every source variant, preserving leading zeros;
2. target price tier and whether the supplied quintal rates are tax-exclusive;
3. GST percentage and HSN for every variant;
4. supplier/selling entity ownership, including Laxmi/Jain/Padam treatment;
5. inventory warehouse/material mapping and available stock policy;
6. explicit case conversion for the ten incomplete rows;
7. visual owner selection for the five ambiguous image groups and source
   assets for the eleven missing images;
8. completeness/retirement scope for the current demo catalogue.

The existing Jain/Padam routing engine remains the only routing authority.
The importer writes structural routing metadata only where the source is
explicit in the manifest, but keeps database routing fields unset while
ownership/GST are unresolved so the existing commercial-integrity constraint
cannot be bypassed. It does not reimplement routing, prices, GST, freight,
invoices, or payment semantics.

## Disposable rehearsal result

The corrected importer was applied to a fresh 41-migration local database.
It created 36 products and 95 representable variants, all
`pending_review`; ten source rows were skipped because their case conversion
was absent. Seventy-nine applied variants received an unambiguous image path;
the 16 remaining applied variants deliberately retain a null image because
their supplied image was missing or ambiguous. A second identical apply
returned the persisted batch summary and did not create duplicate products or
variants. No hosted database was written.

## Recovery

For local rehearsal, use a newly created disposable PostgreSQL database and
retain the dry-run JSON, input checksum, batch summary, and database dump
outside Git. For hosted staging, take an approved recovery point and perform
the migration/data preflight before setting the staging apply guard. No
hosted write was performed for this checkpoint.
