# Jain / Padam routing acceptance matrix

This is the source-specific matrix for the current execution. The complete
118-row ledger is maintained separately at
`/Users/tanutejas/Documents/GAGAN/CURRENT/GOAL/ACCEPTANCE_LEDGER.json` once
execution evidence is recorded. `BLOCKED` and `NOT_RUN` are not passes.

The routing checkpoint was accepted on source
`fadc6d8b70cb39ab5a1f93b395572a9e19f6fcd6`. Hosted golden paths were
exercised with orders `GGN-00000086` and `GGN-00000087`, and the full A–H
policy matrix was reviewed on the physical Moto E13. The evidence note is
`CURRENT/EVIDENCE/20260917-jain-padam-routing-hosted/GAGAN_JAIN_PADAM_HOSTED_UAT_20260917.md`.

## Local source/integration cases

| Group | Cases | Expected evidence | Current boundary |
|---|---|---|---|
| Indore override | R01–R03 | Pure resolver + backend quote | PASS — source tests plus native hosted review for exact `Indore` and `Indore City` |
| Bag threshold | R04–R20 | Below/exact/above five, aggregate, duplicate lines, decimal boundary | PASS — source tests and hosted catalog-backed native review |
| Instant Mix | R21–R24 | Exact `orderedKg / 5` conversion; 3/10/24/25 KG boundaries; aggregation with BAG products; Laxmi exclusion | PASS — 3/10/24/25 KG and mixed cases physically reviewed on Moto E13 |
| Input validation | R25–R28 | Empty/invalid/large/deterministic/tampered input | PASS — routing suite and full seeded backend suite |
| Data/geography | D01–D12 | Stable IDs, mapping errors, destination change, historical snapshot | PASS for the approved exact-city/UAT data boundary; original city restored after review |
| Quote/commit | Q01–Q19 | One authoritative quote, freshness, idempotency, atomic persistence | PASS — hosted orders 86/87 used the existing Wave 1B quote/commit path |
| Commercial preservation | C01–C12 | Pricing, GST, freight, invoice/payment/R2/SAP mock | PASS — hosted totals, GST, freight, combined invoices and mock-SAP-compatible snapshots preserved; no payment mutation in this routing pass |

## UI/device cases

| ID range | Surface | Required result | Current status |
|---|---|---|---|
| U01–U06 | Retailer/Salesperson review and cart retention | Backend groups/requote/errors with no client routing engine | PASS — exact candidate APKs installed; hosted orders 86/87 and review matrix accepted |
| U07–U09 | Dates, keyboard, Home/My Day, safe area | Accepted Salesperson UX remains present | Exact Salesperson candidate launched on Moto E13; broader workflow evidence pending |
| U10 | Surveys | Navigation/capability/context preserved; no survey mutation | Exact Salesperson candidate contains Market Survey entry; hosted permission/context acceptance pending |
| U11–U14 | Admin/history/navigation/content | Stored snapshot and actions remain accurate | PASS for controlled Admin lifecycle, invoices 12/13 and native order-detail surfaces |
| O01–O08 | Offline/session/cache | No stale/fabricated route; account isolation | Prior source tests; final artifact/hosted proof pending |
| H01–H13 | Auth/host/release | Exact service, DB, CORS, cookies, logs and pinned source | Render access/recovery gate pending |
| B01–B12 | Migration/artifact/recovery | Fresh/upgrade, exact APK identity, clean source/recovery | Local source evidence partial; final builds/hosted/device pending |

## Boundaries and remaining non-routing work

1. The hosted golden paths used the authorized `gagan-srat.onrender.com`
   environment and the dedicated `Field Ops UAT Kaveri` record. Its original
   `Pune` city was restored after the exact-city review cases.
2. The deployed hosted Admin preview does not expose the current delivery-city
   control. The exact-city fixture setup therefore used the current-source
   Admin UI through a local staging proxy; no direct database mutation was
   used and no hosted Admin deployment was changed.
3. Payment/collection mutation was intentionally not repeated in this routing
   pass. The accepted Wave 1B invoice-scoped payment contract remains the
   downstream authority. Real SAP remains disconnected.
