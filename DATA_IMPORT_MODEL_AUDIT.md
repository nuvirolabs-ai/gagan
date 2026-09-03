# Gagan Data Import Center V1 — Model Audit

Date: 2026-09-03  
Branch: `codex/data-import-center-v1`  
Scope: staging-only Admin import workflow; no SAP B1 calls and no changes to existing order, credit, fulfilment, or mobile workflows.

## Isolation decision

The Import Center is an additive Admin surface backed by a durable `ImportJob` record. It writes only through the existing Gagan Prisma models and canonical services. It does not connect to Dogkart, call SAP B1, alter production configuration, or replace the existing Gagan Admin.

`source: "import"` and the import job audit metadata identify records written by this workflow. Every apply requires an explicit confirmation after a server-side preview and is permission-gated by `data.import` (with the existing `staff.manage` administrative permission retained as an emergency-compatible fallback for the current staging Ops Admin).

## Canonical entities and supported fields

| Import type | Canonical model(s) | Safe matching key | V1 supported fields | Notes |
| --- | --- | --- | --- | --- |
| Retailers | `Retailer`, `RetailerLocation`, `CreditProfile` | normalized `Retailer.phone` | `name`, `phone`, `shop_address`, `tier`, `credit_limit`, `salesperson_employee_ref`, `sap_customer_id` | New retailers receive the same location and credit-profile initialization as the existing Admin create route. Lifecycle/KYC status is intentionally not importable. |
| Products / SKUs | `Product`, `Variant` | `sapMaterialId` when present; otherwise product name + unit size | `product_name`, `category`, `description`, `image_url`, `sap_material_id`, `unit_size`, `unit`, `units_per_case`, `unit_weight_kg` | The current schema has no separate SKU-code column. A sellable SKU is represented by a `Variant`. |
| Salespeople | `StaffUser`, `SalesRep` | `employee_ref`, then normalized phone/email | `name`, `phone`, `email`, `employee_ref`, `territory`, `manager_employee_ref`, `status` | Uses staff identity creation and validates manager relationships before applying hierarchy changes. It does not create Admin users or grant roles implicitly. |
| Retailer assignments | `Retailer`, `StaffUser` / `SalesRep` | retailer phone + salesperson employee ref | `retailer_phone`, `salesperson_employee_ref` | Updates only the existing `Retailer.salesRepId` relationship. |
| Inventory | `InventorySnapshot` | `sap_material_id` + `warehouse_code` | `warehouse_code`, `sap_material_id`, `product_name`, `unit_size`, `on_hand`, `committed`, `synced_at` | Uses `upsertInventorySnapshot`, including canonical available/status calculation. There is no `Warehouse` model in the current schema, so no separate warehouse-master import is exposed. |
| Pricing | `PriceList`, `Tier`, `Variant` | tier + variant | `tier`, `product_name`, `unit_size`, `price` | Uses the existing tier-price unique key. No new pricing truth or promotion engine is introduced. |
| SAP mappings | `Retailer.sapCustomerId`, `Product.sapMaterialId` | retailer phone or product name + unit size | `entity_type`, `gagan_key`, `sap_code` | Mapping preparation only. This route never calls the SAP connector or outbox. |

## Existing services reused

- `upsertInventorySnapshot` remains the inventory write path.
- `StaffManagementService.createStaff` remains the staff identity creation path.
- `HierarchyService.setManager` remains the hierarchy validation path.
- Existing retailer initialization semantics (`RetailerLocation` + `CreditProfile`) are preserved.
- Existing `PriceList` unique key and Admin catalog contract are preserved.
- Existing `AuditEvent` is used for job and row-level provenance.

Where a current route has no reusable create service, the import adapter performs the same bounded transaction and initialization contract without changing that route’s behavior.

## Explicitly unsupported in V1

- Warehouse master creation: no canonical `Warehouse` model exists; `warehouse_code` remains the existing inventory snapshot dimension.
- Orders, order status, fulfilment, dispatch, invoices, payments, credit decisions, KYC decisions, and SAP sync execution.
- Admin account creation, password changes, role grants, permissions, and production credentials.
- Arbitrary columns and silent field drops. Headers must match the published template.

## Durability and safety

`ImportJob` stores the file name, import type, normalized preview rows, validation/apply result, bounded counts, actor, status, and error rows. Apply is revalidated from the stored preview, processed in bounded row transactions, and is safe to retry because matching keys use canonical unique identifiers and writes use upsert/update semantics where supported. No `prisma.db.push`, destructive reset, or SAP call is part of the workflow.

The staging Admin exposes only the import types implemented against the models above. Unsupported domain concepts are documented rather than represented by a second, parallel data model.
