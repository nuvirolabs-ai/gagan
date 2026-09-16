# Jain / Padam rule traceability

Business source: `Sales Order Creation Logic for Jain & Padam.docx`.
The original document is preserved byte-for-byte under
`CURRENT/DOCS/Commercial/SOURCES/`; its hash and the source/policy boundary
are in `BUSINESS_DECISIONS.md`.

| Original rule | Implemented interpretation | Source location | Automated evidence | Acceptance boundary |
|---|---|---|---|---|
| 1 | Outside Indore, eligible OTHER contribution `>= 5.00` routes all eligible lines to Padam. | `backend/src/modules/commercial/routing.ts` threshold branch | `backend/src/modules/commercial/routing.test.ts` exact-five and above cases; native cases B/C/F | Source, hosted and physical evidence accepted. |
| 2 | Outside Indore, eligible OTHER contribution `< 5.00` routes eligible lines to Jain. | Same | Routing threshold-below cases; native cases A/D/E | Source, hosted and physical evidence accepted. |
| 3 | Laxmi plus eligible OTHER below five routes every line to Jain. | Laxmi exclusion + `allJain` branch | Routing mixed below-threshold case; native case E | Source, hosted and physical evidence accepted. |
| 4 | Laxmi stays Jain while eligible OTHER at/above five routes Padam. | Per-line entity assignment | Routing split case; native case F | Source, hosted and physical evidence accepted. |
| 5 | Khade Anaj/OTHER Dal participates in one aggregate when classified `OTHER`; no special per-line threshold. | `routingClass: OTHER` contract | Named Khade/OTHER aggregate cases | Requires authoritative SKU mapping. |
| 6 | Aggregate reaches five, so all eligible OTHER lines move to Padam. | Same | Named aggregate boundary cases | Requires authoritative SKU mapping. |
| 7 | Exact approved `Indore`/`Indore City` destination overrides threshold and routes all lines to Jain. | `normalizeCity` first decision | Indore override tests; native cases G/H | Source and physical exact-city evidence accepted; no broader geography inference is intended. |
| 8 | Instant Mix uses the approved exact conversion `orderedKg / 5`; Laxmi remains Jain and is excluded from the aggregate. | `contributionForLine` with `INSTANT_MIX_KG_DIV_5` | 3/10/24/25 KG boundary tests and Laxmi mixed cases | Source and physical evidence accepted; missing/invalid authoritative weight remains a data-readiness error. |
| 9 | Instant Mix may be combined with BAG/eligible products; exact decimal contributions are aggregated with the same five-bag threshold. | `contributionForLine` + aggregate threshold | 3 KG + 3 bags, 10 KG + 3 bags, and multi-line cases | Source and physical evidence accepted; no manual Instant Mix override or inferred non-BAG conversion. |
| 10 | Laxmi never contributes to the threshold and is always Jain. | `contributionForLine` + entity branch | Laxmi-only/large Laxmi tests; native cases E/F | Source and physical evidence accepted; requires stable `LAXMI_TOOR` metadata. |
| Final priority | Indore → Laxmi separate → remaining aggregate → one or two entity groups in the existing combined commercial contract. | `resolveSalesOrderAllocation` | Routing matrix; hosted orders 86/87; native cases A–H | Controlled staging acceptance passed; real SAP and payment mutation remain separate existing boundaries. |

## Engineering safeguards

- Cart quantities are normalized by stable SKU ID before routing.
- Decimal arithmetic is used for threshold contributions, including exact
  Instant Mix KG ÷ 5 results without pre-threshold rounding.
- No client-supplied seller, threshold or price is trusted by the backend.
- Quote snapshot and accepted order snapshot carry the resolved lines and
  explanation so future master-data changes cannot reroute history.
- The existing Wave 1B pricing/GST/freight/invoice/payment/idempotency paths
  remain the downstream authority.
