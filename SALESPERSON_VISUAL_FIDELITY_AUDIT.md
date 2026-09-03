# Gagan Salesperson App — Visual Fidelity Audit

## Scope

This audit compares the running SFA V2 app with the three binding salesperson references supplied for this pass:

1. Premium white/blue Home reference (`codex-clipboard-02dc1e01-5d9e-47c4-8190-4c42339c1439.png`).
2. Dark Next Visit / target-progress composition (`codex-clipboard-d442ada7-ad38-4bca-935c-c9eff1637d1f.png`).
3. Lime milestone celebration sheet (`codex-clipboard-e3bcec23-098f-427c-b73f-58fe8d047d90.png`).

The current physical-device evidence used for the visual pass is `/tmp/gagan-salesperson-visual-v2-home-android-final.png`, captured from the final rebuilt release APK on the connected Moto E13 Android device at 720×1600 px (approximately the 360dp small-phone class). The lower Home composition is captured at `/tmp/gagan-salesperson-visual-v2-home-android-final-lower.png`; the resized 390 and 430 class checks are `/tmp/gagan-salesperson-visual-v2-home-390.png` and `/tmp/gagan-salesperson-visual-v2-home-430-inset.png`. The earlier `/tmp/gagan-salesperson-android-launch.png` remains useful only as the before-state reference. This is a presentation audit only. Existing API contracts, permissions, location checks, order validation, inventory, credit, outbox, and SFA behavior remain authoritative.

## Fidelity matrix

| Reference characteristic | Current app | Gap | Fix in this pass |
| --- | --- | --- | --- |
| App background | Light neutral canvas exists, but the current surface reads as a flat grey stack on Android. | The reference has a softer cool-white canvas with stronger white/neutral zoning. | Tune canvas/surface tokens and use a single composed scroll surface instead of repeated equal cards. |
| Safe areas | Safe-area-aware top padding and tab clearance are present. | Header proportions are smaller than the reference and Android system chrome exposes the geometry more strongly. | Centralize safe-area spacing and increase the header’s visual presence without creating a tall banner. |
| Header | Greeting and date render; notification appears only when notifications exist. | Reference always reserves a calm right-side action area, with a larger avatar and clearer status line. | Add a stable notification affordance, status line, larger avatar, and reference-aligned header spacing. |
| Avatar | Initials avatar is functional and blue. | Current avatar is visually light and undersized compared with the reference. | Use a 52–56dp blue avatar with optical centering and a small online/state dot where appropriate. |
| Greeting | Name is readable, but the current completed-day copy is visually dominant and not paired with a compact status line. | Reference uses one strong greeting plus a quieter operational line. | Separate greeting, date/status, and notification into explicit hierarchy. |
| Status line | Date is shown; route/day status is distributed into later content. | Reference gives immediate field-day context under the greeting. | Add deterministic stops-left/day-state copy derived from route and attendance. |
| Notification icon | Conditional bell, no visual container. | It disappears in the normal empty-notification state, unlike the reference. | Keep the affordance visible and use a consistent touch target; no fake notification count. |
| Next Visit hero | A navy hero exists when a route stop is available. | Current hero uses extra “STOP / purpose” metadata, a blue pill, and a generic two-button row; it does not match the reference’s lime next badge and hierarchy. | Recompose as a signature dark hero: next/time badge, distance only when truthful, retailer/address, large blue Start visit, quiet Navigate. |
| Hero typography | Dark hero has reasonable contrast. | Current retailer/address spacing and relative type scale are flatter than the reference. | Increase retailer title hierarchy, reduce metadata noise, and match the reference’s internal rhythm. |
| Hero spacing | Hero is a generic padded surface. | Reference has generous but deliberate top/bottom spacing and stronger action anchoring. | Use a dedicated hero layout with 26–30 radius, fixed rhythm, and bottom action alignment. |
| Hero buttons | Existing Start visit/Open store and Navigate actions work. | Secondary Navigate is boxed like a peer; reference makes it a quiet text action. | Make Start visit dominant and Navigate text/low-chrome while retaining touch size. |
| Today’s Sales | Current surface is conditional and hides on a completed day. | Reference keeps the primary commercial read visible and uses a large value followed by daily/weekly target blocks. | Keep the sales read visible whenever canonical metrics exist; compose target blocks and milestones as one instrument. |
| Target presentation | Current target appears as one progress row and target metadata. | Reference uses two side-by-side progress blocks with percentage and amount context. | Add a two-column target treatment with real daily/weekly values where the API provides them; otherwise show an honest configured-target state. |
| Daily progress | ProgressTrack/ProgressRow exists. | Current bar is generic, thin, and visually disconnected from target context. | Use blue operational progress with a quiet track, percentage, and amount/target labels. |
| Weekly progress | Not presented as a peer of daily progress on Home. | Reference makes daily and weekly pacing immediately comparable. | Derive the weekly target from existing performance data when available; hide only the unavailable half rather than inventing values. |
| Milestones | Existing milestone rail uses gold dots. | Reference uses compact lime/neutral pills with a clear selected/reached state. | Use a dedicated milestone strip with chartreuse reached/current treatment and quiet future states. |
| Milestone celebration | Existing achievement sheet is present. | Current sheet uses gold and generic copy; reference uses lime badge, dark CTA, and a calm bottom-sheet composition. | Rebuild the sheet anatomy, preserve per-day acknowledgement, and use real achievement data only. |
| Route presentation | Current route uses a bordered surface with a progress bar and circular stop numbers. | Reference is a compact itinerary with thin dividers, time, address, and state; not a mini-card per stop. | Recompose route as a dense list with hairline separators and a single route header. |
| Metrics | Current four-metric strip is compact but visually card-like and uses a fourth money KPI. | Reference uses one clean 3-metric strip beneath sales. | Keep canonical metrics but use one quiet surface, 3-column layout when it fits, and wrap responsibly on narrow screens. |
| Quick actions | Four action tiles are nested inside a card and currently read as a generic dashboard tile grid. | Reference uses restrained icon/action tiles with stronger icon consistency. | Use a calm action rail with one icon family, consistent optical sizing, and no extra decorative box when unnecessary. |
| Bottom navigation | Four tabs exist and are permission-aware. | Current labels/icons differ from the reference and the selected state is a light rounded icon chip. | Use Home / Plan or Outlets / Reports / More according to permissions, with a single outlined icon family and a restrained selected state. |
| Typography | System-compatible stack and several token roles exist. | Screen headings and section labels are too similar; several screens overuse bold uppercase labels. | Strengthen greeting/hero/metric hierarchy, reduce tracking, use uppercase only for metadata, and apply tabular numeral styling where supported. |
| Radii | Tokens exist, but many surfaces resolve to the same `lg` radius. | Reference has deliberate hero/card/inner/button/sheet hierarchy. | Expand radius tokens and assign them by role rather than by component convenience. |
| Spacing | Shared spacing tokens exist. | Screen-local gaps still produce a repeated card rhythm and occasional dense controls. | Establish mobile rhythm: 20–24 inset, 12–16 surface gap, 16–24 internal padding, 44+ touch targets. |
| Shadows | Most normal content is border-led. | The current UI has little depth distinction because neutral surfaces are too similar. | Use tonal zoning first; reserve elevation for sheets and native overlays. |
| Iconography | Ionicons/MaterialCommunityIcons are mixed across older screens; current Home is mostly Ionicons. | Mixed icon families and legacy glyphs reduce product coherence. | Use Ionicons for the rebuilt field surface and keep MaterialCommunityIcons only where existing API names require it; remove emoji/Unicode substitutes. |
| Modal / bottom sheet | EOD and achievement modal behavior exists. | Achievement styling and sheet spacing are not reference-level. | Use a bottom sheet with large top corners, dimmed background, lime badge, dark CTA, dismiss action, and reduced-motion support. |
| Scrolling | ScrollView/FlatList works and tab clearance exists. | Home’s visual grouping is interrupted by many full-width sections; lower content can feel like a long card stack. | Keep one deliberate scroll rhythm, reserve tab space, and make route/action rows compact. |
| Small-screen behavior | Metric labels and action labels now remain legible on the physical device. The shared shell consumes the measured tab-bar inset so content does not sit underneath navigation. | The connected staging identity currently has no published route, so the active hero/itinerary state is not available for this capture. | Verify the active-route state with a clean route fixture during founder UAT; keep the completed-day and no-route states truthful in the meantime. |

## Priority order

1. Home composition and geometry.
2. Shared surfaces, buttons, typography, and tab navigation.
3. Route, retailer, catalog/order, activity, and secondary-screen consistency.
4. Bottom sheet and interaction states.
5. Physical-device screenshots and regression evidence.

## Guardrails

- Use canonical API data; do not insert screenshot values such as Arjun, ₹48,750, or Sharma General Store.
- Keep the existing hosted staging API and package identifier.
- Do not change Admin, Retailer, Founder, Dogkart, SAP B1, or production.
- Do not add new SFA capability in this pass.
- Do not declare screenshot fidelity from compilation alone; validate on a device and in the web renderer at small, typical, and large phone widths.
