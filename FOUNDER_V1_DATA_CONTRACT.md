# Founder V1 data contract

All Founder reads are projections. Money fields are **INR rupees as numbers**.

All money fields are **INR rupees as numbers**. Formatting to lakh/crore is a client concern (`formatInrExecutive`).

Unavailable metrics use `value: null` and `availability: "unavailable"`. Present metrics use `availability: "available"`.

## GET /founder/pulse

Staff session. Permission `founder.view`.

```
FounderPulse
  asOf: string (ISO)
  period: { start: string, end: string, timeZone: "Asia/Kolkata", label: string }
  sourceStatus: "ok" | "partial"
  isStale: boolean
  viewer: { staffId: string, name: string }

  summary:
    greeting: string          // "Good morning, Ananya"
    headline: string          // deterministic, no LLM
    tone: "healthy" | "watch" | "risk"

  metrics: FounderMetric[]    // orders, collections, fillRate, blocked first
  secondaryMetrics: FounderMetric[]

  changes: FounderInsight[]
  blocked: FounderBlockedSummary
  health: FounderHealthDomain[]
  issues: FounderIssue[]      // executive projection, impact-sorted, Pulse preview
  pendingDecisions:
    count: number
    label: string
```

## FounderMetric

```
id: "orders" | "collections" | "fillRate" | "blocked" | "activeRetailers" | "activeSalespeople" | "outstanding" | "overdue" | "dispatched" | "invoiced"
label: string
value: number | null
unit: "inr" | "percent" | "count"
availability: "available" | "unavailable"
unavailableReason?: string
delta: { amount: number, unit: "inr" | "percent" | "points" | "count", direction: "up" | "down" | "flat" } | null
deltaLabel?: string           // "vs comparable day"
asOf: string
```

Percent values are 0–100 (91 means 91%).

## FounderInsight

```
id: string
type: "POSITIVE_CHANGE" | "NEGATIVE_CHANGE" | "EMERGING_RISK" | "RECOVERY"
title: string
explanation: string
businessImpact: { amount: number | null, unit: "inr" | "percent" | "count" | "none" }
driver?: string
drilldown?: { kind: string, id?: string }
asOf: string
```

## FounderBlockedSummary

```
totalUniqueValue: number
grossConstraintImpact: number
orderCount: number
categories: Array<{
  id: "CREDIT" | "INVENTORY" | "DISPATCH" | "SYSTEM"
  uniqueValue: number
  orderCount: number
}>
asOf: string
```

Unsupported categories (`PROCUREMENT`, `WAREHOUSE`, `LOGISTICS`) are omitted, not zeroed.

## FounderHealthDomain

```
domain: "Sales" | "Collections" | "Inventory" | "Fulfilment" | "Receivables" | "Sales Team" | "Systems"
status: "HEALTHY" | "WATCH" | "AT_RISK"
reason: string
primaryMetric: string
drilldown?: { kind: string }
asOf: string
```

## FounderIssue

```
id: string
category: "MONEY" | "INVENTORY" | "EXECUTION" | "SALES" | "SYSTEM"
severity: "WATCH" | "HIGH" | "CRITICAL"
title: string
explanation: string
businessImpact: { amount: number | null, unit: "inr" | "count" }
affectedObjects: { orders?: number, retailers?: number, outbox?: number, invoices?: number }
owner: string
ageHours: number | null
status: "open" | "resolved"
expectedNext?: string
drilldown?: { kind: string, id?: string }
asOf: string
```

Issue detail adds `affected.orders[]` and `affected.retailers[]`. Resolved list is empty: issues exist only while the constraint is open.

## GET /founder/trends?period=7D|30D|90D

Same formulas as Pulse, applied to the rolling IST window and the prior window of equal length.

```
FounderTrend
  metric, label, unit, period
  points: [{ date, value }]
  currentValue
  availability
  comparison: { previousValue, changePercent, direction, label }
  interpretation
  asOf, sourceStatus, isStale
```

Overdue `points` are null. `currentValue` is today’s invoice ledger. Interpretation states that honestly.

## GET /founder/decisions?segment=open|history

Only `ApprovalRequest` rows where `requiredPermission = legal.decide` or `status = escalated`.

```
FounderDecision
  id, type (CREDIT_EXCEPTION | EXECUTIVE_ESCALATION)
  title, amount, requester, owner, context[]
  recommendation, recommendedBy, recommendationReason
  availableActions: approve | decline
  unavailableActions: [{ id: "askOwner", reason }]
  createdAt, dueAt, status, auditRequired
```

`POST /founder/decisions/:id/approve` and `/decline` require `founder.decide` and call `ApprovalService.decide`. Idempotent on `approval_already_decided`. Writes `founder.decided` audit.

Unavailable types: `LARGE_PURCHASE`, `EXCEPTIONAL_DISCOUNT`.

## GET /founder/brief?kind=morning|evening

Deterministic statements. Omits unavailable metrics. No LLM.

## GET /founder/team

Read-only manager → salesperson rollup of today’s valid order value.

## Auth

```
POST /founder/auth/otp/request   { phone }
POST /founder/auth/otp/verify    { challengeId, phone, otp }
POST /founder/auth/refresh       { refreshToken }
GET  /founder/me                 founder.view
```

`/founder/me` returns 403 when the staff session lacks `founder.view`. Platform admin is not a Founder.
