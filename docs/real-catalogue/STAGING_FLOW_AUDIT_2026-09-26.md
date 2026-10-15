# Real catalogue staging flow audit - 2026-09-26

## Boundary and result

Read-only inspection of Render service `gagan-api` (`srv-dak1ppu1egvs7397s9c0`), database `gagan_staging_9ftt`, schema `public`, and the connected Moto e13 retailer review app. No hosted write, catalogue import, inventory reseed, order, migration, deployment, or historical row deletion was performed. The database has 52 completed migrations and no failed/incomplete migration. Live API deploy remains `cfff3b62c02970c27bdd728817ba980963df58e1`.

The canonical workbook is `/Users/tanutejas/Downloads/SKU WISE ITEM LIST – 16-09-26-UPDATED.xlsx`, SHA-256 `f9f69849c37421bd48a0326d50239cb2ebf0ff47b955bc56915556446fa9e5a6`, sheet `PRODUCT LIST`, 111 data rows. The reviewed manifest resolves 105 unique variants under 46 product identities. Every hosted keyed variant matches the manifest's product key, pack conversion, internal variant code, and both tier rates on a `quintal` basis. Reimport is unnecessary.

## Hosted state before and after

| Measure | Before | After |
| --- | ---: | ---: |
| All products | 62 | 62 |
| All variants | 121 | 121 |
| Keyed real products | 46 | 46 |
| Keyed real variants | 105 | 105 |
| Duplicate normalized product identities | 0 | 0 |
| Duplicate product/pack variant identities | 0 | 0 |
| Historical rows deleted | 0 | 0 |

Of the real variants, 6 are active and 99 are published/non-orderable. Three real products are active and 43 are published. All 105 real variants have GST unset; the six active variants alone have the approved pending-GST order exception. The other 99 remain browseable with `pending_setup` / `Ordering setup pending`. Images: 91 exact, 11 `Image coming soon`, 3 `Image pending confirmation`. No SAP material ID, HSN, or GST rate was invented. The 210 price-list rows cover all 105 variants in both tiers and retain `rateBasis=quintal`.

## Existing real product IDs

These are the hosted `Product.id` values, not proposed new records.

| Product | Hosted ID |
| --- | --- |
| Gagan Broken | `579e5b37-6e65-4315-93e5-7dea130dc9f5` |
| Gagan Choice | `4b11d248-9d9b-441d-be43-eaff15c28a4d` |
| Gagan Classic | `29de619b-a3f9-4c10-b735-9efc2f174538` |
| Gagan Excellent | `00ed5861-8495-457a-b653-6b7afab11551` |
| Gagan Lite Chana Dal 30 Kg | `a02d7b1e-1e8b-42ab-83b8-b61ba8518c67` |
| Gagan Lite Moong Chilka 30 Kg | `f565a069-a97f-4b99-acaf-f13379b358db` |
| Gagan Lite Moong Mogar 30 Kg | `1be79414-324f-4405-9cee-ba70e2cd0ef2` |
| Gagan Lite Urad Mogar 30 Kg | `d8c8d393-dc5a-4d40-8ffa-803235099520` |
| Gagan Premium | `d42d6968-2960-4f1d-8e3d-1de71f9bc929` |
| Gagan Regular | `99f2aa5e-5b12-40ee-a047-4f9f09822999` |
| Gagan Rozana | `e284467f-d248-4c94-9cbb-8bd1648bd287` |
| Gagan Select | `dc5903a9-72cc-47eb-b704-1d58ef54b2b1` |
| Gagan Super | `a09fdd1f-8d5c-4a67-a9fc-1b8a82c6b428` |
| Gagan Supreme | `815fbdc8-94f2-4645-97c8-bac9cb6c936d` |
| Gagan Toor Dal | `335edf44-aa4d-4ebc-9ef9-68c8161ddc5c` |
| Laxmi LPP Toor Dal | `338f71ac-913f-4e7d-9e59-398b530aeeee` |
| Neel Gagan Chana Dal | `9d76e1eb-a0ca-41ab-b9f3-e3fde9eee38c` |
| Neel Gagan Chawali | `b48349f9-b9b8-4df8-8d4c-87fe2e2388e2` |
| Neel Gagan Kabuli Chana | `1690af1c-b4f8-4e7d-9166-98a9cd0d9bf6` |
| Neel Gagan Masoor Dal | `a39163a1-8290-4398-9eee-e391d4c1aff7` |
| Neel Gagan Masoor Whole | `6939d988-1215-4d8c-aa5c-0c47ab7d38ed` |
| Neel Gagan Moong Chilka | `0054ad9c-9dcf-4bdf-9eb0-d6bb9e3359f1` |
| Neel Gagan Moong Mogar | `e764b4a4-6d6b-4f50-8972-dcd77dbe749b` |
| Neel Gagan Moong Whole | `a170a34e-d7c1-4fa4-b0ca-28caae253c35` |
| Neel Gagan Moth | `6e923437-b104-41a7-856e-041f555a8407` |
| Neel Gagan Rajma Chitra | `b4763fbe-6494-4f51-a888-3381739503fa` |
| Neel Gagan Rajma Kashmiri | `412c797f-b01f-4574-ae7b-7b2ea4d11b19` |
| Neel Gagan Red Chana | `fdc02591-04f6-45b7-ae28-2f1854949a28` |
| Neel Gagan Urad Chilka | `b70c0c43-2c86-4a04-adbc-acbc0ffcda47` |
| Neel Gagan Urad Mogar | `0cd07185-db77-4950-abf0-d0a2a66604d5` |
| Neel Gagan Urad Whole | `04453cd6-edfb-4bb8-ab97-404464fcc8e0` |
| Sehmat Dahi Vada | `721e99aa-c9fd-4835-ba1b-83c15e07c5e0` |
| Sehmat Dosa | `afa794d3-4c43-4284-9a6a-229963f4076f` |
| Sehmat G 11 | `8e594ec6-5469-42d0-8646-58826fd17b4e` |
| Sehmat G 21 | `f71905c1-d3a3-4158-b29c-02395a94b27b` |
| Sehmat G 31 | `50001ab5-53ad-4a66-bb7e-1dd3e6a081c7` |
| Sehmat G 41 | `bd9f6810-e644-4d5a-8af4-685a388618ae` |
| Sehmat G 51 | `ce5bd00f-e561-4628-b030-cc7b99f83d11` |
| Sehmat G 61 | `433e6c6e-6a93-4095-8f36-09897061f3de` |
| Sehmat Gold Poha | `89f5c1a9-6fbc-4d78-b11b-629432ce6cf3` |
| Sehmat Idli | `0443e12e-1f26-4993-852a-8031ffaf5c66` |
| Sehmat Khaman | `0525f583-98c5-49af-83ef-6689e81a9c8e` |
| Sehmat Moong Bhajiya | `3f8116ed-239b-485c-9196-ceef59786eff` |
| Sehmat Poha | `bd6415f8-4f65-49e4-a97a-2d92101c4983` |
| Sehmat Sabudana | `7dea8e09-0d65-473e-a880-32fd269155a5` |
| Sehmat Uttapam | `2b4db102-7190-4808-9530-dcfccc83347a` |

## Six controlled variants

All six are `active`, backend `orderable=true`, `orderingStatus=ready`, `taxStatus=PENDING`, with GST unset and the approved pending-GST ordering flag. All have exact reviewed images, `staging_uat` internal inventory at `WH-001`, on-hand 100, committed 0, and available 100 **as read**, not as a new inventory assumption. Every row's `syncedAt` is `2026-09-23T10:30:15.173Z`, beyond the one-hour freshness limit. The effective availability returned to the apps is `stale`, so Add is blocked and quote/order inventory validation would reject it.

| Variant | Hosted variant ID | INR/quintal | INR/kg | INR/master pack |
| --- | --- | ---: | ---: | ---: |
| Gagan Broken 30 KG | `1a2c0525-dc34-4cd5-ae91-a0d2cc46881f` | 5,400 | 54 | 1,620 |
| Gagan Choice 30 KG | `f5ce43fc-19e5-4eff-a42a-79f16d89c1d3` | 8,100 | 81 | 2,430 |
| Gagan Classic 30 KG | `b833062a-f7c4-486a-bbe0-bbfaad6e6c09` | 9,550 | 95.50 | 2,865 |
| Gagan Classic 1 KG x 20 | `e57e2b24-78ac-453a-9172-defbb12295b4` | 9,950 | 99.50 | 1,990 |
| Gagan Classic 5 KG x 4 | `0d8784a9-738b-42af-8fd1-2adf19b437c7` | 9,950 | 99.50 | 1,990 |
| Gagan Classic 10 KG x 4 | `a29b9d8c-1ba7-4dec-925c-bad913f19a1b` | 9,750 | 97.50 | 3,900 |

The existing `seedApprovedStagingInventory.ts` is **not** a timestamp-only refresh: it resets on-hand to 100 and committed to 0. No approved refresh-only path was found in this checkout. It was not run. The connected Render SQL tool is read-only, so no hosted inventory mutation can be performed through it. A safe continuation requires a guarded, audited staging-only refresh that verifies the exact six current rows and changes `syncedAt` only, followed by immediate app/quote verification. A simple timestamp bump is an extension of the synthetic UAT fixture, not evidence of physical stock.

## App evidence and remaining gates

- Moto e13 retailer review app `com.gagan.retailer.review`, authenticated as Mahesh Store, pointed at `https://gagan-srat.onrender.com`: after clearing an active filter, Products showed 52 groups, matching the hosted grouping count. It displayed the Gagan Broken exact pack image and correct quintal/kg/case values and pending-GST copy. Add was absent while inventory was stale. Sehmat Uttapam remained browseable with `Ordering setup pending` and the correct quintal-derived price. The app duplicated the pending-GST message on the stale Gagan Broken card and used that text as the disabled reason; the actual block is stale inventory.
- Retailer Add/Cart/Review/quote: not passed; the six stale rows prevent the controlled flow. No order was submitted.
- Salesperson physical app: not passed. The review installation's current Deepak session has no assigned operational workspace; the older `com.gagan.sales` app did not reach a usable screen during this audit. Source pricing/orderability unit tests passed, but they are not an authenticated device acceptance.
- Admin live UI: not authenticated in this audit. Database read-model evidence confirms 46/105 real rows and commercial/image states, but is not a substitute for Admin screen acceptance.
- Historical non-keyed catalogue: 16 products/variants remain; eight are active and eight archived. All eight active legacy variants have historical `OrderItem` references, so none were retired without a new exact approval and history-safe decision. The canonical real catalogue does not require dummy rows to browse, but the controlled six cannot yet replace legacy items for Add/Cart/Review testing.

## Gate

- Real product data live in staging: **YES**, at the verified database and on the retailer app.
- Dummy catalogue required for normal browsing: **NO**. For end-to-end controlled ordering today, the real subset is blocked by stale synthetic inventory.
- Six real variants ready for flow testing: **NO**.
- Real SAP used: **NO**.
- Production touched: **NO**.
