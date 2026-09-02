# Gagan Admin visual audit

## Scope

This audit covers the existing Admin frontend in `admin/` and the first visual
redesign gate only:

1. Work / Home (`/`)
2. Orders queue and selected-order Inspector (`/orders`)
3. The selected-order operational workspace rendered by the Orders surface

Retailer, Salesperson, Founder, backend, SAP, and the remaining Admin modules
are outside this pass.

## Current implementation

| Area | Current implementation | Audit finding |
| --- | --- | --- |
| Frontend | React 19 + TypeScript + Vite | Small, direct component structure; visual language is mostly centralized in `index.css`. |
| Routing | `react-router-dom` `BrowserRouter`, route guards in `App.tsx` | Permission-aware and clear. Navigation labels are grouped by operational domain. |
| Page shell | Fixed dark sidebar, flexible main canvas, `max-width: 1280px` | Reliable desktop foundation, but the sidebar and content do not yet read as one intentional operating system. |
| Navigation | Permission-filtered groups: Home, Work, Sales, Finance, Field, System | Good information architecture; active state is too much of a filled rectangle and group rhythm is inconsistent. |
| Typography | System-first stack; page title 26px; many bold labels | Good native rendering direction, but hierarchy is compressed and several labels compete with primary information. |
| Colors | Warm ivory canvas, white surfaces, deep green sidebar/actions, gold/amber/blue/red state tones | Direction is appropriate, but green is used as both brand, action, selected state, and success state. |
| Spacing | Mostly one-off margins plus a small set of utility classes | Pages feel serviceable but not deliberately paced; sections need clearer vertical rhythm. |
| Radius | 6–12px controls and surfaces, 20px tabs, 999px pills | Ordinary content is over-contained. Pills are used for navigation as well as statuses. |
| Shadows | Very limited | This is a strength to preserve. Separation should come from spacing, surface, and rules. |
| Cards | `.card`, `.metric`, `.metric-strip`, `.table-wrap`, `.inspector` | Several card-like objects default to the same white bordered treatment, creating a generic dashboard feel. |
| Tables | Sticky uppercase header, compact rows, hover and selected row | Good baseline. Headers, row density, amount alignment, and action placement need a stronger system. |
| Forms | Labels above native inputs/selects, compact controls | Practical and accessible; do not enlarge or rebuild in this pass. |
| Buttons | Dark green primary, white bordered secondary, transparent ghost, red danger | Hierarchy exists but is not consistently expressed inside workspaces. |
| Status badges | `.pill` with page/status-specific color selectors | Semantics are understandable, but the vocabulary should be documented and normalized. |
| Charts | No chart on current Work/Home; activity charts exist in other surfaces | Home needs one restrained operational visualization derived from existing queue data, not a decorative BI mosaic. |
| Empty states | Generic `.empty-state` with some healthy-state copy | Copy direction is strong; loading geometry is currently not stable and empty states need explicit healthy/configuration/error distinctions. |
| Loading states | Text-only loading messages | Functional but causes content geometry to appear late. Reference surfaces need stable skeleton-like rows. |
| Dialogs/sheets | Centered modal with backdrop; operational modals for assignment and POD | Keep the pattern. Use the visual system for elevation and action hierarchy later; no modal redesign required for this gate. |
| Responsive behavior | Workspace collapses below 1100px; sidebar narrows below 760px | Admin is correctly desktop-first. The 1280px check needs to protect table/Inspector usability and avoid horizontal clipping. |
| Data behavior | Home loads existing work queues in one `Promise.all`; Orders loads one selected status queue and selects the first row | Keep API calls and business contracts unchanged. Presentation can derive summaries from already-loaded data. |

## Reference-surface findings

### Work / Home

- The page communicates a list of counts, but not a clear operating brief.
- The user has to scan every row to learn what matters first.
- There is no compact pulse showing the shape of today’s work.
- The healthy `Clear` state is useful and should remain, but should be visually
  subordinate to active work.
- The existing queue labels and counts are canonical live API results and must
  remain the only source of truth.

### Orders queue + Inspector

- The six status tabs are useful filters, but currently look like generic pills.
- The queue has no visible summary of the selected state’s volume or value.
- The selected row is subtle and the Inspector begins with technical metadata
  rather than identity, state, and next action.
- The existing action functions are correct and must not be changed; only their
  visual hierarchy and placement should change.
- Items are shown as a plain list; the operational relationship between order,
  retailer, commercial state, fulfilment state, and SAP state is not clear at a
  glance.

### Order workspace / detail

- The current Inspector is the detail surface, but reads as a narrow key/value
  card rather than an operational workspace.
- `NEXT_ACTION` already provides a valuable deterministic next-step contract.
- SAP state is useful context but is visually equal to the primary commercial
  facts; it should remain available without dominating the workspace.
- Delivery route and line items are present but need clear grouping and scan
  order.

## Redesign constraints

- No backend or canonical business-logic changes.
- No additional API calls.
- No fabricated values or operational insights.
- No changes to Retailer, Salesperson, Founder, or non-reference Admin page
  components.
- Preserve permission-aware navigation, focus indicators, labels, and existing
  action handlers.
- Stop after the three reference surfaces and browser QA at 1440×900,
  1280×800, and one smaller laptop viewport.

## First-pass success criteria

An employee should be able to answer, without scanning a generic card grid:

1. What needs attention now?
2. Which queue should I open next?
3. Which order is selected and what is its state?
4. What is the next safe action?
5. Where are the underlying commercial, fulfilment, delivery, and SAP facts?
