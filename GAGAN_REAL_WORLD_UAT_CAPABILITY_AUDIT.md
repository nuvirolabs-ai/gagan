# Gagan Real-World UAT — Capability and Contract Audit

This audit classifies the original requested scenarios against Gagan's actual
routes, source, and approved operating model. Dogkart procurement, warehouse,
and fulfillment assumptions were not imported into Gagan.

## Classification rules

- **IMPLEMENTED AND TESTABLE** — a real Gagan route/action exists and was
  exercised or covered by the named automated contract test.
- **IMPLEMENTED BUT CURRENTLY BLOCKED** — the Gagan capability exists, but a
  safe precondition or external interaction prevented this run.
- **PRODUCT CAPABILITY GAP** — the requested scenario requires a route/action
  that is not present in the approved Gagan source; this is not relabeled as a
  failed test.
- **NOT APPLICABLE TO GAGAN'S APPROVED MODEL** — the scenario is a Dogkart or
  other-product concept with no corresponding Gagan business contract.
- **NOT RUN** — the route exists or applicability is plausible, but this run did
  not execute it.

## Capability map

| Scenario | Classification | Gagan evidence / precise boundary |
|---|---|---|
| OTP login/session restoration | IMPLEMENTED AND TESTABLE | `/auth` and staff/rep identity routes; native local and exact hosted-release Salesperson launch/restore exercised; Retailer native local flow exercised |
| Retailer catalog, cart, order review, submit | IMPLEMENTED AND TESTABLE | `/catalog`, `/orders`; native local Retailer flow created GGN-00000041 |
| Salesperson assigned retailers, route, visit, catalog, order | IMPLEMENTED AND TESTABLE | `backend/src/routes/rep.ts` (`/rep/retailers`, `/:id/catalog`, `/orders`) plus `/rep/field`; native local flow created GGN-00000040 |
| Admin order queue and lifecycle | IMPLEMENTED AND TESTABLE | `backend/src/routes/admin/orders.ts`; local Admin browser approved, packed, assigned, delivered both fresh orders |
| POD and delivered invoice | IMPLEMENTED AND TESTABLE | `POST /admin/dispatch/:orderId/pod`; native Retailer details showed delivered weight, invoice, route and POD; Admin UI captured delivery |
| Salesperson delivered visibility | IMPLEMENTED BUT CURRENTLY BLOCKED | Timeline renders delivered status for GGN-00000040; a dedicated separate Salesperson order-detail route/action was not evidenced and should be treated as a UX gap if required |
| Mock SAP mapping and outbox retry | IMPLEMENTED AND TESTABLE | `/admin/sap/status`, `/sync`, `/outbox/drain`; Mahesh mapped path sent, Patel unmapped path remained pending with explicit guard error |
| Data Import Center | IMPLEMENTED AND TESTABLE | `backend/src/routes/admin/imports.ts` exposes types/templates/preview/apply/errors; no fresh native import mutation was run in this UAT |
| Retailer credit/ledger/ageing | IMPLEMENTED AND TESTABLE | Admin retailer ledger/ageing/payment routes exist; fresh collection mutation was not run |
| Collections / partial and final payment | IMPLEMENTED BUT CURRENTLY BLOCKED | `backend/src/routes/admin/retailers.ts` and `backend/src/routes/payments.ts` exist; no fresh collection scenario was authorized against the UAT fixture in this run, and both golden-path invoices remain open |
| Approval/rejection | IMPLEMENTED AND TESTABLE | Admin order approve/reject routes and approval modules exist; approve was exercised, fresh rejection was not |
| Authentication and role authorization | IMPLEMENTED AND TESTABLE | authenticated Admin/retailer/rep identities used; automated tenant/permission tests cover protected cross-scope routes |
| Offline/outbox | IMPLEMENTED AND TESTABLE | Rep offline outbox tests and field API tests cover enqueue/replay/idempotency; physical disconnected-device replay was not run |
| Attendance, More modules, reports | IMPLEMENTED AND TESTABLE | native Salesperson screens captured Attendance, More, Outlets, Timeline, Performance; separate mutation coverage is listed as not run where applicable |
| Shortage/replenishment/procurement | PRODUCT CAPABILITY GAP | no Gagan `/procurement`, supplier, receiving, replenishment, or shortage-fulfillment route/action was found in `backend/src/app.ts` or the mounted route inventory |
| Supplier/price handling | PRODUCT CAPABILITY GAP | Gagan catalog/price-list routes exist, but no supplier procurement workflow exists in the approved source |
| Partial receiving | PRODUCT CAPABILITY GAP | no receiving route/action in the approved Gagan route inventory |
| Actual picking / short pick / invalid pick quantity | PRODUCT CAPABILITY GAP | Gagan exposes Admin `pack`, not a separate warehouse picking/short-pick contract; Dogkart warehouse semantics were not imported |
| Multiple fulfillment/delivery jobs / multi-wave | PRODUCT CAPABILITY GAP | no Gagan multi-wave fulfillment route/action found |
| Multi-warehouse scope | NOT APPLICABLE TO GAGAN'S APPROVED MODEL | the exercised Gagan model uses the canonical Admin dispatch route and mock SAP inventory snapshot; no approved multi-warehouse contract was found |
| Dispatch and POD | IMPLEMENTED AND TESTABLE | Admin dispatch assignment and POD routes were exercised natively in Admin browser |
| Failed delivery and retry | NOT RUN | the canonical POD route exists, but no safe failed-delivery/retry fixture was prepared |
| Cancellation before dispatch | PRODUCT CAPABILITY GAP | no cancellation route/action was found in the approved Gagan mounted route inventory |
| Returns and physical receipt | PRODUCT CAPABILITY GAP | no Gagan return/receipt route/action was found |
| Invoice and outstanding | IMPLEMENTED AND TESTABLE | delivered orders created invoices and open receivables; read-only DB verification showed two invoices totaling ₹12,600 and ₹12,600 outstanding |
| Credit hold | IMPLEMENTED BUT CURRENTLY BLOCKED | credit context and dispatch authorization guard exist; a dedicated blocked-credit mutation was not run |
| Import preview/apply | NOT RUN | implemented route exists, but no fresh import file mutation was used in this UAT |
| SAP retries | IMPLEMENTED AND TESTABLE | mapped and unmapped outbox drain behavior exercised; mapped Mahesh sent, Patel remained reconciliation-required |
| Audit trail | IMPLEMENTED AND TESTABLE | read-only `AuditEvent` query showed confirm, pack, dispatch, delivery, and mapped SAP sync entries for the two orders |

## Permissions evidence

This is not overstated as a missing-token-only result.

- `backend/src/routes/__tests__/tenantIsolation.test.ts` covers retailer A
  being denied retailer B orders/ledger and a rep being denied an unassigned
  retailer/order: **AUTOMATED INTEGRATION — PASS**.
- `backend/src/modules/identity/__tests__/permissions.test.ts` covers missing
  permissions/client-role filtering: **AUTOMATED INTEGRATION — PASS**.
- `backend/src/modules/collections/__tests__/collectionService.test.ts`
  covers collection permission and step-up requirements:
  **AUTOMATED INTEGRATION — PASS**.
- Authenticated Admin, Retailer, and Salesperson personas were used for the
  native/browser golden paths. A dedicated cross-persona mutation attempt was
  not run in the UI: **NOT RUN**, not silently inferred from `401`.

## Inventory and finance invariants observed

Read-only verification after the two fresh native golden paths found:

- both orders were `delivered`;
- each had `qtyOrdered=2`, `qtyDelivered=2`, and `weightDelivered=60.000`;
- both line prices were ₹3,150 and both order totals were ₹6,300;
- all 8 local inventory snapshot rows had non-negative `onHand`, `committed`,
  and `available`; all 8 satisfied `available = onHand - committed`;
- the two invoices totaled ₹12,600 and remained open with ₹12,600 outstanding;
- no Payment rows existed, so no payment was falsely inferred from delivery;
- the mapped Mahesh order reached `sapSyncStatus=sent` with
  `MOCK-SO-000041`; the unmapped Patel order remained
  `reconciliation_required` with the expected mapping error.

This is observed-slice evidence, not a claim of global hosted inventory or
financial invariants. A before/after warehouse conservation test, receiving,
short-pick, collection allocation, and return reversal remain **NOT RUN** or
**PRODUCT CAPABILITY GAP** as classified above.
