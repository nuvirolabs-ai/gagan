# Gagan real-catalogue publication acceptance

Recorded: 17 September 2026 (Asia/Kolkata)

Status: **HOSTED PUBLICATION + TARGETED RETIREMENT PASS; FULL ORDERING NOT CLAIMED**

> Current-state addendum recorded after the historical pre-publication review
> below. The earlier blocked result is intentionally preserved as history and
> must not be read as the current hosted state.

## Current hosted publication checkpoint — 17 September 2026

| Field | Result |
|---|---|
| Canonical source branch | `codex/gagan-canonical-product-v1` |
| Exact source used for the hosted backend deployment | `571292a1015d27e7d9e92639d52009619a8ecb21` |
| Render deployment | `dep-dalovlqd0e5s7385k2jg` |
| Render service | `gagan-api` / `srv-dak1ppu1egvs7397s9c0` |
| Hosted API | `https://gagan-srat.onrender.com` |
| Database | `gagan_staging_9ftt` / `public` |
| Migration state | 43 migrations found; schema up to date |
| Public health | `/health`, `/health/live`, `/health/ready`: HTTP 200 |
| Source/import batch | `real-catalogue:sku-wise-item-list-2026-09-16-v1` using workbook SHA below |
| Publication result | 46 products and 105 variants visible; 0 orderable pending tax/inventory readiness |
| Hosted image result | 91 exact; 11 `Image coming soon`; 3 `Image pending confirmation` |
| Hosted pricing result | 105 published variants have a price row; workbook basis remains GST-exclusive INR per quintal |
| Confirmed retirement result | 2 products / 2 variants archived: Urad Dal (`DEMO-MAT-URAD`) and Poha (`DEMO-MAT-POHA`) |
| Historical records | Orders 85, 86 and 87 remain readable; order-item/invoice counts were unchanged by retirement |
| Admin deployment | Existing Admin deployment was not rebuilt; the public Admin entry point returned HTTP 200 and continues to target the same backend configuration |

The first hosted publication attempt was rejected by the readiness guard for
10 source rows with missing case conversions. The reviewed source manifest was
corrected using explicit `packing_size_and_master_bag` evidence for those rows,
then the same approved publication completed. This is retained as a source
readiness correction, not hidden as a successful first attempt.

The retirement operation was a separate guarded status-only phase. It required
the exact hosted product and variant identities, expected demo material IDs,
null catalogue keys and zero historical `OrderItem` references. Moong Dal and
Sona Masoori Rice were not retired because each has historical order-item
references. No accepted orders, invoices, payments, snapshots, ownership data
or UAT records were rewritten.

## Physical publication evidence — current checkpoint

Evidence is retained under
`/Users/tanutejas/Documents/GAGAN/ARCHIVE/real-catalogue-publication-20260917/`.

| Surface | Result |
|---|---|
| Retailer review app | PASS — existing `com.gagan.retailer.review` v1.0.5/code 6 was reopened against `gagan-srat`; the Products screen showed the real catalogue, packaging choices, product images, GST-exclusive per-quintal labels and `Ordering setup pending` guards |
| Salesperson review app | PASS — existing `com.gagan.sales.review` v1.0.10/code 10 was reopened against `gagan-srat`; New order showed real product images, pack choices, GST-exclusive per-quintal labels and the server-controlled pending setup state |
| Exact image path | PASS — a hosted real catalogue image returned HTTP 200 with `image/jpeg` |
| Placeholder evidence | PASS — the loaded catalogue accessibility data included `Image coming soon` entries; the full hosted count is the authoritative 11 above |
| Admin data surface | PASS at the shared-backend/data boundary; direct authenticated Admin visual capture was not available in the currently focused Render browser window, so no stronger visual claim is made |

The two review APKs were reused; no rebuild, uninstall or app-data clearing was
performed. The strongest screenshots are:

- `/Users/tanutejas/Documents/GAGAN/ARCHIVE/real-catalogue-publication-20260917/retailer-real-catalogue-topward.png`
- `/Users/tanutejas/Documents/GAGAN/ARCHIVE/real-catalogue-publication-20260917/sales-catalogue-scrolled.png`

The physical run proves representative discovery and the guarded display state
on both installed apps. It does not claim that every one of the 105 variants
was independently photographed on-device, nor does it claim checkout
orderability while the hosted configuration correctly reports zero orderable
variants.

## Candidate

| Field | Value |
|---|---|
| Canonical branch | `codex/gagan-canonical-product-v1` |
| Canonical source SHA | `2a8e2d2e9288fb9ff4fb1d5e2f38802e50a172a8` |
| Feature branch | `codex/gagan-real-catalogue-v1` at the same SHA |
| Workbook | `1-SKU-WISE-ITEM-LIST-16-09-26-UPDATED.xlsx` |
| Workbook SHA-256 | `f9f69849c37421bd48a0326d50239cb2ebf0ff47b955bc56915556446fa9e5a6` |
| Image-index SHA-256 | `41da39cf271c7cb37f363c39a128cb2d59b4205ee2359ff145cca898dcb3cc2d` |
| Intended API | `https://gagan-srat.onrender.com` |
| Intended Render service | `gagan-api` / `srv-dak1ppu1egvs7397s9c0` |
| Intended database | `gagan_staging_9ftt` / `public` |

## Local source and rehearsal

- Input: 111 workbook rows, 105 unique variants, 46 product identities.
- Internal identities: 46 product codes and 105 variant codes, persisted from
  stable source keys and retained across replay.
- Approved pricing: workbook values retained as GST-exclusive INR per quintal
  for all existing retailer tiers in the local rehearsal; no MRP substitution.
- Approved routing: the twelve exact 20 KG rice master-BOX variants contribute
  one routing BAG each; displayed BOX, 20 KG weight, pricing weight and freight
  weight remain unchanged. Dynamic Jain/Padam policy remains runtime-owned.
- Images: 91 exact assets, 11 owner-approved `Image coming soon` placeholders,
  3 ambiguous mappings held pending exact packaging confirmation.
- Local publication migration: `20260917130000_real_catalogue_publication_v1`.
- Local publish result: 46 products and 105 variants published visibly, 230
  tier-price rows present, and 0 variants orderable until independent GST/HSN
  and inventory/material configuration is valid. Server-side order restrictions
  remain active.
- Identical publish replay: no-op with the original durable batch summary; no
  duplicate products, variants or price rows.
- Fresh disposable database: 43 migrations from zero, seed and publication
  rehearsal succeeded.
- Backend regression: 135 files / 953 tests passed, 0 skipped.
- Admin regression: 22 files / 58 tests passed.
- Salesperson regression: 33 files / 181 tests passed.
- Retailer regression: 17 files / 74 tests passed.
- Backend/Admin/mobile typechecks and configured builds passed; `git diff
  --check` passed.

## Physical review artifacts

Exact in-place review artifacts and hashes are in
`/Users/tanutejas/Documents/GAGAN/CURRENT/BUILDS/CANDIDATES/2a8e2d2/RELEASE_MANIFEST.md`.

- `com.gagan.sales.review`, version `1.0.10` / code `10`, SHA-256
  `cef1427bdd50b81e4d01f7fe5050633eefdc5564d7224d716efb95cb518b7f24`:
  installed as a compatible update on Moto E13 `ZD2229Q3KB`; app launched and
  loaded the authenticated Salesperson Home screen.
- `com.gagan.retailer.review`, version `1.0.5` / code `6`, SHA-256
  `2bcdbc0776886c9234570afceeedc0384e38552c21819e2e92254925201140c6`:
  installed as a compatible update on the same device; app launched and
  loaded the authenticated Retailer Home and Products screens.
- Physical catalogue result: **NOT ACCEPTED**. The device displayed the
  existing 14-item hosted catalogue because hosted publication had not been
  executed. This is not evidence that the 105 real variants are live.
- Evidence screenshots are retained under
  `/Users/tanutejas/Documents/GAGAN/CURRENT/EVIDENCE/20260917-real-catalogue-build/`.

## Hosted boundary

Public `/health`, `/health/live` and `/health/ready` on `gagan-srat` returned
HTTP 200. The accessible Chrome session exposed Render at `/login`, not the
authorized Gagan Render workspace. Therefore the exact service/database
attachment, migration ledger, backup/recovery boundary and deployment write
path were not proven in this session.

No hosted migration, catalogue import, promotion, dummy/test retirement,
backend deployment, Admin deployment or business-data mutation was performed.
The four narrow dummy candidates remain local semantic candidates only and
must be re-resolved read-only on the authorized staging database before any
retirement write.

## Readiness decision

- Local source ready: **YES**
- Local import/publication rehearsal ready: **YES**
- Hosted catalogue published: **NO — blocked by authorized Render access and
  required hosted recovery/migration preflight**
- Moto real-catalogue acceptance: **NO — hosted catalogue not yet published**
- Production ready: **NO**

This record preserves the distinction between a successful local rehearsal,
an installed review build, a public health response and an actual hosted
catalogue cutover.
