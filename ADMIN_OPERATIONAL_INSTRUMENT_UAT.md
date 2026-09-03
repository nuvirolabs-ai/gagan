# Operational Instrument UAT record

## Environment

| Surface | Local QA target |
| --- | --- |
| Admin | `http://127.0.0.1:5188/` |
| Backend | `http://127.0.0.1:4000` |
| Database | Local Gagan development PostgreSQL, read through the existing backend |
| Admin test identity | `admin@gagan.test` / `admin123` |
| Data mode | Local seeded/canonical test data; not production |

The Admin was started with the same-host API URL
`http://127.0.0.1:4000` so the browser's refresh-cookie flow remains
same-site during direct detail-route QA. No source environment file was
modified.

## Core scenarios

| Scenario | Result | Evidence |
| --- | --- | --- |
| Login and auth-loading geometry | PASS | Login succeeded; stable skeleton shell is implemented in `App.tsx` |
| Work/Home loads | PASS | Home screenshot set and DOM inspection |
| Home business flow | PASS | Six-stage current-state flow reads from order queues |
| Home blocked/impact view | PASS | Current-state value links resolve to existing queues |
| Home pace/trend | PASS | Uses a cumulative same-day series from canonical `createdAt` values when available; current staging data has no same-day rows, so a deterministic staging-only presentation curve is derived from the current canonical order population and ends at that total |
| Home queue ageing | PASS | Age buckets are derived from current order timestamps |
| Home healthy state | PASS | SAP clear/healthy state observed in current data |
| Orders stage rail | PASS | Six current status queues loaded together |
| Orders operational table | PASS | Real `GGN-00000493` and current seeded orders visible |
| Selected row via keyboard | PASS | First row accepted Enter and remained selected |
| Selected order workspace | PASS | Health matrix, journey, items, dependency, related context, activity, action dock visible |
| Empty queue | PASS | Rejected queue displayed “The queue is clear” state |
| Detail route: retailer ledger | PASS | `/ledger/:retailerId` loaded with `Ledger` heading |
| Detail route: staff access | PASS | `/staff/:staffId` loaded with staff heading |
| Compatibility route | PASS | `/warehouses` redirected to `/sap` and loaded `SAP sync` |
| Navigation route sweep | PASS | 23 permission-visible nav routes loaded with expected headings |
| Browser console errors | PASS | No error-level entries observed after route sweep |

## Screenshot evidence

Core surfaces were captured from the final implementation at the required CSS
viewports:

```text
docs/admin-operational-instrument-qa/final-home-1440x900.png
docs/admin-operational-instrument-qa/final-home-1280x800.png
docs/admin-operational-instrument-qa/final-home-1024x768.png
docs/admin-operational-instrument-qa/final-orders-1440x900.png
docs/admin-operational-instrument-qa/final-orders-1280x800.png
docs/admin-operational-instrument-qa/final-orders-1024x768.png
docs/admin-operational-instrument-qa/final-workspace-1440x900.png
docs/admin-operational-instrument-qa/final-workspace-1280x800.png
docs/admin-operational-instrument-qa/final-workspace-1024x768.png
docs/admin-operational-instrument-qa/final-orders-empty-1440x900.png
docs/admin-operational-instrument-qa/final-home-healthy-1440x900.png
docs/admin-alignment-qa/home-visual-read-1440x900.png
docs/admin-alignment-qa/home-visual-read-1280x800.png
docs/admin-alignment-qa/home-visual-read-1024x768.png
```

All permission-visible route screenshots at the browser's current laptop
viewport are under:

```text
docs/admin-operational-instrument-qa/routes/
```

The browser provider's physical image can be narrower than the requested CSS
viewport. QA also checked `window.innerWidth`, document width, and body width;
at the 1280 check they were all 1280px, and no accidental document-level
horizontal overflow was present.

## Non-mutating QA boundary

The browser QA selected rows and changed filters only. It did not approve,
reject, pack, assign, capture POD, change prices, alter staff access, or invoke
SAP sync actions. Existing mutations remain available to authorized employees;
they were not used as part of this visual-readiness pass.
