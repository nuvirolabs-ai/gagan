# Real catalogue business decision register

Revision: **R1 — partially approved; activation remains blocked**
Recorded: 17 September 2026
Branch: `codex/gagan-real-catalogue-v1`
Hosted writes: **none**

## Approval provenance

| Field | Recorded value |
|---|---|
| Decision source | Explicit owner decisions in the current Gagan real-catalogue activation task |
| Approver | Gagan owner |
| Approval ID | `gagan-real-catalogue-owner-approval-r1` |
| Approval revision | `1` |
| Workbook | `1-SKU-WISE-ITEM-LIST-16-09-26-UPDATED.xlsx` |
| Workbook SHA-256 | `f9f69849c37421bd48a0326d50239cb2ebf0ff47b955bc56915556446fa9e5a6` |
| Workbook version | `sku-wise-item-list-2026-09-16-v1` |
| Source sheet | `PRODUCT LIST`, header row 2, 111 data rows, 105 unique variants |
| Image index | `docs/real-catalogue/drive-image-index.json` |
| Image-index SHA-256 | `41da39cf271c7cb37f363c39a128cb2d59b4205ee2359ff145cca898dcb3cc2d` |
| Image-mapping revision | `drive-image-selection-2026-09-17-r1` |
| Supported decisions file | `docs/real-catalogue/real-catalogue-decisions-owner-approved-r1.json` |

The approval is bound to the full stable `variantKey` values in the
decisions file. Workbook row numbers are supporting evidence and are not the
identity key. Unresolved fields are intentionally omitted from the approval
file and cannot make a row orderable.

## Approved decisions applied locally

| Decision | Scope | Local result | Boundary |
|---|---|---|---|
| Durable internal identity | All 46 deterministic products and 105 unique variants | `GAGAN-INT-P-<product-key-suffix>` and `GAGAN-INT-V-<variant-key-suffix>` recorded in the reviewed manifest and source-import path | Internal Gagan identifiers only. Never SAP material codes. |
| Workbook price interpretation | All workbook prices | Numeric values remain the supplied INR per-quintal rates and are recorded as GST-exclusive | No target price-list/tier selected. No price list written. |
| Twenty-kilogram rice BOX contribution | Source rows 6, 7, 10, 13, 14, 18, 19, 22, 23, 26, 27, 30 | Each ordered master BOX contributes `1.000` routing BAG | Routing contribution only. Displayed container remains BOX, actual master weight remains 20 kg, and pricing/freight weight is unchanged. |
| Equivalent image selection | Moong Mogar 30 kg and Urad Chilka 30 kg | Selected sharper, centered exact-pack candidates recorded with Drive ID, source hash, rationale, mapping revision and deterministic asset path | The three other ambiguous groups remain unresolved. No missing image was substituted. |
| Dummy/test catalogue retirement | Confirmed dummy/test records | Owner approved replacement of confirmed dummy/test products in principle; exact target-specific allowlist is prepared for read-only re-resolution | No hosted IDs are placed in the executable approval file. No product has been retired. |

## Internal identity assignment

The reviewed decisions file contains:

- 46 unique product internal codes.
- 105 unique variant internal codes.
- Full source `productKey` and `variantKey` provenance for every record.
- The source workbook checksum and approval revision used for the assignment.

Codes are assigned once from the immutable source-key suffix. A later source
row reorder, name correction or image revision must reuse the same mapping.
The importer rejects duplicate product/variant identity decisions and the
database uniqueness constraints remain authoritative.

## Routing decisions

The twelve reviewed BOX decisions are keyed by these stable source variants:

| Workbook rows | Pack/master evidence | Approved routing contribution |
|---:|---|---:|
| 6, 7 | 1 KG or 5 KG sellable pack; 20 KG BOX master | 1 ordered BOX = 1.000 routing BAG |
| 10 | 5 KG sellable pack; 20 KG BOX master | 1 ordered BOX = 1.000 routing BAG |
| 13, 14 | 5 KG or 1 KG sellable pack; 20 KG BOX master | 1 ordered BOX = 1.000 routing BAG |
| 18, 19 | 1 KG or 5 KG sellable pack; 20 KG BOX master | 1 ordered BOX = 1.000 routing BAG |
| 22, 23 | 1 KG or 5 KG sellable pack; 20 KG BOX master | 1 ordered BOX = 1.000 routing BAG |
| 26, 27 | 1 KG or 5 KG sellable pack; 20 KG BOX master | 1 ordered BOX = 1.000 routing BAG |
| 30 | 5 KG sellable pack; 20 KG BOX master | 1 ordered BOX = 1.000 routing BAG |

This does not assign Jain Traders or Padam International to a SKU. The
accepted runtime policy remains the authority for Indore/Indore City, Laxmi
exclusion, Instant Mix kilogram conversion, exact aggregation and the Jain /
Padam threshold.

## Equivalent images approved

The two selected pairs were inspected as actual images. Each pair showed the
same brand, product, 30 kg pack and packaging version. The selected source
file is the clearer front-facing view. The optimized derivatives are local
assets under the existing catalogue-media path.

| Variant | Selected Drive file | Source file SHA-256 | Asset path | Rationale |
|---|---|---|---|---|
| `real-catalogue:variant:e7b7e9d68e498933ae261b7b1a96eea25929f7ca82fd2994d82465ed76ed1888` | `IMG_MOONG MOGAR (30 kg x 1)-13.jpg` (`1BEO2_kziBjyvbSdbbjjRxv4ZtR1pRpiP`) | `4e8152e22770e650faab49f764b2eeda61d91aa1d2790d09f34171bb2c5708ae` | `/catalog-images/real/e7b7e9d68e498933ae261b7b1a96eea25929f7ca82fd2994d82465ed76ed1888.jpg` | Sharper, centered and more legible exact-pack view. |
| `real-catalogue:variant:17ec761e26a7b2dd77e063a9b73469483d239a3fc01b3bfc549cefa352b56fd5` | `IMG_URAD CHILKA (30 kg x 1)-14.jpg` (`1l0ptFDsDFrsGaRiQuuBtOWBx1YMJFMZS`) | `b6a24ff38655b4f58ea1c3b90ac228222f12af4d1cb0c86336e1135dffed58f3` | `/catalog-images/real/17ec761e26a7b2dd77e063a9b73469483d239a3fc01b3bfc549cefa352b56fd5.jpg` | Sharper, centered and more legible exact-pack view. |

The derivative SHA-256 values are recorded in the release evidence when an
asset is promoted. Drive remains the source of the selected image; it is not
used as the application's permanent serving endpoint.

## Retirement scope prepared, not executed

The owner approved removal of all confirmed dummy/test products from active
sale, subject to the existing status-only/history guards. The exact narrow
semantic candidates identified in the local rehearsal are:

| Semantic identity | Local rehearsal evidence | Proposed action |
|---|---|---|
| Moong Dal / `DEMO-MAT-MOON` | Product `35f30af6-914a-4879-92ae-29bfd50f62cd`; Variant `316c62d2-41e3-4aa9-9d8a-7debd4506223`; 0 local OrderItem references | Archive product and variant after exact hosted re-resolution |
| Poha / `DEMO-MAT-POHA` | Product `88ef1950-bca9-4c24-879b-91ef70635b7f`; Variant `c1587729-cba5-4ede-b986-525f884e6c1d`; 0 local OrderItem references | Archive product and variant after exact hosted re-resolution |
| Sona Masoori Rice / `DEMO-MAT-SONA` | Product `18798b7c-1ab5-4ac6-ae2f-0f187de73439`; Variant `41a8fd01-21f9-4778-8224-512ad5ccbcc3`; 0 local OrderItem references | Archive product and variant after exact hosted re-resolution |
| Urad Dal / `DEMO-MAT-URAD` | Product `0c5b4b9b-d7b8-42ad-b691-6312405baa25`; Variant `2c2a2772-59a9-48c2-9e66-a3ec0fe88619`; 0 local OrderItem references | Archive product and variant after exact hosted re-resolution |

The local IDs above are not hosted IDs and are not executable against
staging. Before any hosted activation, re-resolve by exact name, material
identity, variant membership, status, active-cart/reorder use and historical
OrderItem references. The archive operation must be status-only and must
preserve historical order, invoice, payment, delivery, return and audit
paths.

Explicit exclusions remain:

- Basmati Rice and Chana Dal because they have historical OrderItem references.
- Gagan Toor Dal 1 KG because it has historical references and `TEST-ITEM-001`.
- Gagan Toor Dal 5 KG and 30 KG because they share `SAP-MAT-TOOR` with the
  historical 1 KG identity and require a separate decision.
- Sugar because it is not marked with a demo material identity.

## Remaining genuine decisions and inputs

These are not covered by owner approval revision 1:

### Required for orderable activation

1. Approved GST percentage and HSN for each sellable variant.
2. The existing target price-list/tier that should receive each supplied
   GST-exclusive per-quintal rate. The numeric rates must not be copied to
   every tier.
3. Approved material/warehouse mapping and a current available inventory
   snapshot for each orderable variant. Internal Gagan codes cannot satisfy
   the external material field and stock cannot be invented.

### Required for complete image readiness

1. Exact choice for `PREMIUM (5 kg x 4)`, source row 13.
2. Exact choice for `SUPER (10 kg x 4)`, source row 28.
3. Exact choice for `SEHMAT POHA (35 KG X 1)`, source row 48.
4. Exact source images for the eleven missing product/pack variants listed in
   `REAL_CATALOGUE_IMAGE_EXCEPTION_SHEET.md`.

### Required before hosted retirement/cutover

1. Read-only re-resolution of the four retirement candidates on `gagan-api`,
   service `srv-dak1ppu1egvs7397s9c0`, database `gagan_staging_9ftt`, schema
   `public`.
2. Verification that no restart seed/mock-sync path recreates or reactivates
   archived dummy products.
3. Recovery evidence for the exact authorized target before any write.

## Non-goals

- No real SAP integration or external SAP identity assignment.
- No new Jain/Padam routing engine or static per-SKU seller assignment.
- No changes to GST calculation, freight, invoice, payment or Wave 1B
  contracts.
- No hosted promotion, database migration, catalogue cutover or APK rebuild
  in this approval-recording step.
