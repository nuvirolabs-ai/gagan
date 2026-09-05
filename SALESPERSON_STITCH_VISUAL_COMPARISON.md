# Salesperson Stitch redesign — native visual comparison

Status: **native implementation complete for the mapped reference surfaces; founder physical design review pending**

Source branch: `codex/gagan-salesperson-stitch-redesign`

Source staging commit: `e47e38e99cf08c0d71542ea230815c33dca17a26`

Reference package: `/Users/tanutejas/Downloads/stitch_gagan_sales_ui_redesign/`

## Comparison boundary

The Stitch export is an external visual reference. Its four opaque identifiers are not serialized in the local export, so this comparison records the visual correspondence without inventing source-file provenance:

| Stitch reference | Native screen | Existing Gagan data and behavior retained |
| --- | --- | --- |
| Home | `TodayScreen` | active day, route, attention, targets, milestones, quick actions, navigation |
| Outlets | `RepRetailersScreen` | retailer search/filtering, credit/outstanding, route context, retailer detail navigation |
| Reports | `MyActivityScreen` | timeline, performance period, sales/order/visit/collection metrics and chart data |
| More | `RepAccountScreen` | duty state, profile, route, Sales Kit, performance, account and system actions |

No Stitch sample value was copied into the app. The phone evidence below is from the connected Moto E13 using the staging session and the current canonical data returned by the existing API.

## Home

Reference: [docs/stitch-redesign/reference/home.png](docs/stitch-redesign/reference/home.png)

Native evidence:

- [Home loaded on device](docs/stitch-redesign/evidence/stitch-home-awake-2.png)
- [Home lower composition](docs/stitch-redesign/evidence/stitch-home-top-2.png)
- [Final release APK after install](docs/stitch-redesign/evidence/stitch-final-after-wait.png)

Implemented correspondence:

- Gagan / FIELD COMPANION lockup, notification affordance, and initials avatar.
- Midnight hero/next-stop slot remains the first operating surface when the canonical route has an upcoming stop.
- Real attention data is presented once in the compact amber focus surface.
- Sales is a single instrument with real target, pacing, period, and milestone values.
- Field metrics, next-up route section, quick actions, and bottom navigation use the Stitch spacing and tonal grammar.

Physical limitation in this evidence: the current authenticated staging identity has no published route for today, so the next-stop hero and route rows cannot be truthfully shown in this session. The implementation preserves the existing no-route state and does not substitute reference values.

## Outlets

Reference: [docs/stitch-redesign/reference/outlets.png](docs/stitch-redesign/reference/outlets.png)

Native evidence: [Outlets on device](docs/stitch-redesign/evidence/stitch-outlets.png)

Implemented correspondence:

- compact page title and account context;
- blue add-store action;
- search and horizontally scrollable filter chips;
- white retailer cards with initials, address, credit/due context, semantic tier chip, and chevron;
- bottom navigation with the selected Outlets state.

The visible retailer names, addresses, credit values, and counts are the current staging values.

## Reports

Reference: [docs/stitch-redesign/reference/reports.png](docs/stitch-redesign/reference/reports.png)

Native evidence:

- [Timeline on device](docs/stitch-redesign/evidence/stitch-reports.png)
- [Performance instrument on device](docs/stitch-redesign/evidence/stitch-reports-performance.png)

Implemented correspondence:

- Timeline / Performance control with a single selected blue capsule;
- chronological rail using real activity events;
- blue performance hero with real period, sales, orders, visits, collections, and target data;
- target instrument and real-data chart section in a single composed surface.

## More

Reference: [docs/stitch-redesign/reference/more.png](docs/stitch-redesign/reference/more.png)

Native evidence: [More on device](docs/stitch-redesign/evidence/stitch-more.png)

Implemented correspondence:

- GAGAN FIELD COMPANION kicker and More title;
- real duty status and profile surface;
- grouped field-work and growth surfaces with consistent icon treatment, separators, chevrons, and tap targets;
- existing account/system actions remain reachable without adding new product behavior.

## Visual differences remaining

1. The Stitch Home reference includes a published next stop. The current staging identity has no route published for today, so the physical Home screenshot shows the truthful no-route state rather than the reference hero data.
2. The local Stitch exports are static reference captures; the native app includes existing loading, permission, offline, and empty states that are not represented by those captures.
3. Android system status/navigation bars are device-rendered and therefore differ from the export frame. The app content, bottom navigation ownership, and touch geometry remain native.

These are review conditions, not hidden substitutions. The feature remains **not ready for founder visual approval** until an authenticated staging session with an upcoming route is available for a direct Home comparison.

## Native implementation guarantees

- No WebView, HTML screen, or Stitch runtime was added.
- No backend route, API contract, order calculation, pricing, credit, inventory, or permission behavior was changed.
- No Admin, Retailer App, Founder App, Dogkart, production, or real-SAP surface was modified.
- All visual values shown in the app continue to originate from the existing Gagan data model and API responses.
