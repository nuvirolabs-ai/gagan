# Gagan Retailer App — Spec

**Status:** v1 draft
**Owner:** Signor
**Purpose:** Mobile app for retailers to place orders directly with Gagan (commodities — daal, rice, etc.), replacing manual/phone-based ordering, with tier-based pricing, credit ledger tracking, and a delivery flow. Integrates with existing SAP instance (integration method TBD — see Section 7).

---

## 1. Goals

- Let thousands of retailers place orders directly, without a distributor layer (Gagan delivers directly).
- Reflect real trade pricing — different retailers pay different rates by tier.
- Track credit/khata balances per retailer, since most orders are on credit, not upfront cash.
- Support field sales reps placing orders on behalf of retailers who won't self-serve on the app.
- Keep SAP as the eventual source of truth for master data (customers, materials, pricing, stock) without blocking app design on SAP access being resolved first.

**Non-goals for v1:** multi-warehouse routing, promotions/schemes engine, analytics dashboards. Add once order volume justifies it.

---

## 2. User roles

| Role | Access |
|---|---|
| Retailer | Retailer app — browse catalog, order, view ledger, track delivery |
| Sales rep (DSR) | Rep app — place orders on behalf of assigned retailers |
| Admin/Ops | Admin dashboard — approve orders, manage tiers/pricing, dispatch, view ledger |

---

## 3. Core screens

### 3.1 Retailer App
1. **Login** — phone number + OTP
2. **Home** — quick reorder (last order), banners/announcements, catalog entry
3. **Catalog** — product list by category, shows tier-specific price and pack size/variant, stock availability
4. **Product detail** — variants (1kg/5kg/25kg etc.), price, add to cart
5. **Cart** — quantity edit, running total, credit limit check before checkout
6. **Order confirmation** — order ID, expected delivery window
7. **Order history** — past orders, status, reorder button
8. **Ledger** — running balance, due amount, due date, payment history
9. **Payment** — UPI / pay-against-due
10. **Delivery tracking** — status: placed → confirmed → dispatched → delivered
11. **Profile/support** — shop details, contact support (call/WhatsApp fallback)

### 3.2 Sales Rep App
1. Login
2. Assigned retailer list
3. Place order on behalf of a retailer (same catalog/pricing logic, using that retailer's tier)
4. View retailer ledger/due before placing order

### 3.3 Admin Dashboard (web)
1. Order queue — approve/reject, assign to dispatch
2. Retailer management — onboarding, tier assignment, per-retailer price overrides, credit limit setting
3. Dispatch — assign delivery route/slot, capture proof of delivery + actual delivered weight
4. Ledger view — per-retailer balance, overdue accounts
5. Catalog management — SKUs, tier pricing (synced from SAP once integration is live)

---

## 4. Data model (core entities)

```
Retailer
  id, name, shop_address, phone, tier_id, credit_limit, current_balance, sap_customer_id (nullable until synced)

Tier
  id, name, description

Product (SKU)
  id, name, category, variants[] (pack_size, unit), sap_material_id (nullable until synced)

PriceList
  tier_id, product_id, variant_id, price   // resolved at order time

Order
  id, retailer_id, placed_by (retailer|rep_id), status, items[], order_total,
  created_at, sap_sales_order_id (nullable until synced)

OrderItem
  order_id, product_id, variant_id, qty_ordered, unit_price, qty_delivered (set at dispatch), weight_delivered

Delivery
  order_id, route_id, delivery_slot, pod_type (photo|otp|signature), pod_captured_at, actual_weight

LedgerEntry
  retailer_id, order_id (nullable for payments), type (invoice|payment), amount, balance_after, created_at
```

---

## 5. Order flow

1. Retailer (or rep) adds items to cart → prices resolved via `PriceList` for retailer's `tier_id` (with any per-retailer override applied)
2. On checkout, system checks `credit_limit - current_balance >= order_total`; blocks or flags for admin approval if over limit
3. Order created with status `placed`
4. Admin/ops approves → status `confirmed` → assigned to a delivery route/slot
5. On delivery: proof of delivery captured, **actual delivered weight recorded** (may differ slightly from ordered weight — commodities)
6. Invoice generated off **delivered weight**, not ordered quantity
7. `LedgerEntry` (type: invoice) created, retailer balance updated
8. Payment received → `LedgerEntry` (type: payment) → balance updated

---

## 6. API layer (indicative — app ↔ backend)

```
POST   /auth/otp/request
POST   /auth/otp/verify

GET    /catalog?retailer_id=            → tier-priced product list
GET    /products/:id

POST   /orders                          → create order (credit check inline)
GET    /orders?retailer_id=
GET    /orders/:id

GET    /ledger/:retailer_id
POST   /payments                        → record payment against ledger

GET    /delivery/:order_id/status

# Admin-only
POST   /admin/retailers/:id/tier
POST   /admin/retailers/:id/price-override
POST   /admin/orders/:id/approve
POST   /admin/dispatch/:order_id/assign
POST   /admin/dispatch/:order_id/pod     → captures actual weight, POD
```

---

## 7. SAP integration boundary (to be resolved)

**Decision pending:** SAP version (S/4HANA vs ECC) and available integration access — unknown as of this spec.

**Design principle:** the app's backend owns a **sync layer** that abstracts SAP away from the rest of the system. Nothing above this line (retailer app, rep app, admin dashboard, order flow) should need to change once SAP integration is implemented — only the sync layer's internals change.

**What SAP is expected to be source of truth for (once connected):**
- Retailer/customer master (`sap_customer_id`)
- Material master / SKUs (`sap_material_id`)
- Pricing conditions (may replace or feed the `PriceList` table)
- Stock/inventory levels
- Sales order posting (`sap_sales_order_id`) — app-created orders should post into SAP
- Billing/invoicing — delivered-weight invoice may need to post back into SAP FI/SD

**Until SAP access is confirmed:** the app runs with its own `Retailer`, `Product`, `PriceList` tables as the working source of truth (as modeled in Section 4), with nullable SAP ID fields already in place so records can be linked once sync is built — no data model rework needed later, just a sync job.

**Open items to resolve before building the sync layer:**
- SAP version (S/4HANA has native OData APIs; ECC typically needs RFC/BAPI or middleware)
- Whether integration access/APIs already exist, or need to be exposed by SAP admin/consultant
- Real-time sync vs. batch (e.g. nightly stock/price sync vs. live lookups)

---

## 8. Phasing

**Phase 1 (MVP):** Retailer app (catalog, cart, order, ledger view), admin dashboard (order approval, dispatch, tier/pricing management), app-owned data model (no SAP yet)
**Phase 2:** Sales rep app
**Phase 3:** SAP sync layer, once access/version is confirmed
**Later:** Schemes/promotions, analytics, multi-warehouse

---

## 9. Open questions

- SAP version and integration access (Section 7)
- Delivery: own fleet or third-party? (affects dispatch/route data model)
- Retailer onboarding: self-signup in-app, or admin-created after offline verification?
- Payment gateway for UPI collection — which provider?
