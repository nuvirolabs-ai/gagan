# Founder UAT

Seed: `npm run seed:founder-uat` in `backend/`.

Idempotent, non-destructive, tagged `[FOUNDER UAT]`. Does not wipe staging.

## Identity

- Phone `9812345599`
- Name Ananya Shah
- Role `founder_director`
- Mock OTP `123456`

## Canonical fixture

The seed writes only canonical rows:

| Signal | How it appears |
|---|---|
| Healthy metric | Delivered order value on the IST day (today + prior delivered orders) |
| Weak metric | Fill rate on the short-shipped delivered order (9/10) |
| Blocked business | Open ₹78,000 order with an open `legal.decide` approval and zero available stock on `FOUNDER-UAT-SKU` |
| Executive issue | Credit hold on that order (one issue, not three) |
| Hierarchy/team | Existing salesperson roster + `/founder/team` (empty if no `salesRepId` links) |
| Decision | The same open `ApprovalRequest` (`CREDIT_EXCEPTION`). No fake decision table |

Today’s Pulse numbers stay driven by today’s canonical orders/collections. Prior-day orders are dated in the past so Trends have movement without changing today’s Pulse totals.

## Login

Founder app → staff OTP at `/founder/auth/*`.

## Reconciliation checklist

Compare Founder numbers to Admin / SQL on the same IST day:

- Orders = `sum(Order.orderTotal)` excluding `rejected`
- Collections = confirmed submissions + unlinked succeeded payments
- Fill rate = delivered qty / ordered qty on fulfilment-started orders
- Blocked unique = one `orderTotal` per open order, CREDIT > INVENTORY > DISPATCH > SYSTEM
- Outstanding / overdue = local `Invoice` ledger only

## Decisions

Approve / Decline call `ApprovalService.decide`. Ask Owner is unavailable. Large purchase and exceptional discount are documented as unavailable.

## Do not

- Invent a second issue or decision table
- Treat Expo Web as iOS-native proof
- Connect real SAP B1 from this seed
