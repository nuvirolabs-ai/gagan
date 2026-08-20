# Credit and Approvals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encode the complete Credit & Sales SOP as versioned rules with explainable order decisions, rating lifecycle, mobile/web approvals, SLA escalation, disputes, and dispatch authorization.

**Architecture:** Implement a pure credit-policy engine that consumes an immutable account snapshot and produces reason-coded decisions. Persist policy versions and assessments, then create approval and dispatch workflows around those decisions without duplicating rules in clients.

**Tech Stack:** TypeScript pure-domain modules, Prisma/PostgreSQL, worker queue, Vitest table tests, React admin, Expo staff app.

---

## File map

- Create: `backend/src/modules/credit/{policy,engine,snapshot,ratingService,reasonCodes}.ts`
- Create: `backend/src/modules/credit/__tests__/{newCustomer,ratings,edgeCases,ratingLifecycle}.test.ts`
- Create: `backend/src/modules/approvals/{approvalService,slaService,disputeService,dispatchAuthorization}.ts`
- Create: `backend/src/worker/processors/{approvalEscalation,ratingReview}.ts`
- Create: `backend/src/api/routes/{credit,approvals}.ts`
- Create: `admin/src/pages/{Credit,Approvals,ApprovalDetail}.tsx`
- Create: `rep/src/screens/{StaffTodayScreen,ApprovalsScreen,ApprovalDetailScreen}.tsx`
- Modify: Prisma schema/migration, order services, app navigation.

## Task 1: Add policy, profile, assessment, and approval schema

- [ ] Add migration tests for immutable `CreditPolicyVersion`, one active `CreditProfile` per retailer, ordered `RatingHistory`, one current open request per approval subject/type, unique decision, escalation, dispute, and versioned `DispatchAuthorization`.
- [ ] Add `WorkingCalendar` and holiday rows for SLA calculations.
- [ ] Seed the approved SOP v4 policy values and reason-code catalog.
- [ ] Apply migration to a disposable database and commit: `feat: add credit and approval schema`.

## Task 2: Implement pure SOP credit engine

- [ ] Convert every rule in `Credit & sales ops.md` Sections 3-6 and 10-12 into table-driven red tests.
- [ ] Define input/output:

```ts
type CreditDecision =
  | { result: "allowed"; reasons: ReasonCode[] }
  | { result: "approval_required"; requiredPermission: string; deadline: Date; reasons: ReasonCode[] }
  | { result: "blocked"; reasons: ReasonCode[] };

export function assessOrder(policy: CreditPolicy, snapshot: CreditSnapshot, order: ProposedOrder): CreditDecision;
```

- [ ] Implement N invoice chain, INR 50,000 projected cap, full-clearance rule, C/D caps/open-count, E/F locks, partial-payment behavior, repeated monthly approval escalation, missing/stale rating behavior, and advance-payment gate.
- [ ] Run the complete table suite and commit: `feat: encode SOP credit decisions`.

## Task 3: Integrate assessment into order creation atomically

- [ ] Write integration/concurrency tests proving pending order exposure is included and two simultaneous orders cannot jointly exceed allowed exposure.
- [ ] Build `CreditSnapshot` from invoices, allocations, authorized pending orders, rating/profile, SAP freshness, and prior approval count.
- [ ] Persist `CreditAssessment` with policy and evidence before returning allowed/approval/blocked.
- [ ] Reserve exposure for allowed or approval-pending orders in the same transaction.
- [ ] Return reason-coded API errors/messages; clients only render them.
- [ ] Commit: `feat: enforce credit engine on every order`.

## Task 4: Implement approval service and dual-client queue

- [ ] Write tests for second invoice, third invoice, backup delegation, repeated queue routing, concurrent decisions, mandatory rejection reason, and step-up authentication.
- [ ] Implement create/list/detail/decide endpoints using permission checks.
- [ ] Make approval re-run credit assessment and issue a versioned dispatch authorization.
- [ ] Add admin queue/detail and staff Today/approval cards consuming the same API.
- [ ] Add notification events for request, nearing SLA, decision, and escalation.
- [ ] Commit: `feat: add shared web and mobile approval workflow`.

## Task 5: Implement SLA escalation and disputes

- [ ] Use fake-clock tests for 48-hour third-invoice timeout, four-working-hour acknowledgment, 24-hour meeting/decision, and default hold/block states.
- [ ] Implement idempotent worker processors and `ApprovalDispute` written-position workflow.
- [ ] Route unresolved conflicts to Founder/Director permission.
- [ ] Display SLA and required next action without adding an analytics dashboard.
- [ ] Commit: `feat: automate approval SLA and disputes`.

## Task 6: Implement rating calculation and confirmation

- [ ] Write tests for quarterly checkpoints, six-month N exit, three clean invoices, reset after late/partial payment, regular/irregular edge cases, and immediate 60+ review.
- [ ] Calculate proposals idempotently; require Credit Team Lead confirmation for sensitive changes.
- [ ] Persist evidence and invalidate stale dispatch authorizations after confirmed changes.
- [ ] Add focused rating review UI to admin and authorized staff app.
- [ ] Commit: `feat: add auditable rating lifecycle`.

## Task 7: Run shadow mode and policy comparison

- [ ] Add a feature flag that records but does not enforce new decisions.
- [ ] Produce a per-order comparison record between legacy behavior, engine decision, and Credit Team disposition.
- [ ] Add an exportable queue of mismatches with reason codes; no BI dashboard.
- [ ] Require signed policy approval before enabling enforcement.
- [ ] Commit: `feat: support credit engine shadow rollout`.

## Exit gate

- [ ] Every SOP decision/edge case maps to a passing named test.
- [ ] Pending exposure and concurrent orders cannot bypass limits.
- [ ] Web and staff app decide one authoritative request.
- [ ] SLA/dispute default states are automated.
- [ ] Dispatch requires a current authorization.
