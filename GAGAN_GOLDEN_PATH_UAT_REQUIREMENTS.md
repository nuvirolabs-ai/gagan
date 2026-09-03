# Gagan Golden-Path UAT Requirements

Date: 2026-09-03  
Scope: one disposable staging/local UAT scenario  
SAP mode: `mock` only  
Production/main: untouched

This document records the actual prerequisites found in the canonical code and the normal API path used to create and complete the UAT order. It is not a second business policy.

## Canonical path

The order lifecycle is implemented across these paths:

1. `POST /rep/orders` calls `createOrderForRetailer` in `backend/src/lib/orders.ts`.
2. Order creation resolves tier pricing, validates inventory, builds the credit snapshot, persists the credit assessment/comparison, and either creates an approval request or an active `DispatchAuthorization`.
3. Admin order actions in `backend/src/routes/admin/orders.ts` move the order one state at a time: placed → confirmed → packed → out_for_delivery → delivered.
4. Approval-required orders are handled by `ApprovalService.decide` in `backend/src/modules/approvals/approvalService.ts`; a successful approval creates the active dispatch authorization and queues the sales order.
5. Dispatch assignment consumes the active authorization, creates/updates `Delivery`, and moves the order to `out_for_delivery`.
6. POD calls `createInvoiceForDelivery` in `backend/src/modules/invoicing/invoiceService.ts`; it creates the invoice/ledger records, stores proof, enqueues the invoice outbox item, and marks the order delivered.
7. `drainOutbox` in `backend/src/lib/sap/outbox.ts` posts pending sales-order and invoice items through `getSapConnector()`.

## Preconditions found in code

| Requirement | Canonical condition | UAT setup |
|---|---|---|
| Retailer identity | Retailer must exist, be assigned to the logged-in salesperson for `/rep/orders`, and use a unique phone. | Admin retailer API created `[UAT GOLDEN PATH] Sunrise Stores` and assigned it to `Ravi Kumar`. |
| Retailer lifecycle / KYC | Dispatch requires an active retailer with an approved KYC case; approval also updates `CreditProfile.kycVerifiedAt`. | Created through Admin retailer API, then Admin KYC start → three document uploads → submit → step-up → approve. |
| Credit profile | A rating is required. Rating `N` with verified KYC, no open invoices, no reserved pending orders, and exposure below the ₹50,000 new-customer cap can be allowed. | Rating `N`, known ₹100,000 credit limit, zero outstanding/open invoices, approved KYC, order value ₹3,150. |
| Pricing | `createOrderForRetailer` requires a price for every selected variant from the retailer tier or a retailer override. | Gold tier price for Gagan Toor Dal / 5 KG: ₹3,150 per case. |
| Inventory | `validateOrderInventory` requires a present, fresh, available WH-001 snapshot with enough quantity. | Existing seeded SAP-shaped stock: `SAP-MAT-TOOR`, WH-001, 420 available before the UAT order. |
| Order minimum | `AppConfig.minOrderValue` must not exceed the order total. | Existing staging minimum ₹2,500; UAT order ₹3,150. |
| Dispatch authorization | Every non-rejected Admin forward transition requires an active authorization. | Normal allowed order creation issued version 1; dispatch assignment consumed it as `used`. |
| Route / delivery | Dispatch assignment requires a valid order state, approved KYC, active authorization, and a route identifier. | Route `UAT-GOLDEN-PATH-AUDIT-ROUTE` supplied through the Admin dispatch API. |
| POD | Delivery requires every order line to have a delivery result and a used/active authorization. | One order line, one delivered case, OTP proof. |
| SAP customer mapping | Mock sales-order and invoice posting reject an empty SAP customer ID. | Mock connector includes the staging-only `SAP-CUST-UAT-1001` mapping; normal customer sync linked it by phone before drain. |
| SAP material mapping | Sales-order/invoice payloads require product SAP material IDs. | Selected product is mapped to `SAP-MAT-TOOR`. |
| SAP outbox | Authorized order creation or successful approval queues a sales-order item; delivery queues an invoice item. | Both items were present and drained through the mock connector. |

## Golden-path fixture

The fixture was created using normal application interfaces, not ad-hoc SQL:

- Retailer: `[UAT GOLDEN PATH] Sunrise Stores`
- Retailer ID: `80ee72d2-6d8e-416d-8cd3-aee3178a6381`
- Phone: `9812345698`
- Salesperson: `Ravi Kumar`
- Product: `Gagan Toor Dal / 5 KG`
- Variant ID: `b2e6954c-40d3-4419-b7b3-708cc1aa3175`
- Price: ₹3,150 per case
- Quantity: 1 case
- Order value: ₹3,150
- Order: `GGN-00000889`
- Order ID: `a36b256e-964c-4df4-a185-bec3fb86661d`
- External reference: `GGN-00000889`
- SAP customer: `SAP-CUST-UAT-1001`
- Warehouse: `WH-001`

The mock customer mapping is guarded by `SAP_MODE=mock` and is not used by the real SAP B1 Service Layer connector. No real SAP B1 credentials or production data were used.

## Observed transition evidence

| Step | Result |
|---|---|
| Catalog read | Product had a normal Gold price and fresh available stock. |
| Order creation | `creditDecision=allowed`, order created in `placed`, active dispatch authorization issued, sales-order outbox queued. |
| Admin read | Admin API returned the correct order, retailer, item, price, total, and status. |
| Confirm | Admin normal transition returned `confirmed`. |
| Pack | Admin normal transition returned `packed`. |
| Dispatch assign | Admin normal transition returned `out_for_delivery`; authorization changed to `used`; Delivery row created. |
| Delivery/POD | Admin normal POD returned `delivered`; invoice and ledger were created. |
| POD retry | Returned the same invoice ID; no second invoice was created. |
| SAP sales order | Mock drain stored `MOCK-SO-000889`, DocEntry `900889`, DocNum `910889`, and `sapSyncStatus=sent`. |
| SAP invoice | Mock drain stored one SAP invoice outbox result and marked the invoice outbox item `sent`. |
| Drain retry | Second drain returned `attempted=0`; no duplicate SAP sales order was created. |
| Final refresh | Admin/API/DB all returned delivered and SAP-sent state with the same order reference. |

The normal-path audit trail for the refreshed fixture records `order.confirmed`, `order.packed`, `dispatch.assigned`, `delivery.completed`, `sap.sales_order_synced`, and `sap.invoice_synced` against the order. The standard allowed credit path does not create an approval request; the credit decision is `allowed`, so there is no approval decision event to record for this scenario. KYC approval is separately recorded against its KYC case.

## Safe fixes required by the UAT run

The UAT run exposed two response/integration defects and no business-rule defects:

1. The Admin POD response included a Prisma `BigInt` ledger sequence, causing Express to return HTTP 500 after the delivery transaction had committed. The Admin response now serializes only that response object safely; stored financial values and calculations are unchanged.
2. Invoice outbox retries reused a payload captured before SAP customer linking. The outbox now rebuilds invoice payloads from current canonical retailer/product mappings before retry and stores the refreshed payload after success. This follows the existing sales-order reconciliation pattern and does not alter invoice totals or state transitions.

## Guard and isolation statement

- Business guards bypassed: **NO**.
- Business policy changed: **NO**.
- Audit records manufactured outside normal paths: **NO**.
- Direct Order insertion: **NO**.
- Direct DispatchAuthorization insertion: **NO**.
- Database reset/reseed: **NO**.
- Production SAP connection: **NO**.
- Fixture scope: local/staging mock only.
- Cleanup: the UAT fixture is intentionally retained for founder/staging review and is clearly named for later controlled removal.
