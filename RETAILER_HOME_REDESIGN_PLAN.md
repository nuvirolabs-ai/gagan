# Retailer Home Redesign Plan

Presentation-only. Canonical pricing, credit, SKU identity, cart, and order rules stay as they are.

Home is implemented first. Other retailer screens wait for `CONTINUE RETAILER VISUAL V1`.

---

## Current Home (as shipped)

Opening order today:

1. Giant GAGAN wordmark + tagline + notification/support icons
2. Search
3. Outstanding amount card (dominant; CreditRing; Pay / Ledger)
4. Category chips
5. Product group cards (identical bordered cards)
6. Scheme progress card (if featured scheme)
7. Active order card + 4-step timeline (or empty “no orders in progress”)
8. Greeting + salesperson card (below the fold)
9. Action tiles (Repeat / Orders / Payments / Ledger) + Offers tile
10. Info strip (free delivery / next delivery / min order)

Emotional open: **“You owe ₹X.”** Retailer identity is below the fold. Too many equal white cards.

---

## A. Data already available

From existing `GET /home` (one round-trip):

| Region | Fields |
|---|---|
| Retailer identity | `retailer.name`, `retailer.tier`, `retailer.phone` |
| Salesperson | `salesRep.name`, `salesRep.phone`, `salesRep.photoUrl` |
| Financial summary | `credit.outstanding`, `overdue`, `available`, `creditLimit`, `used`, `utilisationPct` |
| Featured scheme | `scheme.name`, `headline`, `targetAmount`, `discountAmount`, `progress`, `remaining` (null if none) |
| Active offers count | `badges.activeOffers` (count only — no offer list) |
| Notifications count | `badges.notifications` (count only — no inbox) |
| Catalog | `productGroups[]` with grouped SKUs, current prices, pack labels, `imageUrl` |
| Categories | `categories[]` |
| Quick order | `quickOrder[]` (first variant per product — not a usual-order aggregate) |
| Active order | `activeOrder` id, status, total, itemCount, createdAt, `expectedDeliveryAt` |
| Config | `freeDeliveryThreshold`, `minOrderValue`, `supportPhone` |

From other existing APIs (not on Home today):

- `GET /orders` — full history with line items and **historic** `unitPrice`
- Order detail / delivery status
- Ledger / dues / payments

Canonical images already exist (`/catalog-images/…`) and are returned on product groups.

Truthful header/hero states we can support **without new data**:

- Greeting from clock + `retailer.name`
- “Your order is on the way” when `activeOrder` is present
- “You’re ₹X away from this week’s benefit” when `scheme.remaining > 0`
- “Ready for your next stock-up?” as the default
- Next delivery cue **only** when `activeOrder.expectedDeliveryAt` is set
- Scheme hero from `scheme` (never invented)
- Active-order hero fallback
- Assortment hero from a real product group + photo

---

## B. UI that can be redesigned immediately

- Personal header (store name over wordmark)
- Search as a utility, not the emotional hero
- Compact account strip (outstanding / overdue / available + Pay / Ledger)
- Paid-up empty state
- Category pills (compact, premium selected state)
- Product merchandising: one featured group + compact rows (same SKU/pack logic)
- Pack chip presentation (selected state, tap area) — **no grouping change**
- Active order band using existing statuses only
- Loading skeletons that match the new layout
- Honest error / empty copy
- Tab bar polish (same five tabs)
- Removal of card-everywhere chrome: action tiles, gift/offers tile, giant due card, bottom greeting duplicate

---

## C. Useful content unavailable from current backend

| Wanted on Home | Why it is missing |
|---|---|
| “Your usual” aggregate (Toor 3 / Chana 2 / Rice 1 across history) | No frequency/cadence model. `quickOrder` is not that. |
| “Your usual order may be due” | No last-order interval or beat schedule |
| Recurring next delivery when nothing is in flight | `expectedDeliveryAt` exists only on an order |
| Popular / recommended ranking | No popularity or ML feed |
| Scheme detail screen | Profile already says this is later |
| Notification inbox | Badge count only; button currently does nothing |
| Offer list behind `activeOffers` | Count only |

Do **not** invent these.

---

## D. Anything that would require new functionality

Out of scope (not built):

- Recommendation / usual-order engine
- New scheme, notification, or offers screens
- SAP B1
- Changes to order math, credit, cart, SKU identity
- Salesperson / Founder / Admin visual work

### Minimal Home payload extension (implemented)

`GET /home` does not currently include last-order **line items**, so Order Again cannot be truthful from the Home payload alone.

`GET /orders` would work but downloads the full history (extra round-trip) and carries **historic** prices.

**Decision:** add `lastOrder` to the existing `GET /home` response.

- Latest **delivered** order only (not in-flight; Active Order already covers that)
- Line items keep canonical `variantId`
- `price` is **current** tier/override price from the price list already loaded for Home
- Historic `unitPrice` is never returned
- Items with no current price are omitted
- `null` when there is no delivered order with currently orderable lines

This is not a new endpoint, table, or recommendation model.

---

## New Home information architecture

| # | Section | Shown when |
|---|---|---|
| A | Personal header | Always |
| — | Search | Always |
| B | Hero / merchandising banner | Scheme, else active order, else a real product; **hidden if none** |
| C | Compact account position | Always (due strip, all-clear, or unavailable) |
| D | Order again | `lastOrder` present; otherwise a quiet first-order empty |
| E | Shop by category | Categories exist |
| F | Featured + product rows | Product groups; empty copy if none in the filter |
| G | Active order | Compact band if in flight; quiet “No active deliveries” otherwise |
| H | Salesperson | Only if `salesRep` is assigned |

Removed from Home: giant wordmark, CreditRing, action tiles, offers gift tile, info-strip card, greeting at the bottom.

---

## Non-goals for this gate

- Do not visually redesign Products / Cart / Orders / Account yet
- Do not add APIs beyond `lastOrder` on `/home`
- Do not fabricate promotional numbers
- Do not weaken order or financial tests
