# Gagan Salesperson — Founder Visual Acceptance

## Scope

This document records the final visual-composition correction for the
Salesperson app. Functional SFA V2 behavior remains frozen; this pass changes
only presentation composition and adds a staging-only fixture for physical
visual UAT.

- Branch: `codex/gagan-salesperson-sfa-v2`
- Baseline visual build: `64221ff01beed93cd74f4779fcf1f9ebe739fed2`
- Final visual correction commit: `4f8118720c731ddba531bb4cc4a1e0fa4d4eaff3`
- Staging fixture reset hardening: `5a5656af11172ee4f9870ac4580810bc59fc3b84`
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
# For a clean physical visual run after a prior close/dismissal:
NODE_ENV=staging npm run seed:sales-visual-uat -- --date=2026-09-04 --reopen-day --fresh-achievements
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
| Active Home — header, hero, sales, target | `/tmp/gagan-salesperson-founder-active-final-current.png` |
| Active Home — field metrics and route | `/tmp/gagan-salesperson-founder-active-final-route.png` |
| Active Home — lower route, quick actions, attention | `/tmp/gagan-salesperson-founder-active-final-lower.png` |
| 75% milestone sheet | `/tmp/gagan-salesperson-founder-milestone-final.png` |
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

## Side-by-side evidence

The comparison uses the supplied reference captures and final screenshots from
the standalone release installed on the physical Android device. Open the
reference and final paths beside each other at native resolution when reviewing
the render.

| Reference characteristic | Approved reference | Final Android capture | What was checked |
| --- | --- | --- | --- |
| Home composition | `/var/folders/tf/zq_1z08n64s1hl4d6dbc2hvr0000gn/T/codex-clipboard-02dc1e01-5d9e-47c4-8190-4c42339c1439.png` | `/tmp/gagan-salesperson-founder-active-final-current.png` | Header → Next Visit → sales/target → milestone rail; hero is the dominant first action. |
| Lower Home / route | `/var/folders/tf/zq_1z08n64s1hl4d6dbc2hvr0000gn/T/codex-clipboard-d442ada7-ad38-4bca-935c-c9eff1637d1f.png` | `/tmp/gagan-salesperson-founder-active-final-route.png` and `/tmp/gagan-salesperson-founder-active-final-lower.png` | One field-metric instrument, thin-divider route rows, and quick actions below the route. |
| Milestone sheet | `/var/folders/tf/zq_1z08n64s1hl4d6dbc2hvr0000gn/T/codex-clipboard-e3bcec23-098f-427c-b73f-58fe8d047d90.png` | `/tmp/gagan-salesperson-founder-milestone-final.png` | Dim amount, sheet radius/height, lime badge, recognition copy, value/target line, navy CTA, dismiss action. |

### Final rendered comparison notes

- Composition: the final active state preserves the reference order and
  emphasis, with real UAT content replacing sample reference content. The Moto
  E13 is a narrower 360dp-class viewport, so route and secondary work continue
  below the first viewport rather than being compressed into it.
- Relative heights: the Next Visit hero and sales instrument are the two
  largest surfaces; field metrics and the route are denser and use less
  vertical weight than the earlier build.
- Typography: the sales amount is now a composed 32px role rather than the
  earlier 38px display treatment; greeting and hero name retain the strongest
  weights while labels and route metadata remain subordinate.
- Surface count: target blocks are no longer separate gray inner cards;
  milestones are one rail; route stops are rows; Quick Actions are a quiet
  tonal strip.
- Color: navy is reserved for the hero, blue for action/progress, pale lime for
  prior thresholds, and full lime only for the current 75% threshold and its
  legitimate recognition sheet.
- Navigation: the existing four-tab navigation remains behaviorally unchanged
  and is visually aligned with the approved mobile reference proportions.

## Visual scorecard

Scores are based on the rendered Android captures above, not source tokens.
The remaining deductions are device-viewport differences and the fact that the
reference is a larger presentation render; no known visual regression is
hidden by the score.

| Dimension | Score | Evidence / remaining difference |
| --- | ---: | --- |
| Layout | 9/10 | Signature order is preserved; the narrow device naturally folds route content below the first viewport. |
| Typography | 9/10 | Hierarchy is clear and the sales number is reduced; the physical Android system font is slightly heavier than the reference render. |
| Hierarchy | 9/10 | Next Visit is the first operational decision, with target and route following it. |
| Radii | 9/10 | Hero, major surfaces, rows, and bottom sheet use distinct radius roles. |
| Spacing | 9/10 | Header, hero, target instrument, route, and nav have stable rhythm; device density changes absolute pixels. |
| Hero | 9/10 | Real next stop, time, address, location state, visit CTA, and navigation action are all physically visible. |
| Targets | 9/10 | One integrated instrument with separators, progress, period, remaining value, and disciplined milestone emphasis. |
| Route | 9/10 | Five real stops, two completed, next stop, planned stops, addresses, progress, and one-line times are visible. |
| Bottom navigation | 9/10 | One icon family, compact selected state, labels, and safe-area clearance are visible. |
| Milestone sheet | 9/10 | The final release physically shows the legitimate 75% sheet with real target values. |
| Overall perceived quality | 9/10 | The screen reads as a composed field companion rather than a launcher of equal-weight cards. |

## Hard acceptance questions

| Question | Result | Evidence / reason |
| --- | --- | --- |
| Does Home still feel like cards stacked vertically? | NO | Hero, integrated target instrument, metric strip, and itinerary now have distinct composition roles. |
| Does the Day Complete state consume too much space? | NO | `CompactDayStatus` replaces the previous large completed-day hero; the physical capture keeps sales, metrics, and route context visible below it. |
| Is Today's Sales numeral oversized? | NO | Reduced from the previous 38px treatment to the composed 32px role. |
| Are multiple milestones simultaneously neon? | NO | Only the highest reached threshold uses full lime; prior thresholds use pale lime. |
| Do Quick Actions look like a generic module grid? | NO | Tiles use a quiet tonal strip and smaller icon treatment. |
| Is the Next Visit hero physically proven? | YES | `/tmp/gagan-salesperson-founder-active-final-current.png` |
| Is the Route physically proven? | YES | `/tmp/gagan-salesperson-founder-active-final-route.png` and `/tmp/gagan-salesperson-founder-active-final-lower.png` |
| Is the milestone sheet physically proven? | YES | `/tmp/gagan-salesperson-founder-milestone-final.png` |

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

The new standalone release APK was built from the final correction source
commit and installed on the authorized Android device:

- APK: `/Users/tanutejas/Desktop/gagan-salesperson-founder-final-5a5656a.apk`
- SHA-256: `dce1fb7fdd8af7ec695c6314842253a7edf6479c5014d365dbefcc6c5f008025`
- Size: `87,251,731` bytes
- Source revision: `5a5656af11172ee4f9870ac4580810bc59fc3b84`
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
- The compact completed-day state was physically captured after using the
  normal End My Day flow, then the exact staging fixture was reopened with the
  guarded `--reopen-day` reset before the final active-day and milestone
  captures. The fixture is left open for founder review.
