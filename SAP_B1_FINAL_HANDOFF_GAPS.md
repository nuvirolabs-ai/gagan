# SAP B1 final handoff gaps

Real SAP Business One is a **known separate workstream**. This file is the plug-in checklist, not a claim that B1 is live.

Staging today: `SAP_MODE=mock`. Production must not use mock.

## Ready in code

- Connector factory (`mock` / `disabled` / `service-layer`)
- Outbox (`sales_order`, `invoice`) with retry, drain, admin UI (`/sap`)
- External reference `GGN-########`
- CardCode / ItemCode / warehouse fields on mapping types
- Sync watermarks for customers, materials, pricing, stock
- Safe client errors (no raw Service Layer strings)

## Still required from SAP team

See `SAP_B1_HANDOFF.md` and `SAP_B1_REQUIRED_INFO.md`: Service Layer URL, CompanyDB, technical user, TLS, CardCode/ItemCode/warehouse/price-list/invoice/order UDF contracts, sandbox fixtures.

Until those exist, `service-layer` fetch methods reject with “endpoint not configured”.

## Do not treat as a product bug

“Real SAP not connected” is expected. Mock drain on staging is the current UAT path.
