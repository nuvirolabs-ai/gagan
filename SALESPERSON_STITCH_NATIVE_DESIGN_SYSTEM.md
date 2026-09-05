# Gagan Salesperson — Stitch Native Design System

Status: implementation baseline for founder physical review

This document translates the approved Stitch exports into the existing React Native application. It is a native composition guide, not a replacement for the existing product contracts or field-work workflows.

## Product read

Gagan is a field companion: a salesperson should understand the next stop, commercial context, and safest next action in one glance. The Stitch direction is therefore a quiet cool canvas, a small number of purposeful white instruments, midnight for high-priority action, cobalt for interaction, and amber/coral only when the underlying data requires attention.

The Stitch export is reference material. The native app keeps the existing session, route, retailer, order, target, offline, permission, and secure-identity data as the only source of truth.

## Tokens

- Canvas: `#F8FAFC`
- Primary surface: `#FFFFFF`
- Inset surface: `#F1F5F9`
- Primary ink: `#0F172A`
- Secondary ink: `#64748B`
- Hairline: `#E2E8F0`
- Midnight action: `#0F172A`
- Cobalt interaction: `#2563EB`
- Soft cobalt: `#DBEAFE`
- Amber attention: `#D97706` on `#FFF7ED`
- Red only for a real critical or destructive state: `#DC2626` on `#FEF2F2`

The native stack uses the platform system font. Numerals use tabular variants where React Native supports them. Uppercase tracking is reserved for small operational metadata, not ordinary labels.

## Surface grammar

1. Canvas: page background, no shadow.
2. Inset: grouped context such as quick actions, inactive controls, or a compact status band; tonal background and hairline only.
3. Raised: a primary instrument such as Today’s Sales, a route, a retailer commercial readout, or the performance cockpit; white, hairline, low broad elevation.
4. Floating: bottom sheets and sticky actions; stronger elevation, used sparingly.

The screen should have a few strong surfaces rather than a rectangle around every field. Lists use thin dividers and press tint; cards are reserved for information that must be read as one instrument.

## Screen compositions

### Home

Brand/operator header → Next Stop hero → real attention signal when present → Today’s Sales and target instrument → route metrics → Next up today → quick actions → remaining operational context.

The dark hero owns the first action. Sales is one coherent surface: headline value, target context, two progress zones, and a restrained milestone rail. The route remains an itinerary, not a grid of cards.

### Outlets

Title and account context → search/filter controls → a compact route summary when canonical route data exists → retailer rows. Each row exposes name, location/contact context, due/credit context, and the one semantic chip that helps a salesperson decide where to go next.

### Reports

Title → Timeline/Performance switch → one blue performance readout → period control → metric band → target instrument → single chart → productivity funnel/readout. The chart is an actual SVG plot from canonical performance data; zero and unavailable states remain explicit.

### More

Small product kicker → title/status → identity and duty surface → grouped operational list rows → account settings. More is a calm index, not a launcher mosaic.

## Interaction rules

- All interactive controls keep at least a 48dp touch target.
- Use `Pressable`/native opacity or tint feedback on the control itself; do not transform a detached wrapper.
- Existing haptics remain at workflow boundaries such as starting/ending a day, submitting an order, and confirmed success.
- Period and metric controls retain their current state semantics and change only presentation.
- Existing navigation and deep links remain the action owners. Stitch visuals do not create new business actions.
- Reduced-motion support remains authoritative for animated progress and future entrance motion.

## Responsive and viewport rules

React Navigation’s normal-flow tab bar owns its own height. Screens only use the shared small final-content gap from `viewportPolicy`; no screen-level tab-bar spacer is permitted. Long screens must be able to scroll content to the visible bar, and a keyboard-facing CTA must use the existing keyboard-avoidance contract.

The compositions are tuned for narrow Android phones first. Long retailer names, large rupee values, missing coordinates, unavailable targets, empty queues, offline state, and permission-limited modules must remain truthful and must not cause layout jumps.

## What is deliberately not copied

- No Stitch sample names, values, dates, or fake activity are embedded.
- No WebView, HTML, CSS runtime, or screenshot background is used.
- No new backend route or business calculation is introduced.
- No redesign is applied to the Admin, Retailer, Founder, Dogkart, SAP, or production surfaces.
