# Real catalogue field mapping — 16 September 2026 master

Status: source audit and dry-run mapping only. No hosted catalogue write has
been performed.

## Source identity

| Field | Observed value |
|---|---|
| Input | `1-SKU-WISE-ITEM-LIST-16-09-26-UPDATED.xlsx` |
| SHA-256 | `f9f69849c37421bd48a0326d50239cb2ebf0ff47b955bc56915556446fa9e5a6` |
| Sheet | `PRODUCT LIST` |
| Header row | 2 |
| Data rows | 111 |
| Unique variant identities | 105 |
| Duplicate source rows | 68, 69, 70, 71, 72, 73 |

The workbook's displayed last header is `PRICE` followed by a line break and
`PER QUINTAL`; the importer normalizes whitespace and the optional slash in
the header for validation, but stores the source values unchanged in the
generated manifest. Spreadsheet formulas in `S.NO` are not used as identity.

## Mapping

| Source column | Source rows | Current model field | Rule/status |
|---|---:|---|---|
| `TYPE OF ITEM` | 3–113 | `Product.category` | `RICE` → `Rice`; `POHA`, `SABUDANA`, `INSTANT MIX` → `Breakfast`; other supplied item types → `Daal`. |
| `BRAND NAME` | 3–113 | Product name/category context | Preserved in the source record and used in a deterministic catalogue key. It is not treated as a supplier or selling entity. |
| `GROUP NAME` | 3–113 | Product name/context | Preserved; combined with brand and parsed SKU label for product identity. |
| `ITEM NAME` | 3–113 | Source evidence only | No safe one-to-one target field was found; never used alone as a SKU identity. |
| `SKU NAME` | 3–113 | `Variant.unitSize`, `Product.name` label | The parenthetical pack notation is parsed only when it contains an explicit weight × case multiplier. |
| `PACKING SIZE` | 3–113 | `Variant.unitSize` | Stored as the ordering pack label, e.g. `1 KG`, `30 KG`. It is not assumed to be the case weight. |
| `MASTER BAG/BOX SIZE` | 3–113 | Readiness/routing evidence | Parsed as explicit master weight plus `BAG`/`BOX`; it does not overwrite the SKU's weight. |
| `PRICE` + `PER QUINTAL` | 3–113 | Source evidence only | Recorded as `pricePerQuintal`, basis `quintal`. Not written to a price list because the workbook has no target tier, GST, ownership, or approved commercial configuration. |

## Parsed conversion and routing treatment

For a SKU such as `1 kg x 30`, `unitWeightKg = 1`,
`unitsPerCase = 30`, and `caseWeightKg = 30`. The ten rows without an
explicit multiplier are retained in the manifest but are not imported as
representable sellable variants until the conversion is confirmed:
Sehmat G11/G21/G31/G41/G51/G61 and the four Lite products.

The importer derives only the structural routing classification:

- `LAXMI` → `LAXMI_TOOR`; it remains excluded from eligible threshold bags by
  the accepted routing engine.
- `INSTANT MIX` → `INSTANT_MIX`; the accepted engine derives contribution from
  ordered kilograms divided by five, using an explicit pack conversion.
- all other rows → `OTHER`, with `1.000` routing-bag equivalent only when the
  source explicitly says the master container is a `BAG` and the SKU's case
  conversion is parseable.

This is not a business ownership assignment. The workbook supplies no Jain /
Padam field, supplier field, stable SKU/SAP code, GST/HSN, stock mapping, or
price tier. Those values must come from the approved catalogue/commercial
configuration before any record can be promoted to `active` and orderable.

## Readiness outcome

All 105 unique records are `pending_review` in the dry-run manifest. This is a
deliberate fail-closed result, not a missing-feature shortcut:

- stable SKU/SAP identity missing: 105;
- GST missing: 105;
- inventory/SAP mapping missing: 105;
- price tier missing: 105;
- case conversion missing: 10;
- approved routing-bag review required for non-Laxmi, non-Instant-Mix rows
  without a source BAG/conversion basis;
- image mapping: 89 exact, 5 ambiguous, 11 missing.

No MRP-derived price, default GST, fabricated stock, supplier, ownership, or
conversion was created.

The row-tied machine-readable output is
`docs/real-catalogue/real-catalogue-manifest.json`.
