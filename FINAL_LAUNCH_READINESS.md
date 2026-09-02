# Final launch readiness

**Code reviewed:** `codex/gagan-staging` through the accepted SFA capability-depth commits.
**Accepted SFA commits:** `f8a308d`, `9374755`, `920f59b`.
**Do not merge main. Do not deploy production automatically.**

Staging at freeze:

| Surface | Value |
|---|---|
| Branch | `codex/gagan-staging` |
| API | `https://gagan-staging-api.onrender.com` |
| Admin | `https://gagan-staging-admin.vercel.app` |
| SAP | `SAP_MODE=mock` |
| Android | Standalone EAS APKs from `f99a651`; salesperson `com.gagan.sales`; retailer `com.gagan.retailer` |

## Scores

| Area | /100 | Notes |
|---|---:|---|
| Retailer App | 88 | Order loop complete; session survives network loss; cart total matches server |
| Salesperson App | 90 | Field Companion accepted; money online-only by design |
| Admin | 86 | Live Work home, order workspace, SAP outbox; not a WMS |
| Backend | 91 | Strong contracts; mock adapters in staging |
| Security | 88 | IDOR + RBAC; in-process rate limits |
| Data consistency | 92 | One retailer/order/SKU; order refs now 8-digit `GGN-########` |
| Operations | 85 | Employees can act on core queues including SAP retry |
| Physical-device readiness | 82 | Approved SFA capability-depth surface accepted on a physical Motorola E13 Android handset; broader device checklist and fresh iOS pass remain open |
| Production infrastructure | 55 | Checklist exists; secrets/SMS/pay/SAP not provisioned |
| SAP readiness | 45 | Mock + outbox UI; credentials and field maps missing |

**NON-SAP PRODUCT READINESS: 88 / 100**  
**OVERALL INCLUDING SAP: 70 / 100**

## Recommendation

**READY FOR SAP UAT** on staging mock, after this branch is deployed.

Production shoppers still need real SMS + real payments. ERP still needs Business One credentials. Those are configuration/SAP workstreams, not missing V1 modules.

## Tests (this pass)

| Package | Result |
|---|---|
| Backend | 103 files, 766 tests passed; typecheck passed |
| Retailer | 12 files, 35 tests passed; typecheck passed |
| Salesperson | 17 files, 89 tests passed; typecheck passed |
| Admin | 18 files, 48 tests passed; typecheck + lint passed |

## V1 FEATURE FREEZE

The Salesperson V1 surfaces are frozen at the accepted SFA capability-depth
pass:

- SALESPERSON FUNCTIONAL V1 — FROZEN
- SALESPERSON VISUAL V1 — FROZEN
- SFA CAPABILITY DEPTH V1 — FROZEN

Do not add further SFA/Bizom-reference capabilities. Salesperson App changes
are allowed only if:

- a launch-critical defect is discovered, or
- physical iOS QA exposes a real defect, or
- SAP Business One UAT reveals a required integration change.

Do not start Procurement, WMS, notification centre, or a scheme engine.  
Do not connect real SAP B1 without the SAP handoff.  
Do not merge `main`.  
Do not deploy production.

Allowed after freeze: staging verification, launch-critical defect fixes, SAP integration work from the handoff, and production configuration (SMS, payments, secrets).

## Staging verification (`f99a651`)

| Check | Result |
|---|---|
| Git push `codex/gagan-staging` → origin | PASS (fast-forward `b88fe32..f99a651`) |
| Render `/health` and `/health/ready` | LIVE `{"ok":true}` |
| Hosted Admin Work / Orders / SAP desk | LIVE against staging API |
| Mock SAP desk (view / retry / drain) | PASS — UI retry moved a failed row to pending |
| Cross-system order `GGN-00000024` | PASS |
| Retailer APK | `/Users/tanutejas/Desktop/gagan-retailer-f99a651.apk` |
| Salesperson APK | `/Users/tanutejas/Desktop/gagan-sales-f99a651.apk` |
| Physical retailer smoke | NOT RUN (no Android device attached) |
| Physical salesperson smoke | PASS for the approved SFA capability-depth surface on Motorola E13; broader device checklist remains open |

**NON-SAP PRODUCT READINESS: 88 / 100**  
**READY FOR SAP B1 UAT: YES**

Remaining blocker before live SAP: Service Layer credentials and field maps. Mock outbox failures for retailers without a CardCode (for example `GGN-00000023`) are expected until B1 UAT.

Admin staging builds must bake `VITE_API_URL=https://gagan-staging-api.onrender.com`. That is recorded in `admin/vercel.json` so a Vercel rebuild cannot ship a blank Admin.

## Known limitations (not freeze blockers)

- Expense approval does not post ledger
- Dispatch route selection is not a live route list
- Schemes are display-only
- Notification centre is intentionally absent
- Credit enforcement activation has API but no UI
- Real SAP B1 is not connected
- Real SMS / payment providers are not configured |

The remaining documented UAT limitation is a fresh Start My Day → EOD note →
End My Day mutation sequence using a clean UAT identity. The next engineering
workstream is real SAP Business One UAT after the SAP team provides Service
Layer credentials and field mappings.
