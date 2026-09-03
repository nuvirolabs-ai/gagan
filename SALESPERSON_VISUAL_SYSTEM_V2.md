# Gagan Salesperson App — Visual System V2

## Position

The Salesperson App is a personal field companion: warm enough for a long day outside, precise enough to move a store visit forward, and visually calm enough to use one-handed between conversations. The binding reference is a white/blue mobile application with one dark action surface, one chartreuse achievement signal, and a compact itinerary—not a green consumer storefront and not an ERP dashboard.

This contract governs the visual reconstruction only. It does not change canonical data, permissions, or SFA behavior.

## Canvas and surfaces

| Role | Token direction | Use |
| --- | --- | --- |
| Canvas | `#F4F6F9` cool near-white | Root screen, behind all content. |
| Primary surface | `#FFFFFF` | Sales read, target instrument, route list, forms that need focus. |
| Secondary surface | `#F0F2F5` | Inner metric blocks, quiet action cells, input backgrounds. |
| Hairline | `#E1E5EB` | Dividers and field borders, never heavy containers. |
| Hero | deep midnight navy | Next visit and primary field action only. |
| Action blue | vivid but restrained blue | Primary actions, active navigation, links, progress. |
| Milestone lime | chartreuse/lime | Reached/current achievement only. It is not a brand wash. |
| Success green | forest green | Completed, verified, healthy, and collected states. |
| Warning / critical | amber / brick red | Attention that needs action, never decoration. |

The base app should read as light and breathable. Visual depth comes from white surfaces against the cool canvas and from the dark hero—not from shadows on every object.

## Typography

Use the native system sans stack through React Native defaults. Do not add a decorative font. Avoid cramped tracking and aggressive negative letter spacing.

- Greeting: 26–30sp, semibold/bold, dark navy.
- Hero retailer: 25–30sp, bold, white.
- Screen title: 24–28sp, semibold.
- Primary commercial number: 32–40sp, bold, tabular where the platform supports it.
- Section heading: 13–15sp, semibold; uppercase only for short metadata labels.
- Primary row: 15–16sp, medium/semibold.
- Secondary context: 13–14sp, muted slate.
- Metadata: 11–12sp, muted slate, with restrained tracking.

Numbers should be easy to compare. Money and percentages use `en-IN` formatting and should not be squeezed into tiny labels.

## Geometry and rhythm

- Screen inset: 20–24dp; never let primary content touch the device edge.
- Header to hero: 16–20dp.
- Surface-to-surface: 12–16dp.
- Major surface padding: 20–24dp.
- Inner block padding: 14–18dp.
- Button height: 48–52dp, minimum touch target 44dp.
- Bottom navigation clearance: safe-area inset plus 82–96dp.
- Standard transitions: 160–240ms; disable or shorten motion when reduced motion is enabled.

Radii are semantic:

- hero: 28–30dp
- major surface: 20–24dp
- inner block: 16–20dp
- button: 16–20dp
- chip/milestone: full radius
- bottom sheet: 30–34dp top corners

Do not put a border and shadow on the same normal surface. Prefer a hairline or tonal separation.

## Home composition

The Home is an operating read, ordered vertically:

1. Header: avatar, greeting, date/status, notification affordance.
2. Next Visit hero: dark navy, next/time badge, store identity, address, Start visit, Navigate.
3. Today’s Sales: large value, daily/weekly target blocks, progress, milestone strip.
4. Field metrics: one compact strip.
5. Today’s route: itinerary rows with time/address/state.
6. Quick actions: attendance, order, Sales Kit, More.
7. Needs attention and tasks: only when canonical data requires it.

When the day is closed, the hero becomes a truthful completed-day state but keeps the same footprint and action hierarchy. Sales remains visible if canonical metrics exist; hiding the commercial read makes a completed day look empty.

## Signature surfaces

### Next Visit hero

The hero is the only large dark surface. It communicates one safe next action. Use a chartreuse or blue next badge only for real next/current state; no fake distance or ETA. The action row has one dominant blue Start visit button and a quiet Navigate action.

### Sales instrument

The sales surface is one composed object, not a row of unrelated KPIs. A large current value anchors it. Daily and weekly progress are comparable inner blocks. Milestones are compact pills along the bottom edge. If a target dimension is missing, show `Not configured` or omit that block; never invent a target.

### Route list

Route is an itinerary. A thin divider does more work than a bordered card per stop. A row includes time/sequence, store name, area/address, and a quiet state marker. A single action opens the stop.

### Field metrics

Use one rounded strip with 3 columns on typical phones. On narrow phones, wrap into two columns with generous label width. Keep collection value green only if it is a confirmed canonical collection.

### Quick actions

Use one icon family. Icon containers may use a pale blue disc or a quiet neutral cell, but do not make four colorful dashboard tiles. Each action retains a 44dp touch target and a concise label.

### Achievement sheet

On first acknowledgement of a real threshold crossing, dim the Home and slide a white sheet from the bottom. Show a lime badge with the percentage, a direct headline, concise earned-context copy, current/target amount, a dark primary CTA, and a quiet dismiss action. Persist acknowledgement by salesperson/day/threshold using the existing achievement contract.

## Buttons and controls

- Primary: vivid blue or dark navy when the action is inside a navy hero; white text; 16–20 radius.
- Secondary: low-chrome outline or text action; blue label; same touch height.
- Destructive: brick red only for irreversible/closing action, with explanatory copy.
- Chips: white/neutral by default; blue selected for filters; lime selected only for milestone achievement.
- Steppers: large touch targets, product image/price context, no tiny ERP controls.

Pressed states reduce opacity or shift tonal background for 160ms. Focus indicators remain visible on web/keyboard surfaces.

## Navigation

The primary tab bar is a white safe-area surface with a subtle top separator. It uses a single outlined icon family, 20–22dp icons, and labels no longer than needed. Home is the visual anchor. The permission-aware set remains unchanged by capability; label mapping may use Home, Outlets/Plan, Reports, and More where that reflects the current route.

## Secondary screen grammar

The same system propagates without making every screen identical:

- Plan/Route: itinerary and progress, not stacked cards.
- Retailers: searchable rows with store identity and commercial context.
- Retailer detail: identity, next visit/order action, commercial read, schemes, history, activity.
- Catalog/order: image-led product rows, category chips, price and pack, generous steppers, persistent cart dock.
- Performance: one lead number, target trajectory, compact trend, direct conclusion.
- More: grouped list rows under Field Work, Retailer Tools, Sales, Account.
- Forms: sectioned fields, visible labels, progressive detail, one obvious submit action.
- Visits/activity: timeline ledger, verification state, outcome, and next action.

## States

- Loading: stable skeletons preserve header, hero, surface, and route geometry; never flash zeros.
- Empty/healthy: say what is true, such as `No route published for today` or `No stores need a follow-up.`
- Offline: a compact warning banner with plain-language recovery; cached/read-only surfaces may remain visible.
- Error: human message first; technical detail only in authorized diagnostics.

## Responsive behavior

Validate at 360×800, 390×844, and 430×932. The hero must not clip. Target blocks may become one column only when needed; route rows must preserve store name and state. Bottom navigation must remain above the safe-area inset. Inputs and action buttons must remain keyboard-safe.

## What V2 changes from the previous implementation

The previous pass introduced the right colors and several correct components but still rendered as a vertical stack of similarly bordered cards. V2 is a composition pass: the hero is a signature action, the sales read is a single instrument, route is a list, metrics are a strip, and secondary work is grouped. The reference is matched through proportion, spacing, action hierarchy, and state treatment—not by copying sample values or adding decorative gradients.
