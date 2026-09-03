# Gagan Salesperson App — SFA V2 Final Matrix

This matrix is the release-facing companion to `SALESPERSON_SFA_V2_CAPABILITY_AUDIT.md`. Every capability from the SFA benchmark is accounted for. `PASS — EXISTING` means the canonical workflow was already present and was preserved. `PASS — IMPROVED UX` means the same workflow now has a clearer V2 mobile presentation. `PARTIAL — DOCUMENTED LIMITATION` means the safe contract is incomplete and is intentionally not faked. `NOT APPLICABLE — EVIDENCE` means the benchmark capability does not belong to the current Gagan retailer field-sales responsibility or has no approved canonical contract.

| PDF capability | Current Gagan implementation | Final implementation | Mobile route/screen | Backend source/model | Offline behavior | Permission | Test evidence | Status |
|---|---|---|---|---|---|---|---|---|
| Attendance | Workday and attendance services | Existing Start/End My Day plus clearer Home state and EOD review | Home, My Day | `WorkdaySession` | Online mutation; cached state readable | Field attendance capability | Existing field integration coverage; mobile tests | PASS — IMPROVED UX |
| Leave | Leave request/history | Existing flow preserved | My Day | `LeaveRequest` | Online required | Attendance management | Existing leave route tests | PASS — EXISTING |
| Performance dashboard | Read models and visual aggregates | Activity keeps 7D/30D, target, sales, visit, collection, category and route views | Activity | Field/performance services | Read cache where session permits | Field day/performance | Existing performance integration tests | PASS — IMPROVED UX |
| Configurable home | No configuration contract | Intentional fixed next-action home | Home | Salesperson Today read model | Cached last good payload | Field-day capability | UI route/typecheck | NOT APPLICABLE — EVIDENCE |
| PJP / beat plan | Route and ordered stops | Direct Home route plus full Route screen | Home, Route | `RoutePlan`, `RoutePlanStop` | Cached read; skip online | Field day | Existing route service/integration tests | PASS — IMPROVED UX |
| New retailer | Proposal and approval | Existing controlled proposal | Add retailer | `RetailerProposal` | Online required | Proposal permission | Existing proposal tests | PASS — EXISTING |
| Retailer information | Detail, credit, KYC, location | Pre-call workspace retained | Retailer detail | Retailer and credit read models | Read cache | Assigned-retailer scope | Existing retailer route tests | PASS — IMPROVED UX |
| Outlet verification | Location capture/verify, no separate outlet OTP | Honest location verification; no conflated OTP flow | Retailer detail | `RetailerLocation` | Online required | Location capability | Existing location tests | PARTIAL — DOCUMENTED LIMITATION |
| Order history | Recent orders and ledger | Recent orders and intelligence retained | Retailer detail | `Order`, ledger | Read cache | Assigned-retailer scope | Existing retailer detail coverage | PASS — EXISTING |
| Schemes | Scheme read model | Store-specific scheme context retained | Retailer detail, Sales Kit | `Scheme` | Read cache | Assigned retailer | Existing scheme route coverage | PASS — EXISTING |
| Retailer stock audit | No canonical model | Deferred, no warehouse/retailer truth conflation | None | No compatible model | N/A | N/A | Audit evidence | PARTIAL — DOCUMENTED LIMITATION |
| Competitor stock/price | No canonical model | Deferred pending policy and evidence contract | None | No compatible model | N/A | N/A | Audit evidence | NOT APPLICABLE — EVIDENCE |
| Secondary ordering | Catalog and checkout | Existing server-authoritative checkout retained | Retailer detail → Catalog | `/rep/orders`, Product/Variant | Draft in memory only; submit online | Order permission | Existing checkout/integration tests | PASS — EXISTING |
| Suggested order | Deterministic opportunities/baseline | Existing safe opportunity surface; no forced cart mutation | Home, Opportunities | Opportunity/baseline services | Read-only | Intelligence scope | Existing opportunity tests | PASS — EXISTING |
| Variable discount | Not authorized | Not exposed | None | Server pricing policy | N/A | N/A | Policy boundary audit | NOT ENABLED BY POLICY — EVIDENCE |
| Sales return | No rep return command | Deferred pending finance/inventory contract | None | No compatible command | N/A | N/A | Audit evidence | NOT APPLICABLE — EVIDENCE |
| Picture/surveys | KYC/evidence only | KYC retained; survey builder not fabricated | KYC | `KycCase`, `EvidenceAsset` | Online required | KYC permission | Existing KYC tests | PARTIAL — DOCUMENTED LIMITATION |
| Order review/submission | Existing cart, totals and idempotency | Existing flow retained and visually tightened | Catalog/cart | Order domain | Online required | Order permission | Existing order integration tests | PASS — EXISTING |
| Offline sync | Bounded field outbox | Clear sync state preserved; no unsafe offline order | Home, More, field screens | Secure session/outbox | Activity/location/tasks/issues/expenses supported where contract allows | Per-operation capability | Existing outbox tests | PARTIAL — DOCUMENTED LIMITATION |
| Digital signature | No approved command | Not added or forced | None | No compatible evidence workflow | N/A | N/A | Audit evidence | NOT APPLICABLE — EVIDENCE |
| Sales Kit | Existing endpoint/screen | Home quick action and More access | Home, Sales Kit | Sales kit service | Read cache | Field capability | Existing route/typecheck | PASS — EXISTING |
| EOD report | Existing summary and note | Bottom-sheet review before End My Day | Home, My Day | Workday/audit services | Online required | Attendance capability | Existing EOD integration tests | PASS — IMPROVED UX |
| Expenses | Field expense form and statuses | Existing form, evidence, list and state retained | Expenses | `FieldExpense` | Online required; no silent loss | Expense permission | Existing expense tests | PASS — EXISTING |
| Distance/KM | Foreground tracking pings, no full distance read model | No fabricated KM; existing tracking state remains available | More, tracking | `LocationPing` | Pings can queue | Tracking policy | Existing tracking tests | DATA LIMITATION — EVIDENCE |
| Distributor tasks | Not in current field model | Not added | None | No compatible model | N/A | N/A | Audit evidence | NOT APPLICABLE — EVIDENCE |
| Stockist closing stock | Not in current field model | Not added | None | No compatible model | N/A | N/A | Audit evidence | NOT APPLICABLE — EVIDENCE |
| Primary order | Not in current field model | Not added | None | No compatible model | N/A | N/A | Audit evidence | NOT APPLICABLE — EVIDENCE |
| Stockist collection/return | Retailer collections exist; stockist workflow does not | Retailer collections preserved; stockist workflow excluded | Collections | `CollectionSubmission` | Online required | Collection permission | Existing collection tests | NOT APPLICABLE — EVIDENCE |
| Retailer fulfilment | Order/delivery visibility | Read-only visibility retained | Retailer detail/order history | Order/delivery/invoice models | Read cache | Assigned scope | Existing order read tests | PASS — EXISTING |
| Profile | Staff identity and role | Existing More profile retained | More | `StaffUser`, `SalesRep` | Session cache | Authenticated staff | Existing auth tests | PASS — EXISTING |
| Notifications | No guaranteed push contract; in-app opportunities | Affordance appears only when canonical notification data exists | Home, Opportunities | Opportunity/notification sources | Read-only | Assigned scope | Conditional rendering/typecheck | PARTIAL — DOCUMENTED LIMITATION |

## Verification record

- Source commit: `47a918dd2dc2237d42e0e845a60b1dde658e4a13`
- Branch: `codex/gagan-salesperson-sfa-v2`
- Worktree: `/Users/tanutejas/Documents/Gagan-salesperson-sfa-v2`
- Production and `main`: untouched
- SAP B1: not connected; existing mock/staging boundary preserved
- Admin, Retailer, and Founder surfaces: not redesigned in this pass
- Mobile dependency baseline after install: 16 test files / 87 tests passing; typecheck passing before visual implementation
