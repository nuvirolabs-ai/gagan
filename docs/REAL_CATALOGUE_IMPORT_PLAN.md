# Real catalogue import and activation plan

Status: **owner approval revision 1 recorded locally; source import and approval-path hardening complete; activation remains blocked until GST/HSN, target tier, inventory configuration and remaining image decisions are available.** Prepared 17 September 2026 on codex/gagan-real-catalogue-v1. No hosted database, deployment, production, main, Dogkart, GNV or SAP resource was changed.

## Verified input

- Workbook: 1-SKU-WISE-ITEM-LIST-16-09-26-UPDATED.xlsx
- Workbook SHA-256: f9f69849c37421bd48a0326d50239cb2ebf0ff47b955bc56915556446fa9e5a6
- Sheet: PRODUCT LIST; header row 2; 111 data rows; 105 unique variants
- Duplicate source rows: 68, 69, 70, 71, 72, 73; identity and price were consistent and source row provenance is retained
- Drive image index: 104 files in four folders; index SHA-256 41da39cf271c7cb37f363c39a128cb2d59b4205ee2359ff145cca898dcb3cc2d

## Supported command path

Run from backend. A command is a dry run unless --apply and the explicit confirmation are supplied.

    npm run catalogue:real -- --input=<xlsx> --image-index=../docs/real-catalogue/drive-image-index.json --manifest=<output-json>

Reviewed configuration is supplied separately. The current owner-approved revision is:

    npm run catalogue:real -- --input=<xlsx> --image-index=../docs/real-catalogue/drive-image-index.json --decisions=../docs/real-catalogue/real-catalogue-decisions-owner-approved-r1.json --phase=import --manifest=<output-json>

Controlled activation is a distinct promotion:

    npm run catalogue:real -- --input=<xlsx> --image-index=../docs/real-catalogue/drive-image-index.json --decisions=<approved-decisions.json> --phase=promote --apply --actor=<staff-id> --target=<disposable-local|gagan-staging>

The owner-approved decisions file is validated against the exact workbook and image-index checksums. It records durable internal identities for all 105 unique variants, the GST-exclusive/quintal interpretation without selecting a target tier, one routing BAG for each of the twelve approved 20 KG BOX rows, two equivalent image choices and the approval revision. It intentionally does not contain GST/HSN, a target tier, inventory/material mappings, the three unresolved image choices, the eleven missing images or hosted retirement IDs. The example file under docs/real-catalogue remains a template only, not an approval.

For apply, all of these are required:

- actor staff identity;
- target label;
- REAL_CATALOGUE_CONFIRM=REAL_CATALOGUE_V1;
- for staging, REAL_CATALOGUE_ALLOW_STAGING and exact identity values for service gagan-api, service ID srv-dak1ppu1egvs7397s9c0, hostname https://gagan-srat.onrender.com, database gagan_staging_9ftt and schema public.

The staging guard compares the exact database name and schema; a gagan_staging_ prefix alone is rejected. Local rehearsals must use localhost/127.0.0.1 and a unique disposable database.

## Lifecycle and orderability

The phases are deliberately separate:

1. **Source import:** upserts structural product/variant rows by deterministic source identity, keeps new rows pending_review, preserves existing lifecycle status, records source checksum and batch provenance, and never writes commercial prices or ownership.
2. **Reviewed configuration:** a versioned decisions file explicitly supplies the fields absent from the workbook. Omitted rows remain pending_review.
3. **Readiness validation:** every selected row must have stable internal identities, valid conversion, approved GST/HSN, a target price tier and rate basis, a valid inventory/material-to-warehouse mapping, valid dynamic routing metadata, and a prepared exact image asset where an image is required.
4. **Controlled promotion:** only a fully resolved manifest can activate rows. Promotion updates the same stable identity, writes the approved fields, and optionally archives only the exact legacy/test retirement allowlist after identity/history guards.

A status change by itself cannot make an unconfigured row orderable through the legacy null-quote fallback. Active API catalogue filters, quote creation and order creation retain their current active/configured guards. Source import does not retire missing rows or broad-delete the old catalogue.

## Batch and replay safety

The source checksum identifies the source batch. When reviewed configuration is present, the batch key also contains approval ID, approval revision, approval checksum and image-mapping revision. An identical source plus approval revision is a no-op that returns the recorded summary. A new approved revision advances the same stable product/variant identities; if the first source import used provisional source keys, the approved revision adopts those rows rather than creating duplicates. Conflicting target identity mappings are rejected.

## Current source audit result

- 46 deterministic product identities and 105 variants are represented by the source manifest.
- Owner approval revision 1 supplies durable internal identity for all 46 products and 105 variants. It does not make them orderable.
- 89 image candidates are exact and have prepared deterministic application asset references.
- Two of the five ambiguous groups are now resolved by an owner-approved equivalent-image selection; three groups remain unresolved. Eleven exact product/pack images remain absent.
- The ten former conversion exceptions are now derived from explicit 30 KG plus 30KG BAG fields; no conversion row is skipped by the current parser.
- The twelve reviewed Gagan rice BOX rows are approved as one ordered master BOX equals one routing BAG for threshold contribution only. This does not change the displayed BOX, 20 KG weight or pricing/freight basis.
- Workbook rates are recorded as GST-exclusive INR per quintal. The existing target price-list/tier remains unresolved and no price is written to every tier.
- Dynamic Jain/Padam routing remains runtime-authoritative; no per-SKU sellingEntity is fabricated.

See:

- docs/real-catalogue/REAL_CATALOGUE_BLOCKER_RECONCILIATION.md
- docs/real-catalogue/REAL_CATALOGUE_OWNER_DECISION_PACK.md
- docs/real-catalogue/REAL_CATALOGUE_IMAGE_EXCEPTION_SHEET.md
- docs/real-catalogue/REAL_CATALOGUE_RETIREMENT_CANDIDATES.md
- docs/real-catalogue/REAL_CATALOGUE_BUSINESS_DECISION_REGISTER.md
- docs/real-catalogue/real-catalogue-decisions-owner-approved-r1.json
- docs/real-catalogue/real-catalogue-decisions.example.json

## Local rehearsal evidence

The current branch migrates from zero through 42 migrations, including the additive real-catalogue approval migration. On gagan_catalogue_approval_test_20260917_0500, the full migration and seed completed, the source import created 46 product identities and 105 variants, and an identical replay left 46 real products, 105 real variants and one source batch. The replay returned the durable prior summary rather than creating duplicates. The owner-approved decisions file has been validated against the exact source checksums and is ready for a fresh local dry-run/rehearsal; no hosted data was used.

A prior 41-migration rehearsal recorded 36 products, 95 variants and ten conversion skips. That is historical evidence only; the current parser resolves those ten explicit BAG rows and the current counts above supersede that old rehearsal.

## Retirement and history

No retirement has been executed. Owner approval revision 1 authorizes replacement of confirmed dummy/test products in principle, but the executable retirement list remains empty until the four narrow semantic candidates are re-resolved read-only on the exact authorized hosted target. The local candidates are Moong Dal, Poha, Sona Masoori Rice and Urad Dal, each marked DEMO-MAT with zero local OrderItem references. Historical Basmati, Chana and Toor records remain untouched. Products sharing a historical SAP-shaped identity are not automatic candidates.

Archiving is status-only and recoverable; it does not delete products, variants, prices, orders, invoices, payments or audit evidence. A source import preserves existing archived/test status and does not recreate an archived row as active.

## Recovery and release boundary

Keep the workbook, Drive index, matched source images, generated manifests, migration record and disposable database dump outside Git under the GAGAN archive. The current local rehearsal dump is /Users/tanutejas/Documents/GAGAN/ARCHIVE/catalogue-source/20260917-local-uat/gagan_catalogue_approval_test_20260917_0500.dump with SHA-256 3169131020cb4c0009cf16956638604f0999735c15da88b9d7210983f9229f69. It was restored into a second disposable database and recovered 46 real products, 105 real variants and one import batch. Before any hosted write, verify the exact Render service/database binding and a recoverable backup/restore boundary. No hosted promotion is currently permitted: the owner-approved revision is local only, and GST/HSN, target tier, inventory/material mapping, remaining image decisions and exact hosted retirement IDs are still unresolved.

When approved decisions exist, rehearse the exact decisions file locally, export a change manifest, validate the exact target guard, confirm backup/recovery, and only then promote. A data-only catalogue update should not replace either mobile APK; rebuild clients only if the final client source or API contract actually changes.
