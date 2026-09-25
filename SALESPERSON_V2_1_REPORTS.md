# Salesperson V2.1 Reports contract

Reports remains a read-only projection over the existing field performance
contract. No second performance model or app-side business calculation was
introduced.

## Default cockpit

- Summary uses the canonical selected-period `orderValue`, order count, visit count, and attendance.
- One integrated metric band shows Sales, Orders, Visits, and confirmed Collections.
- The target instrument uses the existing order-value target and actual values.
- The single chart switches between Sales, Orders, Visits, and Collections.
- 7D renders daily points; 30D sums deterministic contiguous buckets, capped at six points.
- A zero series shows one honest unavailable state instead of repeated zero rows.
- The productivity funnel uses route-plan totals when exposed, canonical visits/productive visits, and unique retailers with orders.
- The daily ledger is progressive disclosure through the existing bottom-sheet modal.

## Canonical additive fields

`customersWithOrders`, `planned`, and `visited` are bounded read-model fields:

| Field | Canonical source | Purpose |
| --- | --- | --- |
| `customersWithOrders` | unique `Order.retailerId` values in the selected performance period | ordering-retailer funnel stage |
| `planned` | existing route-plan progress total | planned-stops funnel stage |
| `visited` | existing route-plan progress visited count | route progress context |

No values are persisted, and no fake chart series is generated. Missing
canonical data remains visibly unavailable.
