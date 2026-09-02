# Founder metric definitions

Pulse V1 only. Every formula reads canonical Gagan tables. Founder never stores a second total.

Period for Pulse is the **Asia/Kolkata calendar day** containing `asOf`.
Comparable day is the **same weekday one week earlier**, same timezone.

Unavailable means JSON `null` plus `availability: "unavailable"`. Never `0` / `₹0` / `0%`.

## ORDERS

| | |
|---|---|
| Canonical source | `Order.orderTotal` |
| Window | `Order.createdAt` in the period |
| Include | every status except `rejected` |
| Exclude | `rejected` |
| Formula | `sum(Order.orderTotal)` |
| Comparison | same formula on the comparable day |

Does not invent a Founder order-total. Retailer, salesperson, and Admin already persist this field at placement.

## COLLECTIONS

| | |
|---|---|
| Canonical source | Confirmed field collections **plus** succeeded retailer payments that are not already those collections |
| Window | `CollectionSubmission.confirmedAt` / `Payment.settledAt` in the period |

Included:

1. `CollectionSubmission` with `status = confirmed`
2. `Payment` with `status = succeeded` and **no** linked `CollectionSubmission`

Excluded:

- `pending`, `confirming`, `rejected` submissions
- `pending`, `failed`, `cancelled`, `reversed` payments

Formula: `sum(confirmed submission.amount) + sum(unlinked succeeded payment.amount)`

A confirmed collection creates a payment. Counting both would double-count. The second term is only in-app / manual payments that never passed the collection queue.

## FILL RATE

| | |
|---|---|
| Canonical source | `OrderItem.qtyOrdered`, `OrderItem.qtyDelivered`, `Order.status` |
| Eligible orders | created in the period, not `rejected`, and fulfilment has started: `status ∈ {packed, out_for_delivery, delivered}` **or** any line has `qtyDelivered != null` |

Delivered quantity for a line:

- `qtyDelivered` when not null
- else `qtyOrdered` when `Order.status = delivered` (ops marked delivered without a short-ship capture)
- else `0`

Formula:

```
sum(delivered quantity) / sum(qtyOrdered)
```

over items on eligible orders.

If there are **no eligible orders**, fill rate is **unavailable**. A day of only `placed` / `confirmed` orders is not a fill-rate day.

## BLOCKED BUSINESS VALUE

Open business = orders with `status ∈ {placed, confirmed, packed, out_for_delivery}` (not `delivered`, not `rejected`).

An order is blocked only if it currently has at least one supported constraint (see `FOUNDER_APP_ARCHITECTURE.md`). Headline uses **uniqueBlockedValue**: each order’s `orderTotal` counted once under its **primary** blocker.

Gross constraint impact sums the same `orderTotal` once per category the order belongs to. It is diagnostic, never the Pulse headline.

## ACTIVE RETAILERS

Distinct `retailerId` with at least one **valid** order (`status != rejected`) created in the period.

Productive, for Pulse V1, means **a valid order**. Visits and unconfirmed collections do not count.

## ACTIVE SALESPEOPLE

Staff who hold the `salesperson` role, are `active`, and have a `WorkdaySession` with `status = open` whose `startedAt` falls on the Pulse calendar day.

If `WorkingCalendar` has a row for that date with `isWorkingDay = false`, expected staff is zero and the metric is still a number (zero), not unavailable.

## OUTSTANDING / OVERDUE

Company rollup of the **local invoice ledger**, same rules as `financialAgeingFor`:

- invoices `status ∈ {open, partially_paid}`
- `outstandingAmount > 0`

Outstanding: `sum(outstandingAmount)`
Overdue: those with `dueDate < asOf`

If the company has **no invoices**, both metrics are **unavailable**. Founder does not sum stale `Retailer.currentBalance` into a fake company ledger.

## DISPATCHED / INVOICED (secondary)

Dispatched: valid orders in the period with `status ∈ {out_for_delivery, delivered}`.
Invoiced: `Invoice.invoiceDate` in the period, `sum(Invoice.total)`.

## UNAVAILABLE UNTIL SAP B1

Not computed on Pulse V1, and must not be faked from mock DocEntry:

- live SAP stock as a second inventory truth (local `InventorySnapshot` is used instead)
- SAP financial summary / DSO from Service Layer
- invoice ageing from B1 when no local invoices exist
- procurement commitments (module not implemented)

## NOT A FOUNDER METRIC YET

Route completion, schemes, expense totals, and notification counts are omitted from Pulse V1 because they would overload the screen or are not executive-grade in the current domains.
