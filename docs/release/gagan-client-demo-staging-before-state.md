# GAGAN client-demo staging before-state

Captured 2026-09-17 before the final client-demo display cleanup.

## Verified target

- Render workspace: R’s workspace
- Environment: Production
- API service: `gagan-api` / `srv-dak1ppu1egvs7397s9c0`
- Database service: `gagan-staging-db` / `dpg-dajvi2h5efls73ags3f0-a`
- Database: `gagan_staging_9ftt`
- Schema: `public`
- Health: `/health`, `/health/live`, and `/health/ready` all returned HTTP 200
- Recovery boundary: Render showed 3 days of point-in-time recovery and two
  retained logical exports before this change

## Demo retailer display records

These names were unambiguously marked as staging/UAT fixtures. IDs and account
relationships remain unchanged. The order count is included to identify the
record without exposing contact data.

| Retailer ID | Current display name | Status | Orders | Planned display name |
|---|---|---:|---:|---|
| `22bfe6e3-ba2d-415c-b621-c7c994d4be98` | Field Ops UAT Kaveri | active | 4 | Rajesh Kirana Store |
| `21cd01e7-0d6c-4d4a-aae8-0fb9a0d94585` | Field Ops UAT Patel | pending_kyc | 0 | Shop Mart |
| `cf7b7b26-898a-47c1-9883-681ba5321fbf` | Field Ops UAT Sharma | active | 8 | Kirana Mart |
| `ec20567c-68b4-4e0e-b565-10c491c2f75f` | [FOUNDER UAT] Executive Store | pending_kyc | 5 | Shree Balaji Mart |
| `c5603b3c-a1ae-4e29-9981-0e367df1cf00` | [UAT GOLDEN PATH] Sunrise Stores | pending_kyc | 1 | City Mart |

Orders 85, 86, and 87 all belonged to the Kaveri record and were respectively
`out_for_delivery`, `delivered`, and `delivered`. They are preserved; only the
current retailer display name is changed.

## Demo salesperson display records

| Staff ID | Current staff name | Status | SalesRep ID | Current territory | Planned values |
|---|---|---|---|---|---|
| `5cd4a147-488e-479a-992a-5a99c9457ecb` | Field Ops UAT | active | `d93c0412-0652-4948-892f-5f13152a09d9` | Pune Field Ops | Rahul Sharma / Pune Sales |

A second dedicated visual fixture had a realistic person name but a staging
marker in its territory. Its linked staff record already used the realistic
name Nikhil Patil, so only the territory display was changed:

| SalesRep ID | Current name | Current territory | Planned territory |
|---|---|---|---|
| `8177c786-a640-4c4c-9834-0eac34904c37` | Nikhil Patil | Pune Central · visual UAT | Pune Central |

The staff and linked SalesRep records keep their IDs, roles, permissions,
credentials, route/attendance/history, order attribution, and survey access.

## Active legacy catalogue records

The published real master was 46 products and 105 variants. Six additional
active products were visibly marked as UAT/routing fixtures; each had one
variant and retained historical order-item references as shown below. They are
archived from new catalogue reads while their historical rows remain intact.

| Product ID | Current name | Status | Variants | Historical order items |
|---|---|---:|---:|---:|
| `e447fb65-5b87-4328-9aed-08f9c7911b3e` | [FOUNDER UAT] Executive SKU | active | 1 | 5 |
| `0b631750-46a3-45aa-92e7-94e23126894e` | ROUTING-UAT-INSTANT-MIX-20260917 | active | 1 | 0 |
| `45531c59-5ec1-42ec-a331-fa5d2c29682e` | ROUTING-UAT-LAXMI-20260917 | active | 1 | 3 |
| `ae9ba4a7-840e-4340-bf49-bd8823cbb06a` | ROUTING-UAT-OTHER-BAG-20260917 | active | 1 | 3 |
| `5769f17f-6fe6-4910-a9ab-26598199f3e9` | W1B-UAT-JAIN-SKU-20260914 | active | 1 | 2 |
| `f6ac9c9e-ff94-4fec-9d1a-e5d75c36d7b5` | W1B-UAT-PADAM-SKU-20260914 | active | 1 | 2 |

No product names in the published 46-product/105-variant master matched the
UAT/test/demo pattern. No product name, SKU, order line, invoice, or immutable
historical snapshot is rewritten.
