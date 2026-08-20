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

- [x] Add migration tests for immutable `CreditPolicyVersion`, one active `CreditProfile` per retailer, ordered `RatingHistory`, one current open request per approval subject/type, unique decision, escalation, dispute, and versioned `DispatchAuthorization`.
- [x] Add `WorkingCalendar` and holiday rows for SLA calculations.
- [x] Seed the approved SOP v4 policy values and reason-code catalog.
- [x] Apply migration to a disposable database and commit: `feat: add credit and approval schema`.

## Task 2: Implement pure SOP credit engine

- [x] Convert every rule in `Credit & sales ops.md` Sections 3-6 and 10-12 into table-driven red tests.
- [x] Define input/output:

```ts
type CreditDecision =
  | { result: "allowed"; reasons: ReasonCode[] }
  | { result: "approval_required"; requiredPermission: string; deadline: Date; reasons: ReasonCode[] }
  | { result: "blocked"; reasons: ReasonCode[] };

export function assessOrder(policy: CreditPolicy, snapshot: CreditSnapshot, order: ProposedOrder): CreditDecision;
```

- [x] Implement N invoice chain, INR 50,000 projected cap, full-clearance rule, C/D caps/open-count, E/F locks, partial-payment behavior, repeated monthly approval escalation, missing/stale rating behavior, and advance-payment gate.
- [x] Run the complete table suite and commit: `feat: encode SOP credit decisions`.

## Task 3: Integrate assessment into order creation atomically

- [x] Write integration/concurrency tests proving pending order exposure is included and two simultaneous orders cannot jointly exceed allowed exposure.
- [x] Build `CreditSnapshot` from invoices, allocations, authorized pending orders, rating/profile, and prior approval count. SAP freshness remains explicitly deferred with SAP integration.
- [x] Persist `CreditAssessment` with policy and evidence before returning allowed/approval/blocked.
- [x] Reserve exposure for allowed or approval-pending orders in the same transaction.
- [x] Return reason-coded API errors/messages; clients only render them.
- [x] Commit: `feat: enforce credit engine on every order`.

## Task 4: Implement approval service and dual-client queue

- [x] Write tests for second invoice, third invoice, backup delegation, repeated queue routing, concurrent decisions, mandatory rejection reason, and step-up authentication.
- [x] Implement create/list/detail/decide endpoints using permission checks.
- [x] Make approval re-run credit assessment and issue a versioned dispatch authorization.
- [x] Add admin queue/detail and staff Today/approval cards consuming the same API.
- [x] Add notification events for request, nearing SLA, decision, and escalation.
- [x] Commit: `feat: add shared web and mobile approval workflow`.

## Task 5: Implement SLA escalation and disputes

- [x] Use fake-clock tests for 48-hour third-invoice timeout, four-working-hour acknowledgment, 24-hour meeting/decision, and default hold/block states.
- [x] Implement idempotent worker processors and `ApprovalDispute` written-position workflow.
- [x] Route unresolved conflicts to Founder/Director permission.
- [x] Display SLA and required next action without adding an analytics dashboard.
- [x] Commit: `feat: automate approval SLA and disputes`.

## Task 6: Implement rating calculation and confirmation

- [x] Write tests for quarterly checkpoints, six-month N exit, three clean invoices, reset after late/partial payment, regular/irregular edge cases, and immediate 60+ review.
- [x] Calculate proposals idempotently; require Credit Team Lead confirmation for sensitive changes.
- [x] Persist evidence and invalidate stale dispatch authorizations after confirmed changes.
- [x] Add focused rating review UI to admin and authorized staff app.
- [x] Commit: `feat: add auditable rating lifecycle`.

## Task 7: Run shadow mode and policy comparison

- [x] Add a feature flag that records but does not enforce new decisions.
- [x] Produce a per-order comparison record between legacy behavior, engine decision, and Credit Team disposition.
- [x] Add an exportable queue of mismatches with reason codes; no BI dashboard.
- [x] Require signed policy approval before enabling enforcement.
- [x] Commit: `feat: support credit engine shadow rollout`.

## Exit gate

- [x] Every SOP decision/edge case maps to a passing named test.
- [x] Pending exposure and concurrent orders cannot bypass limits.
- [x] Web and staff app decide one authoritative request.
- [x] SLA/dispute default states are automated.
- [x] Dispatch requires a current authorization.
