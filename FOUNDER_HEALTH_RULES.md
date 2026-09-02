# Founder health rules

Pulse V1 uses **explainable domains**, not a 0–100 business score.

Thresholds live in `backend/src/modules/founder/healthRules.ts`. Application code must import that object. Do not scatter percentages.

Statuses: `HEALTHY` | `WATCH` | `AT_RISK`

When the primary metric is **unavailable**, the domain status is `WATCH` with reason `Not enough canonical data to judge this domain.` Do not treat unavailable as zero.

Expected pace for Sales and Collections is:

```
today / comparable-day
```

If the comparable-day value is 0 and today is also 0: `HEALTHY` (quiet day, in line).
If the comparable-day value is 0 and today is > 0: `HEALTHY` (no baseline to miss).
If today is 0 and comparable-day is > 0: pace is 0 → `AT_RISK`.

## Sales

Primary metric: ORDERS (period value vs comparable day).

| Pace | Status |
|---|---|
| ≥ 95% | HEALTHY |
| 80% – 95% | WATCH |
| < 80% | AT_RISK |

## Collections

Primary metric: COLLECTIONS vs comparable day. Same bands as Sales.

## Fulfilment

Primary metric: FILL RATE (absolute, not vs comparable day).

| Fill rate | Status |
|---|---|
| ≥ 95% | HEALTHY |
| 90% – 95% | WATCH |
| < 90% | AT_RISK |

Unavailable fill rate → WATCH, reason as above.

## Inventory

Primary metric: inventory share of unique blocked value vs open order value.

```
inventoryUniqueBlocked / openOrderValue
```

If open order value is 0: HEALTHY (nothing to fulfil).

| Share | Status |
|---|---|
| < 5% | HEALTHY |
| 5% – 12% | WATCH |
| ≥ 12% | AT_RISK |

## Receivables

Primary metric: overdue / outstanding from the local invoice ledger.

Both unavailable → WATCH.
Outstanding 0 → HEALTHY.

| Overdue share | Status |
|---|---|
| < 25% | HEALTHY |
| 25% – 40% | WATCH |
| ≥ 40% | AT_RISK |

## Sales team

Primary metric: open workday sessions / expected active salespeople.

Expected = active `StaffUser` rows with the `salesperson` role, unless `WorkingCalendar.isWorkingDay = false` (then expected is 0 and status is HEALTHY).

If expected is 0 on a working day (no salespeople in the directory): unavailable → WATCH.

| Attendance | Status |
|---|---|
| ≥ 85% | HEALTHY |
| 70% – 85% | WATCH |
| < 70% | AT_RISK |

## Systems

Primary metric: `SapOutbox` rows with `status = failed`.

| Failed rows | Status |
|---|---|
| 0 | HEALTHY |
| 1 – 4 | WATCH |
| ≥ 5 | AT_RISK |

Mock SAP failures for unlinked CardCodes are still failures. Founder must not hide them. They are operational system debt, not a reason to invent a green status.
