# Gagan Salesperson V2.1 color system

## Scope

V2.1 moves the salesperson field companion to a restrained Apple-like system. It is a presentation change only; frozen SFA calculations, APIs, and workflow states remain authoritative.

## Tokens

| Role | Token | Use |
| --- | --- | --- |
| Canvas | `colors.bg` / `colors.canvas` | Very light cool neutral background |
| Primary surface | `colors.surface` | White content surfaces |
| Secondary surface | `colors.surfaceAlt` / `colors.surfaceSecondary` | Integrated tonal zones, tracks, read-only fields |
| Structural primary | `colors.primary` / `colors.navy` / `colors.primaryDeep` | Primary actions, navigation, milestones, progress |
| Primary text | `colors.ink` | High-contrast content |
| Secondary text | `colors.inkMuted` | Context and metadata |
| Separator | `colors.border` / `colors.separator` | Quiet dividers |
| Alert | `colors.danger` / `colors.error` | Validation, critical state, destructive action |

The old blue, green, gold, and lime names remain as compatibility aliases so existing screens compile, but their values resolve to the neutral/dark system. They are not independent visual families. Lime is no longer used as a neon achievement colour.

## Rules

- Use the structural dark for primary actions, selected controls, progress, and milestone emphasis.
- Use neutral tonal shifts for normal state, success, information, and inactive controls.
- Use the muted brick-red alert only when the user needs to notice risk, failure, or a destructive action.
- Do not introduce page-level hex values for routine UI.
- Never use Aadhaar or other sensitive data as a visual label, analytics value, log value, or ordinary local-storage value.
- All amounts use tabular numerals and one-line constraints where compact presentation is required.

## Accessibility

Primary text, structural actions, and alert text meet the existing contrast tests. Semantic status never relies on colour alone: it is paired with a state label or explanatory copy.
