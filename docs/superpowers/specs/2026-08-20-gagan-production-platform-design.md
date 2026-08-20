# Gagan Production Platform Design

**Status:** Approved design
**Date:** 2026-08-20
**Scope:** Retailer app, role-aware staff app, admin/ops web, shared backend, production operations, and multi-API SAP integration boundary
**Source requirements:** `gagan-retailer-app-spec.md` and `Credit & sales ops.md`

## 1. Objective

Turn the current Gagan prototype into a production-ready B2B ordering, credit, delivery, payment, recovery, and collection platform while keeping the product calm and operationally trustworthy.

The platform must:

- Let retailers browse their effective catalog and pricing, order, track fulfilment, view invoices and ledger, and pay dues.
- Let salespeople manage assigned retailers, place orders, capture KYC, and complete assigned recovery actions.
- Give field collectors mobile access to routes, visits, collection submissions, and receipt capture.
- Let authorized staff approve credit and order requests from the staff app or admin web without relying on WhatsApp.
- Require Accounts confirmation before field or offline collections alter the financial ledger.
- Encode the Credit & Sales Operations SOP as versioned, testable backend rules.
- Integrate with SAP through multiple backend APIs without exposing SAP directly to any client.
- Preserve immutable evidence and audit history for financial, credit, approval, and collection decisions.

## 2. Product boundaries

### 2.1 Client applications

The production platform has three user-facing clients:

1. **Gagan Retailer mobile app**
   - Retailer identity and session
   - Catalog, pricing, stock availability, cart, and order placement
   - Orders, deliveries, invoices, ledger, payments, and notifications
   - Profile, support, KYC status, and payment evidence

2. **Gagan Staff mobile app**
   - Evolves from the current salesperson app
   - Uses one staff identity and permission set
   - Shows role-specific work for Salesperson, Field Collector, Credit Team, Sales Coordinator, Credit Team Lead, Accounts, Dispatch, Founder/Director, and mobile approvers
   - Uses a compact role-aware Today screen rather than a dashboard or sidebar

3. **Admin/Ops web app**
   - Operational queues and configuration
   - Staff and permission management
   - Retailer/KYC, orders, approvals, dispatch, credit, recovery, collection, payments, catalog, integration health, and audit
   - Uses focused queue/detail flows instead of analytics-heavy enterprise UI

### 2.2 Backend components

The backend remains a modular monolith deployed as two processes:

- **API process:** stateless HTTP API for all clients and external callbacks.
- **Worker process:** durable asynchronous jobs, schedules, retries, escalation, reminders, reconciliation, and integration processing.

Both processes use the same domain modules and PostgreSQL database. Scheduled jobs never run inside API replicas.

### 2.3 External systems

- SAP customer, material, pricing, inventory, sales order, delivery, billing, receivables, and credit APIs
- SMS OTP and transactional messaging provider
- Push notification provider
- UPI/payment gateway
- Private object storage for KYC, POD, receipts, letters, and signatures
- Error monitoring, metrics, logs, and alerting

## 3. Architecture decision

Use a modular monolith rather than microservices or continued route-by-route extension.

Reasons:

- Credit, approvals, orders, inventory, invoicing, and payments require strong transactional consistency.
- The current team and product phase benefit from one deployable backend and one schema.
- Domain modules provide isolation without distributed-system overhead.
- A worker process and durable queue solve scheduling and retry requirements without splitting ownership across services.
- Modules can be extracted later only if load or team ownership justifies it.

Target backend structure:

```text
backend/src/
  api/
    middleware/
    routes/
  worker/
    processors/
    schedules/
  modules/
    identity/
    retailers/
    kyc/
    catalog/
    inventory/
    orders/
    credit/
    approvals/
    fulfilment/
    invoicing/
    payments/
    recovery/
    collections/
    notifications/
    audit/
    integrations/sap/
  platform/
    config/
    database/
    queue/
    storage/
    logging/
    security/
```

Routes validate transport inputs, call application services, and format outputs. Domain rules do not live in route handlers, React components, or integration adapters.

## 4. Identity, roles, and permissions

### 4.1 Identity model

- `StaffUser`: name, phone, email, employee reference, status, and authentication metadata.
- `Role`: named operational role.
- `Permission`: granular backend action.
- `StaffRole`: many-to-many assignment between staff and roles.
- `RolePermission`: permissions granted by each role.
- `RoleDelegation`: temporary backup authority with explicit start/end and grantor.
- `DeviceSession`: refresh-token family, device, last use, expiry, and revocation.
- `RetailerSession`: separate retailer session family.

### 4.2 Required roles

- Salesperson
- Field Collector
- Credit Team
- Sales Coordinator
- Credit Team Lead
- Accounts
- Dispatch
- Founder/Director
- Platform Admin

### 4.3 Authorization rules

- Backend permission checks are mandatory for every staff/admin endpoint.
- Client visibility is convenience, never authorization.
- A user may have multiple roles, but sensitive actions require the exact permission.
- Temporary backup approval uses `RoleDelegation`; it is not implemented by permanently widening a role.
- Payment confirmation, credit overrides, blocks, rating confirmation, legal decisions, and write-offs require step-up authentication.
- Staff sessions are revocable by device and by user.

### 4.4 Staff app navigation

After login, the app derives work sections from permissions:

- Salesperson: assigned retailers, new order, KYC, recovery calls
- Field Collector: route, visits, submission history, pending deposits
- Approver: requests ordered by SLA
- Accounts: collections/payment confirmations
- Dispatch: authorized dispatch work
- Multi-role staff: small work-mode switcher

No role gets access to unrelated operational queues.

## 5. Retailer and KYC domain

### 5.1 Retailer model

Extend `Retailer` with:

- legal name and trade name
- GSTIN/PAN and tax registration status
- primary billing and delivery addresses
- lifecycle status: draft, KYC pending, active, suspended, closed
- onboarding stage
- commercial group identifier for customers with multiple SAP codes
- account block state and block reason

### 5.2 KYC model

- `KycCase`: retailer, status, submitted/reviewed timestamps, reviewer, and rejection reasons.
- `KycDocument`: type, object-storage key, checksum, file metadata, uploader, verification status, and expiry where applicable.
- `KycReview`: decision, reviewer, evidence, and comments.
- `RetailerContact`: owner, buyer, accounts, and delivery contacts.
- `RetailerSapAccount`: one commercial retailer to one or more SAP customer codes.

### 5.3 KYC invariants

- A salesperson may capture an order and KYC draft together.
- A new SAP customer and first dispatch require approved mandatory KYC.
- Files are private and accessed through short-lived signed URLs.
- Every document access and review is audited.
- Duplicate SAP customer codes are flagged for Credit Team Lead resolution at the commercial-retailer level.

## 6. Credit policy and rating domain

### 6.1 Models

- `CreditProfile`: retailer, current rating N/A/B/C/D/E/F, billing pattern, limit, block state, rating date, review due date, and active policy version.
- `CreditPolicyVersion`: effective dates and versioned numeric/configuration rules.
- `RatingAssessment`: calculated evidence, proposed rating, trigger, and policy version.
- `RatingHistory`: old/new rating, approver, reason, evidence snapshot, and timestamp.
- `CreditAssessment`: immutable order-level decision snapshot.
- `CreditOverride`: exceptional Founder/Director decision, evidence, scope, expiry, and revocation.
- `WorkingCalendar`: working days and holidays used for SLA calculations.

### 6.2 Policy values

The policy configuration includes:

- DSO target: 45 days
- Rating N outstanding cap: INR 50,000
- Rating N invoice chain: first automatic, second Sales Coordinator, third Credit Team Lead, fourth blocked until invoices 1-3 are fully cleared
- Rating C cap: INR 100,000 or three open invoices
- Rating D cap: INR 25,000 or three open invoices
- Rating E lock when any invoice exceeds 59 days; after full clearance restart as N
- Rating F permanent block and advance-payment requirement
- Full-clearance dispatch gate for any invoice older than 45 days
- Third-invoice decision SLA: 48 hours
- Conflict acknowledgment SLA: four working hours
- Conflict decision timing: 24 hours after acknowledgment
- Rating review checkpoints: 1 April, 1 July, 1 October, and 1 January
- Recovery action day bands and seven-day recovery-letter deadline
- Two-percent cash discount choice and overdue-interest trigger

The exact interest calculation convention must be stored as configuration before interest posting is enabled. Until configured and approved, the platform may warn that interest applies but must not create interest ledger entries.

### 6.3 Credit engine output

For every order, the credit engine returns:

- `allowed`
- `approval_required`
- `blocked`

The decision records:

- policy version
- rating and rating-review freshness
- projected outstanding
- open invoice count
- oldest unpaid invoice age from invoice/dispatch date
- partial-payment state
- approval frequency for the month
- required approver role and deadline
- machine-readable reason codes and a human explanation

### 6.4 Rating lifecycle

- New customers begin at N.
- The system calculates rating proposals at scheduled checkpoints, six months, and immediate triggers.
- Sensitive rating changes are proposals until confirmed by the Credit Team Lead.
- A late or partial payment resets the clean-invoice count.
- Rating evidence and policy version are immutable after confirmation.
- Rating changes immediately invalidate stale dispatch authorizations.

## 7. Order, approval, and dispatch domain

### 7.1 Order model

Extend orders with:

- effective pricing snapshot
- selected cash-discount or credit-term option
- delivery fee and tax components
- inventory validation/reservation state
- credit decision and policy version
- current authorization version
- complete status history

### 7.2 Approval models

- `ApprovalRequest`: type, subject, retailer/order, required role, requested by, requested at, deadline, status, and reason codes.
- `ApprovalDecision`: approve/reject, actor, reason, source client, step-up authentication result, and timestamp.
- `ApprovalEscalation`: trigger, from/to role, SLA timestamps, and resolution.
- `ApprovalDispute`: written positions, evidence, default state, acknowledgment, meeting, and Founder/Director decision.
- `DispatchAuthorization`: allow/hold/block result, evidence snapshot, expiry, and invalidation reason.
- `OrderStatusHistory`: transition, actor, source, and correlation ID.

### 7.3 Approval delivery

- The same request appears in admin web and the authorized staff app.
- A decision from either client closes the same request atomically.
- Concurrent decisions return the already-recorded decision.
- Rejection requires a reason.
- Every decision and escalation produces an audit event and notification.
- WhatsApp is not an authoritative workflow or approval channel.

### 7.4 Order and dispatch workflow

1. Backend receives an order request with an idempotency key.
2. It re-resolves current effective prices and validates active products.
3. It validates minimum order, delivery fee, inventory, and retailer status.
4. Credit engine produces an immutable assessment.
5. Allowed orders reserve inventory and proceed.
6. Approval-required orders remain held until the authoritative request is approved.
7. Blocked orders persist only as rejected/held records with clear reason codes; they cannot dispatch.
8. The SAP adapter prepares a blocked/draft sales order when SAP credit simulation or document creation is required for approval evidence.
9. After an allowed or approved decision, the adapter releases or posts the SAP sales order using the same idempotency key.
10. Dispatch rechecks authorization freshness immediately before release.
11. Dispatch occurs only with an active authorization and acknowledged SAP enforcement state.

## 8. Inventory and fulfilment domain

### 8.1 Inventory

- `InventorySnapshot`: location/material/variant, available quantity, reserved quantity, source timestamp, and sync freshness.
- `InventoryReservation`: order, variant, quantity, expiry, and status.
- Inventory is read from SAP APIs but persisted locally for fast app reads.
- Stale inventory beyond the configured freshness window cannot be presented as guaranteed availability.
- Reservations are released on rejection, cancellation, expiry, or dispatch adjustment.

### 8.2 Delivery and POD

- `Delivery`: route, slot, assignee, vehicle/driver references where used, and status.
- `DeliveryLine`: ordered, dispatched, delivered, damaged, and rejected quantities/weights.
- `PodEvidence`: method, object-storage key or OTP verification reference, checksum, captured by, device time, server time, and optional location.
- `DeliveryAdjustment`: shortage, damage, rejection, and reason.
- `Return`: post-delivery returned goods workflow.
- `CreditNote`: financial correction tied to an invoice and approved adjustment.

### 8.3 Delivery invariants

- All order lines must be explicitly resolved at POD.
- Photo/signature evidence stores the actual protected asset.
- OTP POD must verify a server-issued, expiring OTP.
- One delivered order creates at most one invoice.
- Duplicate POD requests return the existing delivery/invoice result.
- Delivered-weight pricing uses controlled decimal arithmetic.

## 9. Invoicing, ledger, and payments

### 9.1 Financial models

- `Invoice`: unique order, invoice/dispatch date, due date, amount, outstanding amount, status, and SAP invoice reference.
- `InvoiceLine`: delivered basis, quantity/weight, unit rate, and amount.
- `Payment`: retailer, amount, channel, provider, status, external reference, confirmation details, and reversal relationship.
- `PaymentAllocation`: payment, invoice, applied amount, and application timestamp.
- `PaymentEvidence`: UTR, cheque/reference metadata, or protected receipt.
- `LedgerEntry`: immutable debit/credit event and resulting sequence.
- `CreditNote` and `PaymentReversal`: correction events.
- `ReconciliationIssue`: expected/actual difference, source, owner, and resolution.

### 9.2 Financial invariants

- One invoice per order.
- One successful settlement per payment/provider event.
- Invoice date equals dispatch date.
- Payment allocation is oldest invoice first unless Accounts records an authorized explicit allocation.
- Partial payment never marks an invoice fully cleared.
- Ledger entries are append-only.
- Corrections use reversals and credit notes.
- Balance is derived from immutable entries; any cached balance is verifiable and rebuildable.
- Financial state transitions use atomic conditional updates and database uniqueness constraints.

### 9.3 Retailer online payment

1. Backend validates payable amount and creates a pending payment.
2. Gateway intent is created with Gagan payment ID as idempotency reference.
3. Client opens the gateway/UPI flow.
4. Only a verified provider webhook may mark payment successful.
5. A conditional settlement transaction allocates the payment and creates ledger entries once.
6. Reconciliation independently compares gateway settlement data.

### 9.4 Offline and field collection

1. Collector records visit, amount, method, receipt, and optional location.
2. Submission becomes `pending_accounts_confirmation` and does not change the ledger.
3. Collector groups physical deposits into a deposit batch.
4. Accounts verifies bank/UPI/cheque/cash evidence and deposit reconciliation.
5. Accounts approve creates the payment, allocation, and ledger entries atomically.
6. Rejection returns the submission to the collector with a reason.
7. Correction after confirmation uses reversal, never record editing.

## 10. Recovery, collections, and legal workflow

### 10.1 Models

- `RecoveryCase`: invoice, retailer, current band, priority, owner, state, and last movement.
- `RecoveryAction`: required/completed action type, assignee, due date, outcome, and evidence.
- `CallLog`: participants, outcome, notes, and external call reference where integrated.
- `PromiseToPay`: amount/date, source, status, and missed count.
- `RecoveryLetter`: generated document, signatories, sent channel/time, and deadline.
- `CollectionAssignment`: route/day, retailer, invoices, amount, collector, priority, and state.
- `CollectionVisit`: check-in/out, location, outcome, and notes.
- `CollectionSubmission`, `DepositBatch`, and `CollectionConfirmation` as defined above.
- `LegalCase`: referral date, evidence, status, settlement/write-off request, and Director decision.

### 10.2 Scheduled recovery workflow

The worker evaluates open invoices by age from invoice/dispatch date and produces idempotent actions:

- Day 35: reminder call
- Day 40: active push and interest warning with five-day deadline
- Day 45-48: amount and firm commitment call
- Day 49-52: commitment follow-up
- Day 53-56: joint Credit Team and Salesperson call
- Day 60-69: daily action, rating review, and senior escalation on defined triggers
- Day 70-89: signed recovery letter and seven-day deadline
- Day 90+: legal referral and permanent F recommendation

Additional rules:

- A missed commitment creates the defined next action immediately.
- Two consecutive missed commitments escalate to the Credit Team Lead.
- A 60+ case with no movement for two weeks escalates directly.
- Field visits are assigned and tracked in the staff app.
- All actions are audited and visible on a single case timeline.

## 11. Notifications

- `Notification`: audience, entity link, priority, title/body, created/read state.
- `NotificationDelivery`: in-app, push, SMS, delivery status, retry, and provider reference.
- Approval requests, decisions, recovery tasks, collection rejections, payment confirmations, delivery events, and integration exceptions generate notifications.
- Notifications are informational; only backend state authorizes action.
- Retailer app includes a usable notification center and deep links to the relevant order, invoice, payment, or support action.

## 12. SAP integration boundary

### 12.1 Adapter interfaces

Separate adapters cover:

- customer/KYC master
- material and packaging master
- pricing conditions
- inventory
- sales orders
- dispatch/delivery
- billing/invoices
- receivables/payment state
- ratings, credit limits, and blocks where supported

Each adapter maps an SAP-specific API into a canonical internal contract. Client applications never use SAP identifiers as their primary identifiers.

### 12.2 Reliability models

- `IntegrationInbox`: inbound event ID, source, payload hash, received/processed state.
- `IntegrationOutbox`: command, aggregate, idempotency key, state, and next attempt.
- `SyncCursor`: adapter/entity watermark and freshness.
- `IntegrationAttempt`: correlation ID, sanitized request/response metadata, latency, retry, and error category.
- `ExternalEntityLink`: local entity, SAP system, SAP identifier, validity, and conflict state.
- `IntegrationReconciliation`: expected/actual references and resolution.

### 12.3 Integration rules

- Inbound events are deduplicated.
- Outbound commands carry stable idempotency keys.
- Retries use bounded exponential backoff and dead-letter parking.
- Retrying rebuilds payloads from current authoritative mappings when safe.
- Every field has a documented source of truth.
- Normal app reads use local data; SAP latency does not block screen rendering.
- Reconciliation detects missing, duplicated, stale, or conflicting records.
- Integration errors have an operational owner and actionable remediation.

### 12.4 Source-of-truth ownership

The production boundary is explicit:

| Data | Authoritative owner | App behavior |
|---|---|---|
| Onboarding draft, KYC workflow, commercial retailer grouping | Gagan platform | Creates or updates the SAP customer through an adapter and stores the acknowledged SAP identifier. |
| Official customer master after SAP creation | SAP | Local mirror is refreshed from SAP; app-only contact/workflow metadata remains local. |
| Materials, packaging, tax classification, approved pricing, and stock | SAP | Local read model serves clients. Stale data is labelled or fails closed according to its freshness policy. |
| Order intent, app actor, approval request, and approval decision | Gagan platform | Produces idempotent SAP prepare/release commands. |
| Official sales-order and goods-movement document | SAP | SAP references and status are mirrored locally. |
| Credit policy, rating decision, approval SLA, and override evidence | Gagan platform | Approved rating, limit, and block commands are sent to SAP; dispatch waits for SAP acknowledgment where SAP enforces the control. |
| POD photo/signature/OTP evidence and collection visit evidence | Gagan platform | SAP receives only required delivery/financial references, not private evidence assets. |
| Official billing/FI document and posted receivable | SAP | Local invoice/ledger is an operational mirror linked to SAP document IDs and continuously reconciled. |
| Gateway result or Accounts-confirmed offline collection | Gagan platform at confirmation | Payment posting is sent to SAP FI; dispatch clearance that depends on payment requires acknowledged/reconciled SAP state. |
| Notifications, audit, recovery actions, promises, and collection assignments | Gagan platform | These workflows remain local and reference SAP documents through stable links. |

If a required SAP mirror is older than its configured maximum age, financial clearance and dispatch fail closed while read-only screens show the last-sync time.

## 13. Security and privacy

### 13.1 Authentication

- Real SMS OTP with short expiry, single use, resend cooldown, attempt limits, and abuse controls.
- Secure mobile token storage using platform Keychain/Keystore.
- Short-lived access tokens and rotating refresh tokens.
- Session/device revocation.
- Step-up authentication for sensitive actions.
- Secure HTTP-only admin cookies where deployment topology permits.

### 13.2 API and data protection

- Restricted CORS and security headers.
- Rate limits by endpoint, account, device, and IP where appropriate.
- Strict input schemas and request/file size limits.
- Malware/file-type validation for uploads.
- TLS for every connection.
- Encryption at rest for database, backups, and object storage.
- Secrets stored outside source code in a managed secret store.
- Redacted logs and sanitized integration traces.
- Signed short-lived document access URLs.
- Retention and deletion policies for KYC, POD, and collection evidence.

### 13.3 Audit

`AuditEvent` records:

- actor and effective roles
- action and entity
- before/after values for sensitive changes
- reason/evidence reference
- client, device/IP, and correlation ID
- server timestamp

Audit events are immutable and cover credit, rating, approval, block, KYC, payment, collection, dispatch, correction, integration retry, and permission changes.

## 14. Production infrastructure

### 14.1 Environments

- Development: local dependencies and mock adapters.
- Staging: production-shaped infrastructure, SAP sandbox, and payment test mode.
- Production: isolated database, queues, storage, secrets, credentials, and SAP endpoints.

Production startup fails closed if a mock OTP, payment, or SAP adapter is selected.

### 14.2 Runtime components

- stateless API replicas
- worker replicas consuming a durable Redis-backed queue
- managed PostgreSQL with automated backups and point-in-time recovery
- private object storage
- admin static hosting/CDN
- Expo/EAS mobile builds and release channels
- managed secrets
- centralized structured logs, metrics, tracing/correlation, error reporting, and alerting

### 14.3 Health and shutdown

- `/health/live`: process is alive.
- `/health/ready`: required configuration, database, and queue are available.
- Graceful shutdown stops accepting requests, drains in-flight work, and releases resources.
- Database migrations run as an explicit deployment step using a restricted migration identity.

## 15. Reliability and observability

Monitor and alert on:

- API latency, throughput, and error rate
- authentication abuse and OTP delivery
- order decision and approval outcomes
- approval SLA breaches
- queue depth and oldest job age
- SAP sync freshness, outbox age, and dead-letter count
- payment webhook/reconciliation failures
- ledger invariant violations
- recovery action backlog
- field collection confirmation backlog
- notification delivery failures
- database pool, locks, storage, and slow queries

Every request, job, payment, approval, and SAP command uses a correlation ID.

Required runbooks:

- SAP outage or stale sync
- payment gateway outage
- payment/ledger mismatch
- duplicate callback/POD protection alert
- queue backlog
- failed migration/rollback
- database restore
- compromised staff device/session

## 16. Testing strategy

### 16.1 Backend

- Unit tests for credit policy, rating, invoice calculation, allocation, authorization, and state machines.
- Table-driven tests for every rule and edge case in `Credit & sales ops.md`.
- Integration tests against disposable PostgreSQL.
- Concurrency tests for order placement, approval decisions, POD, payment callback, collection confirmation, and outbox claims.
- RBAC matrix tests for all sensitive actions.
- API validation and stable error-contract tests.
- SAP adapter contract tests against fixtures and sandbox.
- Reconciliation invariant tests.
- Migration tests from a production-like database snapshot.

### 16.2 Mobile

- Component tests for critical forms and decision states.
- Session restoration, refresh, revocation, and role navigation tests.
- Retailer order/payment end-to-end tests.
- Staff approval, KYC, recovery, visit, and collection end-to-end tests.
- Offline/poor-network, retry, duplicate-tap, and stale-data tests.
- Real-device smoke coverage for supported Android and iOS versions.

### 16.3 Admin web

- Component tests for queues, evidence, and decision forms.
- Playwright tests for KYC, approvals, dispatch, payment confirmation, credit configuration, and audit.
- Permission visibility and backend-denial tests.
- Keyboard and screen-reader accessibility checks.

No financial or credit-policy change ships without a regression test proving the affected rule.

## 17. Migration and rollout

### 17.1 Foundation

1. Put the project under source control.
2. Make database migrations reproducible and apply the current baseline in a controlled environment.
3. Establish CI for build, lint, tests, migration validation, dependency scanning, and artifact creation.
4. Add characterization tests for current order, invoice, payment, and SAP outbox behavior.

### 17.2 Additive data migration

1. Add new tables and nullable references without deleting legacy fields.
2. Backfill invoices from delivered orders and ledger entries.
3. Backfill payment allocations and identify unallocatable historical entries.
4. Create initial credit profiles and SAP entity links.
5. Rebuild balances from immutable entries and compare with stored balances.
6. Resolve all unexplained differences before enabling authoritative financial writes.

### 17.3 Controlled enablement

1. Run the credit engine in shadow mode.
2. Compare its decisions to Credit Team decisions.
3. Approve policy configuration and edge-case behavior.
4. Enable approvals for internal staff.
5. Pilot retailer ordering with a bounded cohort.
6. Enable recovery tasks and field collection.
7. Enable Accounts confirmation and deposit reconciliation.
8. Enable production payment gateway.
9. Connect SAP adapters one domain at a time with reconciliation.
10. Expand retailer and staff rollout after launch gates remain green.
11. Remove legacy/mock paths only after verified cutover.

## 18. Launch gates

Production launch requires:

- Every applicable SOP rule and edge case has a passing automated test.
- Credit Team signs off shadow-mode decision results.
- No unresolved balance, allocation, gateway, collection, or SAP reconciliation differences.
- Duplicate payment callback, POD, approval, and order-submission tests pass.
- RBAC matrix is signed off by Operations.
- KYC/POD/receipt access controls and audit coverage pass.
- Backup restoration and rollback drills succeed.
- Monitoring and alert delivery are verified.
- Production mobile builds work on supported real devices.
- Credit, Sales, Accounts, Dispatch, Field Collection, and Founder/Director UAT is complete.
- Runbooks have named owners.
- Mock adapters cannot start in production.

## 19. Explicit non-goals for the production-readiness program

To keep scope controlled, this program does not add:

- general BI dashboards
- multi-company tenancy
- multi-warehouse optimization beyond inventory location support required by SAP
- promotion/scheme calculation beyond the existing read-only display unless separately specified
- route optimization algorithms
- automated legal actions
- unrestricted offline financial posting
- microservices

## 20. Success criteria

The platform is production-ready when:

- A retailer or salesperson can place an order and receive a deterministic, explainable credit result.
- Approval-required orders can be decided from admin web or staff app with identical authorization and audit behavior.
- No order dispatches without current credit and dispatch authorization.
- Delivery creates exactly one evidence-backed invoice from delivered quantities/weights.
- Online and offline payments settle exactly once and reconcile to invoices.
- Field collectors can complete assigned visits without directly changing the ledger.
- Accounts can confirm or reject collections with complete evidence.
- Recovery actions and rating reviews are created according to policy and SLA.
- SAP APIs can fail or retry without losing, duplicating, or corrupting business state.
- Every sensitive action is attributable, reversible where appropriate, monitored, and covered by tests.
