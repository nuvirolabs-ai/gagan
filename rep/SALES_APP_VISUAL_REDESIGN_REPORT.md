# Sales app visual redesign report

Presentation-only redesign of the existing salesperson app on `codex/gagan-staging`.

## Screens changed

| Screen | Status | Notes |
|---|---|---|
| Today | Redesigned | Personal greeting, day-state focus card, next action, momentum strip, gold target module, compact route / attention / tasks |
| Retailers | Redesigned | Account count, compact summary, filter chips, customer rows |
| Customer detail | Redesigned | Identity + finance snapshot, check-in vs visit-in-progress, timeline activity |
| Visit | Polished | Focus card, calmer verification copy, success haptic on checkout |
| Order / catalog | Polished | Selected pack gold wash, quieter success alert, success haptic |
| Activity timeline | Redesigned | Day groups + spine events, not stacked log cards |
| Activity performance | Redesigned | Month headline, one grouped metric surface, progress rows, de-emphasised ranking when n=1 |
| More | Redesigned | Profile + grouped tool lists |
| Route / Needs attention | Inherited | AppScreen + existing flows |
| Tab bar | Polished | primaryDeep active state, soft capsule |
| Secondary (My Day, Expenses, Issues, Map, Add Store) | Inherited | Same tokens / cards; not custom-art-directed |

## Shared components created

`src/components/companion.tsx`

- AppScreen, PersonalGreeting, SectionHeader
- FocusCard, Surface
- MetricStrip, ProgressRow
- CustomerRow, AttentionRow, TaskRow, TimelineEvent
- StatusChip, FilterChip, InitialsBadge
- TextButton, OfflineBanner, Skeleton, ErrorState

Existing `ui.tsx` primitives (buttons, search, empty, list row, cards) now use the same tokens and re-export the companion set.

`src/feedback/haptics.ts` — light/medium/success/warning via `Vibration`. No-op on web.

## Tokens introduced

In `src/theme.ts`:

- Colour aliases: canvas, surfaceSecondary, textPrimary/Secondary/Tertiary, separator, primaryDeep/primary/primarySoft, goldStrong
- Spacing: section 24, block 32, hero 40
- Radius: focus 22, hero 24; card 16; control 12
- type roles: display, screenTitle, sectionTitle, cardTitle, bodyStrong, metricXL/Large/Medium, caption
- elevation (cards have no drop shadow)
- motion, control
- helpers: `initials`, `greetingForHour`

Existing hex values and contrast tests are unchanged.

## Old components removed/replaced

Nothing deleted. `Card` / `MetricTile` / `ListRow` remain for secondary screens. Today, Retailers, Activity, and More no longer treat every block as an equal white card.

## Accessibility notes

- Contrast pairs still tested in `designTokens.test.ts`
- Gold is not used as small text on white
- Status uses icon + label, not colour alone
- Progress bars honour reduce-motion
- Minimum tap targets on chips, tasks, customer rows, and primary buttons (48pt)
- Tab bar no longer uses a fixed height that would clip the home indicator

## Functional regressions found

None in typecheck or the 82 existing salesperson unit tests.

Behaviour preserved: APIs, attendance, tracking, offline outbox, orders, collections, visits, expenses, issues, targets, opportunities, retailer proposals, permissions.

Copy-only change: location privacy wording (`trackingBanner`) and a few Today / More strings. Tests updated to the new off-duty sentence.

## Physical-device verification

Not run in this pass. A new staging APK was not built here. Install the next local staging APK and compare Today / Retailers / Activity / More on the same 360–390dp Android phone used for the previous UAT.

## Known visual limitations

- Live screenshots of before/after day states were not captured from a device in this session
- Hindi covers the new greeting and day-state keys; some newer English-only strings fall back to English
- Nearby filter was not added — the retailer list API does not expose distance, and no extra API call was introduced
- Ranking with one salesperson is shown quietly rather than as a trophy
- Secondary screens still use the older card layout, now on the shared canvas and radius
- Expo web / simulator visual QA was not available in this session
