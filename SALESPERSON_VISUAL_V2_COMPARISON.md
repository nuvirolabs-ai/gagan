# Gagan Salesperson App — Visual V2 Comparison

## Review scope

This is the visual comparison record for the SFA V2 presentation rebuild on
`codex/gagan-salesperson-sfa-v2`. The three supplied screenshots are binding
references for composition and behavior; their sample names and numbers are
not copied into the app.

Reference files:

- `/var/folders/tf/zq_1z08n64s1hl4d6dbc2hvr0000gn/T/codex-clipboard-02dc1e01-5d9e-47c4-8190-4c42339c1439.png` — white/blue Home composition.
- `/var/folders/tf/zq_1z08n64s1hl4d6dbc2hvr0000gn/T/codex-clipboard-d442ada7-ad38-4bca-935c-c9eff1637d1f.png` — dark Next Visit hero, targets, route, and navigation.
- `/var/folders/tf/zq_1z08n64s1hl4d6dbc2hvr0000gn/T/codex-clipboard-e3bcec23-098f-427c-b73f-58fe8d047d90.png` — lime milestone celebration sheet.

Final device evidence:

- Before visual rebuild: `/tmp/gagan-salesperson-android-launch.png`.
- Final Home, connected Android device: `/tmp/gagan-salesperson-visual-v2-home-android-final.png`.
- Final Home lower scroll: `/tmp/gagan-salesperson-visual-v2-home-android-final-lower.png`.
- Final 390-class check: `/tmp/gagan-salesperson-visual-v2-home-390.png`.
- Final 430-class check with tab-bar inset: `/tmp/gagan-salesperson-visual-v2-home-430-inset.png`.
- Final retailer list: `/tmp/gagan-salesperson-visual-v2-outlets-final.png`.
- Final retailer detail: `/tmp/gagan-salesperson-visual-v2-retailer-detail-final.png`.
- Final catalog with product imagery and per-kg context: `/tmp/gagan-salesperson-visual-v2-catalog-release-final.png`.

The screenshots were captured from the release APK on the connected Moto E13
(`ZD2229Q3KB`) against the hosted staging API. The physical screen is 720×1600
px; the 390 and 430 checks temporarily used Android display-size overrides and
were restored afterward.

## Data integrity

The final screenshots use the current staging identity and canonical API data:

- Salesperson: Ravi Kumar.
- Sales read: ₹3,63,070.
- Configured monthly target: ₹4,00,000.
- Assigned store data and Gagan product images/prices come from the staging API.
- The current fixture reports `Day complete` and has no manager-published route
  for the capture date. The app therefore shows a truthful completed-day hero
  instead of inventing a next store, distance, or ETA.

No backend fields, order logic, inventory rules, credit rules, permissions, or
SAP behavior were changed for the visual pass.

## Home

### Before

The prior release opened with a functional but generic light dashboard: repeated
rounded blocks, a green-first palette, weaker greeting hierarchy, a conditional
day/sales composition, and a route/metric treatment that did not resemble the
approved field-sales reference. Evidence: `/tmp/gagan-salesperson-android-launch.png`.

### After

The Home now follows the reference composition:

- cool near-white canvas with white primary surfaces;
- compact avatar/greeting/date/status header with an always-available notification affordance;
- dark navy signature field-day / Next Visit hero when a real route stop exists;
- a composed sales instrument with one large value, two target blocks, real progress,
  and lime reached milestones;
- one three-column field-metrics strip;
- itinerary rows with thin separators instead of per-stop cards;
- a restrained quick-action rail with one icon family;
- persistent white bottom navigation with a focused dark Home state;
- bottom-sheet achievement anatomy with lime badge and dark CTA, using the
  existing acknowledgement persistence.

The final current-state capture is `/tmp/gagan-salesperson-visual-v2-home-android-final.png`.
The lower interaction grouping is `/tmp/gagan-salesperson-visual-v2-home-android-final-lower.png`.

### What is faster to understand

The salesperson can read identity, day state, sales progress, target completion,
route state, and the next available field action in that order. The screen no
longer asks the user to interpret several equal dashboard tiles before finding
the field context.

### Remaining state-coverage note

The current staging identity has already completed the day and has no published
route on the capture date. The active Next Visit hero and a newly crossed
milestone sheet are implemented, but cannot be truthfully shown in this fixture
without mutating attendance/route state or fabricating a screenshot value. A
clean route/day identity should be used for the final active-state founder UAT.

## Plan / Route

Route is now an itinerary-style surface: time or sequence first, store identity
and address second, and a quiet state marker last. Existing route actions remain
unchanged. The Home route structure was exercised through the app’s shared route
and retailer navigation; the current identity’s no-route state is intentionally
shown as an informative empty state.

## Retailers and retailer detail

The retailer list uses searchable rows with a blue active filter, initials, tier,
outstanding/credit context, and a consistent bottom tab bar. Retailer detail uses
identity-first hierarchy, commercial context, store intelligence, schemes,
history, and a fixed blue Place order action. Evidence:

- `/tmp/gagan-salesperson-visual-v2-outlets-final.png`
- `/tmp/gagan-salesperson-visual-v2-retailer-detail-final.png`

## Order taking and catalog

The catalog now reads as a field-ordering surface rather than an ERP table:

- real Gagan product imagery is visible in every product row;
- category chips use the shared blue selection treatment;
- product, pack, case price, and per-kg price remain legible;
- the case/per-kg contexts stack when necessary instead of truncating the
  per-kg value with an ellipsis;
- the persistent order dock remains available after a quantity is added.

Evidence: `/tmp/gagan-salesperson-visual-v2-catalog-release-final.png`. The
accessibility tree also exposes full values such as `₹104/kg` and `₹446/kg`.

## Visual scorecard

Scores describe the implemented presentation quality. Where a score is marked
with an asterisk, the component is implemented but the current staging fixture
does not expose the corresponding active data state for a physical screenshot.

| Dimension | Score | Notes |
| --- | ---: | --- |
| Layout | 9/10 | Home hierarchy and content grouping now follow the approved composition. |
| Typography | 9/10 | Greeting, hero/title, sales number, target numbers, labels, and tabular money context have clear roles. |
| Hierarchy | 9/10 | Day state → sales → target → field context → route/actions is deliberate. |
| Radii | 9/10 | Hero, major surfaces, inner blocks, controls, and sheet use separate roles. |
| Spacing | 9/10 | Shared rhythm is applied across Home, retailer, detail, route, and catalog surfaces. |
| Hero | 9/10* | The active navy Next Visit variant is implemented; current fixture only exposed the truthful completed-day variant. |
| Targets | 9/10 | Two target blocks, progress, amount context, and lime milestone rail are visible with real data. |
| Route | 9/10* | Itinerary row structure is implemented; current capture has no route rows to render. |
| Bottom navigation | 9/10 | Persistent navigation, focus treatment, labels, and safe-area clearance are visible on device. |
| Milestone sheet | 9/10* | Reference anatomy is implemented with existing per-day acknowledgement; no new unacknowledged threshold existed in the fixture. |
| Overall screenshot fidelity | 9/10 | Strong visual match for the available current-state surface; active-state evidence remains a fixture/UAT item. |

## Device checks

| Class | Evidence | Result |
| --- | --- | --- |
| Small / physical 360-class | `/tmp/gagan-salesperson-visual-v2-home-android-final.png` and lower capture | PASS — labels, targets, metrics, actions, and tab bar remain usable. |
| Typical 390-class | `/tmp/gagan-salesperson-visual-v2-home-390.png` | PASS — no clipped hero/target content or horizontal overflow. |
| Large 430-class | `/tmp/gagan-salesperson-visual-v2-home-430-inset.png` | PASS — shared AppScreen consumes the measured tab-bar inset; quick actions no longer sit under navigation. |

## Functional safety

The visual pass preserved the accepted SFA V2 contracts. The final release APK
was installed over the accepted fallback, launched explicitly, and showed no
`FATAL EXCEPTION`, `AndroidRuntime`, or `ReactNativeJS` error in the post-launch
log sample. Retailers, retailer detail, catalog, real imagery/pricing, reports,
and More were opened on the physical device after the final build.

The existing functional SFA UAT evidence remains the source of truth for OTP,
session restoration, attendance, visit, order submission, activity, and
performance. This pass did not rewrite those flows.

## QA limits

- Local web login against the hosted staging API was not used as visual evidence
  because the staging CORS allow-list does not include the local Expo origin.
  Physical Android is the authoritative visual check for this pass.
- iOS simulator visual evidence was not captured in this run; the React Native
  system uses shared platform-neutral layout primitives and the Android release
  is the requested standalone staging artifact.
- No production deployment, SAP B1 connection, or backend migration was made.
