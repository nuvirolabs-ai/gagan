# SAP Business One handoff

The app currently has a mock connector and a disabled/service-layer placeholder. No real SAP credentials have been added. SAP team should provide the following values through the secret manager, not Git or mobile builds.

| # | Required value | Why / consumer |
|---:|---|---|
| 1 | Service Layer base URL, including `/b1s/v2` | Backend connector endpoint |
| 2 | CompanyDB | Login payload |
| 3 | SAP technical username | Server-side login |
| 4 | SAP technical password/secret | Server-side login |
| 5 | Environment/tenant identifier | Routing and audit |
| 6 | TLS certificate/CA requirements | Secure HTTPS connection |
| 7 | Login/session TTL and concurrency limits | `B1SESSION` renewal and worker behavior |
| 8 | Business Partner CardCode field and customer status rules | Retailer ↔ CardCode mapping |
| 9 | Customer price-list/group field | Pricing sync and checkout revalidation |
| 10 | ItemCode field and active/inactive rules | Product ↔ ItemCode mapping |
| 11 | WarehouseCode per territory | Warehouse-aware inventory and order payload |
| 12 | Inventory endpoints and committed/open-order semantics | Inventory snapshots |
| 13 | Price list, discount and special-price endpoints | Effective price calculation |
| 14 | Invoice/open-balance and ageing endpoints | Unified financial summary |
| 15 | Sales Order required fields, UDFs and series | `POST /Orders` payload |
| 16 | External reference UDF/search field | Duplicate-safe `GGN-########` reconciliation |
| 17 | Ship-to/address code rules | Checkout delivery mapping |
| 18 | Delivery Note endpoint and required fields | Field fulfilment posting |
| 19 | Error catalog, throttling and retry guidance | Safe mapping and backoff |
| 20 | Sandbox test company, sample CardCodes/ItemCodes and approval rules | UAT fixtures |

## Acceptance tests before enabling real SAP

- Login, session expiry/re-login and timeout behavior.
- Customer, item, price, warehouse stock and invoice sync with known fixtures.
- Order payload contains CardCode, ItemCode, Quantity, WarehouseCode, ShipToCode, required UDFs and external reference.
- Simulated response loss after SAP commit: retry searches by external reference and creates no duplicate.
- 400/401/500, malformed response, missing DocEntry/DocNum and throttling map to safe app errors and outbox states.
- DocEntry and DocNum are stored and match SAP UI; retailer, salesperson and admin show the same order.
- Reconciliation and rollback drill completed with SAP operations owner sign-off.

Until these tests pass, keep `SAP_MODE=disabled` in production and do not claim SAP-ready status.
