# Final product completeness audit

**Reviewed code:** `/Users/tanutejas/Documents/Gagan`  
**Branch:** `codex/gagan-staging`  
**HEAD:** `b88fe328189849859905336130126dcfd7b4713f` (`b88fe32`)  
**Remote staging:** `origin/codex/gagan-staging` @ `b88fe32` (in sync at audit start)  
**Do not audit:** nested `Gagan/`, uncommitted OTP WIP, old Desktop APKs, `origin/main` (`5d2bc0c`)

This audit was written **before** implementation in this pass. Later launch docs record what was then fixed.

---

## 0. Deployment truth

| Surface | Staging |
|---|---|
| Retailer backend | `https://gagan-staging-api.onrender.com` (`mobile/eas.json`) |
| Salesperson backend | `https://gagan-staging-api.onrender.com` (`rep/eas.json`) |
| Admin backend | `https://gagan-staging-api.onrender.com` (`admin/.env.example` / Vercel) |
| Admin UI | `https://gagan-staging-admin.vercel.app` |
| Database | Staging Postgres (Render), Prisma schema in `backend/prisma` |
| SAP | `SAP_MODE=mock` on staging; production forbids mock; service-layer is a contract stub |
| Android | EAS local/internal APK, `com.gagan.sales` / retailer package, Hermes bundle, no Metro |
| SMS / payments | Staging mock OTP `123456`, mock payment provider |

Working tree at audit start also contained **uncommitted OTP login WIP** and gitignore edits. Those are **not** part of `b88fe32` and must not be treated as shipped product.

---

## 1. Capability scorecard

Classification: **COMPLETE** · **COMPLETE WITH LIMITATION** · **PARTIAL** · **MISSING** · **DEFERRED BY DESIGN** · **BLOCKED BY SAP** · **NOT REQUIRED FOR V1**

### Platform

| Capability | Status | Notes |
|---|---|---|
| Single Retailer model | COMPLETE | `Retailer` + SAP account mapping |
| Single Order model | COMPLETE | `GGN-########` external ref, idempotent create |
| Single Product/SKU model | COMPLETE | Product + Variant + price list/overrides |
| Inventory snapshots | COMPLETE WITH LIMITATION | Warehouse-aware reads; no warehouse master or stock ops |
| Auth: retailer OTP | COMPLETE | Staging mock OTP |
| Auth: salesperson OTP | COMPLETE | Identity cache on network loss |
| Auth: admin password | COMPLETE | Cookie refresh + CSRF |
| RBAC / roles / delegations | COMPLETE | Backend is authority; some admin routes over-use `staff.manage` |
| Reporting tree / manager scope | COMPLETE | Field admin + sales leader scoped to subtree |
| IDOR isolation | COMPLETE | Retailer-own, assigned-rep, tenant tests |
| Rate limits | COMPLETE WITH LIMITATION | In-process Map, not Redis |
| Audit of staff/org changes | COMPLETE WITH LIMITATION | Org/staff mutations audited; not a full SIEM |
| Mock SAP connector | COMPLETE | Staging pull/post/outbox |
| Real SAP B1 | BLOCKED BY SAP | Service Layer skeleton, no credentials/field maps |
| Real SMS | CONFIGURATION NEEDED | Only mock adapter registered |
| Real payments | CONFIGURATION NEEDED | Only mock adapter; retailer Pay always confirms mock |
| Object storage | COMPLETE WITH LIMITATION | Local on staging; S3 required in production env |
| Background worker | COMPLETE | Separate `worker.ts`; staging can run jobs in API |
| Procurement / PO / GRN | NOT REQUIRED FOR V1 | Absent; SAP will own buying |
| Warehouse pick/pack desk | NOT REQUIRED FOR V1 | Fulfilment is admin order pipeline, not WMS |
| Background GPS | DEFERRED BY DESIGN | Foreground pings only |
| LMS / gamification / Bluetooth print / face ID | NOT REQUIRED FOR V1 | Explicitly out of scope |

### Retailer app

| Capability | Status | Notes |
|---|---|---|
| OTP login / logout | COMPLETE | |
| Session recovery after kill | PARTIAL | Tokens kept; **UI dumps to Login if `/me` fails for any non-auth reason** |
| Home | COMPLETE | |
| Catalogue / search / category | COMPLETE | Fetch failure currently looks like empty |
| Product / pack / UOM | COMPLETE | Failed load = infinite spinner |
| Cart | COMPLETE WITH LIMITATION | Persisted; **local ₹250 delivery fee is not on the order** |
| Server pricing | COMPLETE | Catalog/home/order totals |
| Schemes | PARTIAL | Banner only; schema says read-only v1 |
| Credit / outstanding | COMPLETE | Local gate + server 402 |
| Checkout | COMPLETE | Online, idempotent; must not succeed offline |
| Order history / detail | COMPLETE | |
| Payments / UPI | COMPLETE WITH LIMITATION | Mock settlement only (provider not connected) |
| Ledger | COMPLETE | Same financial-summary contract |
| Store geolocation | COMPLETE | Capture / verify / change-request |
| Assigned salesperson | COMPLETE | Call / WhatsApp |
| Notifications | DEFERRED BY DESIGN | Badge + dead icon; centre not built |
| Offline order queue | DEFERRED BY DESIGN | Orders must not pretend success |

### Salesperson app

| Capability | Status | Notes |
|---|---|---|
| Field day (start/end, route, visit, next) | COMPLETE | GPS; selfie unused |
| Check-in geo verification | COMPLETE | Needs verified store location |
| Order for assigned retailer | COMPLETE | |
| Collections submit | COMPLETE | Confirm is accounts; visit Collect does not prefill retailer |
| Activity log | COMPLETE WITH LIMITATION | Queued offline; **any error currently queued as offline** |
| Issues / expenses / leave / tasks | COMPLETE | Review is admin |
| Add retailer proposal | COMPLETE | Not a live customer create |
| Performance / targets | COMPLETE | |
| Attendance history | COMPLETE | My Day |
| Customer map | COMPLETE WITH LIMITATION | Sorted list + `geo:` not a map SDK |
| Offline identity | COMPLETE | 7-day cache |
| Offline queue | COMPLETE WITH LIMITATION | Activities + location pings only |
| Manager team OS in the sales app | NOT REQUIRED FOR V1 | Managers use Admin sales leader + field pages |
| Recovery desk in the sales app | NOT REQUIRED FOR V1 | Recovery is Admin |

### Admin / employee OS

| Capability | Status | Notes |
|---|---|---|
| Attention home | MISSING | Overview is **hardcoded demo** (shoes, Ananya, Aug 2026) |
| Warehouses | MISSING | Re-renders the same demo dashboard |
| Order fulfilment (approve/pack/assign/POD) | COMPLETE WITH LIMITATION | Works; `dispatch.execute` unused; route id is typed |
| Credit approvals (2nd/3rd invoice) | COMPLETE | Step-up OTP |
| Collection confirm | COMPLETE | Step-up |
| KYC review | COMPLETE | |
| New-retailer proposals | COMPLETE | Parallel “onboard retailer” bypasses the field story |
| Field routes/tasks/targets | COMPLETE | |
| Leave / expenses / issues | COMPLETE WITH LIMITATION | Issue has no Close; expense does not post ledger |
| Recovery calls/promises | PARTIAL | Cannot mark promise kept/missed in UI |
| Legal letters | COMPLETE WITH LIMITATION | Split from Recovery by permission |
| Staff / roles / org | COMPLETE | |
| SAP status / outbox / retry | PARTIAL | **API exists, no Admin UI** |
| Inventory operations | VIEW only | Snapshots from SAP sync |
| Procurement | NOT REQUIRED FOR V1 | |
| Credit enforcement activate | PARTIAL | API, no UI (dangerous; do not enable casually) |

---

## 2. Dead-end workflow table

| Object | Current state | Responsible role | Available action | Next state | Gap? |
|---|---|---|---|---|---|
| Order `placed` | Visible in Order queue | `staff.manage` | Approve / reject | confirmed / rejected | No (credit holds also on Approvals) |
| Order `confirmed` | Queue | `staff.manage` | Pack | packed | No WMS, but next action exists |
| Order `packed` | Queue | `staff.manage` | Assign route string | out_for_delivery | Weak (not a live route list) |
| Order `out_for_delivery` | Queue | `staff.manage` | POD | delivered + invoice | No photo capture in UI |
| Inventory shortage | Shown at checkout as reject | Shop / salesperson | Change qty or wait | — | Operational reorder is SAP |
| Expense `submitted` | Field expenses | `expense.review` | Approve / reject | decided, not ledgered | Documented limitation |
| Retailer proposal | New retailers | `retailer.proposal_review` | Approve / reject | pending_kyc customer | No |
| Service issue | Service issues | `issue.review` | Start / resolve / reject | resolved | Close unused |
| SAP outbox `failed` | API only | `staff.manage` | retry/drain **if you know the API** | pending | **Yes — no UI** |
| Credit shadow mismatch | Credit reviews | CTL | None in UI | disposition | Yes |
| Recovery promise | Recovery | credit | Create only | kept/missed API unused | Yes |
| Admin Overview | Demo metrics | anyone with staff.manage | None real | — | **Yes — misleading** |

---

## 3. P0 / P1 / P2 decisions (pre-implementation)

### P0 — cannot safely call V1 complete (non-SAP)

1. **Retailer cold start with no signal shows Login** despite stored tokens (`mobile/src/context/AuthContext.tsx`). Sales app already solves this.
2. **Cart invents a ₹250 delivery fee** and uses it for credit; backend order total is line items only.
3. **Admin Overview/Warehouses present demo consumer goods as live SAP.** Employees cannot trust the operating system home.

### P1 — material, small/clear enough to fix in this pass

- Product detail infinite spinner on error.
- Catalog / orders / ledger treating network error as empty.
- Dead chevrons on Home notifications / schemes / offers.
- Sales `logActivity` queues 4xx as offline.
- Visit Collect does not pass `retailerId`.
- Activity “Performance” deep link ignored after first mount.
- Admin: grouped OS navigation, live Work home, SAP outbox workspace, `.alert` CSS, promise kept/missed, issue close, route permission guards.

### P2 / P3 — do not implement now

- Notification centre, scheme engine, real UPI, map SDK, selfie attendance, procurement, WMS pick/pack, credit enforcement activation, background GPS, LMS.

### SAP (known blocker, not a surprise bug)

- No Service Layer credentials, endpoints, or field maps.
- Do not classify this as an unexpected product defect.

---

## 4. Cross-app consistency (design)

Canonical contracts already exist for:

- Order identity (`GGN-########`, CardCode/ItemCode/warehouse on SAP payload)
- Financial summary (home, dues, ledger, admin, salesperson)
- Inventory availability at checkout
- Store location verification

Expected residual mismatches **before this pass:** retailer cart payable vs invoice (delivery fee). Mock SAP DocEntry/DocNum appear after drain in staging.

---

## 5. Security (summary)

| Check | Result |
|---|---|
| Retailer A vs B | Own-resource queries + ledger 403 |
| Salesperson A vs B | Assigned retailers; unassigned 404 |
| Manager tree | Field admin + sales leader scoped |
| Admin roles | Nav filtered; **routes not guarded** (API 403) |
| OTP | Attempt/IP caps; mock in staging |
| Secrets | Not in mobile EAS env (API URL only) |
| SAP errors | Mapped codes + request id, not raw connector |
| Rate limits | Present, process-local |

---

## 6. Offline matrix

| Action | Offline |
|---|---|
| Retailer browse cached cart | Works (stale prices until reconcile) |
| Retailer place order / pay | Requires internet; no fake success |
| Sales identity UI | Cached 7 days |
| Sales activity / GPS pings | Queued |
| Sales start day / check-in / order / collect / expense / issue / leave / KYC | Requires internet; honest errors |

---

## 7. Visual posture (pre-pass)

| App | Direction | Remaining |
|---|---|---|
| Retailer | Accepted language in `theme.ts` | Confirmation/tracking off-theme; loading/error holes |
| Salesperson | Field Companion accepted (`b88fe32`) | Do **not** redesign; polish secondary screens only |
| Admin | Cream tokens exist but IA is a 23-link CRUD list + vanity home | Needs OS grouping, live Work, table density, no fake SAP |

---

## 8. Belief check

**Most of the commercial + field product is complete** for a mock-SAP staging pilot.

It is **not** complete as an employee operating system until the Admin home is real, SAP outbox is operable from the UI, and the retailer session/cart defects above are gone.

Procurement, live B1, live UPI, and live SMS are **not** missing V1 modules in the sense of forgotten features — they are external/config/SAP workstreams.

---

## 9. After this pass (implementation note)

The P0/P1 items named above were implemented on this branch:

- Retailer identity cache on `/me` network failure
- Cart payable = line total (delivery “Included”)
- Admin Work home is live; `/warehouses` redirects to SAP sync
- SAP outbox UI with retry/drain
- Recovery promise kept/missed; issue Close
- Honest load/error states on catalogue, orders, product, ledger, tracking
- Order references displayed as `GGN-########` to match the outbox
- Sales activity 4xx no longer queued as offline; Collect prefills retailer; Visit on order-capable staff

See `FINAL_LAUNCH_READINESS.md` for scores after those fixes.
