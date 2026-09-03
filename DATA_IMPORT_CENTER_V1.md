# Gagan Data Import Center V1

## Operating contract

This is a staging-safe, preview-first Admin workflow. It accepts `.csv` and `.xlsx` files, validates exact published headers against current Gagan canonical models, shows row-level outcomes, and requires an explicit server confirmation before applying anything. SAP mappings only prepare Gagan identifiers; no SAP B1 connector or outbox operation is called.

Limits are 10 MB per file and 10,000 rows per import. Apply runs row-by-row in bounded transactions and records a durable `ImportJob` plus `AuditEvent` provenance. Repeating an import uses canonical matching keys and upsert/update behavior rather than creating duplicates.

## Supported import types

- Retailers — phone, name, address, tier, credit limit, existing salesperson assignment, optional SAP customer mapping.
- Products / SKUs — product metadata and one sellable variant per row. The current canonical schema has no separate SKU code, so `Variant` is the sellable SKU.
- Salespeople — staff identity plus linked `SalesRep`, optional territory/status/manager reference. Roles and Admin accounts are never implicitly created.
- Retailer assignments — connect an existing retailer to an existing salesperson.
- Inventory — warehouse code plus stock quantities, using `upsertInventorySnapshot` so available stock and inventory status are canonical calculations.
- Pricing — existing tier + variant `PriceList` rows.
- SAP mappings — retailer phone or `Product name|Unit size` to a future SAP code; mapping preparation only.

Warehouse master creation, orders, payments, credit decisions, fulfilment, and SAP execution are intentionally not exposed because they do not have a safe V1 import contract in the current platform.

## Admin workflow

1. Open `System → Data import`.
2. Choose an import type and download the CSV or XLSX template.
3. Upload the completed file and choose `Upsert`, `Create only`, or `Update only` where supported.
4. Review total, valid, warning, and blocked row counts plus the first 100 row outcomes.
5. Resolve blocked rows and preview again if necessary.
6. Select `Apply import →`. No apply is possible without the explicit confirmation sent by the Admin UI.
7. Review the result in Recent import history or download the row-level error CSV.

## Permission and provenance

The endpoint accepts `data.import`. Current staging platform administrators retain access through `staff.manage` so the existing staging account is not stranded before the next role seed. The role catalog includes `data.import` for a future least-privilege role assignment. Every job stores its actor and source, and each applied entity receives an `AuditEvent` with the `ImportJob` id and `source: "import"`.

## QA status

- Parser accepts CSV and XLSX and rejects unsupported headers instead of silently dropping fields.
- A 10,000-row XLSX parser test passes without a database apply.
- Admin preview → explicit apply interaction test passes.
- Admin typecheck, lint, and production build pass.
- Full backend database-backed integration tests require a configured isolated `DATABASE_URL`; they were not run against an unknown database from this worktree.
- No existing Gagan business data was changed by this implementation; no import apply was run during unit/build checks.

## Freeze status

**DATA IMPORT CENTER V1 — FROZEN**

The Import Center preview-first workflow and its final Operational Instrument
color alignment are frozen for the existing staging/client-demo release. Future
changes are limited to genuine defects or explicitly approved functionality.
This is not production approval.
