# Gagan Salesperson V2.2 — Motion System

Status: frozen implementation contract for the V2.2 material/motion pass  
Scope: Salesperson App only  
Baseline: `e47e38e99cf08c0d71542ea230815c33dca17a26`

## Purpose

Motion should make the field companion feel responsive and physically composed.
It must never delay a field task, decorate an empty screen, or change the
meaning of an existing state. The system is intentionally small so it remains
smooth on the Moto E13.

The V2.2 visual distinction is:

- material depth is encoded by a few intentional surface levels;
- tactile response is shared by controls rather than hand-tuned per screen;
- transitions move the user's focus, not the whole screen for effect;
- charts and progress acknowledge real data changes without inventing data;
- reduced motion always collapses an effect to its final state.

## Authorized material tokens

### Color families

| Token | Value | Use |
| --- | --- | --- |
| `canvas` | `#F4F6F9` | App background and ambient neutral |
| `surface` | `#FFFFFF` | Primary raised surface |
| `surfaceInset` | `#EEF1F5` | Tonal/inset groups and inactive controls |
| `ink` | `#081221` | Primary text and midnight structural surfaces |
| `inkMuted` | `#667085` | Secondary copy and metadata |
| `inkFaint` | `#98A2B3` | Placeholder/tertiary copy only |
| `midnight` | `#071426` | Hero, primary dark CTA, selected controls |
| `cobalt` | `#2F6BFF` | Interaction and primary progress accent |
| `cobaltSoft` | `#EAF1FF` | Selected/inset cobalt tint |
| `coral` | `#D3483F` | Destructive, blocked, or genuinely late state |
| `coralSoft` | `#FCEDEA` | Alert surface |
| `success` | restrained green | Tiny semantic confirmation only |

No lime, purple, pink, orange, decorative multicolor icon backgrounds, or
rainbow chart series are part of this system. A legacy semantic alias may map to
one of these families for compatibility, but screen code must not introduce a
new palette.

### Elevation levels

| Level | Material | Treatment | Examples |
| --- | --- | --- | --- |
| 0 | canvas | no shadow | screen background |
| 1 | inset | `surfaceInset`, hairline, no floating shadow | quick actions, metric band, form grouping |
| 2 | raised | white, hairline, broad low shadow, Android elevation 2–3 | Today's Sales, route, report instrument, retailer context |
| 3 | floating/action | white or midnight, stronger soft shadow, Android elevation 4–6 | bottom sheet, sticky CTA, milestone/confirmation |

Nested surfaces should normally step down a level. Do not put Level 2 shadow
inside another Level 2 surface unless the inner object is an actual control.

### Geometry

- Screen horizontal inset: use existing `spacing.xl`/screen composition; do not
  add page-specific offsets.
- Hero radius: 26–30.
- Major surface radius: 20–24.
- Inner group radius: 16–20.
- Button radius: 16–20.
- Status/selection pills: full radius only where semantic compactness is useful.
- Primary button height: 52–56dp; compact controls must still preserve a 44dp
  touch target through padding/hit slop.
- Use broad, low shadows. Avoid crisp floating outlines or large dark shadows.

## Motion primitives

| Name | Duration / curve | Allowed properties | Use |
| --- | --- | --- | --- |
| `press` | 90–140ms, ease-out | scale 0.985–0.98, opacity/tint | buttons, tabs, actionable rows |
| `base` | 180–220ms, ease-out | opacity and translateY/translateX | section/route/tab transitions |
| `sheet` | native spring | opacity and translateY | bottom sheets and decisions |
| `progress` | 450–650ms, ease-out | bounded fill width | real progress changes only |
| `chart` | 220–320ms, ease-out | chart container opacity/scale or safe path fade | metric switch/data update |
| `list` | 180–240ms, ease-out | opacity + 4–8dp translate | bounded insert/refresh, never a scrolling loop |

Use native-driver-compatible transform and opacity wherever possible. Width
progress is allowed for the small number of visible progress tracks, but it
must be bounded and must not run continuously.

## Reduced-motion policy

Use one shared `useReducedMotion` subscription backed by
`AccessibilityInfo.isReduceMotionEnabled()` and
`reduceMotionChanged`.

When reduced motion is enabled:

- press feedback changes immediately to the pressed state and returns without
  scale animation;
- selection and tab state changes immediately, with no sliding capsule;
- sheets use the platform's reduced/instant behavior where available;
- progress and chart values render directly at their final values;
- no screen entrance stagger is used;
- haptics remain optional feedback and never replace a visible state.

The hook subscription must be cleaned up. Do not create a new listener on every
row render. Long lists must not hold one listener per item.

## Shared interaction contracts

### `TactileButton`

Props should preserve the current button API (`label`, `onPress`, `disabled`,
`icon`, `tone`) and add only presentation details. It must:

- expose `accessibilityRole="button"`;
- preserve disabled behavior and visibly reduce emphasis;
- give immediate scale/tint feedback on press-in;
- call the existing haptic helper once on a meaningful press, not on every
  render or repeated move event;
- show an inline spinner without changing height when loading;
- keep text/icon alignment stable across states;
- support primary midnight/cobalt, quiet, secondary, and coral alert variants.

### `TactilePressable`

Use for shared list rows, tab buttons, quick actions, and segments. The pressed
state must be visible without changing layout height. Rows should not scale
enough to cause neighboring content to move.

### Segments

Use one selection capsule/background within a stable control frame. The capsule
may crossfade/scale or translate when widths are known; do not animate the whole
screen. Selected state remains available via accessibility state and text.

### Tab bar

React Navigation's bottom tab bar is normal-flow in this app. Keep its height
and the V2.1 single-owner viewport contract unchanged. Material treatment is
limited to the bar itself:

- white/opaque surface with a top hairline;
- restrained upward shadow;
- selected icon backing/capsule animates in 180–220ms;
- tab selection may provide light haptic feedback;
- no overlay positioning, additional scene padding, or full-height empty band.

## Screen choreography

### Home

The existing order remains:

1. compact header;
2. Next Visit hero;
3. Today's Sales / targets;
4. milestones;
5. field metrics;
6. route;
7. quick actions;
8. attention and field-day state.

On a cold mount, a short under-450ms sequence may fade/translate the header,
hero, sales instrument, and route rows. The content must be usable immediately;
the animation is not a loading gate. Progress fills animate only after real
values are present. Scroll must not replay the entrance.

Home-specific material:

- Next Visit: Level 2 raised midnight instrument with a static tonal highlight;
- Today's Sales: Level 2 white financial instrument with an inset target band;
- Field metrics: Level 1 single instrument with separators;
- route: Level 2 with a cobalt NEXT rail and tactile rows;
- quick actions: Level 1 strip, no module-card grid;
- attention: Level 2 white/coral-tinted row only when real attention exists;
- field-day completion: Level 1 compact status row.

### Reports and Timeline

Keep the existing Timeline/Performance tabs and data. When the tab or metric
changes, use a 180–240ms crossfade/shared-axis transition inside the existing
content area. Keep one report instrument raised, a tonal metric band inset, and
one chart region. Do not animate every chart bar or every timeline row.

Timeline events use one thin rail and small tonal icon circles. Event color is
limited to primary, neutral, or coral when an event is genuinely alerting.

### Retailer Detail

Use one raised identity/commercial surface with inset zones, then intelligence
and related information with tonal separators. The sticky Place order action is
Level 3 and uses the shared primary button. Press feedback must not move the
content under the existing safe-area arrangement.

### New Retailer

Preserve four steps, validation, keyboard behavior, and secure photo handling.
The step selector uses a compact selection transition. Focus changes should
animate border/color only, without changing field height. Validation may use a
single restrained 2–3dp shake on attempted progression, never a continuous
loop. Continue/Review remains visible above the keyboard through the existing
keyboard-only inset policy.

### Order taking and remaining screens

Shared material/buttons/list rows propagate the same depth and response to
Catalog, Cart, Order Review, Outlets, Plan, Visit, Attendance, Leave, Tasks,
Expenses, Issues, Schemes, Sales Kit, EOD, Profile, More, and offline/sync
states. No screen may add a new motion dialect or change the underlying data
flow.

## Feedback rules

| Outcome | Visual feedback | Haptic |
| --- | --- | --- |
| meaningful button press | immediate pressed state | light selection where useful |
| Visit started / order placed / proposal submitted / expense submitted | compact visible confirmation or existing success alert | success once |
| validation failure | inline alert text/border, preserve input | warning only on attempted progression |
| network error | plain-language alert surface with retry | optional warning |
| disabled action | visible disabled treatment and explanation where applicable | none |

No confetti, continuous animation, looping shimmer after error, or haptic-only
confirmation.

## Performance budget

The Moto E13 is the acceptance device.

- Animate at most the visible hero/sales/route sections during Home entrance.
- Animate one chart region when the selected metric changes.
- Do not use blur, real-time shadow animation, JS timers, layout animation in
  long lists, or per-row listeners.
- Prefer `useNativeDriver: true` for opacity/transform.
- Keep shadows static and broad; fall back to hairline + tonal separation if
  Android rendering is slow.
- Do not keep animated values alive for screens that are unmounted.

## Accessibility and testing contract

Every new animated interactive primitive must retain:

- visible focus/pressed state;
- semantic role and selected/disabled state;
- 44dp minimum touch target;
- readable label and adequate contrast;
- reduced-motion final-state behavior.

Physical verification must cover Home cold open, Start Visit press, scroll,
Reports tab, 7D/30D, metric switch, Timeline, New Retailer step transition,
and keyboard + sticky CTA. Screenshots verify composition; a 20–30 second
Moto E13 screen recording verifies motion response.

## Non-goals

- no new SFA capability;
- no backend or API changes;
- no sample/reference values in runtime data;
- no Admin/Retailer/Founder visual changes;
- no staging integration until Founder approves this feature branch;
- no production or `main` deployment/change.
