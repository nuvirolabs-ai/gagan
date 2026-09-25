# Operational Instrument reference lock

## Binding decision

**OPERATIONAL INSTRUMENT is the binding Gagan Admin visual system.** Future
Admin surfaces must use its spatial, typographic, data-visualization,
interaction, and component grammar. New visual directions require explicit
founder approval.

This is a visual-system lock, not a business-logic or API lock. Existing
canonical data, auth, permissions, mutations, and route contracts remain the
source of truth.

## Reference source

| Property | Locked value |
| --- | --- |
| Source project | `/Users/tanutejas/Documents/Gagan-admin-design-lab` |
| Source branch | `codex/admin-design-lab` |
| Source URL | `http://127.0.0.1:5184/` |
| Reference surfaces | Work/Home, Orders, selected Order workspace |
| Reference scenario | Static visual scenario only; not a data source |
| Capture directory | `docs/admin-operational-instrument-reference/` |
| Local tag | `admin-operational-instrument-v1-reference` |

## Source files inspected

```text
/Users/tanutejas/Documents/Gagan-admin-design-lab/src/App.tsx
/Users/tanutejas/Documents/Gagan-admin-design-lab/src/styles.css
/Users/tanutejas/Documents/Gagan-admin-design-lab/package.json
```

The reference uses Direction A, named “Operational instrument / Precision
console”. Direction B and Direction C remain exploration controls inside the
design lab and are not part of this lock.

## Reference tokens and rules

| System | Locked reference rule |
| --- | --- |
| Font | `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", sans-serif` |
| Base text | `#1d1d1f`; muted `#6e6e73`; subtle `#8e8e93` |
| Canvas/surfaces | canvas `#f5f5f7`; paper `#ffffff`; soft `#fbfbfd`; warm/cool tint `#f2f2f7` |
| Separator | `rgba(60, 60, 67, .17)`; stronger rule `rgba(60, 60, 67, .28)` |
| Primary accent | blue `#0a84ff` with `#e8f2ff` soft state |
| Semantic accents | green `#248a3d`; gold `#ff9f0a`; red `#ff453a`; blue-violet information `#5e5ce6` |
| Spacing | 4px base rhythm; common 7–10px gaps, 13–26px panel padding, 38–48px page insets |
| Radius | 9–10px controls, 12–16px panels, 18–20px major instruments, full pill only for tags/status |
| Elevation | `0 1px 2px rgba(28,39,34,.05), 0 10px 28px rgba(28,39,34,.055)` for normal instrument surfaces; stronger hover/elevated treatment only for interactive/floating surfaces |
| Motion | 180ms transitions for navigation, selection, hover, and action affordances; reduced-motion override |

The reference's flow cards encode the source-to-delivered progression with
decreasing visual weight, the gold card marks the bottleneck, bars encode
retention relative to source, and the workspace uses a blue context surface
for the next safe action. These encodings are reused only where functional
data supports them.

## Locked grammar

- System-first typography with stronger page titles, tabular numeric display,
  restrained mono metadata, and limited weights.
- Warm mineral/ivory canvas with white primary surfaces and cool tinted context
  surfaces.
- Deep graphite navigation, not a dark-sidebar template.
- Apple-like blue used for informational/selection/action affordance; green
  reserved for healthy/completed states; gold for bottlenecks/performance;
  amber/red for warning/critical conditions.
- No normal-content shadows as a default separation mechanism. Elevated
  surfaces are reserved for the action dock, popovers, menus, dialogs, and
  other genuinely floating context.
- Content patterns are chosen by work type: command strip, flow map, metric
  with sparkline, impact bar, age distribution, work queue, status matrix,
  table, Inspector, timeline, action dock, or clear/healthy state.
- Every meaningful status has text and a semantic tone. Color is not the only
  carrier of meaning.
- Every operational workspace exposes one obvious next safe action.
- Every visualization is a read-only expression of canonical data already
  exposed by the Admin API, with an explicit unavailable state when the field
  does not exist.
- Loading states preserve the geometry of the final work surface. Empty states
  explain whether the queue is clear, neutral, or awaiting configuration.

## Reference captures

The reference source was captured at the requested CSS viewports. The browser
provider may return a physically narrower image while reporting the requested
CSS viewport; the QA record preserves the viewport measurement separately.

```text
docs/admin-operational-instrument-reference/reference-home-1440x900.png
docs/admin-operational-instrument-reference/reference-home-1280x800.png
docs/admin-operational-instrument-reference/reference-home-1024x768.png
docs/admin-operational-instrument-reference/reference-orders-1440x900.png
docs/admin-operational-instrument-reference/reference-orders-1280x800.png
docs/admin-operational-instrument-reference/reference-orders-1024x768.png
docs/admin-operational-instrument-reference/reference-workspace-1440x900.png
docs/admin-operational-instrument-reference/reference-workspace-1280x800.png
docs/admin-operational-instrument-reference/reference-workspace-1024x768.png
```

## What is not locked

The reference prototype's sample counts, names, dates, prices, and static
labels are not copied into the functional Admin. The functional Admin uses
the local/staging canonical read model. No production deployment, SAP B1
connection, mobile redesign, or backend business-logic change is implied by
this lock.
