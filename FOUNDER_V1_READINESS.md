# Founder V1 readiness

Executive read app over canonical Gagan data. Not a smaller Admin.

## Gate

Pulse vertical (`8747fc9`) approved. This document is the V1 close-out.

## Surfaces

| Surface | Status |
|---|---|
| Pulse | Live. Canonical day metrics. |
| Trends | Live. 7D / 30D / 90D. Same formulas as Pulse. Overdue series is ledger-now, not reconstructed history. |
| Issues / Issue detail | Live. Projections over open constraints. Impact-sorted. Deduped by root. Resolved is empty by design. |
| Decisions / Decision detail | Live for `CREDIT_EXCEPTION` / escalated `EXECUTIVE_ESCALATION` via `ApprovalRequest`. Approve/Decline through `ApprovalService`. Ask Owner unavailable. LARGE_PURCHASE and EXCEPTIONAL_DISCOUNT unavailable. |
| Settings | Minimal grouped list. |
| Morning / Evening brief | Deterministic sentences from Pulse. No LLM. Omits unavailable metrics. |

## Safety

- `founder.view` on every read
- `founder.decide` on Approve/Decline
- `platform_admin` is not a Founder
- No second order/collection/fill/blocked formula
- No fake approval tables
- Frozen Retailer / Salesperson / Admin surfaces untouched

## Not in V1

Ask AI, chatbot, LLM brief, forecasting, ML, voice, automatic deciding, notification automation, real SAP B1 Service Layer.

## Honest gaps

- Overdue trend has no historical snapshots
- Fill rate unavailable until fulfilment starts
- Outstanding/overdue unavailable without local invoices
- Next-day commitment omitted (no canonical commitment source)
- iOS Simulator visual QA requires Xcode selected

## Readiness

See the close-out report in the implementing chat for the scored `/100` after tests and visual QA.
