# Real catalogue retirement candidates

Status: **historical local candidate list preserved; hosted targeted retirement executed.** The four DEMO material identities below remain the original local candidate list. Only the exact hosted identities recorded in the execution section were archived after target-specific re-resolution and history guards.

The executable approval file intentionally contains an empty retirement list:
local IDs must not be replayed against hosted staging. Re-resolve the exact
name/material/variant identities, status, active-cart or reorder use and
historical OrderItem references on the authorized `gagan-api` target before
adding any candidate to a promotion decisions file. The operation remains
status-only, recoverable and history-preserving.

## Narrow candidates for owner approval

| Local rehearsal Product ID | Product | SAP/material field | Local Variant ID | OrderItem references | Proposed action | Guard |
|---|---|---|---|---:|---|---|
| <code>35f30af6-914a-4879-92ae-29bfd50f62cd</code> | Moong Dal | <code>DEMO-MAT-MOON</code> | <code>316c62d2-41e3-4aa9-9d8a-7debd4506223</code> | 0 | Archive product + variant | Exact name/material/variant match; no order-item history; must re-resolve on hosted DB |
| <code>88ef1950-bca9-4c24-879b-91ef70635b7f</code> | Poha | <code>DEMO-MAT-POHA</code> | <code>c1587729-cba5-4ede-b986-525f884e6c1d</code> | 0 | Archive product + variant | Same |
| <code>18798b7c-1ab5-4ac6-ae2f-0f187de73439</code> | Sona Masoori Rice | <code>DEMO-MAT-SONA</code> | <code>41a8fd01-21f9-4778-8224-512ad5ccbcc3</code> | 0 | Archive product + variant | Same |
| <code>0c5b4b9b-d7b8-42ad-b691-6312405baa25</code> | Urad Dal | <code>DEMO-MAT-URAD</code> | <code>2c2a2772-59a9-48c2-9e66-a3ec0fe88619</code> | 0 | Archive product + variant | Same |

The activation code requires the complete variant ID set, exact expected name/material, a non-empty reason, a legacy product with null catalogue key, and zero historical order-item references. It archives by status; it does not delete or rewrite history. The allowlist is part of the approval checksum.

## Explicitly not automatic

- Basmati Rice has 28 order-item references.
- Chana Dal has 27 order-item references.
- Gagan Toor Dal | 1 KG has 29 order-item references and TEST-ITEM-001; it is historical and must remain.
- Gagan Toor Dal | 5 KG and Gagan Toor Dal | 30 KG have zero local order-item references but share SAP-MAT-TOOR with the historical 1 KG item, so they require a separate identity decision and are not included in the automatic list.
- Sugar has no local order-item reference, but it is not marked with a demo material identity; do not retire merely because it is absent from this workbook.

No candidate should be placed into an approved decisions file until the exact target product/variant IDs, current status, active cart/reorder considerations and historical references have been checked on the authorized staging database.

## Hosted execution — 17 September 2026

Target: `gagan-api` / `srv-dak1ppu1egvs7397s9c0`,
`https://gagan-srat.onrender.com`, database `gagan_staging_9ftt` / `public`.

The guarded retirement phase used the owner-approved revision 2 decision file,
the exact workbook batch, and the exact hosted identities below. It changed
only `catalogStatus` to `archived`; it did not delete records or rewrite
history.

| Hosted product ID | Product | Material identity | Hosted variant ID | Historical OrderItems | Result |
|---|---|---|---|---:|---|
| `530c6a1f-e512-4755-ae0c-be483fc0d752` | Urad Dal | `DEMO-MAT-URAD` | `bda74096-b06c-4ba8-bf9a-a1e04900039c` | 0 | Archived |
| `3710b619-bca9-4e51-bbd8-52562b73b3cd` | Poha | `DEMO-MAT-POHA` | `e9e68b05-3655-4388-981c-8e0ae72db514` | 0 | Archived |

The hosted post-check showed two remaining active DEMO material products:
Moong Dal and Sona Masoori Rice. They were deliberately not included in the
executed allowlist because each has historical order-item references. They
remain recoverable and untouched. Accepted historical orders 85, 86 and 87
remain readable; no product, line, invoice or payment history was rewritten.
