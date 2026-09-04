# Gagan Salesperson V2.2 — Material and Motion Audit

Status: pre-implementation audit  
Date: 4 September 2026  
Source branch: `codex/gagan-salesperson-v2-2-material-motion`  
Source commit: `e47e38e99cf08c0d71542ea230815c33dca17a26`  
Base: `origin/codex/gagan-staging` at the time of audit  
Scope: Salesperson App (`rep/`) only

## Guardrails

This pass is a presentation and interaction refinement. The following remain
frozen and are not part of the change surface:

- authentication, session restoration, permissions, and manager scope;
- route, attendance, visits, EOD, retailer, catalog, pricing, credit, inventory,
  targets, performance, offline/outbox, and order contracts;
- secure Aadhaar/photo handling and the existing backend API;
- Admin, Retailer App, Founder App, Dogkart, SAP behavior, production, and
  `main`.

The attached Moto E13 photographs are binding defect evidence for this audit.
The current evidence set is stored outside the repository at:

`/tmp/codex-remote-attachments/01a03ead-23c6-7c42-8516-b0fb855094fc/661BFC3E-6B09-42BC-B7AD-B599FC933C82/`

The source implementation was also inspected in the isolated worktree. No
V2.2 code changes had been made when this document was created.

## Current rendered baseline

| Area | Current treatment | Problem seen in the physical evidence | Proposed V2.2 treatment | Performance risk | Accessibility risk | Affected screens |
| --- | --- | --- | --- | --- | --- | --- |
| Canvas | `colors.bg` / `colors.canvas` is a single light neutral (`#F5F6F8`) | White content surfaces blend into the background; there is no ambient framing | Keep the cool neutral canvas and add only a static, very low-contrast top tint layer on major surfaces, with a solid fallback | Very low if implemented as a static view; avoid blur | Keep contrast unchanged; do not use tint as a status signal | All `AppScreen` surfaces |
| Primary surface | Shared `Surface`/`Card` uses white, hairline border, large radius | Most sections have the same perceived depth; raised objects do not read as instruments | Add explicit material levels: canvas, inset, raised, floating; apply Level 2 only to primary instruments | Low; one shadow per major surface | Borders remain present; no meaning relies on shadow | Home, Reports, Timeline, Retailer Detail, forms |
| Inset surface | `surfaceAlt`/`surfaceSecondary` tonal blocks | Inset areas and raised cards use similar geometry and color | Use tonal inset zones without shadow for metrics, actions, and form groupings | Negligible | Text and controls retain existing contrast | Home metrics/actions, reports, forms, catalog |
| Borders | Hairlines on most cards, inputs, chips, and rows | Border repetition creates a pasted-card feeling | Keep hairlines for boundaries, remove redundant nested borders where a tonal separator is enough | Negligible | Preserve visible boundaries for low-contrast surfaces | Shared components |
| Shadows/elevation | `elevation.card` is empty; `elevation.floating` exists but is rarely used | White surfaces merge with canvas; bottom bar is visually attached | Centralize low broad Level 2 shadow (Android elevation 2–3) and stronger Level 3 shadow for sheets/CTA only | Low on a few surfaces; tune for Moto E13 | Depth is supplementary, never the only state cue | Home, Reports, Retailer Detail, bottom CTA/sheets |
| Gradients | No app-level gradient package or shared gradient primitive | Hero is a flat midnight block; the app feels static | Use a cheap layered midnight tone or existing SVG primitive for one static hero treatment; no animated gradients | Low if static; do not add real-time blur | Text contrast tested against final hero tone | Home Next Visit hero |
| Buttons | `PrimaryButton`/`SecondaryButton` use `TouchableOpacity` and `activeOpacity` | Controls look like text/icons placed in rectangles; no tactile scale or shared loading anatomy | Introduce shared `TactileButton` with 52–56dp primary height, scale/opacity press state, icon alignment, loading/disabled states, and haptic hook | Low with native-driver transform/opacity | Keep 44dp minimum hit target, label, role, and disabled state | Home, visits, retailer, catalog, forms, sheets |
| Quiet actions | `TextButton`/raw `Pressable` mostly changes opacity | Navigate, Full plan, See all, and Done have inconsistent feedback | Use a shared quiet press treatment with visible pressed tint and no competing fill | Very low | Preserve readable text and button role | Home, Reports, forms, detail |
| Segmented controls | `FilterChip` switches static background/border; no moving selection capsule | Timeline/Performance and report metric selection feel abrupt and disconnected | Use a shared animated selection treatment, with a single cobalt/midnight family and reduced-motion fallback | Low; animate opacity/scale, not layout | Expose selected state and keep labels readable | Reports/Timeline, Performance, route/filter controls |
| Bottom navigation | React Navigation normal-flow bar, white surface, hairline, fixed 78dp height; selected icon backing is a static dark rounded rectangle | Bar feels printed onto the bottom; no material separation or selection transition | Keep normal-flow/inset ownership from V2.1; add hairline, restrained upward shadow, animated selection backing, and selection haptic | Low; native-driver transform/opacity only | Do not reduce bar height or introduce overlay padding; keep labels/icon contrast | All tab screens |
| Sheets/dialogs | Native `Modal` with slide animation; action buttons vary | Sheets are functional but not consistently material or tactile | Preserve native modal boundary; add Level 3 surface, handle/spacing where custom sheet exists, shared buttons, and reduced-motion-safe animation | Low if native modal is retained | Keep escape/back behavior and focus order | Home EOD/milestone, Reports detail, other modal flows |
| List rows | Mix of `Pressable`, `TouchableOpacity`, and raw views; pressed state is generally opacity or background tint | Rows do not have a common physical response; route and retailer rows feel static | Create shared tactile row primitive or upgrade existing `ListRow`/row styles with scale/opacity-free layout stability, tint, and optional haptic | Low; avoid per-row mount animation in long lists | Keep semantic button roles, hit slop, and chevrons | Route, Retailers, Timeline, More, forms, catalog |
| Charts | `react-native-svg` paths/bars render immediately; static `TrendChart` and VisualBars | Reports feel like values printed on a surface; metric switching can redraw abruptly | Animate chart container/series opacity and metric value transitions in one bounded area; preserve real values and labels | Low if one chart animates at a time; avoid path morph loops | Add accessible chart description and direct scale/unit copy | Reports/Performance |
| Progress bars | Shared `ProgressRow` animates width with JS-driven width interpolation, 320ms; reduced-motion check is local | Progress changes have limited material feedback; multiple controls use divergent tracks | Retain bounded width animation, tune to 450–650ms for deliberate instruments, centralize reduced-motion hook, and use cobalt only for primary progress | Moderate because width uses non-native driver; keep count small and no loops | Keep `accessibilityRole=progressbar` and numeric value | Home, Reports, route, targets |
| Skeleton/loading | Static tonal `Skeleton` plus full-screen `ActivityIndicator` in some screens | Content appears abruptly; routine loads can look empty or spin-heavy | Add low-contrast stable geometry and short content fade; stop shimmer on error and keep spinner for explicit submit only | Low; no continuous shimmer on budget device | Do not announce decorative motion; preserve loading semantics | Home, Reports, retailers, forms, catalog |
| Success feedback | Existing `haptic` calls in selected flows and `Alert.alert` after actions | Feedback is not a consistent visual pattern; alerts interrupt field work | Keep business outcomes and alert fallback, add compact confirmation surface/toast where existing screen state allows, plus haptic | Low; auto-dismiss only transient UI | Never rely on haptic alone; announce visible result | Visit, order, retailer proposal, expenses, EOD |
| Error feedback | `Alert.alert`, inline error banners, raw `ActivityIndicator` | Error surfaces vary and can expose a generic interruption rather than a next step | Use compact alert surface, plain-language message, retry/close action, preserved input; do not alter API errors | Negligible | Preserve accessible error text and focus | All network/form flows |
| Haptics | `rep/src/feedback/haptics.ts` exists; call sites opt in individually | Tap semantics are inconsistent; shared controls do not provide predictable feedback | Route light selection/success/warning through existing helper only; no new dependency | Very low; avoid high-frequency list haptics | Visual state remains complete without haptic | Buttons, tabs, segments, success/error actions |
| Reduced motion | `ProgressRow` checks `AccessibilityInfo`; most controls and transitions do not | A user preference is honored only by one component | Add shared `useReducedMotion`/motion helpers; all new scale, fade, sheet, segment, and progress effects have an immediate fallback | Low; one listener per mounted shared animation surface or shared hook | Directly improves accessibility; retain stable layout | Shared components and all affected screens |
| Safe areas | V2.1 fixed normal-flow bottom ownership; screen shell no longer reserves tab height | Visual changes must not reintroduce the previously fixed bottom gap | Keep the existing normal-flow model exactly; material bar shadow lives inside its own bar | None if no inset changes | Top/notch safety and final-content breathing gap remain intact | All tab screens |

## Shared component inventory

The V2.2 change should be concentrated in these existing surfaces before any
screen-specific composition changes:

- `rep/src/theme.ts`: authorized palette, material levels, radii, control sizes,
  and motion durations;
- `rep/src/components/companion.tsx`: `AppScreen`, `Surface`, progress,
  greeting, attention/list/timeline rows, skeleton and error primitives;
- `rep/src/components/ui.tsx`: `Card`, `PrimaryButton`, `SecondaryButton`,
  `TextButton`, `FilterChip`, `ListRow`, `QtyStepper`, `Field`, empty/error
  patterns;
- `rep/App.tsx`: bottom-tab material, tab selection animation, and tab haptic;
- `rep/src/feedback/haptics.ts`: existing safe haptic boundary, without adding
  a new dependency.

Screen-level changes should be limited to composing those primitives in the
existing information order. No API client, context contract, reducer, or
business calculation needs to change for this pass.

## Surface-by-surface visual targets

### Home

Current physical evidence shows the correct V2.1 information architecture:
header, Next Visit, Today's Sales, field metrics, route, quick actions,
attention, and field-day state. V2.2 should make the hero and sales instrument
Level 2/3 objects, keep field metrics inset, give the NEXT route row a cobalt
rail, and make the bottom bar an elevated material layer without changing order
or viewport ownership.

### Reports and Timeline

The evidence shows a readable timeline and a strong performance cockpit, but
both are static. V2.2 should use one raised report instrument, a tonal metric
band, a single bounded chart transition, and a coherent timeline rail. It must
not introduce a multi-series or rainbow data display.

### Retailer Detail

The evidence shows identity, commercial context, Store Intelligence, schemes,
and a sticky Place order action. V2.2 should make the identity/commercial region
one deliberate raised surface with inset zones and keep the CTA as a Level 3
action surface above the existing safe-area contract.

### New Retailer

The evidence shows a valid four-step form and keyboard-safe CTA. V2.2 should
reduce static visual weight through smaller inputs, a compact step instrument,
focus treatment, and shared tactile Continue/Review actions. It must preserve
the previous keyboard and secure-photo behavior.

### Remaining screens

Outlets, Plan/Route, Visit, Catalog/order-taking, Cart/order review, Attendance,
Leave, Tasks, Expenses, Issues, Schemes, Sales Kit, EOD, Profile, More, and
offline/sync states should inherit shared material/buttons/list/loading tokens.
They are not permission to add new SFA capability or change their data model.

## Acceptance risks to watch during implementation

1. A new shadow or bottom-bar style must not add a second bottom inset. V2.1's
   normal-flow fix remains authoritative.
2. `TouchableOpacity` to `Pressable` changes must preserve `disabled`,
   accessibility, and navigation behavior.
3. Progress and chart animations must not delay data use or create repeated
   animations on scroll.
4. Existing legacy semantic colors may still appear in genuine success/error
   states. They must be reduced to small semantic indicators; the primary
   visual family remains neutral + midnight/cobalt with muted coral alerts.
5. No sample values from the reference photographs may enter React state or
   seed data.
6. The final decision must be made from Moto E13 renders and a recording, not
   only from TypeScript/build success.

## Audit conclusion

The app does not need a new information architecture. It needs a shared
material contract and a shared response model. The highest-leverage V2.2 work
is therefore: centralize tokens, upgrade surfaces/buttons/segments/tab bar,
add reduced-motion-safe native-driver feedback, then verify Home, Reports,
Timeline, Retailer Detail, New Retailer, and the existing long-scroll flows on
the physical Moto E13.
