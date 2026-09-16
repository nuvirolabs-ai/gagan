# Real catalogue blocker reconciliation

Status: source/import hardening complete; commercial activation is pending reviewed decisions and verified target inventory. Prepared 17 September 2026 from the actual workbook, image index, current Prisma schema and the local rehearsal database.

## Outcome

The prior blocker list mixed business-input gaps with importer limitations. The current branch now has a validated --decisions=<file> input and distinct import and promote phases. The source import is repeatable and pending-safe; it does not activate rows. No hosted write has been performed.

## Classification by cause

| Classification | Exact evidence | Affected field/workflow | Status / disposition |
|---|---|---|---|
| Importer limitation, fixed | Prior CLI emitted a manifest only; current CLI accepts a decisions file, validates source/image checksums and records approval metadata | Approved catalogue configuration, image selection, retirement allowlist | **FIXED**; tests cover invalid decisions, source mismatch, image candidate mismatch, revision replay and stable-key advancement |
| Importer limitation, fixed | Source import and promotion are separate; source import preserves lifecycle state; promotion is the only activation path | Active catalogue, quote/order eligibility | **FIXED**; unresolved rows remain pending_review and active API filters exclude them |
| Importer limitation, fixed | Batch keys include source checksum, approval ID/revision/hash and image mapping revision; approved stable keys can adopt provisional source rows | Repeat import and revised approval | **FIXED**; identical replay is a no-op and a new revision updates the same identities |
| Importer limitation, fixed | Staging guard checks service gagan-api, service ID srv-dak1ppu1egvs7397s9c0, hostname, exact DB gagan_staging_9ftt and schema public | Hosted catalogue write safety | **FIXED**; wrong database/name-prefix targets are rejected |
| Business input genuinely absent | Workbook columns are type, brand, group, item, SKU, packing, master and price only; no HSN/GST | Quote, GST, invoice, SAP payload | **OWNER DECISION REQUIRED** for 105 variants |
| Business/config input genuinely absent | Workbook has a price amount and basis but no target tier/list or explicit tax basis | Price list and backend quote | **OWNER DECISION REQUIRED** for 105 variants. Numeric amount is preserved; no MRP inference |
| Runtime orderability prerequisite | Current inventory service requires Product.sapMaterialId and a fresh available InventorySnapshot by warehouse | Catalogue, quote and order placement | **CONFIGURATION REQUIRED** for 105 variants. This is not solved by an internal code; no fake stock or SAP code is created |
| Identity approval absent | Workbook has no durable internal catalogue codes; source-derived keys are replay keys, not owner-approved business codes | Product/variant identity and future revisions | **OWNER DECISION REQUIRED** for 105 variants; proposed convention is in the decision pack |
| Derivable from explicit source | Ten rows have 30 KG packing and 30KG BAG master; conversion is one 30kg bag | Order unit, billing/freight weight, snapshot | **RESOLVED IN IMPORTER**; no missing conversion blocker remains |
| Derivable but policy-sensitive | Brand/type identifies LAXMI_TOOR and INSTANT_MIX structure; BAG master gives 1.000 OTHER contribution | Jain/Padam dynamic routing | **STRUCTURAL MAPPING PRESENT**; no seller is assigned. BOX contribution still needs owner policy |
| Genuine business decision | Twelve Gagan rice rows have explicit 20 KG BOX master but no source rule that an ordered BOX equals one routing BAG | Threshold routing and mixed invoice allocation | **OWNER DECISION REQUIRED** for source rows 6, 7, 10, 13, 14, 18, 19, 22, 23, 26, 27, 30 |
| Asset genuinely absent/ambiguous | Image index has 89 exact candidates, 5 multi-candidate groups and 11 no-candidate rows; ambiguous files are byte-distinct | Retailer/Salesperson catalogue image | **89 prepared; 5 owner selections; 11 source images required** |
| Future SAP-only dependency | Real SAP material/customer synchronization and external code governance are not part of this source import | Future SAP payload/sync | **DEFERRED**; real SAP remains disconnected. Non-SAP staging cannot bypass current stock requirements |
| Retirement scope not proven | Workbook does not certify it is a complete replacement; local seed contains demo/test rows and historical rows | Active search/catalogue | **EXPLICIT ALLOWLIST ONLY**; see retirement candidate sheet. No broad retirement |
| Legacy sellingEntity tuple | Existing schema supports static seller + GST for legacy rows; accepted dynamic routing uses routingClass and a null seller | Commercial-integrity validation / quote allocation | **NOT A per-SKU ownership request**; tuple is compatibility for legacy/static rows and must not override dynamic routing |

## Exact exception evidence

### Ten conversions now resolved

| Source rows | SKU | Packing | Master | Price / quintal | Result |
|---:|---|---|---|---:|---|
| 32 | SEHMAT G 11 | 30 KG | 30KG BAG | INR 9300 | 1 x 30 kg = 30 kg; source packing_size_and_master_bag |
| 33 | SEHMAT G 21 | 30 KG | 30KG BAG | INR 7000 | 1 x 30 kg = 30 kg; source packing_size_and_master_bag |
| 34 | SEHMAT G 31 | 30 KG | 30KG BAG | INR 5950 | 1 x 30 kg = 30 kg; source packing_size_and_master_bag |
| 35 | SEHMAT G 41 | 30 KG | 30KG BAG | INR 5650 | 1 x 30 kg = 30 kg; source packing_size_and_master_bag |
| 36 | SEHMAT G 51 | 30 KG | 30KG BAG | INR 4350 | 1 x 30 kg = 30 kg; source packing_size_and_master_bag |
| 37 | SEHMAT G 61 | 30 KG | 30KG BAG | INR 3850 | 1 x 30 kg = 30 kg; source packing_size_and_master_bag |
| 104 | LITE CHANA DAL 30 KG | 30 KG | 30KG BAG | INR 8800 | 1 x 30 kg = 30 kg; source packing_size_and_master_bag |
| 105 | LITE MOONG CHILKA 30 KG | 30 KG | 30KG BAG | INR 9000 | 1 x 30 kg = 30 kg; source packing_size_and_master_bag |
| 106 | LITE MOONG MOGAR 30 KG | 30 KG | 30KG BAG | INR 10600 | 1 x 30 kg = 30 kg; source packing_size_and_master_bag |
| 107 | LITE URAD MOGAR 30 KG | 30 KG | 30KG BAG | INR 13100 | 1 x 30 kg = 30 kg; source packing_size_and_master_bag |

### Twelve routing-contribution decisions

| Source row | SKU | Packing | Master | Proposed current structural class | Decision |
|---:|---|---|---|---|---|
| 6 | CLASSIC (1 kg x 20) | 1 KG | 20 KG BOX | OTHER; no static seller | Is one ordered BOX one routing BAG? Approve explicit contribution or keep non-orderable |
| 7 | CLASSIC (5 kg x 4) | 5 KG | 20 KG BOX | OTHER; no static seller | Is one ordered BOX one routing BAG? Approve explicit contribution or keep non-orderable |
| 10 | EXCELLENT (5 kg x 4) | 5 KG | 20 KG BOX | OTHER; no static seller | Is one ordered BOX one routing BAG? Approve explicit contribution or keep non-orderable |
| 13 | PREMIUM (5 kg x 4) | 5 KG | 20 KG BOX | OTHER; no static seller | Is one ordered BOX one routing BAG? Approve explicit contribution or keep non-orderable |
| 14 | PREMIUM (1 kg x 20) | 1 KG | 20 KG BOX | OTHER; no static seller | Is one ordered BOX one routing BAG? Approve explicit contribution or keep non-orderable |
| 18 | ROZANA (1 kg x 20) | 1 KG | 20 KG BOX | OTHER; no static seller | Is one ordered BOX one routing BAG? Approve explicit contribution or keep non-orderable |
| 19 | ROZANA (5 kg x 4) | 5 KG | 20 KG BOX | OTHER; no static seller | Is one ordered BOX one routing BAG? Approve explicit contribution or keep non-orderable |
| 22 | SELECT (1 kg x 20) | 1 KG | 20 KG BOX | OTHER; no static seller | Is one ordered BOX one routing BAG? Approve explicit contribution or keep non-orderable |
| 23 | SELECT (5 kg x 4) | 5 KG | 20 KG BOX | OTHER; no static seller | Is one ordered BOX one routing BAG? Approve explicit contribution or keep non-orderable |
| 26 | SUPER (1 kg x 20) | 1 KG | 20 KG BOX | OTHER; no static seller | Is one ordered BOX one routing BAG? Approve explicit contribution or keep non-orderable |
| 27 | SUPER (5 kg x 4) | 5 KG | 20 KG BOX | OTHER; no static seller | Is one ordered BOX one routing BAG? Approve explicit contribution or keep non-orderable |
| 30 | SUPREME (5 kg x 4) | 5 KG | 20 KG BOX | OTHER; no static seller | Is one ordered BOX one routing BAG? Approve explicit contribution or keep non-orderable |

## What is not required from the owner

- No permanent Jain/Padam seller for every SKU.
- No invented SAP material code.
- No default GST/HSN.
- No MRP-derived or proportional price.
- No broad dummy-product deletion.
- No real SAP credentials or connection.
