# Founder V1 data contract

Pulse gate only. Later resources (`/founder/trends`, issue detail, decisions) are not implemented until Pulse is approved.

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

## FounderIssue (Pulse preview)

```
id: string
category: "MONEY" | "INVENTORY" | "EXECUTION" | "SALES" | "SYSTEM"
severity: "WATCH" | "HIGH" | "CRITICAL"
title: string
explanation: string
businessImpact: { amount: number | null, unit: "inr" | "count" }
affectedObjects: { orders?: number, retailers?: number, outbox?: number }
owner: string
ageHours: number | null
drilldown?: { kind: string }
asOf: string
```

## Auth

```
POST /founder/auth/otp/request   { phone }
POST /founder/auth/otp/verify    { challengeId, phone, otp }
POST /founder/auth/refresh       { refreshToken }
GET  /founder/me                 founder.view
```

`/founder/me` returns 403 when the staff session lacks `founder.view`. Platform admin is not a Founder.
