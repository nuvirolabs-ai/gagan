# Jain / Padam routing acceptance matrix

This is the source-specific matrix for the current execution. The complete
118-row ledger is maintained separately at
`/Users/tanutejas/Documents/GAGAN/CURRENT/GOAL/ACCEPTANCE_LEDGER.json` once
execution evidence is recorded. `BLOCKED` and `NOT_RUN` are not passes.

## Local source/integration cases

| Group | Cases | Expected evidence | Current boundary |
|---|---|---|---|
| Indore override | R01–R03 | Pure resolver + backend quote | Unit/integration evidence exists; hosted/device pending |
| Bag threshold | R04–R20 | Below/exact/above five, aggregate, duplicate lines, decimal boundary | Local routing tests exist; catalog conversion readiness pending |
| Instant Mix | R21–R24 | Documented `<5 KG` exception; unresolved structured error elsewhere | Local fail-closed tests; BD-01 blocks full completion |
| Input validation | R25–R28 | Empty/invalid/large/deterministic/tampered input | Existing validation and routing tests; final full rerun pending |
| Data/geography | D01–D12 | Stable IDs, mapping errors, destination change, historical snapshot | Source contract documented; approved hosted data not verified |
| Quote/commit | Q01–Q19 | One authoritative quote, freshness, idempotency, atomic persistence | Existing Wave 1B + routing tests; final candidate/hosted proof pending |
| Commercial preservation | C01–C12 | Pricing, GST, freight, invoice/payment/R2/SAP mock | Existing Wave 1B regression; full final rerun/hosted proof pending |

## UI/device cases

| ID range | Surface | Required result | Current status |
|---|---|---|---|
| U01–U06 | Retailer/Salesperson review and cart retention | Backend groups/requote/errors with no client routing engine | Final APK not built for this candidate |
| U07–U09 | Dates, keyboard, Home/My Day, safe area | Accepted Salesperson UX remains present | Prior same-source evidence only; final artifact pending |
| U10 | Surveys | Navigation/capability/context preserved; no survey mutation | Prior same-source evidence; final artifact pending |
| U11–U14 | Admin/history/navigation/content | Stored snapshot and actions remain accurate | Hosted Admin/device proof pending |
| O01–O08 | Offline/session/cache | No stale/fabricated route; account isolation | Prior source tests; final artifact/hosted proof pending |
| H01–H13 | Auth/host/release | Exact service, DB, CORS, cookies, logs and pinned source | Render access/recovery gate pending |
| B01–B12 | Migration/artifact/recovery | Fresh/upgrade, exact APK identity, clean source/recovery | Local source evidence partial; final builds/hosted/device pending |

## Explicit blockers

1. The current browser session is authorized for Dogkart, not the target Gagan
   Render service; hosted topology, recovery and migration ledger cannot yet
   be verified safely.
2. The Moto E13 device has not yet been re-verified against a newly built
   routing artifact.
3. BD-01 (Instant Mix mixed units), BD-02 canonical geography and BD-03
   production bag mapping are not fully resolved in supplied source.
