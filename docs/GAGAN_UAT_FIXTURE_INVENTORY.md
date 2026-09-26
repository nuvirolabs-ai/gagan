# Gagan Whole-Product UAT Fixture Inventory

Snapshot: 2026-09-26. **One non-commercial staging fixture has been created and resolved by this acceptance pass.** Pre-existing Mahesh, Deepak, Ravi, warehouse and leave records are observations, not fixtures owned by this pass. Do not edit or delete them merely to make a test pass.

Recovery observation: Render `R` workspace, existing `gagan-staging-db` Recovery page, 2026-09-26. PITR is displayed as the past 3 days. At 13:04:45 IST, the restore dialog displayed 2026-09-26 13:04:45 IST as its latest usable point; it was cancelled without restoring. A fresh logical export completed at 13:19 IST with a green success mark and `.dir.tar.gz` file. The downloaded archive at `/Users/tanutejas/Downloads/2026-09-26T07_49Z.dir.tar.gz` is 275,682 bytes; `gzip -t` passed, `tar -tzf` lists 102 entries including `gagan_staging_9ftt/toc.dat`, and SHA-256 is `7a652b600ced8246327c41565a202efcd905b93d1b0481dce22ac145dc9b92bc`. This validates archive integrity/structure, not a performed restore. Render says exports are retained for at least 7 days. Keep the local copy private and do not commit it.

Read-only connected-account verification: workspace `R's workspace` (`tea-dajvdg0ae00c73bi74c0`), `gagan-api` (`srv-dak1ppu1egvs7397s9c0`) on `main`, auto-deploy off, live deploy `acb6073d3924e2b2e860857c28475780a38cfa96`, and database `dpg-dajvi2h5efls73ags3f0-a` / `gagan_staging_9ftt`, status available, PostgreSQL 18. The database has **54 finished migration rows and 0 unfinished** (rechecked 2026-09-26 at 14:04 IST). All 54 hosted migration names and SHA-256 checksums matched the checked-out local baseline at preflight. Five later local migrations for manual beats, own-beat permission, salesperson feedback, feedback-review permission, and catalogue identity are not hosted. A read-only catalogue preflight found zero duplicate normalized product names and zero duplicate `(productId, normalized unitSize, unitsPerCase)` pack identities; the salesperson role exists. These checks did not apply a migration or alter data.

## Write gate

Before each hosted mutation, record the connected account/workspace, exact `gagan-api` service (`srv-dak1ppu1egvs7397s9c0`), Render database (`dpg-dajvi2h5efls73ags3f0-a`, `gagan_staging_9ftt.public`), deployed SHA, authenticated actor and permission, current recovery/export evidence, the intended rollback, and the feature ID. If any identity differs or data ownership is unclear, do not write. Never fabricate SAP IDs, payment settlement, GST, freight, customer OTP rules or production data.

Use a visible `[UAT WHOLE PRODUCT 2026-09-26]` prefix on synthetic names where the field permits. Prefer isolated UAT records and existing mock-only providers. Record IDs returned by the hosted API or Admin and read them back before calling a fixture ready. If a created record is immutable or financial, preserve it and label it for UAT instead of attempting unsafe deletion.

## Created records

| Feature IDs | Object type | Exact ID | Label/owner | Intended state and readback | Created by/time | Cleanup or retention decision | Status |
|---|---|---|---|---|---|---|---|
| GGN-ISS-01 | ServiceIssue | `aeebd2d1-b7d0-4117-84bd-4be51e498ff0` | `UAT-WHOLE-PRODUCT-2026-09-26 Shared issue lifecycle test. No real action requested.` from Mahesh Store (`7e026d12-735e-422c-b191-e7ea0bea46a0`) | Retailer submitted and displayed Open; DB matched retailer, type `service_request`, and status `open`. Admin assigned `UAT only`, added `UAT lifecycle acceptance only. No customer action or dispatch occurred.`, and resolved the exact row. DB readback showed `resolved` at `2026-09-26T08:19:44.303Z` with that assignment and note. AuditEvent readback has `service_issue.retailer_submitted` at `08:17:20.894Z` with no staff actor, then `service_issue.resolved` at `08:19:44.305Z` with a staff actor. Retailer refreshed and displayed Resolved after a full app stop/relaunch; Salesperson readback on final build remains pending. [Open](acceptance-evidence/2026-09-26/retailer-uat-service-request-open.png); [resolved](acceptance-evidence/2026-09-26/retailer-uat-service-request-resolved.png); [after relaunch](acceptance-evidence/2026-09-26/retailer-uat-service-request-after-relaunch.png). | 2026-09-26 13:47 IST via logged-in Retailer app; resolved 13:49 IST via authenticated Admin | Retain resolved UAT record and audit trail; do not delete production-like history | RESOLVED, ADMIN/RETAILER/DB READBACK VERIFIED; REP PENDING |

## Existing observations, not owned fixtures

| Object | Current observation | Evidence boundary |
|---|---|---|
| Mahesh Store Retailer app | Logged in on Moto; Home, zero outstanding, catalogue and simulated Pay visible in the prior founder review. | Do not create real payment or infer a nonzero due case. |
| Deepak Iyer Salesperson/leader | Logged in during current three-button verification; personal Home and Ravi-only Team context. | Preserve his SalesRep and accepted TEAM-01 figures. |
| Admin warehouse queue and leave records | Existing authenticated Admin screenshots show eligible orders and leave statuses. | Read-only observations; no pack/decision was executed in this pass. |
| Add a store Page 2 | A local, unsubmitted draft on the old Salesperson APK opened Step 2 at Transporter with the keyboard closed. | No retailer proposal was submitted or persisted; [capture](acceptance-evidence/2026-09-26/salesperson-new-store-page2-focus.png). |

## Fixture requests to resolve during acceptance

| Need | Feature IDs | Safety requirement | State |
|---|---|---|---|
| Nonzero Jain/Padam plus legacy ledger | PAY-05/07/08 | Controlled accounting records, no fabricated real payment or mutation of Mahesh history. | NOT CREATED |
| Assigned normal salesperson with route and no-route store | VIS-01/02/03, ROUTE-01/03 | Synthetic identity/store and explicit reporting/assignment; no real order unless approved commercial inputs. | NOT CREATED |
| Pending retailer/proposal demand | ORD-02, UX-05 | Synthetic contact identity; avoid real Aadhaar/phone, and preserve manager approval boundary. | NOT CREATED |
| Collection and receipt | PAY-01/02/03, ADM-04 | Mock/test evidence and permissioned collector; Accounts confirmation only if settlement safely isolated and explicitly authorized. | NOT CREATED |
| Marketing task and issue | MKT-01/02, ISS-01 | Synthetic task/issue linked to UAT store; private evidence only. | Issue created and resolved against existing Mahesh staging account; task not created. |
| Warehouse-eligible order | ORD-05 | Controlled confirmed order, exact operator permission, no SAP execution. | NOT CREATED |
