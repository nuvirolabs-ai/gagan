# Final UI/UX audit

Reviewed on `codex/gagan-staging` after this pass.

## Retailer

**Preserved:** cream/green shop language.

**Fixed:** session UI on network loss; payable = server line total; product/catalogue/orders/ledger/tracking error vs empty; dead notification/scheme/offer chevrons; next-delivery uses `expectedDeliveryAt`; confirmation/tracking on theme; order numbers `GGN-########`.

**Not visually run in a phone simulator this pass:** Expo web is not installed (`react-native-web` / `react-dom` absent by design). Native APK was not rebuilt. Defects above were fixed in source and covered by unit tests where they have logic.

## Salesperson

**Preserved:** Field Companion (Today / Retailers / Activity / More). No redesign.

**Fixed:** activity queue only on transport failure; Collect prefills retailer; Performance tab from More; Visit registered for order-capable staff; order numbers `GGN-########`.

**Same device caveat as retailer.** Field Companion visual QA on small Android was completed on `b88fe32`.

## Admin — actually inspected at 1440×900

Local Vite `http://127.0.0.1:5173` against staging API via same-origin proxy.

| Screen | Result |
|---|---|
| Employee sign in | Calm OS card, ivory canvas, human error banner (`Failed to fetch` when CORS blocked; success after proxy) |
| Work home | Live queues: 18 orders, 2 pack, 1 OFD, 3 expenses, 7 SAP failures; grouped nav; no vanity SKUs |
| Order workspace | Dense table + inspector; `GGN-00000023`; Approve/Reject; SAP Failed shown secondary |
| SAP sync | mock connector, 7 failed / retry, drain, filters |

## Remaining visual P2

- Admin sidebar System group sits below the fold at 900px (scrolls).
- SAP outbox “Updated” column often `—` if the API omits `updatedAt`.
- Retailer confirmation was themed in source; needs a new APK to see on device.
