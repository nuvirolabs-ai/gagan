# Device UAT checklist

Run this against staging with test accounts and mock/sandbox providers. Record device, OS, build, tester and timestamp for every result.

## Matrix

- [ ] Android current supported OS, small phone
- [ ] Android current supported OS, large phone
- [ ] iPhone current supported iOS, small screen
- [ ] iPhone current supported iOS, large screen
- [ ] Retailer build installed from a clean install
- [ ] Salesperson build installed from a clean install

## Authentication and session

- [ ] Valid OTP login and resend cooldown
- [ ] Wrong OTP, expired OTP and attempt limit show safe messages
- [ ] Logout removes access
- [ ] Relaunch restores a valid session from secure storage
- [ ] Expired/revoked session returns to login without a loop

## Retailer order journey

- [ ] Home, assigned salesperson, outstanding and credit render correctly
- [ ] Catalog search/category/filter, price, case quantity and availability render
- [ ] Empty catalog, slow network, offline and API-error states are usable
- [ ] Add/remove/increment/decrement cart items
- [ ] MOQ/minimum order and unavailable/insufficient inventory validation
- [ ] Place Order button disables during submission; double tap creates one order
- [ ] Kill app immediately after submit; relaunch shows the order exactly once
- [ ] Order status, SAP sync state and DocNum render when available
- [ ] Reorder uses current price and current inventory

## Salesperson journey

- [ ] Only assigned retailers are visible
- [ ] Retailer detail, financial summary, catalog and recent orders match backend
- [ ] Assisted order requires an idempotency key and respects retailer pricing/stock
- [ ] Unauthorized retailer lookup/order is rejected

## Interaction quality

- [ ] Keyboard does not cover fields or the primary CTA
- [ ] Safe areas/notches, scrolling and Android back navigation work
- [ ] Buttons have disabled/loading feedback and no accidental duplicate taps
- [ ] Background/resume does not duplicate requests
- [ ] No raw stack traces, SAP credentials or sensitive financial data appear in logs
