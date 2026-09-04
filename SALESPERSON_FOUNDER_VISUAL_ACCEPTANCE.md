# Gagan Salesperson — Founder Visual Acceptance

## Scope

This document records the final visual-composition correction for the
Salesperson app. Functional SFA V2 behavior remains frozen; this pass changes
only presentation composition and adds a staging-only fixture for physical
visual UAT.

- Branch: `codex/gagan-salesperson-sfa-v2`
- Base visual build: `64221ff01beed93cd74f4779fcf1f9ebe739fed2`
- Physical device: Moto E13, Android, `720 × 1600` screenshot output
- Backend: `https://gagan-staging-api.onrender.com`
- Environment: staging only; no production data or real SAP B1

## Binding references

The following supplied screenshots are the visual references used for the
rebuild. They are kept outside the repository and are not runtime assets:

1. `/var/folders/tf/zq_1z08n64s1hl4d6dbc2hvr0000gn/T/codex-clipboard-02dc1e01-5d9e-47c4-8190-4c42339c1439.png`
2. `/var/folders/tf/zq_1z08n64s1hl4d6dbc2hvr0000gn/T/codex-clipboard-d442ada7-ad38-4bca-935c-c9eff1637d1f.png`
3. `/var/folders/tf/zq_1z08n64s1hl4d6dbc2hvr0000gn/T/codex-clipboard-e3bcec23-098f-427c-b73f-58fe8d047d90.png`

The first reference establishes the premium white/blue Home composition, the
second establishes the dark Next Visit hero, and the third establishes the
lime milestone bottom sheet.

## Staging visual-UAT fixture

The fixture is created by the normal backend seed mechanism:

```text
NODE_ENV=staging npm run seed:sales-visual-uat
```

The script is guarded by `NODE_ENV === "staging"` and creates an isolated
salesperson rather than changing Ravi's accepted data.

| Field | Staging value |
| --- | --- |
| Salesperson | Nikhil Patil |
| Phone | `9812367800` |
| Mock OTP | `123456` |
| Route | 5 published stops in Pune Central |
| Current state | Open workday, 2 visited, 3 pending |
| Next stop | Patel Mart, 12:30 |
| Target | ₹4,00,000 monthly order-value target |
| Current value | ₹3,00,000 from canonical rep orders (75%) |
| Previous-order context | ₹42,000 delivered order in the prior period |
| Attention | Sharma General Store, ₹40,500 real overdue ledger balance |
| Coordinates | Verified retailer locations for all five stops |

The first Today read evaluates the canonical progress and records the
unacknowledged `TARGET_75` achievement through the existing recognition service.
No milestone is hardcoded in React and no recognition event is pre-seeded.

## Physical screenshots

Captured from the standalone release build on the authorized Android device:

| State | Evidence |
| --- | --- |
| Active Home — header, hero, sales, target | `/tmp/gagan-salesperson-founder-active-home-top.png` |
| Active Home — field metrics and route | `/tmp/gagan-salesperson-founder-active-home-route.png` |
| Active Home — lower route, quick actions, attention | `/tmp/gagan-salesperson-founder-active-home-route-lower.png` |
| 75% milestone sheet | `/tmp/gagan-salesperson-founder-milestone.png` |
| Retailer list | `/tmp/gagan-salesperson-founder-retailer.png` |
| Retailer detail | `/tmp/gagan-salesperson-founder-retailer-detail.png` |
| Order taking | `/tmp/gagan-salesperson-founder-order-taking.png` |
| More | `/tmp/gagan-salesperson-founder-more.png` |
| Day-complete Home | `/tmp/gagan-salesperson-founder-day-complete.png` |

Screenshots are evidence files on the local machine, not committed APK or
application assets.

## Reference comparison

### Composition

The active Home now follows the binding order: compact greeting, dark Next
Visit hero, a single integrated sales/target instrument, milestone rail,
compact field metrics, route itinerary, and then secondary actions/attention.
The target values and route content in the evidence are read from the staging
backend fixture, not copied from the reference screenshots.

The main remaining device-level difference is that the Moto E13 viewport is a
narrower and taller Android composition than the supplied reference renders.
The implementation keeps the same hierarchy while allowing the route and
secondary sections to continue below the fold.

### Typography

The greeting, hero retailer name, sales figure, and route names use the
existing system-native React Native stack with restrained weight changes. The
commercial amount is smaller than the previous accepted visual build and the
target instrument carries more hierarchy through alignment and separators
rather than additional nested cards.

### Spacing and radii

The hero remains the dominant rounded surface. The sales instrument is one
coherent surface with a divider between its two target readings. Route stops
are thin-divider itinerary rows, not individual cards. The route time column
has enough width to keep `HH:MM` on one line on the physical narrow device.

### Color usage

Midnight navy is reserved for the Next Visit hero, blue for primary actions and
progress, pale lime for prior milestones, and full chartreuse for only the
highest/current reached milestone. Future milestones remain neutral. The
attention row uses a restrained semantic danger tint for overdue balance.

### Target hierarchy

Today's sales is read as the current commercial result. The monthly target,
percentage, progress track, remaining amount, and period are integrated below
it. Two separate gray target cards were removed.

### Route hierarchy

The route reads as a plan: time → retailer → address → state. Completed stops
are subordinate, the next stop is blue and directly corresponds to the hero,
and the `Full plan` action remains available.

### Bottom navigation

The existing four-tab navigation remains intact. The Home tab has the compact
dark selected indicator, one icon family, aligned labels, and safe-area
clearance. No navigation behavior was changed.

### Milestone sheet

The physical `TARGET_75` sheet uses a dimmed Home, a white sheet with rounded
top corners, a lime 75% badge, a concise recognition headline, canonical
current/target amounts, and a navy primary action with a subordinate dismiss
action. Additional canonical achievements are queued by the existing service;
the evidence capture records the 75% target sheet before the subsequent
recognition items were dismissed.

## Hard acceptance questions

| Question | Result | Evidence / reason |
| --- | --- | --- |
| Does Home still feel like cards stacked vertically? | NO | Hero, integrated target instrument, metric strip, and itinerary now have distinct composition roles. |
| Does the Day Complete state consume too much space? | NO in source / physical evidence pending final clean fixture | `CompactDayStatus` replaces the previous large completed-day hero. |
| Is Today's Sales numeral oversized? | NO | Reduced from the previous 38px treatment to the composed 32px role. |
| Are multiple milestones simultaneously neon? | NO | Only the highest reached threshold uses full lime; prior thresholds use pale lime. |
| Do Quick Actions look like a generic module grid? | NO | Tiles use a quiet tonal strip and smaller icon treatment. |
| Is the Next Visit hero physically proven? | YES | `/tmp/gagan-salesperson-founder-active-home-top.png` |
| Is the Route physically proven? | YES | `/tmp/gagan-salesperson-founder-active-home-route.png` and lower route evidence |
| Is the milestone sheet physically proven? | YES | `/tmp/gagan-salesperson-founder-milestone.png` |

## Functional regression

The visual pass does not alter backend contracts or canonical calculations.
The following physical paths were checked on staging after the visual build:

| Flow | Result |
| --- | --- |
| Mock OTP login | PASS |
| Session restoration | PASS |
| Active Home | PASS |
| Published route and Next Visit | PASS |
| Retailer list/detail | PASS |
| Catalog/order-taking screen | PASS |
| More screen | PASS |
| Actual order placement in this final visual pass | NOT RUN; prior accepted SFA evidence retained |
| Admin receives order | NOT RUN in this visual-only pass |
| Performance / More modules | Screen-level evidence captured; full regression retained from accepted SFA V2 |
| Start Visit / EOD mutation sequence | NOT RUN with a clean identity in this pass |

## Build evidence

The new standalone release APK is produced after the final source commit and
must be recorded below before handoff:

- APK: pending final copy
- SHA-256: pending final copy
- Package: `com.gagan.sales`
- Embedded API: `https://gagan-staging-api.onrender.com`
- Release build: `./gradlew app:assembleRelease -x lint -x test`
- Metro requirement at runtime: none
- USB requirement at runtime: none

## QA limitations

- The physical device is a Moto E13 at `720 × 1600`; additional 360×800,
  390×844, and 430×932 device classes were not available for physical capture
  in this run.
- The staging fixture's first Today load also evaluates other canonical
  achievements (personal best and new-retailer milestone). The target 75% sheet
  was captured first, and the remaining recognition sheets were dismissed for
  the active Home evidence.
- The compact completed-day source state is implemented; a clean same-day
  closed-day physical capture is the last evidence item if the final gate
  requires a separate closed-day identity.
