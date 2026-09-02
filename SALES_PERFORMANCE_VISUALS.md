# Sales Performance Visuals

The endpoint `/rep/field/performance` returns one `visuals` object for Activity > Performance. The request may be bounded to seven or thirty days.

## Visual contract

- `salesTrend`: one row per calendar day with `value` and `orders`.
- `ordersByDay`: compact order-count projection for small infographics.
- `visitsTrend`: daily visits and productive visits.
- `collectionsTrend`: submitted and confirmed collection values.
- `categoryContribution`: category value and share, derived from order items and product category.
- `productivityPct`: productive visits divided by visits, or `null` when no visits exist.
- `routeCompletionTrend`: published route days only; empty when route history is unavailable.
- `hasEnoughHistory`: whether any canonical row exists in the requested window.

Every chart gets a plain-language conclusion above it. The UI uses restrained bars so the value remains legible on small phones. It intentionally avoids gauges, pie charts, decorative gradients, and multicolour dashboards.
