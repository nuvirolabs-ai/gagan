# Gagan Admin visual system

## Status

This is the visual contract for the first Admin redesign gate. It is applied to
the Work/Home and Orders reference surfaces first. The rest of the Admin must
not be propagated into this system until the reference surfaces are accepted.

## Design thesis

Gagan Admin is a quiet operational instrument: calm, premium, desktop-first,
precise, high-trust, and fast. Information comes first, whitespace gives it
structure, actions follow, and decoration is last.

The interface should feel like one Business Operating System, not a collection
of dashboard cards.

## Canvas and surfaces

- Canvas: warm ivory / light stone (`#f4f1ea` family).
- Primary surface: near-white (`#fffdf9`), reserved for a real work object,
  table, inspector, or focused brief.
- Quiet surface: warm stone (`#eeebe3`) for grouped metadata and secondary
  context.
- Separator: soft warm gray (`#ded9cf`). Prefer rules and whitespace to
  floating containers.
- Normal content has no shadow. Elevation is reserved for popovers, dialogs,
  command surfaces, and truly floating context.

## Typography

Use the existing system-first stack:

```text
-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif
```

| Role | Direction |
| --- | --- |
| Page title | 28–32px, 650–700, tight tracking |
| Primary metric | 26–32px, 650–700 |
| Section heading | 15–17px, 650 |
| Table/body | 14–15px, 450–550 |
| Secondary | 12–13px, 450–550 |
| Metadata | 11–12px, 600, restrained tracking |
| Eyebrow | 10–11px, 700, uppercase, generous tracking |

Typography must create hierarchy. Do not make every label bold or turn page
headings into marketing copy.

## Spacing

Use a disciplined 4px base scale: 4, 8, 12, 16, 20, 24, 32, 40.

- Page inset: 32px on wide desktop, 24px on smaller laptops.
- Header-to-content: 24–32px.
- Section-to-section: 28–40px.
- Row inner padding: 12–16px depending on density.
- Label-to-value: 4–8px.

Calm does not mean empty. Keep operational lists dense enough to scan while
giving major sections a visible pause.

## Radius

- Inputs and buttons: 8–10px.
- Grouped surfaces: 10–12px.
- Larger intentional surfaces: 12–14px.
- Pills only for statuses, compact filters, and semantic values.

Avoid applying a large radius to every rectangle.

## Color and semantic states

| Meaning | Treatment |
| --- | --- |
| Primary text | Graphite / near-black |
| Secondary text | Muted graphite |
| Primary action | Deep forest green, used sparingly |
| Positive / completed | Restrained green with explicit text |
| Performance | Warm gold, used as a signal rather than a fill |
| Pending / needs review | Amber |
| Blocked / critical | Red |
| Informational | Blue only where it communicates a real informational state |
| Neutral | Warm gray |

Every status uses text plus tone. Color is never the only carrier of meaning.
The brand accent should occupy a small minority of the interface.

Canonical state vocabulary:

- Draft
- Active / In progress
- Pending
- Completed
- Needs action
- Blocked

## Navigation

Navigation remains permission-aware and uses the existing routes. The shell
should establish a stable operating-system frame:

```text
NAVIGATION  |  WORK CANVAS  |  CONTEXT / INSPECTOR
```

The sidebar is a quiet anchor, not a second dashboard. Group labels are
subtle, active state is clear but not loud, and sign-out remains available at
the bottom.

## Content patterns

Use the pattern that matches the work:

- Metric strip: a small set of comparable numbers.
- Attention brief: deterministic statement of what needs action and one next
  action.
- Structured list: short queue with count, label, tone, and destination.
- Work queue: scannable rows with stable columns and clear selection.
- Ledger: event/time/actor sequence.
- Split pane: queue in the center, selected context at right.
- Status band: one exception or state that needs immediate attention.
- Chart section: restrained visualization with a conclusion, never decoration.

Cards are reserved for objects that genuinely behave as one object.

## Home / Work

Home opens with an attention brief, not vanity metrics. All numbers must be
derived from the existing work-queue API calls. The page order is:

1. page identity and current operating context;
2. `Needs action` brief with one obvious route into work;
3. active queues as structured rows;
4. a restrained queue pulse derived from those same counts;
5. clear / healthy queues.

No revenue, inventory, or trend value may be invented when the current Home
contract does not provide it.

## Tables

- Header: 11–12px uppercase metadata, sticky where useful.
- Rows: 12–14px vertical rhythm, stable height, subtle separator.
- Names and descriptions: left aligned.
- Amounts and counts: right aligned.
- Status: compact semantic chip with text.
- Selection: quiet tinted surface plus a visible leading/edge cue.
- Hover: a slight warm surface shift, not a shadow.
- Actions: show the one primary action; keep secondary actions compact.
- Empty state: say whether the queue is clear, awaiting setup, or failed.

## Inspector and order workspace

The reusable Inspector anatomy is:

1. object identity;
2. state;
3. primary facts;
4. attention / exception;
5. primary action;
6. related lines or objects;
7. recent activity and technical context where useful.

For Orders, the selected order must read in this order: order ID, retailer,
value, commercial state, next action, items, route/fulfilment, SAP state.
Technical SAP metadata stays available but never dominates ordinary work.

## Loading, empty, error, and focus states

- Loading: preserve geometry with stable row/section placeholders; do not flash
  zeros into metric positions.
- Empty: explain the operational meaning, e.g. “Nothing is waiting. The queue
  is clear.”
- Error: human operational copy; never raw stack traces, undefined values, or
  connector strings.
- Focus: preserve visible keyboard focus indicators with adequate contrast.
- Disabled: preserve the control’s place and communicate why when the context
  makes it useful.

## Chart rules

Charts answer an operational question. Use quiet bars, lines, or lifecycle
sequences with direct labels and limited colors. Avoid gauges, decorative pies,
multicolor mosaics, and unannotated trends.

The first Home pulse is intentionally a queue pulse derived from already-loaded
live queue counts. It does not introduce a new endpoint or a new business
metric.

## Future command surface

The system should remain compatible with a future `⌘K` command/search surface
for orders, retailers, products, and employees. This pass documents the
architecture only; it does not build a command palette.

## Binding status: Operational Instrument

Effective 2026-09-03, **OPERATIONAL INSTRUMENT is the binding Gagan Admin
visual system**. Future Admin surfaces must use its spatial, typographic,
data-visualization, interaction, and component grammar. New visual directions
require explicit founder approval.

The approved reference is the local visual source at
`http://127.0.0.1:5184/`, captured in
`docs/admin-operational-instrument-reference/`. Its static scenario is a
visual reference only; canonical values in the functional Admin continue to
come from the existing Admin API.

The propagated system has two layers:

1. A shared shell layer: warm mineral canvas, white work surfaces, precise
   navigation, top bar, system-first typography, tabular numbers, semantic
   states, restrained borders, stable loading geometry, human empty/error
   states, and visible focus treatment.
2. A reference-surface layer: command strips, lifecycle flow maps, impact
   views, age distributions, operational tables, health matrices, journeys,
   timelines, and action docks on Work/Home and Orders.

This contract does not authorize new business logic, new data truth, changes to
permissions, or propagation into the Retailer, Salesperson, Founder, backend,
or SAP integration surfaces without a separate approved scope.
