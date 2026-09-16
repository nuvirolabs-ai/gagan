# Jain / Padam rule traceability

Business source: `Sales Order Creation Logic for Jain & Padam.docx`.
The original document is preserved byte-for-byte under
`CURRENT/DOCS/Commercial/SOURCES/`; its hash and the source/policy boundary
are in `BUSINESS_DECISIONS.md`.

| Original rule | Implemented interpretation | Source location | Automated evidence | Acceptance boundary |
|---|---|---|---|---|
| 1 | Outside Indore, eligible OTHER contribution `>= 5.00` routes all eligible lines to Padam. | `backend/src/modules/commercial/routing.ts` threshold branch | `backend/src/modules/commercial/routing.test.ts` exact-five and above cases | Local unit/integration passed in prior source checkpoint; hosted/device pending. |
| 2 | Outside Indore, eligible OTHER contribution `< 5.00` routes eligible lines to Jain. | Same | Routing threshold-below cases | Same. |
| 3 | Laxmi plus eligible OTHER below five routes every line to Jain. | Laxmi exclusion + `allJain` branch | Routing mixed below-threshold case | Same. |
| 4 | Laxmi stays Jain while eligible OTHER at/above five routes Padam. | Per-line entity assignment | Routing split case | Same. |
| 5 | Khade Anaj/OTHER Dal participates in one aggregate when classified `OTHER`; no special per-line threshold. | `routingClass: OTHER` contract | Named Khade/OTHER aggregate cases | Requires authoritative SKU mapping. |
| 6 | Aggregate reaches five, so all eligible OTHER lines move to Padam. | Same | Named aggregate boundary cases | Requires authoritative SKU mapping. |
| 7 | Exact approved `Indore`/`Indore City` destination overrides threshold and routes all lines to Jain. | `normalizeCity` first decision | Indore override tests | Broader city-boundary approval remains open. |
| 8 | Laxmi plus authoritatively weighted Instant Mix below 5 KG routes Jain only when no other ambiguous mixed-unit line exists. | `laxmiInstantException` | Instant Mix exception tests | Exact/above-five and other mixed units remain blocked. |
| 9 | Instant Mix with other bag products uses the threshold principle only when an approved bag equivalent exists; otherwise returns `ROUTING_POLICY_UNRESOLVED`. | Fail-closed branch | Unresolved policy tests | BD-01 required for unconfigured combinations. |
| 10 | Laxmi never contributes to the threshold and is always Jain. | `positiveContribution` + entity branch | Laxmi-only/large Laxmi tests | Requires stable `LAXMI_TOOR` metadata. |
| Final priority | Indore → Laxmi separate → remaining aggregate → one or two entity groups in the existing combined commercial contract. | `resolveSalesOrderAllocation` | Routing matrix | Full status also needs data, hosted and physical gates. |

## Engineering safeguards

- Cart quantities are normalized by stable SKU ID before routing.
- Decimal arithmetic is used for threshold contributions.
- No client-supplied seller, threshold or price is trusted by the backend.
- Quote snapshot and accepted order snapshot carry the resolved lines and
  explanation so future master-data changes cannot reroute history.
- The existing Wave 1B pricing/GST/freight/invoice/payment/idempotency paths
  remain the downstream authority.
