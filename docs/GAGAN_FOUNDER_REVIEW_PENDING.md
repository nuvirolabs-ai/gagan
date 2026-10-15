# GAGAN founder review pending

**Status: FOUNDER REVIEW CANDIDATE.** This is a product-experience review, not final acceptance or production readiness. Current ledger: **23 PASS, 13 PARTIAL, 0 BROKEN, 0 MISSING_UI, 6 BUSINESS_BLOCKED, 4 DEFERRED**. The paths below identify screens you can open; they do not claim every transaction has completed hosted acceptance.

## 1. What I can use now

**Retailer**
- Home -> Products (20-item Home preview; full 52-item catalogue) -> Product Detail -> Add -> Cart -> Review.
- Home -> Orders -> Order Detail -> Back; Pay/Ledger for balances and payment history; Account for profile and salesperson feedback; Service requests.

**Salesperson**
- Home -> My Day -> assigned Outlets -> Outlet Detail -> Visit, Store Intelligence, Outstanding, catalogue/order activity.
- Home -> Routes/My beats; Reports/My activity -> Order Detail; More -> Add a store, Expenses, Service issues and Collections where permitted.

**Sales Leader**
- All personal Salesperson surfaces above remain available.
- Home -> Team Today -> Team Performance -> permitted Member Detail. Personal work and team performance are separate; opening a member does not switch identity.

**Admin**
- Work -> Approvals, Collections, Warehouse orders (queue, filters and detail).
- Sales -> Orders, Retailers, New retailers, Organisation/Sales leader, Catalog and Commercial.
- Field -> Team & leave, Routes & tasks, Expenses, Issues, Feedback and Visits.
- Finance -> Ledger; System -> Users & roles and Data import. Availability of a screen does not authorize changing disputed balances or live financial records.

## 2. Things I need to decide

Recommendations are proposals, not decisions already made.

| ID | Decision needed | Recommended option | Alternatives | Consequence |
|---|---|---|---|---|
| PAY-04 | Which collection methods need a customer-bound OTP, and at what stage? | All cash, cheque, NEFT and UPI at field submission. | Cash only at submission; selected methods at Accounts confirmation. | Stronger customer acknowledgement, but an extra delivery/consent step and possible delay. |
| PAY-05 | Are Mahesh's three opening entries collectible, and what is each entry's Jain/Padam allocation? | Keep disputed/under review until source documents reconcile them. | Approve collectible entries with source invoices and an explicit split; or approve audited noncollectible normalization. | Payment guards stay in place until evidence supports a separately reviewed correction. No split or collectibility is assumed. |
| SAL-01 | What unit defines quantity targets, and how do old lines without reliable snapshots count? | Kilograms from immutable pack snapshots; older unsnapshotable lines unavailable. | Cases with legacy excluded; kilograms with an approved legacy conversion table. | Enables a consistent volume target without inventing historical quantities. |
| ROUTE-01 | How does an approved reusable beat become dated routes? | Manager applies it manually to selected dates. | Auto-generate on weekdays within a horizon; auto-generate every N days within a horizon. | Fewer surprise assignments, with more manager scheduling. Self-created beats still require manager approval before activation. |
| GEO-01 | What staff base may be used for distance, who sees it, and how long is it retained? | Company-assigned work base, manager/employee access, with an owner-set retention period. | Consented home coordinate with retention; no base-distance feature. | Avoids collecting home location but requires an approved base source and privacy rules. |
| OTP-01 | Which real message channel/provider is approved? | Keep mock-only staging now; approve MSG91 SMS before real-user use. | MSG91 SMS now; SMS with separately approved WhatsApp fallback. | No real messages are sent in current review; provider credentials/templates and delivery proof remain needed. |
| EXP-01 | Which wider exports, formats, fields, filters and roles should be allowed? | Approve an owner-selected subset, starting with Orders and Visits/Routes after field-level privacy review. | All proposed modules in stages; or service-issue Excel and existing utilities only. | Wider downloads remain unavailable until scope is approved. Proposed choices include Orders, Retailers, finance, performance, visits/routes, staff operations, targets, catalogue and surveys; Excel/CSV, scoped filters and roles would be reviewed per module. |

**PAY-05 source dispute:** ₹18,500 (`b3817a6c`), ₹22,000 (`05a9c3ae`) and ₹21,912 (`26df9cb0`), **total ₹62,412**. These are legacy ledger entries without matching canonical invoices/orders or an authoritative Jain/Padam split. The cached ₹62,412 balance reconciles to the three entries, while the six bridged canonical invoices are paid to ₹0. That discrepancy does not establish collectibility.

## 3. Not yet confirmed

The 13 current PARTIAL rows are below. The last column names the primary remaining gate, not a missing screen.

| ID | Feature | What already works | What is still unconfirmed | Gap class |
|---|---|---|---|---|
| GGN-VIS-01 | Check-in/recovery | Existing visit recovers with a location warning; invalid/cross-assignment requests are denied. | Valid-distance and duplicate check-in on a safe synthetic visit. | FIXTURE_ACCEPTANCE |
| GGN-VIS-02 | Checkout/next store | Visit workflow exists locally. | Hosted checkout and next-stop readback on a safe visit. | FIXTURE_ACCEPTANCE |
| GGN-VIS-03 | Outcome/follow-up | Outcome workflow exists locally. | Hosted follow-up and app readback on a safe visit. | FIXTURE_ACCEPTANCE |
| GGN-ORD-01 | Punched vs created | Order/cart screens and milestone model exist. | Controlled order creation and milestone readback across roles. | FIXTURE_ACCEPTANCE |
| GGN-ORD-02 | Pending retailer demand | Add a store and Admin proposal queue open. | Safe proposal, pending intent, decision and conversion path. | FIXTURE_ACCEPTANCE |
| GGN-PAY-01 | Payment evidence | Camera/image controls and local upload behavior exist. | Hosted attachment persistence, retrieval and ownership on a synthetic record. | FIXTURE_ACCEPTANCE |
| GGN-PAY-02 | Collection detail | Scoped detail flow passes local integration. | Positive hosted detail and unrelated-scope denial on synthetic data. | FIXTURE_ACCEPTANCE |
| GGN-PAY-03 | Collector access | Denial before grant and local grant/revoke tests pass. | Temporary staging grant/revoke, unrelated-scope denial and phone role refresh. | HOSTED_WRITE_ACCEPTANCE |
| GGN-PAY-06 | Online payment intent | Pay surface and local intent/idempotency behavior exist. | Mock-only hosted intent, retry/failure and phone readback. | FIXTURE_ACCEPTANCE |
| GGN-ADM-04 | Accounts collection queue | Admin queue/detail opens and local decision flow passes. | Safe synthetic Accounts decision and resulting readback. | FIXTURE_ACCEPTANCE |
| GGN-TEAM-01 | Selling Sales Leader | Personal Home, Team Performance and member detail are visible; current Deepak/Ravi team figure is accepted. | Zero-report target fixture, out-of-tree denial and leader-origin personal action. | FIXTURE_ACCEPTANCE |
| GGN-UX-02 | Retailer catalogue scrolling | Full catalogue and 20-item Home preview work; v29 return-to-Products flicker fix is retained. | Evidence-supported cold-scroll improvement without visual or list regressions. | ENGINEERING |
| GGN-EXP-01 | Scoped exports | Service-issues Excel works on hosted Admin. | Owner approval of wider modules/fields/roles before further acceptance. | OWNER_DECISION |

## 4. Things I should notice while reviewing

- Does Retailer browsing, adding and reviewing an order feel clear and simple? Are prices and stock messages understandable?
- Is the Salesperson's next action easy to find from Home, My Day and an Outlet?
- Does the Sales Leader see enough useful team context without losing the personal Salesperson workspace?
- Are Admin queues and employee/retailer detail pages easy to navigate and act on?
- Do labels, empty states and information placement make sense? Note any screen that feels unnecessarily empty or confusing.

You do not need to test persistence, permissions, APIs, database writes or edge cases; those remain engineering/QA responsibilities.

## 5. Known technical limits

- Retailer cold-scroll performance remains PARTIAL; the accepted v29 return-to-Products flicker repair remains installed.
- Controlled stock can become stale and may need an approved guarded refresh before order testing; no old stock balance should be assumed.
- Real SAP is disconnected. Real payment settlement and real SMS/WhatsApp delivery are not active in this review.
- Some old orders display a total-discrepancy warning because their historical line totals and stored totals do not reconcile; those records were not rewritten.
- The Mahesh opening balance remains under review, and wider exports are not approved beyond the existing service-issues Excel and utility downloads.

## 6. Current build identity

| Component | Current identity |
|---|---|
| Retailer installed | 1.0.29 / code 29; source `72cb4f85a8688c82dbf016f19ac694fc829fd72d` |
| Salesperson installed | 1.0.35 / code 35; source `ebde19307b5ae1b1ce951ff01c02cdee0c5b69b6` |
| Backend deployed | `0919397f46a7bda4bb6732894cc5a25224f70e2e` |
| Admin deployed | Vercel `dpl_4Qog6fU6DeEJYanc7CaRg5ou2EGG`; source `5ad5f4335e8fe92769eab1542ca0726fd0b9b3b5` |
| Main | `015fe7e1e0bff6ac00e7ea60404f0035d2225439` |

Main is newer because the later commits are acceptance evidence/documentation only. The installed apps and deployed services intentionally retain their accepted product builds; no rebuild or redeploy is needed for those document changes.

**Final status: FOUNDER REVIEW CANDIDATE.** Founder experience feedback is welcome; unfinished acceptance and business decisions remain open.
