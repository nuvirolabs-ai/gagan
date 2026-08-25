# Gagan Retailer Ordering App
## Product Requirements, UX, Technical Architecture & SAP Integration Specification

**Document type:** Build-ready PRD + Technical Specification  
**Product:** Gagan Retailer App  
**Audience:** Product, Design, Mobile, Backend, SAP/ERP, QA, DevOps  
**Primary use case:** Retailers place repeat and new orders for Gagan commodities such as daal, rice, atta, sugar, etc.  
**Primary integration:** SAP Business One (SAP B1) via Service Layer  
**Design direction:** Native iOS simplicity inspired by Apple system apps, adapted for high-frequency B2B ordering  
**Status:** V1 specification  
**Last updated:** 20 August 2026

---

# 1. Product Vision

Gagan Retailer App is a self-service ordering application for thousands of retailers who currently order Gagan products through salespeople, calls, WhatsApp, paper, or other offline processes.

The app should let a retailer:

1. Open the app.
2. Immediately understand account status.
3. Reorder frequently purchased products.
4. Discover current products, prices, and eligible schemes.
5. Add quantities in cases or units.
6. Place an order.
7. Have the order automatically created in SAP.
8. Track order confirmation, dispatch, delivery, invoices, payments, outstanding balance, and credit.
9. Contact the assigned salesperson when human support is needed.

The app is not intended to replace SAP. SAP remains the ERP/system of record for enterprise transactions. The Gagan platform becomes the retailer-facing experience and orchestration layer.

---

# 2. Core Product Principle

A retailer should be able to place a normal repeat order in **under 30 seconds**.

The product should optimize for:

- Few taps.
- Large tap targets.
- Clear prices.
- Clear quantities.
- Clear schemes.
- Clear credit/outstanding information.
- Fast reorder.
- Reliability on average Indian mobile networks.
- Minimal typing.
- Phone-number-first identity.
- Localized language support.
- Simple error recovery.
- No exposure of SAP complexity to retailers.

Do not make the retailer feel like they are using ERP software.

---

# 3. User Types

## 3.1 Retailer

The primary user.

Typical permissions:

- Browse permitted Gagan products.
- View retailer-specific prices.
- View eligible schemes.
- Add products to cart.
- Place orders.
- View their own orders.
- View delivery status.
- View invoices.
- View payment/ledger information.
- Make supported payments.
- View available credit.
- Raise order/delivery issues.
- Contact assigned salesperson.
- Manage store/profile details that are allowed to be edited.

## 3.2 Salesperson

Initially salesperson features may live in an internal/admin product rather than the retailer app.

Typical permissions:

- View assigned retailers.
- View retailer activity.
- See retailers who have not ordered.
- Assist in placing orders.
- See outstanding/credit information according to policy.
- Contact retailers.
- See order history.
- See scheme eligibility.
- Create follow-up tasks.

## 3.3 Distributor / C&F / Fulfilment User

Depending on Gagan's distribution model:

- View assigned orders.
- Confirm allocation.
- Process dispatch.
- Update delivery.
- Handle shortages.
- See invoices/payment state.
- Handle returns/damages.

## 3.4 Gagan Admin

- Manage retailers.
- Manage sales territories.
- Manage product visibility.
- Manage banners/content.
- Manage schemes.
- View orders.
- Inspect SAP sync.
- Retry failed integrations.
- Manage app configuration.
- View reports.
- Manage support issues.
- Suspend retailer access when required.

## 3.5 Finance / Credit Team

- View credit limits.
- View outstanding.
- View overdue invoices.
- Review blocked orders.
- View payment reconciliation.
- Review credit/debit notes.
- Approve exceptional cases where business policy permits.

---

# 4. Systems of Record

Define ownership clearly to avoid duplicated business logic.

Recommended ownership:

| Domain | System of Record |
|---|---|
| SAP Customer ID / Business Partner | SAP |
| Material / SKU master | SAP |
| Base commercial pricing | SAP |
| Tax configuration | SAP |
| Customer credit limit | SAP |
| Outstanding balance | SAP |
| Sales order | SAP |
| Delivery / shipment document | SAP |
| Billing / invoice document | SAP |
| Accounting payment posting | SAP |
| App user session | Gagan Platform |
| OTP/auth state | Gagan Platform |
| App preferences | Gagan Platform |
| Push notification tokens | Gagan Platform |
| App banners/content | Gagan Platform |
| Retailer favorites/reorder UX | Gagan Platform |
| Cached SAP data | Gagan Platform |
| SAP integration audit log | Gagan Platform |
| Support tickets | Gagan Platform unless integrated elsewhere |
| App analytics | Gagan Platform |

If Gagan already runs custom pricing, schemes, distributor logic, DMS, or secondary-sales logic outside SAP, update this ownership table before implementation.

---

# 5. Mobile Navigation

Use five primary tabs:

1. **Home**
2. **Products**
3. **Orders**
4. **Payments**
5. **Account**

Use native-feeling tab navigation.

The Home screen must not become a dashboard full of tiny widgets. It should focus on the next retailer action.

---

# 6. Native Apple-Inspired Design System

The goal is not to imitate Apple's branding. The goal is to use iOS-native interaction principles: clarity, hierarchy, restraint, familiar patterns, smooth motion, and strong typography.

## 6.1 Visual principles

- White or system grouped background.
- Large navigation title where appropriate.
- System typography.
- High information hierarchy.
- Very limited shadows.
- Prefer separators and grouped surfaces over floating cards everywhere.
- Native sheets for secondary actions.
- Native alerts for destructive/critical actions.
- Context menus where useful.
- Haptic confirmation for order placed/payment success.
- SF Symbols on iOS where licensing/platform rules permit.
- Platform-equivalent icons on Android.
- Green is the primary Gagan action/accent color.
- Red only for overdue/error/critical state.
- Blue may be used for familiar system-like links.
- Avoid gradients except marketing banners.
- Avoid excessive illustration.
- Product photography should be accurate and consistent.

## 6.2 Typography

Suggested semantic hierarchy:

- Large title: 34 pt / bold
- Screen title: 28 pt / bold
- Section title: 20–22 pt / semibold
- Primary value: 24–32 pt / bold
- Body: 17 pt
- Secondary body: 15 pt
- Caption: 12–13 pt

Do not hardcode iOS points identically on Android. Use equivalent scalable tokens.

## 6.3 Tap targets

Minimum interactive target:

- iOS: approximately 44 × 44 points.
- Android: use platform accessibility guidance.

## 6.4 Accessibility

- Dynamic text sizing.
- Minimum contrast compliance.
- Never rely only on green/red color.
- VoiceOver/TalkBack labels.
- Buttons must have explicit accessible labels.
- Product image alt/accessibility text.
- Loading states must be announced when necessary.

---

# 7. Authentication & Retailer Onboarding

## 7.1 Login

Primary login:

**Mobile number → OTP → retailer account**

Flow:

1. Enter mobile number.
2. Verify format.
3. Send OTP.
4. Enter OTP.
5. Backend verifies OTP.
6. Match mobile number to approved retailer record.
7. If one retailer account exists, sign in.
8. If multiple stores are associated with the number, show store selector.
9. Create app session.
10. Load retailer configuration and SAP-linked identifiers.

## 7.2 Unknown phone number

If a phone number is not recognized:

Show:

> We could not find a Gagan retailer account linked to this number.

Actions:

- Request retailer registration.
- Call Gagan support.
- Contact salesperson if a mapped lead exists.

Do not automatically create an ERP customer from an unverified phone number.

## 7.3 Retailer identity mapping

Minimum mapping:

```text
app_user_id
mobile_number
retailer_id
sap_business_partner_id
sap_customer_id
sales_organization
distribution_channel
division
plant_or_fulfilment_center
shipping_condition
price_list_or_pricing_group
sales_office
sales_group
territory_id
salesperson_id
default_ship_to_id
default_bill_to_id
currency
language
is_active
```

The exact SAP fields vary by implementation. Confirm them with the SAP functional team.

## 7.4 Session security

Recommended:

- Access token: short-lived.
- Refresh token: rotating.
- Refresh tokens stored securely.
- iOS Keychain / Android Keystore.
- Device/session revocation.
- Server-side rate limiting.
- OTP attempt limits.
- OTP expiry.
- Fraud monitoring.
- Optional device binding for high-risk operations.

---

# 8. Home Screen Specification

## 8.1 Header

Elements:

- Large title: **Gagan**
- Notification icon.
- Optional overflow/settings icon.

Do not place a giant marketing logo at the top. The app should feel native.

## 8.2 Greeting

Example:

**Hello, Mahesh Store**  
Good morning.

Right-side or secondary row:

**Ravi Kumar**  
Your Salesman >

Tap opens salesperson details:

- Name.
- Phone.
- WhatsApp if company policy permits.
- Assigned territory.
- Call action.
- Support/escalation action.

## 8.3 Account Summary

Show:

### Outstanding Amount
₹68,000

Overdue: ₹18,500

Action: **View Ledger**

### Credit Limit
₹1,00,000

Used: ₹68,000  
Available: ₹32,000

The source should normally be SAP/finance data.

Do not let stale data silently appear current. Store:

- Last synced timestamp.
- Sync status.
- Data source.

If data is stale beyond policy threshold, display:

> Updated 2 hours ago

and refresh in background.

## 8.4 Scheme / Growth Banner

Example:

**GOLD SCHEME**

Buy ₹25,000 this week  
& get ₹500 discount

You are ₹8,700 away from unlocking.

Requirements:

- Only show schemes eligible for the retailer.
- Show actual calculation rules.
- Scheme value must be confirmed server-side.
- App-side calculation is for preview only.
- Final commercial validation occurs on backend/SAP/rules engine.
- Banner should deep-link to eligible products.

## 8.5 Order Again

Horizontal list or compact grouped list of frequently purchased SKUs.

Each item:

- Product image.
- Product name.
- Pack configuration.
- Case price.
- Optional MRP.
- Quantity control.
- Add button.

Source ranking:

1. Last order.
2. Most frequently ordered.
3. Recently ordered.
4. Predictive reorder later.

Actions:

- Add 1 case.
- Increase/decrease.
- Open product details.
- See all reorder items.

## 8.6 Current Order

Show the most relevant open order:

**Order #GGN-38291**  
₹42,850  
Out for Delivery  
Expected today by 6:00 PM

Tap opens order detail.

## 8.7 Delivery Information

Compact grouped row:

- Free delivery threshold.
- Next delivery day/date.
- Minimum order value.

These values can vary by geography/distributor/retailer and must be configuration driven.

## 8.8 Top Categories

Example:

- Daal
- Rice
- Atta
- Sugar
- More

Tap category → prefiltered Products screen.

---

# 9. Products Screen

## 9.1 Purpose

Let retailers find and order products with minimal friction.

## 9.2 Header

- Search field.
- Optional filter icon.
- Cart button with item count.

Search should support:

- Product name.
- Common alternate name.
- SKU/code where retailers know it.
- Category.
- Pack size.

## 9.3 Category chips

Examples:

- All
- Daal
- Rice
- Atta
- Sugar
- New
- Offers

## 9.4 Product list item

Required:

- Product image.
- Product name.
- Variant.
- Pack size.
- Case configuration.
- Retailer price.
- Optional MRP.
- Effective margin if business wants to expose it.
- Scheme tag.
- Availability indicator.
- Quantity control.

Example:

```text
Gagan Toor Dal
1 kg × 30

₹3,150 / case
MRP ₹120 / unit

Scheme: Buy 10 cases, save ₹300

[-] 3 cases [+]
```

## 9.5 Product detail

Fields:

- Hero product image.
- Product name.
- SKU.
- Category.
- Pack size.
- Case configuration.
- Retailer price.
- MRP.
- Tax information if applicable.
- Retailer margin.
- Active scheme.
- Minimum order quantity.
- Maximum allowed quantity if applicable.
- Availability.
- Expected fulfilment.
- Product description.
- Ingredients/nutrition only if relevant to packaged product and available.
- Add to cart.

## 9.6 Price behavior

Never trust price sent from the mobile client.

Mobile sends:

```json
{
  "materialId": "SAP_MATERIAL_ID",
  "quantity": 10,
  "unit": "CS"
}
```

Backend calculates/validates:

- Current allowed price.
- Customer-specific pricing.
- Taxes.
- Schemes.
- Minimums.
- Availability.
- Credit/payment eligibility.

---

# 10. Cart

## 10.1 Cart line

Each line:

- Image.
- Product.
- Pack configuration.
- Unit/case price.
- Quantity.
- Line subtotal.
- Scheme impact.
- Remove.

## 10.2 Cart totals

Example:

```text
Product value                 ₹28,500
Scheme discount                 -₹750
Retailer discount               -₹300
Delivery                           ₹0
Tax                         Included / ₹X
---------------------------------------
Estimated payable             ₹27,450
```

The label "Estimated" should be used until final server-side/SAP validation returns the final order values.

## 10.3 Commercial nudges

Useful nudges:

> Add ₹2,200 more for free delivery.

> Add 2 more cases of Toor Dal to unlock ₹300 scheme discount.

These must be truthful and backed by rules.

## 10.4 Checkout eligibility

Before enabling Place Order:

- Retailer is active.
- Cart not empty.
- Quantities valid.
- MOQ met.
- Minimum order met.
- Products still orderable.
- Ship-to address valid.
- Payment/credit option allowed.
- No policy block that prevents ordering.

---

# 11. Checkout

## 11.1 Shipping

Normally default retailer store address from SAP/master data.

If multiple ship-to addresses exist:

- Select ship-to.
- Do not allow arbitrary address creation unless business process supports it.

## 11.2 Delivery

Show:

- Expected delivery date/window.
- Fulfilment source if relevant.
- Delivery notes field if permitted.

## 11.3 Payment method

Possible methods depending on policy:

- Credit.
- UPI.
- Net banking/payment gateway.
- Pay on delivery.
- Advance payment.

Availability must be retailer-specific.

## 11.4 Final validation

On checkout:

1. Mobile calls `POST /checkout/validate`.
2. Backend reloads authoritative data.
3. Backend revalidates prices/schemes/availability/credit.
4. Backend returns final commercial snapshot.
5. Retailer confirms.
6. Mobile calls `POST /orders`.
7. Backend creates internal order intent.
8. Backend submits order to SAP.
9. SAP returns sales order/document number.
10. Backend marks order `CONFIRMED_BY_SAP`.
11. Mobile shows success.

If SAP is temporarily unavailable, see the integration reliability rules later in this document.

## 11.5 Confirmation screen

Native full-screen success.

Example:

**Order placed**

Order #GGN-38291  
SAP Sales Order #1234567890

₹42,850

Expected delivery: 19 Aug

Actions:

- View order.
- Continue shopping.

Do not expose the SAP number prominently unless it is useful operationally. It can remain in order details.

---

# 12. Orders

## 12.1 Order list

Segments/filters:

- Active
- Delivered
- Cancelled
- All

Order row:

- Gagan order number.
- Date.
- Value.
- Status.
- Expected delivery.
- Item count.

## 12.2 Status model

Consumer-facing statuses:

```text
Pending Confirmation
Confirmed
Processing
Packed
Dispatched
Out for Delivery
Delivered
Partially Delivered
Cancelled
Action Required
```

SAP has more technical statuses. Map those to a simpler retailer-facing state.

## 12.3 Order detail

Sections:

### Status
Timeline.

### Products
Ordered lines.

### Commercial summary
Subtotal, discount, taxes, final.

### Delivery
Expected delivery, shipment, proof if available.

### Invoice
Invoice number, date, amount, PDF.

### Payment
Paid/unpaid/partial/credit.

### Support
Report issue / contact support / contact salesperson.

### Reorder
Add order contents to a new cart, then re-price using current pricing.

Never clone an old order with old pricing.

---

# 13. Payments & Ledger

## 13.1 Summary

Show:

```text
Outstanding       ₹68,000
Overdue           ₹18,500
Credit Limit    ₹1,00,000
Available Credit  ₹32,000
```

## 13.2 Ledger

Rows:

- Invoice.
- Payment.
- Credit note.
- Debit note.
- Adjustment.

Fields:

- Date.
- Document number.
- Description.
- Debit.
- Credit.
- Balance.
- Due date.
- Status.

## 13.3 Outstanding invoices

Allow retailer to see:

- Invoice number.
- Invoice date.
- Due date.
- Original amount.
- Paid amount.
- Outstanding amount.
- Days overdue.

## 13.4 Payment flow

If online payments are supported:

1. Select invoices or amount.
2. Choose payment method.
3. Backend creates payment intent.
4. Payment provider presents secure flow.
5. Provider webhook confirms payment.
6. Backend updates local state.
7. Payment is posted/reconciled to SAP according to finance process.
8. Ledger refreshes after reconciliation.

Never mark an invoice permanently paid based only on the mobile client returning "success."

---

# 14. Account

Sections:

- Store details.
- GST details if shown.
- Billing address.
- Shipping address.
- Assigned salesperson.
- Preferred language.
- Notification preferences.
- Help & support.
- Terms & conditions.
- Privacy policy.
- App version.
- Logout.

Sensitive master-data edits should go through an approval process instead of immediately overwriting SAP.

---

# 15. Notifications

## 15.1 Transactional

Examples:

- Order received.
- Order confirmed.
- Order rejected/action required.
- Order dispatched.
- Out for delivery.
- Delivered.
- Invoice generated.
- Payment received.
- Payment due.
- Payment overdue.

## 15.2 Commercial

Examples:

- New scheme.
- Scheme about to expire.
- ₹X away from threshold.
- New product.
- Reorder reminder.

## 15.3 Rules

- Respect preferences where legally/business appropriate.
- Critical transactional notifications may be mandatory.
- Avoid spam.
- Store notification history.
- Deep-link notifications to correct screen.

---

# 16. Search, Reorder & Recommendations

## V1

- Search products.
- Last order.
- Order again.
- Frequent items.

## V2

Recommendation engine inputs:

- SKU purchase frequency.
- Days since last order.
- Typical reorder cycle.
- Average quantity.
- Seasonality.
- Territory.
- Scheme eligibility.
- Stock availability.

Example:

> You usually order Gagan Basmati Rice every 11 days. It has been 14 days.

Action:

**Add usual 4 cases**

Any recommendation must still be re-priced and revalidated.

---

# 17. Returns, Damages & Shortages

Depending on Gagan's current process, support:

- Missing quantity.
- Damaged goods.
- Wrong SKU.
- Quality issue.
- Delivery issue.
- Invoice mismatch.

Issue creation:

```text
Order
Product
Issue type
Quantity
Photo(s)
Description
Preferred resolution
```

Backend creates support case.

If SAP has return-order/credit-note workflows, integrate in a later phase after core ordering is stable.

---

# 18. Admin Web App

A separate internal web app is recommended.

Suggested navigation:

- Dashboard
- Orders
- Retailers
- Products
- Schemes
- Payments
- SAP Sync
- Notifications
- Support
- Users & Roles
- Settings

## 18.1 SAP Sync dashboard

This is critical.

Show:

- Sync health.
- Last successful sync.
- Orders awaiting SAP.
- Orders failed.
- Retry count.
- Last error.
- SAP document number.
- Correlation ID.
- Manual retry.
- Dead-letter queue.
- Integration latency.

Admin users must never need database access to discover why a retailer order failed.

---

# 19. Recommended Technical Stack

This stack is one pragmatic option, not a requirement.

## Mobile

- React Native
- TypeScript
- Expo development workflow with native/prebuild capability when required
- React Navigation
- TanStack Query for server state
- Zustand or equivalent for lightweight local UI/cart state
- Secure storage backed by Keychain/Keystore
- Native push notifications
- Crash/error reporting

Reason:

- One codebase for iOS and Android.
- Ability to produce native-feeling UI.
- Strong TypeScript ecosystem.
- Appropriate for a retailer user base where Android is likely important.

## Backend

- Node.js
- TypeScript
- NestJS or similarly structured framework
- PostgreSQL
- Redis
- Queue system such as BullMQ, SQS, RabbitMQ, Kafka, or enterprise equivalent
- Object storage for documents/images
- OpenAPI
- Structured logging
- Distributed tracing

## Admin

- Next.js
- TypeScript
- Component library designed to match internal product needs
- Role-based access control

## Infrastructure

Could run on:

- AWS
- Azure
- GCP
- SAP BTP
- Existing Gagan infrastructure

Selection should consider current SAP network topology and IT policies.

---

# 20. High-Level Architecture

```text
┌────────────────────────────┐
│ Gagan Retailer App         │
│ iOS + Android              │
└──────────────┬─────────────┘
               │ HTTPS
               ▼
┌────────────────────────────┐
│ API Gateway / WAF          │
└──────────────┬─────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│ Gagan Application Backend                   │
│                                             │
│ Auth                                        │
│ Retailer mapping                            │
│ Product/catalog facade                      │
│ Pricing facade                              │
│ Cart / Checkout                             │
│ Orders                                      │
│ Credit / Outstanding                        │
│ Invoices / Ledger                           │
│ Notifications                               │
│ Support                                     │
│ SAP B1 Adapter                              │
└───────┬────────┬────────┬─────────┬─────────┘
        │        │        │         │
        ▼        ▼        ▼         ▼
   PostgreSQL  Redis    Queue     Object Store
                                      │
                                      ▼
                              Product/Invoice files

               │
               ▼
┌─────────────────────────────────────────────┐
│ SAP B1 Integration Boundary                 │
│                                             │
│ SAP Business One Service Layer              │
│ Preferred: OData v4                         │
│ Service root: /b1s/v2                       │
│ HTTPS only                                  │
│ Backend-managed SAP session/auth            │
└───────────────────┬─────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│ SAP Business One                            │
│                                             │
│ BusinessPartners                            │
│ Items / ItemPrices                          │
│ ItemWarehouseInfoCollection                 │
│ Orders                                      │
│ DeliveryNotes                               │
│ Invoices                                    │
│ IncomingPayments                            │
│ Credit Notes / relevant financial objects   │
│ UDF / UDT / UDO data                        │
└─────────────────────────────────────────────┘
```

The retailer app must never connect directly to SAP B1. Only the Gagan backend communicates with Service Layer.

---

# 21. SAP Business One Integration Strategy

## 21.1 Primary integration interface

Use **SAP Business One Service Layer** as the preferred integration boundary.

For current SAP Business One releases:

```text
OData v4 root:
https://<sap-host>:<port>/b1s/v2
```

The exact host, port, TLS certificate, authentication method, patch level and available objects must be verified in Gagan's SAP B1 environment.

OData v3 `/b1s/v1` may still exist for compatibility, but new development should target v4 where supported by the installed B1 release.

## 21.2 Fundamental rule

```text
Retailer App
     ↓
Gagan Backend
     ↓
SAP B1 Service Layer
     ↓
SAP Business One
```

Do not:

- Store B1 credentials in the mobile app.
- Expose the Service Layer endpoint publicly to retailer devices.
- Let the app issue `POST /Orders` itself.
- Trust prices, customer codes or warehouse codes coming from the phone.
- Let mobile retry logic create duplicate SAP documents.

## 21.3 Why the backend is required

The backend provides:

- Retailer authentication.
- Mapping app user → B1 `CardCode`.
- Product authorization.
- Pricing validation.
- Warehouse rules.
- Quantity/UOM validation.
- Credit policy.
- Idempotency.
- Retry handling.
- SAP session management.
- Error translation.
- Audit logs.
- Caching.
- Reconciliation.
- Push notifications.
- Protection from future B1 API changes.

## 21.4 Main SAP B1 entities for Gagan

Recommended initial mapping:

| Retailer-app domain | SAP B1 Service Layer area |
|---|---|
| Retailer / customer | `BusinessPartners` |
| Product / SKU | `Items` |
| Standard price lists | `ItemPrices` / item price-list data |
| Customer/item calculated price | `CompanyService_GetItemPrice` where appropriate |
| Inventory by warehouse | `ItemWarehouseInfoCollection` |
| Sales order | `Orders` |
| Delivery | `DeliveryNotes` |
| A/R Invoice | `Invoices` |
| Incoming payment | `IncomingPayments` |
| Credit memo | `CreditNotes` / configured object |
| Custom fields | UDFs exposed in entity metadata |
| Custom tables / objects | UDTs / UDOs where exposed/configured |

The exact object names and properties must be confirmed from the live UAT Service Layer `$metadata`.

---

# 22. SAP B1 Authentication & Session Management

SAP B1 Service Layer supports a login/session model in many installations.

Typical login flow:

```http
POST /b1s/v2/Login
Content-Type: application/json
```

Example conceptual payload:

```json
{
  "CompanyDB": "GAGAN_UAT",
  "UserName": "gagan_api_user",
  "Password": "SECRET_FROM_SECRET_MANAGER"
}
```

A successful login returns a B1 session and typically sets the `B1SESSION` cookie. Depending on topology, `ROUTEID` can also be used for load-balancer stickiness.

Backend responsibilities:

1. Keep SAP credentials only in a secrets manager.
2. Create/reuse a valid B1 session.
3. Store session cookies only server-side.
4. Detect `401` / invalid-session responses.
5. Re-authenticate safely.
6. Retry the original read request once when appropriate.
7. Never trigger duplicate document creation during authentication retry.
8. Support environment-specific CompanyDB values.
9. Log login failures without logging passwords.

Some modern B1/IAM deployments can use access-token based authentication. The exact mode must be confirmed from Gagan's installed B1 version and IAM configuration. The `SapB1Gateway` must isolate the rest of the application from this difference.

---

# 23. SAP B1 Adapter Abstraction

Create one interface used by the Gagan domain layer:

```ts
interface SapB1Gateway {
  // Customer
  getBusinessPartner(cardCode: string): Promise<B1BusinessPartner>;
  getCustomerFinancialSummary(cardCode: string): Promise<CustomerFinancialSummary>;

  // Catalog
  getItem(itemCode: string): Promise<B1Item>;
  listSellableItems(input: ItemQuery): Promise<B1Item[]>;
  getItemPrice(input: ItemPriceInput): Promise<ItemPriceResult>;
  getAvailability(input: AvailabilityInput): Promise<AvailabilityResult>;

  // Sales
  createSalesOrder(input: CreateSalesOrderInput): Promise<B1SalesOrderResult>;
  getSalesOrder(docEntry: number): Promise<B1SalesOrder>;
  findSalesOrderByExternalReference(reference: string): Promise<B1SalesOrder | null>;

  // Fulfilment
  getDeliveries(input: DeliveryQuery): Promise<B1Delivery[]>;

  // Billing / finance
  getInvoices(input: InvoiceQuery): Promise<B1Invoice[]>;
  getIncomingPayments(input: PaymentQuery): Promise<B1IncomingPayment[]>;
  getLedger(input: LedgerQuery): Promise<LedgerSnapshot>;

  // Custom B1 configuration
  getUserDefinedData(input: UserDefinedQuery): Promise<unknown>;
}
```

Implementations:

```text
SapB1ServiceLayerGateway
SapB1MockGateway
```

No route/controller should call raw Service Layer URLs directly.

---

# 24. SAP B1 Retailer / Business Partner Mapping

Each approved retailer must map to the SAP B1 customer record.

Minimum local mapping:

```text
retailer_id
app_user_id
mobile_number

sap_card_code
sap_card_name

default_ship_to_code
default_bill_to_code

default_price_list
default_warehouse_code

salesperson_code
territory_id

currency
payment_terms_code

is_active
last_b1_sync_at
```

The SAP B1 `CardCode` is the critical foreign identifier.

Example:

```text
Retailer App:
Mahesh Store

Internal retailer_id:
ret_01J...

SAP B1:
CardCode = C0001842
```

When Mahesh Store logs in, the retailer app must never be allowed to supply an arbitrary `CardCode`. The backend resolves it from the authenticated retailer record.

Important customer data may include:

- `CardCode`.
- `CardName`.
- Customer type/status.
- Addresses.
- contact information.
- price-list association.
- payment terms.
- credit limit.
- current account balance.
- salesperson.
- tax/GST-related fields as configured.
- UDFs used by Gagan.

Do not assume every field required by Gagan is standard. Existing Gagan B1 implementations may rely heavily on UDFs.

---

# 25. SAP B1 Product, Pricing & Inventory Mapping

## 25.1 Products

Primary SAP B1 object:

```text
Items
```

Common information to map:

```text
ItemCode
ItemName
SalesItem
InventoryItem
SalesUnit
PurchaseUnit
InventoryUOM
ItemGroup
Barcodes where applicable
ItemPrices
ItemWarehouseInfoCollection
UDFs
```

The exact property names must come from `$metadata` for the installed version.

The app-local product record should contain a stable mapping:

```text
product_id
sap_item_code
display_name
category
pack_size
case_configuration
image_url
is_active
order_uom
default_warehouse_code
last_b1_sync_at
```

Product photography and merchandising content can remain in the Gagan platform even if the transactional SKU comes from B1.

## 25.2 Pricing

Do not accept the price from the mobile client.

Potential B1 sources include:

- Item price-list data.
- Business Partner's assigned price list.
- Special pricing/discount configuration.
- `CompanyService_GetItemPrice` where it correctly models Gagan's customer/item pricing.
- UDF/UDO/custom scheme logic if Gagan's SAP implementation uses custom structures.

Recommended pattern:

```text
Products screen:
cached/fast indicative price

Cart:
server-calculated price

Checkout:
authoritative B1/commercial validation

Sales Order:
allow B1 to validate/derive final commercial result according to configured business rules
```

The SAP B1 functional consultant must verify whether Gagan expects the order API payload to explicitly set `UnitPrice`, `DiscountPercent`, price-list related fields, or let B1 calculate them.

## 25.3 Inventory

Inventory may be available through item warehouse information.

Conceptual calculation:

```text
Warehouse stock
- committed stock
+ optionally incoming stock
= availability signal
```

Do not implement that formula blindly. Gagan's definition of "available to sell" must be confirmed.

For retailer UX prefer:

```text
Available
Low availability
Temporarily unavailable
Expected by <date>
```

rather than exposing exact warehouse stock unless the business wants it.

At checkout, validate the appropriate warehouse again.

---

# 26. SAP B1 Sales Order Creation

This is the central transaction.

## 26.1 Gagan API request

```http
POST /api/v1/orders
Idempotency-Key: <uuid>
Authorization: Bearer <retailer-session>
```

Mobile sends only retailer-controlled choices:

```json
{
  "cartVersion": "c_01J...",
  "shipToId": "MAIN",
  "paymentMethod": "CREDIT",
  "deliveryNote": "Deliver after 12 PM"
}
```

The backend resolves:

- `CardCode`.
- SAP item codes.
- warehouse.
- price/pricing policy.
- tax behavior.
- UOM.
- sales employee or UDF references.
- external reference.
- delivery date.
- any mandatory custom fields.

## 26.2 Conceptual B1 Service Layer order

Typical shape:

```http
POST /b1s/v2/Orders
```

Conceptual payload:

```json
{
  "CardCode": "C0001842",
  "DocDueDate": "2026-08-21",
  "Comments": "Gagan Retailer App Order",
  "NumAtCard": "GGN-38291",
  "DocumentLines": [
    {
      "ItemCode": "DAL-TOOR-1KG",
      "Quantity": 10,
      "WarehouseCode": "WH01"
    },
    {
      "ItemCode": "DAL-CHANA-1KG",
      "Quantity": 5,
      "WarehouseCode": "WH01"
    }
  ]
}
```

This is illustrative only. Gagan's actual B1 installation may require:

- Different warehouse.
- Tax fields.
- unit-of-measure fields.
- `ShipToCode`.
- `PayToCode`.
- salesperson.
- branch/BPL.
- project.
- distribution rules.
- freight.
- custom UDFs.
- approval-related information.

The UAT SAP team must provide a known-good payload.

## 26.3 Store both identifiers

B1 commonly distinguishes between:

```text
DocEntry  = internal document key
DocNum    = displayed business document number
```

Store both.

Recommended:

```text
sap_doc_entry
sap_doc_num
```

Use `DocEntry` for API retrieval where appropriate, but show the retailer a Gagan-friendly order number and/or `DocNum` according to business preference.

---

# 27. End-to-End Order Lifecycle

```text
Retailer taps Place Order
        ↓
Gagan API authenticates retailer
        ↓
Resolve SAP B1 CardCode
        ↓
Reload cart
        ↓
Validate ItemCodes / UOM / warehouse
        ↓
Re-price cart
        ↓
Check credit/order policy
        ↓
Create immutable order intent
        ↓
Generate Gagan order number
        ↓
Write idempotency record
        ↓
Submit POST /Orders to B1 Service Layer
        ↓
SAP B1 creates Sales Order
        ↓
Return DocEntry + DocNum
        ↓
Persist SAP identifiers
        ↓
Mark CONFIRMED_BY_SAP
        ↓
Notify retailer
```

Recommended order fields:

```text
id
gagan_order_number
retailer_id

sap_card_code
sap_doc_entry
sap_doc_num

status
payment_method
currency

subtotal
discount_total
tax_total
grand_total

ship_to_code
warehouse_code

requested_delivery_date
expected_delivery_date

created_at
submitted_to_b1_at
confirmed_by_b1_at
last_synced_at

idempotency_key
external_reference
commercial_snapshot_json
integration_correlation_id

failure_code
failure_message
```

Order item snapshot:

```text
id
order_id
product_id
sap_item_code
product_name_snapshot
uom
warehouse_code
quantity
unit_price_snapshot
discount_snapshot
tax_snapshot
line_total
scheme_snapshot_json
```

Snapshots are required because SAP master/pricing data can change after order placement.

---

# 28. Sync Patterns

# 28. Sync Patterns

Use different patterns for different data.

## 28.1 Scheduled sync

Suitable for:

- Product master.
- Category.
- retailer master.
- static configuration.

## 28.2 Near-real-time event/webhook/message

Suitable if SAP landscape supports it:

- Sales order changes.
- Delivery updates.
- Billing/invoice.
- Payment reconciliation.

## 28.3 Pull polling

Fallback when events are unavailable:

- Poll open orders more frequently.
- Poll completed orders less frequently.
- Stop polling after final state.

Avoid polling the complete historical dataset repeatedly.

---

# 29. Local Database Model

Core tables:

```text
users
retailers
retailer_users
salespeople
territories

products
product_categories
product_images
retailer_product_visibility

price_snapshots
scheme_definitions
retailer_scheme_eligibility

carts
cart_items

orders
order_items
order_status_events

deliveries
delivery_items

invoices
invoice_items
ledger_entries

payments
payment_attempts
payment_reconciliations

notifications
push_tokens

support_cases
support_case_attachments

sap_sync_jobs
sap_sync_events
sap_api_logs
integration_dead_letters

audit_logs
feature_flags
app_config
```

---

# 30. Core API Specification

Base:

```text
/api/v1
```

## Auth

```text
POST /auth/otp/request
POST /auth/otp/verify
POST /auth/refresh
POST /auth/logout
GET  /me
```

## Home

```text
GET /home
```

Prefer a purpose-built aggregate endpoint to avoid 10–15 mobile requests.

Example:

```json
{
  "retailer": {},
  "salesperson": {},
  "accountSummary": {},
  "schemeHighlight": {},
  "reorderProducts": [],
  "activeOrder": {},
  "deliveryInfo": {},
  "categories": []
}
```

## Products

```text
GET /products
GET /products/:id
GET /categories
GET /products/search?q=
```

## Cart

```text
GET    /cart
POST   /cart/items
PATCH  /cart/items/:id
DELETE /cart/items/:id
POST   /cart/reprice
POST   /checkout/validate
```

## Orders

```text
POST /orders
GET  /orders
GET  /orders/:id
POST /orders/:id/reorder
POST /orders/:id/cancel-request
```

## Payments

```text
GET  /account/summary
GET  /ledger
GET  /invoices
GET  /invoices/:id
POST /payments/intents
GET  /payments/:id
```

## Support

```text
POST /support/cases
GET  /support/cases
GET  /support/cases/:id
POST /support/cases/:id/messages
POST /support/cases/:id/attachments
```

## Notifications

```text
GET   /notifications
PATCH /notifications/:id/read
POST  /devices/push-token
```

---

# 31. API Response Rules

Standard success envelope is optional. Prefer conventional HTTP semantics.

Standard error:

```json
{
  "error": {
    "code": "ORDER_CREDIT_REVIEW_REQUIRED",
    "message": "Your account requires review before this order can be confirmed.",
    "requestId": "req_01J..."
  }
}
```

Never use raw SAP messages as `message`.

Keep technical metadata server-side.

---

# 32. Security Requirements

## Mobile/API

- TLS only.
- WAF/API gateway.
- Rate limits.
- OTP abuse protection.
- Device/session revocation.
- Secure token storage.
- Input validation.
- No secrets in app binary.
- No SAP credentials in app.
- Certificate pinning only if operations can manage its lifecycle safely.

## Backend

- Principle of least privilege.
- Network segregation.
- Secrets manager.
- Encrypted database.
- Encrypted backups.
- RBAC.
- Admin MFA.
- Immutable audit trail for sensitive operations.
- Log redaction.
- No OTP, token, password, bank credential, or full secrets in logs.

## SAP

- Dedicated technical integration identity.
- Minimum SAP authorizations.
- Separate credentials/environments for dev/UAT/prod.
- Rotate credentials/certificates.
- IP/network restrictions where applicable.
- Monitor integration user activity.

---

# 33. Privacy

Store only data required for business operation.

Consider:

- Phone number.
- Store/contact name.
- Business addresses.
- GST/company identifiers.
- Order/payment data.
- Device tokens.
- Support attachments.

Provide:

- Privacy policy.
- Data retention rules.
- Support process for account/access requests.
- Controlled admin access to personal/business data.

Legal/compliance requirements should be reviewed for applicable Indian laws and Gagan's own policies before launch.

---

# 34. Performance Targets

Suggested targets, to be finalized with engineering:

- App launch to usable cached Home: < 2 seconds on a reasonable device.
- Fresh Home API p95: < 1.5 seconds where downstream systems permit.
- Product list pagination: < 1 second perceived response after cache.
- Cart quantity interaction: immediate local UI.
- Checkout validation: ideally < 3 seconds.
- Order submission: show deterministic processing state even if SAP takes longer.
- No duplicate orders.
- App remains usable when a noncritical SAP read is temporarily unavailable.

---

# 35. Offline & Poor Network Behavior

Retailers may operate on inconsistent networks.

Support:

- Cached Home.
- Cached products.
- Cached order history.
- Local cart.
- Retry reads.
- Clear stale-data indicator.

Do **not** silently finalize orders offline.

If user taps Place Order while offline:

> You're offline. Your cart is saved. Connect to the internet to place the order.

This avoids uncertain/duplicate ERP transactions.

---

# 36. Observability

Every important request should have:

```text
request_id
user_id
retailer_id
gagan_order_id
sap_customer_id
sap_order_id
integration_correlation_id
```

Monitor:

- API uptime.
- p50/p95/p99 latency.
- OTP success.
- Login failures.
- Checkout failures.
- Order conversion.
- SAP creation success.
- SAP latency.
- SAP error rate.
- Duplicate prevention events.
- Queue depth.
- Dead letters.
- Payment webhook errors.
- Push failures.

---

# 37. Product Analytics

Key funnel:

```text
App Open
→ Product Viewed
→ Product Added
→ Cart Viewed
→ Checkout Started
→ Checkout Validated
→ Place Order Tapped
→ SAP Confirmed
→ Delivered
```

Events:

```text
app_opened
home_viewed
product_searched
category_opened
product_viewed
product_added
product_removed
cart_quantity_changed
scheme_viewed
scheme_threshold_reached
checkout_started
checkout_validation_failed
order_submitted
order_confirmed
order_failed
order_reordered
ledger_opened
invoice_opened
payment_started
payment_success
payment_failed
salesperson_called
support_case_created
```

Never put unnecessary sensitive financial/customer payloads into analytics tools.

---

# 38. Business KPIs

Measure:

- Monthly active retailers.
- Weekly active retailers.
- Percentage ordering through app.
- Orders per retailer.
- Average order value.
- Repeat order rate.
- Time to place repeat order.
- Cart conversion rate.
- Scheme participation.
- Percentage of orders needing salesperson intervention.
- SAP order success rate.
- Credit-block rate.
- Payment collection through app.
- Reduction in manual order entry.
- Reduction in order-entry errors.

---

# 39. Feature Flags

Use server-controlled flags.

Examples:

```text
payments_enabled
online_upi_enabled
schemes_enabled
credit_summary_enabled
ledger_enabled
recommendations_enabled
support_cases_enabled
returns_enabled
show_mrp
show_margin
show_stock
allow_piece_ordering
allow_case_ordering
```

Flags can also vary by:

- retailer.
- territory.
- distributor.
- app version.
- platform.

This allows phased rollout.

---

# 40. Localization

Recommended initial architecture supports:

- English.
- Hindi.
- Regional languages later.

Do not embed business text directly throughout components.

Use localization keys.

Example:

```text
home.greeting
home.outstanding
home.creditLimit
home.orderAgain
orders.outForDelivery
checkout.placeOrder
```

Product names may require localized master/marketing data separately.

---

# 41. Design of Empty/Error States

Examples:

## No orders

**No orders yet**

Your Gagan orders will appear here after you place your first order.

Button: **Browse Products**

## No outstanding

**You're all clear**

No payment is currently due.

## SAP/account data unavailable

**Account details are temporarily unavailable**

You can continue browsing products. Try again shortly.

Do not show technical integration terminology.

---

# 42. Order Cancellation

Cancellation must reflect actual SAP/operations capability.

Possible policy:

- Before SAP confirmation: allow cancel request.
- After SAP confirmation but before processing: attempt cancellation.
- After dispatch: cancellation unavailable; support flow.

Never promise cancellation until SAP/operations confirms it.

Status:

```text
Cancellation Requested
Cancellation Confirmed
Cancellation Declined
```

---

# 43. Scheme Engine

Schemes can become complex.

Model conceptually:

```text
scheme_id
name
description
start_at
end_at
eligible_customer_group
eligible_territory
eligible_materials
condition_type
threshold
reward_type
reward_value
max_uses
stacking_rule
priority
funding_source
sap_condition_reference
```

Examples:

- Buy ₹25,000 → ₹500 off.
- Buy 10 cases → ₹300 off.
- Buy 20 cases → 1 free.
- Category threshold.
- SKU mix.
- Monthly target.

Critical:

The app may visually calculate progress, but authoritative scheme eligibility/settlement must match the actual commercial system.

If SAP already manages these conditions, do not build a competing financial truth in the app.

---

# 44. Credit Logic

Possible states:

```text
AVAILABLE
LOW_CREDIT
LIMIT_REACHED
OVERDUE
BLOCKED
MANUAL_REVIEW
UNAVAILABLE
```

Home can show summary.

Checkout must use authoritative policy.

Important distinction:

A retailer can have:

- credit limit ₹1,00,000,
- used ₹68,000,
- available ₹32,000,

but still be blocked due to overdue/policy rules.

Do not infer order eligibility solely from `limit - used`.

---

# 45. Inventory / Availability

Decide what Gagan wants to expose:

### Option A
In stock / unavailable only.

### Option B
Expected delivery date.

### Option C
Exact quantity.

For most B2B retailer experiences, exact warehouse stock may reveal unnecessary operational information. A sellable/not-sellable or expected-delivery view is often enough.

Actual ATP/availability must be confirmed during checkout/order creation if required.

---

# 46. Invoice Documents

If SAP produces invoice PDFs or documents:

Preferred behavior:

1. App requests invoice.
2. Backend authorizes ownership.
3. Backend fetches or retrieves cached document.
4. Backend returns short-lived secure download/view URL.
5. Document is not public.

Do not expose a predictable unauthenticated SAP document URL.

---

# 47. Push Notification Architecture

```text
SAP event / backend event
        ↓
Notification service
        ↓
Preference check
        ↓
Template render
        ↓
APNs / FCM
        ↓
Retailer device
```

Store:

```text
notification_id
user_id
type
title
body
deep_link
created_at
sent_at
delivered_at_if_available
read_at
```

---

# 48. Environments

Minimum:

```text
Development
UAT
Production
```

Prefer separate:

- databases.
- secrets.
- SAP endpoints.
- payment accounts.
- push credentials.
- object buckets.

Never allow a test mobile build to create production SAP orders.

---

# 49. SAP B1 UAT Test Matrix

Before retailer pilot, test at least:

1. Login to Service Layer UAT.
2. Read one `BusinessPartners` customer.
3. Read one `Items` SKU.
4. Retrieve/derive the correct retailer price.
5. Read warehouse availability.
6. Standard one-line Sales Order.
7. Multi-line Sales Order.
8. Correct customer `CardCode`.
9. Incorrect customer `CardCode`.
10. Inactive/frozen customer.
11. Valid item.
12. Invalid item.
13. Non-sellable/inactive item.
14. Valid warehouse.
15. Invalid warehouse.
16. Case UOM/order quantity.
17. Piece UOM if business supports it.
18. Price-list customer.
19. Customer-specific/special price.
20. Scheme/discount case.
21. Credit limit scenario.
22. Overdue-account scenario.
23. Approval procedure scenario.
24. Multiple ship-to address scenario.
25. Mandatory UDF scenario.
26. Branch/BPL requirement if used.
27. Tax/GST behavior.
28. SAP B1 Service Layer timeout before document creation.
29. Timeout after SAP creates document but before Gagan receives response.
30. Duplicate mobile `Place Order` tap.
31. Repeat request with same idempotency key.
32. Expired `B1SESSION`.
33. Re-login during a read.
34. Re-login around a write without duplicate order.
35. Delivery Note creation/status visibility.
36. A/R Invoice visibility.
37. Incoming Payment visibility.
38. Credit Note scenario.
39. Cancelled/closed order.
40. Partial fulfilment.
41. UDF values read/write.
42. Large order line count.
43. Service Layer pagination/query behavior.
44. Service Layer 4xx business error.
45. Service Layer 5xx/infrastructure error.

Test #29 is mandatory.

If B1 created the Sales Order but the HTTP response was lost, a blind retry could create a second Sales Order.

---

# 50. Idempotency & B1 Reconciliation

Every order must have a Gagan-generated immutable reference.

Example:

```text
Gagan Order Number:
GGN-38291

Idempotency Key:
0dcde985-...

B1 External Reference:
GGN-38291
```

Prefer storing the Gagan reference in an appropriate standard B1 field such as a customer-reference field when business semantics permit, or in a dedicated UDF created for this integration.

Recommended dedicated UDF:

```text
U_GaganOrderId
```

Exact name to be chosen with SAP B1 administrator.

## Reconciliation algorithm

```text
Order state = SUBMITTING_TO_B1
Response missing / timeout
        ↓
DO NOT immediately create another B1 order
        ↓
Search B1 using Gagan external reference / UDF
        ↓
If found:
    save DocEntry + DocNum
    mark CONFIRMED_BY_SAP
        ↓
If not found:
    retry according to controlled policy
```

If Service Layer cannot efficiently query the selected reference field in your version/configuration, create an alternate reconciliation mechanism with the B1 team.

---

# 51. Admin SAP B1 Monitor

Admin-only view:

```text
Gagan Order:       GGN-38291
Retailer:          Mahesh Store
B1 CardCode:       C0001842

Status:            FAILED_RETRYABLE
Attempts:          3

B1 DocEntry:       —
B1 DocNum:         —

Last Attempt:      20 Aug 2026 15:22
Correlation ID:    b1_01J...
Service:           Orders
HTTP Status:       503
B1 Error Code:     ...
Next Retry:        ...

External Reference:
GGN-38291
```

Actions:

- Retry safely.
- Reconcile.
- Search B1 by reference.
- View retailer.
- View cart/order snapshot.
- Escalate to SAP team.
- Copy correlation ID.
- View restricted raw response.

Never expose B1 credentials or unrestricted SAP payloads to normal admin users.

---

# 52. Folder Structure

Example monorepo:

```text
gagan-retailer-platform/
│
├── apps/
│   ├── mobile/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   ├── home/
│   │   │   │   ├── products/
│   │   │   │   ├── cart/
│   │   │   │   ├── orders/
│   │   │   │   ├── payments/
│   │   │   │   └── account/
│   │   │   ├── navigation/
│   │   │   ├── services/
│   │   │   ├── store/
│   │   │   ├── theme/
│   │   │   ├── types/
│   │   │   └── utils/
│   │   └── assets/
│   │
│   ├── admin/
│   │   └── ...
│   │
│   └── api/
│       ├── src/
│       │   ├── auth/
│       │   ├── retailers/
│       │   ├── catalog/
│       │   ├── pricing/
│       │   ├── cart/
│       │   ├── checkout/
│       │   ├── orders/
│       │   ├── payments/
│       │   ├── notifications/
│       │   ├── support/
│       │   ├── sap-b1/
│       │   │   ├── sap-b1.gateway.ts
│       │   │   ├── service-layer/
│       │   │   │   ├── b1-client.ts
│       │   │   │   ├── b1-session.service.ts
│       │   │   │   ├── business-partners.service.ts
│       │   │   │   ├── items.service.ts
│       │   │   │   ├── pricing.service.ts
│       │   │   │   ├── orders.service.ts
│       │   │   │   ├── deliveries.service.ts
│       │   │   │   ├── invoices.service.ts
│       │   │   │   └── payments.service.ts
│       │   │   ├── mapping/
│       │   │   ├── jobs/
│       │   │   └── mock/
│       │   └── common/
│       └── ...
│
├── packages/
│   ├── api-types/
│   ├── validation/
│   ├── design-tokens/
│   └── config/
│
├── docs/
│   ├── architecture.md
│   ├── sap-b1-integration.md
│   ├── api.md
│   └── runbooks/
│
└── infrastructure/
```

---

# 53. Mobile Screen Inventory

# 53. Mobile Screen Inventory

## Authentication
- Splash.
- Phone number.
- OTP.
- Store selector.
- Access pending/unknown retailer.

## Home
- Home.
- Salesperson sheet.
- Notifications.

## Products
- Product list.
- Search.
- Category.
- Product detail.
- Scheme detail.

## Cart/Checkout
- Cart.
- Checkout validation.
- Address/ship-to selector.
- Payment method.
- Final confirmation.
- Order success.
- Order processing.

## Orders
- Order list.
- Order detail.
- Delivery detail.
- Invoice viewer.
- Reorder.
- Cancellation request.

## Payments
- Account summary.
- Ledger.
- Invoice list.
- Invoice detail.
- Payment amount/invoice selector.
- Payment processing.
- Payment success/failure.

## Account
- Profile.
- Store details.
- Addresses.
- Salesperson.
- Language.
- Notifications settings.
- Support.
- Legal.
- Logout.

## Support
- New issue.
- Upload images.
- Case detail.
- Case history.

---

# 54. MVP Definition

Do not build everything before retailer testing.

## MVP — Phase 1

Must have:

- Mobile number + OTP.
- SAP retailer mapping.
- Home.
- Product catalogue.
- Retailer-specific product visibility.
- Product pricing.
- Cart.
- Checkout.
- SAP sales order creation.
- Order confirmation.
- Order list.
- Order detail.
- Basic order-status sync.
- Outstanding/credit summary.
- Assigned salesperson.
- Push notifications for key order events.
- Admin SAP sync/error dashboard.
- Analytics.
- Crash monitoring.

## Phase 1.1

- Invoice list/PDF.
- Ledger.
- Scheme presentation.
- Better reorder.
- Search improvements.
- Localization.

## Phase 2

- Online payments.
- Advanced schemes.
- Delivery tracking.
- Returns/damage.
- Smart reorder.
- Loyalty.
- Salesperson companion experience.

---

# 55. What NOT to Build in MVP

Avoid:

- Full inventory management.
- Full ERP replacement.
- Complex loyalty.
- AI chatbot.
- Live delivery map unless logistics data supports it.
- Social feed.
- Retailer community.
- Dozens of dashboards.
- Manual SAP data duplication.
- Custom pricing engine if SAP already owns pricing.

The MVP goal is:

**Retailer can independently place a correct order and that order reliably appears in SAP.**

---

# 56. Acceptance Criteria for MVP

The MVP is launchable only when:

- [ ] Approved retailer can OTP-login.
- [ ] Correct SAP customer is mapped.
- [ ] Retailer sees only permitted products.
- [ ] Correct indicative/current pricing appears.
- [ ] Retailer can add quantities.
- [ ] Cart persists.
- [ ] Checkout revalidates commercial data.
- [ ] Order cannot be submitted twice accidentally.
- [ ] Backend creates sales order in SAP.
- [ ] SAP sales order ID is stored.
- [ ] Retailer sees confirmation.
- [ ] SAP outage produces safe processing/error state.
- [ ] Failed integration is visible to admin.
- [ ] Retry does not duplicate order.
- [ ] Order status updates after SAP changes.
- [ ] Outstanding/credit data maps to correct retailer.
- [ ] Auth prevents access to another retailer.
- [ ] Logs redact sensitive information.
- [ ] Production secrets are externalized.
- [ ] Push notifications work.
- [ ] Critical analytics are captured.
- [ ] UAT passes business and SAP test matrix.

---

# 57. Suggested Build Sequence

## Step 1 — Inspect current SAP Business One

Collect:

```text
SAP Business One version:
Feature Package:
Patch Level:

Database:
SAP HANA / Microsoft SQL Server

CompanyDB:
UAT CompanyDB:
Production CompanyDB:

Service Layer installed:
Service Layer version:
OData v4 /b1s/v2 available:
Service Layer UAT URL:
Service Layer network accessibility:

Authentication mode:
B1 session login / IAM token / other

Branches/BPL enabled:
Warehouses:
Price lists:
Approval procedures:
UDFs:
UDTs:
UDOs:
Add-ons affecting sales orders:
```

## Step 2 — Obtain SAP B1 UAT access

Get:

- Service Layer URL.
- UAT `CompanyDB`.
- dedicated integration user.
- one test customer `CardCode`.
- one test `ItemCode`.
- one warehouse code.
- retailer price-list setup.
- one customer with credit.
- one customer with overdue/blocked case.
- one valid Sales Order created manually in B1 as a reference.

## Step 3 — Prove the Service Layer

Run and document:

```text
POST /Login
GET  /BusinessPartners('<test-card-code>')
GET  /Items('<test-item-code>')
POST /Orders
GET  /Orders(<DocEntry>)
```

Do not build broad SAP integration until this vertical path works.

## Step 4 — Build mock B1 adapter

Develop mobile/backend in parallel with SAP setup.

## Step 5 — Build OTP + retailer → CardCode mapping

## Step 6 — Build product sync from `Items`

## Step 7 — Build pricing adapter

## Step 8 — Build availability adapter

## Step 9 — Build Home + Products

## Step 10 — Build Cart + checkout validation

## Step 11 — Build idempotent B1 `Orders` creation

## Step 12 — Build reconciliation by external Gagan reference

## Step 13 — Build order status synchronization

## Step 14 — Add customer credit/outstanding

## Step 15 — Add Delivery Notes + A/R Invoices

## Step 16 — Build admin B1 sync monitor

## Step 17 — UAT

## Step 18 — Pilot with 20–50 retailers

## Step 19 — Pilot with 200–500 retailers

## Step 20 — Scale gradually

---

# 58. SAP Business One Discovery Checklist for Gagan IT Team

Ask the SAP B1 partner/internal team:

1. Exact SAP Business One version?
2. Exact Feature Package and Patch Level?
3. Is the company database on SAP HANA or Microsoft SQL Server?
4. Exact UAT CompanyDB?
5. Exact production CompanyDB?
6. Is SAP Business One Service Layer installed and healthy?
7. Is `/b1s/v2` OData v4 available?
8. What is the UAT Service Layer base URL?
9. How can Gagan backend network reach it?
10. Is access private/VPN/VPC/site-to-site or public allowlisted?
11. What TLS certificate is installed?
12. What authentication mode is currently configured?
13. Can we create a dedicated least-privilege integration user?
14. What permissions should that user receive?
15. Are branches/BPL enabled?
16. Which warehouse(s) should retailer orders use?
17. Can warehouse differ by retailer/territory?
18. What price lists are used?
19. How is a retailer assigned to a price list?
20. Do we use Special Prices?
21. Do we use discount groups?
22. Where are trade schemes stored?
23. Are schemes represented by standard B1 logic or UDF/UDO/custom add-on?
24. What is the customer `CardCode` convention?
25. Which field/UDF contains retailer mobile number?
26. Are multiple retailers ever associated with the same mobile?
27. What customer addresses/Ship-To codes are used?
28. Which SAP field identifies salesperson?
29. How is customer credit limit configured?
30. Which value should the app treat as current outstanding?
31. What rules block a customer/order due to credit or overdue?
32. Are Sales Order approval procedures enabled?
33. Can an API-created order become a draft because of approval?
34. Which fields are mandatory on every Sales Order?
35. Do we need `BPL_IDAssignedToInvoice` or branch information?
36. Which tax fields are mandatory?
37. Which UDFs must be written on an app-created Sales Order?
38. Which external-reference field can store `GGN-xxxxx`?
39. Can that field be searched/filterable through Service Layer?
40. Can we add a dedicated `U_GaganOrderId` UDF if needed?
41. How are order cancellations handled?
42. How do we determine open/closed/cancelled order state?
43. How do we identify the Delivery Note linked to an Order?
44. How do we identify the A/R Invoice linked to a Delivery/Order?
45. How are partial deliveries represented?
46. How are returns represented?
47. How are credit notes represented?
48. How are Incoming Payments posted?
49. Is payment reconciliation automated or manual?
50. Are product images stored anywhere in B1?
51. Which Item fields define case/pack configuration?
52. Which UOM/UoM Group configuration is used?
53. Can a retailer order both cases and pieces?
54. Which inventory definition should drive "Available"?
55. Do any SAP B1 add-ons intercept or modify Sales Orders?
56. Do any add-ons change pricing or schemes?
57. Are there formatted searches/stored procedures impacting documents?
58. What Service Layer request limits/timeouts apply?
59. Who monitors Service Layer uptime?
60. What is the B1 maintenance window?
61. Who owns API failures during production?
62. Can the SAP team give us a working Postman collection for UAT?
63. Can they provide one successful Sales Order payload and response?
64. Can they provide one example for each expected business error?
65. Can they provide `$metadata` from UAT for implementation mapping?

---

# 59. SAP B1 Integration Configuration

Use environment variables / secret manager.

Example:

```bash
SAP_B1_MODE=service-layer
SAP_B1_ODATA_VERSION=v2

SAP_B1_BASE_URL=https://sap-b1-uat.example.internal:50000
SAP_B1_COMPANY_DB=GAGAN_UAT

SAP_B1_AUTH_MODE=session
SAP_B1_USERNAME=gagan_api_user
SAP_B1_PASSWORD=SECRET_FROM_SECRET_MANAGER

SAP_B1_REQUEST_TIMEOUT_MS=10000
SAP_B1_MAX_READ_RETRIES=3

SAP_B1_DEFAULT_WAREHOUSE=WH01
SAP_B1_GAGAN_ORDER_UDF=U_GaganOrderId
```

Never commit real values.

For token/IAM-based installations, replace session credentials with the appropriate secure client/token configuration.

---

# 60. Backend SAP B1 Module Concept

```text
sap-b1/
├── sap-b1.module.ts
├── sap-b1.gateway.ts
├── sap-b1.types.ts
│
├── service-layer/
│   ├── b1-client.ts
│   ├── b1-session.service.ts
│   ├── b1-auth.strategy.ts
│   │
│   ├── business-partners.service.ts
│   ├── items.service.ts
│   ├── pricing.service.ts
│   ├── inventory.service.ts
│   ├── orders.service.ts
│   ├── deliveries.service.ts
│   ├── invoices.service.ts
│   ├── payments.service.ts
│   └── user-defined.service.ts
│
├── mapping/
│   ├── retailer.mapper.ts
│   ├── item.mapper.ts
│   ├── order.mapper.ts
│   └── error.mapper.ts
│
├── jobs/
│   ├── b1-order-submit.job.ts
│   ├── b1-order-reconcile.job.ts
│   ├── b1-order-sync.job.ts
│   ├── b1-product-sync.job.ts
│   └── b1-customer-sync.job.ts
│
├── mock/
│   └── mock-sap-b1.gateway.ts
│
└── errors/
    ├── b1-error.ts
    └── retailer-error.mapper.ts
```

---

# 61. Example Order Domain Service

Pseudo-code:

```ts
async function placeOrder(user, request, idempotencyKey) {
  const existing = await idempotency.find({
    retailerId: user.retailerId,
    idempotencyKey
  });

  if (existing) return existing.response;

  const retailer = await retailers.get(user.retailerId);
  const cart = await carts.getActive(user.retailerId);

  const validation = await checkout.validate({
    retailer,
    cart
  });

  if (!validation.canOrder) {
    throw new CheckoutValidationError(validation);
  }

  const order = await db.transaction(async (tx) => {
    return orders.createIntent(tx, {
      retailerId: retailer.id,
      sapCardCode: retailer.sapCardCode,
      idempotencyKey,
      externalReference: generateGaganOrderNumber(),
      commercialSnapshot: validation.snapshot
    });
  });

  await queues.sapB1OrderCreate.add({
    orderId: order.id
  });

  return {
    orderId: order.id,
    number: order.gaganOrderNumber,
    status: "PROCESSING"
  };
}
```

Worker concept:

```ts
async function submitOrderToB1(orderId) {
  const order = await orders.get(orderId);

  // First reconcile before retrying any uncertain write.
  const existingInB1 =
    await sapB1.findSalesOrderByExternalReference(order.gaganOrderNumber);

  if (existingInB1) {
    return orders.markConfirmed(order.id, {
      docEntry: existingInB1.DocEntry,
      docNum: existingInB1.DocNum
    });
  }

  const result = await sapB1.createSalesOrder(
    mapGaganOrderToB1(order)
  );

  return orders.markConfirmed(order.id, {
    docEntry: result.DocEntry,
    docNum: result.DocNum
  });
}
```

The real mapping must be generated from Gagan's UAT Sales Order requirements.

---

# 62. Mobile State Rules

# 62. Mobile State Rules

## Cart

Cart can update optimistically for quantity.

## Price

Never optimistically assume a changed quantity preserves price/scheme. Show estimated values until repricing.

## Order

Never optimistically show `Confirmed`.

Allowed immediate state:

**Sending order…**

Then:

**Order confirmed**

only after authoritative confirmation policy.

---

# 63. Native Home UI Structure

Recommended component tree:

```text
HomeScreen
│
├── NativeLargeNavigationHeader
│   ├── Title("Gagan")
│   ├── NotificationsButton
│   └── MoreButton
│
├── RetailerGreeting
│   ├── StoreName
│   └── SalespersonLink
│
├── AccountSummaryGroup
│   ├── OutstandingRow
│   └── CreditRow
│
├── SchemeHighlight
│
├── Section("Order Again")
│   └── ReorderProductScroller
│
├── Section("My Orders")
│   └── ActiveOrderRow
│
├── DeliveryInfoGroup
│
└── Section("Top Categories")
    └── CategoryScroller
```

Use grouped native-feeling surfaces rather than excessive elevated cards.

---

# 64. Design Tokens

Example conceptual tokens:

```ts
const tokens = {
  color: {
    accent: "#0A8F3C",
    textPrimary: "systemLabel",
    textSecondary: "secondarySystemLabel",
    background: "systemBackground",
    groupedBackground: "systemGroupedBackground",
    separator: "separator",
    danger: "systemRed",
    link: "systemBlue",
  },
  radius: {
    small: 10,
    medium: 14,
    large: 20,
  },
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
  }
}
```

On Android, map system semantic colors to Material/platform equivalents while retaining Gagan accent identity.

---

# 65. Release Strategy

## Internal

- Gagan employees.
- SAP team.
- Sales team.
- Test retailers.

## Pilot

20–50 retailers across:

- high volume.
- medium volume.
- low volume.
- different territories.
- different credit states.
- different phone/device quality.

## Expansion

200–500 retailers.

Measure:

- login success.
- product load.
- cart completion.
- SAP order success.
- support calls.
- retailer feedback.

Then scale to thousands.

---

# 66. Operational Runbooks Required

Before production:

```text
SAP unavailable
Order stuck in processing
Duplicate suspected
Wrong pricing
Wrong retailer mapping
Payment confirmed but SAP not reconciled
Invoice unavailable
Push outage
OTP outage
Database incident
Queue backlog
Credential/certificate expiry
SAP maintenance window
```

Each runbook should specify:

- Detection.
- Customer impact.
- Owner.
- Immediate action.
- Safe recovery.
- Communication.
- Post-incident review.

---

# 67. Definition of Success

The Gagan retailer app succeeds when the retailer no longer needs to call a salesperson for routine ordering.

The expected normal journey becomes:

```text
Open Gagan
↓
Tap Order Again
↓
Adjust 2–3 quantities
↓
Review cart
↓
Place Order
↓
SAP Sales Order Created
↓
Retailer Gets Confirmation
↓
Delivery / Invoice / Payment Updates Follow Automatically
```

The salesperson can then spend more time on:

- retailer expansion.
- new product selling.
- relationship management.
- merchandising.
- resolving exceptions.

rather than manually typing recurring orders.

---

# 68. Final Product Boundary

The architecture should maintain this separation:

```text
GAGAN APP
Retailer experience
Fast, simple, native

        ↓

GAGAN PLATFORM
Auth
Permissions
UX data
Caching
Orchestration
Idempotency
Audit
Notifications
Integration reliability

        ↓

SAP
Enterprise transaction truth
Customer
Material
Pricing
Credit
Order
Delivery
Billing
Accounting
```

This separation is the foundation of the system.

---

# 69. First Engineering Milestone

The first end-to-end engineering milestone should not be "Home screen complete."

It should be:

> A test retailer signs in, sees one real/test SAP-linked product, adds one case, taps Place Order, and a valid sales order is created in SAP UAT exactly once.

Once that vertical slice works, expand catalogue, design, credit, schemes, invoices, payments, and automation around it.

---

# 70. Required Inputs Before Production SAP B1 Connection

Fill these values:

```yaml
sap_b1:
  version: "TBD"
  feature_package: "TBD"
  patch_level: "TBD"
  database_engine: "TBD" # HANA or MSSQL

  service_layer:
    available: false
    odata_v4_available: false
    base_url_uat: "TBD"
    base_url_production: "TBD"
    auth_mode: "TBD"
    network_route: "TBD"

  company_db:
    uat: "TBD"
    production: "TBD"

  integration_user:
    created: false
    permission_profile: "TBD"

business_partner:
  card_code_field: "CardCode"
  mobile_field_or_udf: "TBD"
  salesperson_field: "TBD"
  default_ship_to_logic: "TBD"
  price_list_logic: "TBD"
  credit_limit_logic: "TBD"
  outstanding_logic: "TBD"

items:
  item_code_field: "ItemCode"
  sellable_filter: "TBD"
  category_source: "TBD"
  image_source: "TBD"
  pack_size_field_or_udf: "TBD"
  case_configuration_field_or_udf: "TBD"
  uom_logic: "TBD"

inventory:
  warehouse_codes: []
  retailer_to_warehouse_logic: "TBD"
  availability_formula: "TBD"

pricing:
  source: "TBD"
  customer_price_method: "TBD"
  special_prices_used: false
  discount_groups_used: false
  schemes_source: "TBD"

orders:
  endpoint: "/b1s/v2/Orders"
  external_reference_field: "TBD"
  gagan_order_udf: "TBD"
  mandatory_udfs: []
  branch_required: false
  approval_procedure_enabled: false
  cancellation_process: "TBD"

fulfilment:
  delivery_notes_used: true
  order_to_delivery_link_logic: "TBD"
  partial_delivery_logic: "TBD"

billing:
  ar_invoices_used: true
  invoice_pdf_source: "TBD"
  credit_note_process: "TBD"

payments:
  incoming_payments_source: "TBD"
  online_payment_required: false
  payment_provider: "TBD"
  reconciliation_process: "TBD"

customization:
  important_udfs: []
  important_udts: []
  important_udos: []
  sales_order_addons: []
```

Keep this file under version control only after removing all secrets. Passwords/tokens belong in a secrets manager.

---

# 71. SAP Business One Implementation Notes

1. **Service Layer first.** Use the SAP Business One Service Layer rather than direct database writes.

2. **Prefer OData v4.** Where the installed release supports it, use `/b1s/v2`. Verify behavior from UAT `$metadata`.

3. **Never write directly to SAP B1 database tables.** Creating/updating business documents through SQL bypasses B1 business logic and is not the architecture for this app.

4. **Treat `CardCode`, `ItemCode`, `DocEntry` and `DocNum` correctly.**
   - `CardCode` identifies the customer/business partner.
   - `ItemCode` identifies the SKU.
   - `DocEntry` is the internal document key.
   - `DocNum` is the business-facing document number.

5. **Use B1 pricing rather than inventing a second truth.** If Gagan's pricing/schemes use standard B1 structures, call/derive them through B1. If they use custom UDF/UDO/add-on logic, document that explicitly.

6. **Inspect UDFs.** Gagan's production B1 implementation may have essential custom fields. Export/document all relevant Business Partner, Item, Order, Delivery and Invoice UDFs.

7. **Check add-ons.** An API order can behave differently if third-party B1 add-ons, approvals, formatted searches or custom processes affect order creation.

8. **Store a Gagan external order reference in B1.** This is essential for reconciliation and duplicate prevention.

9. **Cache reads intelligently.**
   - Product master: scheduled sync.
   - Product merchandising: Gagan platform.
   - price: cache + checkout validation.
   - inventory: short cache/live validation depending on business.
   - credit/outstanding: refresh on foreground and checkout.
   - open orders: frequent sync/event strategy if available.
   - historical closed orders: infrequent sync.

10. **Do not make SAP B1 availability equal retailer-visible exact inventory without business approval.** The app should usually expose an orderability signal.

11. **Translate B1 errors.** Retailer sees a simple message; admin retains B1 technical details.

12. **UAT payload is the contract.** Before production coding is finalized, Gagan's SAP B1 team should supply a manually-created reference Sales Order and a Service Layer payload that creates an equivalent UAT document.

---

# 72. Developer Instruction

Hand this specification to the AI coding agent/engineering team with this instruction:

> Build Phase 1 for SAP Business One only. Create a React Native TypeScript retailer app, TypeScript backend, PostgreSQL database, queue worker, mock `SapB1Gateway`, and admin SAP-B1 monitor.
>
> The first vertical slice must be:
>
> OTP test login → retailer mapped to SAP B1 `CardCode` → read one test `ItemCode` → display price → add quantity → checkout validation → create immutable Gagan order intent → submit an idempotent `POST /b1s/v2/Orders` through the backend → store B1 `DocEntry` and `DocNum` → show confirmed order in the app.
>
> All SAP B1 calls must be isolated behind `SapB1Gateway`.
>
> Implement backend-managed Service Layer authentication/session handling. Never put SAP credentials in the mobile app.
>
> Before retrying an uncertain Sales Order write, reconcile using the immutable Gagan external order reference so that a lost HTTP response cannot create a duplicate B1 Sales Order.
>
> Use a mock B1 adapter until UAT credentials and an approved example Sales Order payload are available.
>
> Do not hardcode `CardCode`, `ItemCode`, warehouse, price list, UOM, tax fields, branch/BPL, UDFs, credit policy, schemes, SAP credentials or CompanyDB.
>
> Build automated tests for:
> 1. duplicate Place Order tap,
> 2. Service Layer session expiry,
> 3. B1 timeout before order creation,
> 4. B1 creates order but response is lost,
> 5. invalid customer,
> 6. invalid item,
> 7. insufficient credit/business block,
> 8. mandatory UDF failure.
>
> Do not expand to payments, returns, loyalty or recommendations until the B1 UAT Sales Order vertical slice is working reliably.

---

# END OF SPECIFICATION