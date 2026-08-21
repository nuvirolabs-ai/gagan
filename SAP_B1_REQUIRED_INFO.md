# SAP Business One information required before live integration

The repository now has a typed Service Layer boundary, session-aware HTTPS client, pure mappers/parsers, and opt-in mocked tests. It intentionally does **not** contain a live SAP endpoint, credentials, or guessed field mappings. `SAP_MODE=service-layer` fails startup until the six required configuration values below are present.

## Required configuration values

Provide these through the deployment secret manager, never Git or a mobile build:

1. `SAP_B1_BASE_URL` — the exact HTTPS Service Layer base URL, including any agreed API version/path.
2. `SAP_B1_COMPANY_DB` — the exact CompanyDB value.
3. `SAP_B1_AUTH_MODE` — the supported authentication mode and its request/response rules.
4. `SAP_B1_USERNAME` — server-side technical account.
5. `SAP_B1_PASSWORD` — server-side technical account secret.
6. `SAP_B1_DEFAULT_WAREHOUSE` — the default warehouse only if SAP confirms one is valid for this tenant.

## Required contract details

- Login path, request fields, response shape, session cookie names and expiry/renewal behavior.
- Business Partner read path, CardCode field, active/frozen rules, customer-to-retailer matching and multiple-account behavior.
- Item read path, ItemCode field, active/inactive rules, UOM and pack/case semantics.
- Pricing read path, price-list/group fields, discount/special-price precedence, currency and tax semantics.
- Inventory read path, warehouse field, on-hand/committed/available semantics, freshness limits and multi-warehouse policy.
- Sales Order create path, response fields for DocEntry and DocNum, mandatory header/line fields, series, branch/BPL, ShipTo/PayTo, UOM and required UDFs.
- Exact external-reference field/query used to reconcile a committed order after a lost response.
- Delivery Note and Invoice paths, mandatory fields, document links and response identity fields.
- Financial summary/open invoices/ageing paths and authoritative formulas for outstanding, overdue, credit limit and available credit.
- Error payload shape, throttling limits, timeout guidance, retry safety and sandbox test data.
- SAP B1 sandbox/UAT URL, test CompanyDB, test CardCodes/ItemCodes, test warehouse values and an SAP operations owner for sign-off.

## What to send next

Send the values and documents above through a secure channel. Do not send production passwords in chat. After receipt, we will add an environment-specific endpoint/field mapping module, enable opt-in SAP sandbox tests, and run reconciliation/UAT. Until then, keep `SAP_MODE=disabled` (or `mock` only for local development).
