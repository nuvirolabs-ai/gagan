# Stitch → Native Implementation Source Map

## Baseline and source provenance

- Source staging commit: `e47e38e99cf08c0d71542ea230815c33dca17a26`
- Feature branch: `codex/gagan-salesperson-stitch-redesign`
- Native source root: `rep/`
- Stitch source root: `/Users/tanutejas/Downloads/stitch_gagan_sales_ui_redesign/`
- Local capture date: 2026-09-05
- Native target: React Native / Expo; no Stitch HTML or WebView is shipped.

The brief supplied four external Stitch screen IDs:

`61e88aa8d2c342d99360c0d263ecebbb`, `522d451e2a014aa7aab702b65d0d0727`, `597f75491acf498a96aa594043042197`, and `6dd73f4f437a4fd3968a7b654b1200e7`.

Those IDs are not serialized in the local export files, HTML, PNG metadata, or `DESIGN.md`. The map below therefore uses the local folder/source name and the visible screen title as the authoritative local mapping, while preserving all four supplied IDs as external reference IDs. No ID-to-screen assignment is invented.

## Approved screen mapping

| External Stitch reference | Local Stitch source | Approved visual screen | Existing Gagan screen | Existing route | Existing functionality | Native implementation component | Status |
|---|---|---|---|---|---|---|---|
| External ID supplied; not serialized locally | `gagan_home_card_layout/code.html` + `screen.png` | Gagan Field Companion Home | `TodayScreen.tsx` | Bottom tab `Today` labelled `Home` | Identity, active/before/complete day, next stop, Start Visit/Open Store, Navigate, target/sales, milestones, route, attention, quick actions, tasks, EOD, offline/outbox refresh | `TodayScreen` + shared `AppScreen`, `Surface`, `PrimaryButton`, `TactilePressable`, `SectionHeader` | Mapped; implementation pending |
| External ID supplied; not serialized locally | `gagan_outlets_card_layout/code.html` + `screen.png` | Outlets | `RepRetailersScreen.tsx` | Bottom tab `Retailers` labelled `Outlets` | Retailer list, search, all/route/overdue/opportunity filters, Add Store, retailer detail navigation, loading/empty/error/refresh | `RepRetailersScreen` + shared `SearchBar`, `FilterChip`, `RetailerRow`, `EmptyState` | Mapped; implementation pending |
| External ID supplied; not serialized locally | `gagan_reports_card_layout/code.html` + `screen.png` | Performance View / Reports | `MyActivityScreen.tsx` | Bottom tab `Activity` labelled `Reports` | Timeline, Performance, 7D/30D, Sales/Orders/Visits/Collections, canonical performance and targets, daily detail, ranking/achievements | `MyActivityScreen` + shared report instruments and chart primitives | Mapped; implementation pending |
| External ID supplied; not serialized locally | `gagan_more_harmonized_card_flow/code.html` + `screen.png` | More / Field Companion account | `RepAccountScreen.tsx` | Bottom tab `More` | Profile, duty state, My Day, Route, Needs Attention, Sales Kit, Performance, Add Store, Customer Map, Expenses, Issues, language, outbox sync, logout | `RepAccountScreen` + shared `Surface`, `FilterChip`, `TextButton`, row primitives | Mapped; implementation pending |

## Supporting native routes required by the approved surfaces

| Native route | Source | Why it remains in scope |
|---|---|---|
| `RepRetailerDetail` | `RepRetailerDetailScreen.tsx` | Home route/attention and Outlets rows navigate here; preserve identity, credit, outstanding, schemes, intelligence, visit, KYC, issues, and Place Order. |
| `RepCatalog` | `RepCatalogScreen.tsx` | Retailer Detail opens catalog; preserve SKU, pricing, stock, quantity, cart, and order submission. |
| `Route` | `RouteScreen.tsx` | Home Full plan and More Route use it; preserve route refresh, skip-stop validation, and retailer navigation. |
| `Visit` | `VisitScreen.tsx` | Retailer Detail starts/opens a visit; preserve check-out and activity outcome behavior. |
| `AddRetailer` | `AddRetailerScreen.tsx` | More/Add Store and Outlets/Add Store use it; preserve all four steps, 19 fields, validation, Aadhaar security, proposal submission, drafts, and requests. |
| `SalesKit` | `SalesKitScreen.tsx` | Home/More action; preserve canonical sales-kit loading and data. |
| `MyDay` | `MyDayScreen.tsx` | More/My Day and Home Attendance action; preserve attendance and leave flows. |
| `CustomerMap` | `CustomerMapScreen.tsx` | More/Customer Map; preserve location scope and retailer selection. |
| `Opportunities` | `OpportunitiesScreen.tsx` | Home Needs Attention; preserve attention data and retailer navigation. |

## Local reference captures

Persistent copies are stored at `docs/stitch-redesign/reference/`:

- `home.png` — 699×1600
- `outlets.png` — 599×1600
- `reports.png` — 618×1600
- `more.png` — 409×1600

The copied images are visual acceptance references only. Their example values are not application data.
