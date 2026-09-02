# Gagan Salesperson — Premium Design System

Field Companion visual language for the existing salesperson app.
Presentation only. Functionality, APIs, and permissions do not change.

## 1. Design philosophy

The app is a personal daily sales companion, not a mobile admin console.

Every screen answers one of:

- What should I do next?
- How am I doing?
- Who needs my attention?
- What just happened?

Those answers must be obvious within one or two seconds.

The product should feel personal, warm, premium, focused, motivating, fast, and calm. It should not feel like ERP, generic SaaS, a game, or a dashboard dump.

**North star:** FIELD COMPANION.

Hierarchy comes from typography, spacing, and one or two strong surfaces — not from stacking identical white cards.

## 2. Semantic colour palette

Tokens live in `src/theme.ts`. Gold is never body text on white.

| Token | Role | Hex |
|---|---|---|
| `canvas` / `bg` | Screen background | `#F7F4EC` |
| `surface` | Operational cards | `#FFFFFF` |
| `surfaceSecondary` / `surfaceAlt` | Grouped sections | `#F1EEE4` |
| `textPrimary` / `ink` | Primary text | `#16241B` |
| `textSecondary` / `inkMuted` | Supporting text | `#7A8780` |
| `textTertiary` / `inkFaint` | Meta, placeholders | `#A8B2AB` |
| `separator` / `border` | Hairlines | `#E7E1D4` |
| `primaryDeep` / `greenDeep` | Primary actions, active nav | `#123122` |
| `primary` / `green` | Brand / field green | `#1F5132` |
| `primarySoft` / `greenSoft` | Soft green fill | `#E7F0E9` |
| `goldStrong` / `accentStrong` | Gold text (contrast-safe) | `#8A6A12` |
| `gold` / `accentPrimary` | Progress, recognition fill | `#C9992B` |
| `goldSoft` / `accentSoft` | Achievement wash | `#F5E7C9` |
| `success` | Distinct success | `#1F5132` |
| `warning` | Amber caution | `#9A6510` |
| `danger` / `error` | Overdue, blocked, error | `#C4462F` |
| `info` | Neutral information | `#2F5B8F` |

Gold is for progress, achievement, selected packs, highlighted numbers, and recognition. Primary actions stay deep green. Red means overdue, error, blocked, or danger only.

## 3. Typography

Platform-native system type. Semantic roles in `type`:

| Role | Size | Weight | Use |
|---|---|---|---|
| `display` | 28 | semibold | Rare greetings |
| `screenTitle` | 22 | semibold | Screen titles |
| `sectionTitle` | 13 | semibold | Section labels |
| `cardTitle` | 17 | semibold | Store / action titles |
| `body` | 15 | regular | Supporting copy |
| `bodyStrong` | 15 | semibold | Emphasised body |
| `metricXL` | 32 | semibold | Hero rupee figures |
| `metricLarge` | 22 | semibold | Card-level numbers |
| `metricMedium` | 17 | semibold | Strip numbers |
| `caption` | 13 | regular | Secondary lines |
| `label` | 12 | medium | Field / metric labels |
| `micro` | 11 | medium | Chips, timestamps |

Numbers dominate their cards. Descriptions never compete with the next action. Bold is reserved; screens are not set entirely in bold.

## 4. Spacing

Eight-point rhythm: 4, 8, 12, 16, 20, 24, 32, 40.

| Token | Value | Use |
|---|---|---|
| `spacing.xs` | 4 | Tight icon gaps |
| `spacing.sm` | 8 | Inline gaps |
| `spacing.md` | 12 | Compact stacks |
| `spacing.lg` | 16 | Card internals (min) |
| `spacing.xl` | 20 | Screen horizontal padding |
| `spacing.section` | 24 | Section gaps |
| `spacing.block` | 32 | Major blocks |
| `spacing.hero` | 40 | Rare breathing room |

Screen padding is generally 20. Card padding is 16–20. Avoid one-off values.

## 5. Radii

| Token | Value | Use |
|---|---|---|
| `radius.sm` | 8 | Chips, small controls |
| `radius.md` | 12 | Buttons, inputs |
| `radius.lg` | 16 | Operational cards |
| `radius.xl` | 20 | Focus cards |
| `radius.hero` | 24 | Day-state / hero |
| `radius.pill` | 999 | Avatars, filter chips |

Not every object is a pill.

## 6. Borders

Default operational separation is a 1px `separator` hairline. No decorative double borders. Danger / gold / green borders appear only on attention, recognition, or selected-pack states.

## 7. Surfaces

Four levels. Never put every section on Level 3. Maximum one or two strong surfaces on screen at once.

| Level | Name | Treatment |
|---|---|---|
| 0 | Canvas | Warm ivory. Whitespace + type. No card. |
| 1 | Grouped section | `surfaceSecondary` wash or labelled list. |
| 2 | Operational card | Warm white, thin border, no shadow. |
| 3 | Focus card | Tinted or stronger: next action, day state, urgent attention. |

## 8. Shadows

Most cards: border + surface only.

Shadow is reserved for floating CTAs, elevated sheets, and the cart bar. No large SaaS blur.

## 9. Buttons

| Kind | Look | Examples |
|---|---|---|
| Primary | Deep green fill, high-contrast label, 48pt min height | Start My Day, Open Store, Place Order |
| Secondary | Soft surface, hairline border | Navigate, View ledger |
| Tertiary | Text only, primary colour | See all, Open route |
| Danger | Restrained red, destructive only | End Day, Sign out |

## 10. Pills / chips

| Family | Tone |
|---|---|
| Status | Present, Verified, On duty — green or neutral |
| Warning | Overdue, Needs review — amber / red |
| Context | Gold, Route today, Reorder — gold or soft green |
| Filter | All, Overdue, Nearby — outlined; selected uses primaryDeep |

Chips are not all green.

## 11. Metric presentation

Numbers dominate. Labels sit above or below in `label` / `caption`. A momentum strip is one grouped surface, not four bulky cards. Large rupee values wrap or stack; they never shrink into unreadability.

## 12. Progress presentation

Gold fill on a warm track for targets. Green fill for route completion. Copy stays motivating at low percentages: remaining, not punitive. Optional projection only when existing data supports it.

## 13. Navigation

Tabs stay Today / Retailers / Activity / More.

Active tab: `primaryDeep` icon and label, optional soft tinted capsule. Compact bar, safe-area aware. Not a giant floating dock.

## 14. List rows

Leading glyph or initials, title, one supporting line, optional trailing value or chevron. Dividers, not stacked cards. Minimum 44pt hit target.

## 15. Card families

| Family | Use | Treatment |
|---|---|---|
| Action card | Next store, start day | Level 3, one primary action |
| Metric card / strip | Orders, visits, collections | Compact, numbers first |
| Attention card / row | Overdue, reorder, problem | Subtle amber/red |
| Customer row | Retailer list | Compact, information-rich |
| Timeline event | Activity feed | Spine + icon, not a card |
| Profile card | More screen once | Identity only |

## 16. Empty states

Calm and useful. Always a title. Optional body and one action.

Examples:

- No tasks — You're clear for now.
- No collections due — Nothing to chase today.
- No route — No route has been published for today.

## 17. Loading states

Preserve structure. Prefer section skeletons over a full-screen spinner once the chrome is known.

## 18. Error states

Human copy. Never raw backend codes.

"Couldn't load today's route." + Try again.

## 19. Success states

Brief confirmation, optional success haptic. No confetti. No "You're crushing it."

## 20. Motion

160 / 220 / 320ms. Progress bars ease. Tab transitions stay native. Respect `reduce-motion`.

## 21. Haptics

| Weight | When |
|---|---|
| Light | Selection (filters) |
| Medium | Check-in, start day |
| Success | Order placed, task done, day completed |
| Warning | Location / validation problem |

Not every tap.

## 22. Iconography

One family: Ionicons outlined. Simple, native, professional.

| Domain | Icon |
|---|---|
| Order | `cart-outline` |
| Visit | `location-outline` |
| Collection | `wallet-outline` |
| Expense | `receipt-outline` |
| Task | `checkmark-circle-outline` |
| Route | `navigate-outline` |
| Achievement | `ribbon-outline` |
| Issue | `alert-circle-outline` |
| Store | `storefront-outline` |

Do not mix families.

## 23. Accessibility

Minimum 44pt targets. Contrast pairs are tested. Status is never colour alone — icon + label. Dynamic type should wrap, not clip. Reduced motion is honoured.

## Copy tone

Confident, calm, helpful. Short.

Prefer:

- Location is only recorded while you're on duty.
- ₹3,90,520 remaining
- 2% of monthly target

Avoid fake enthusiasm and administrative lecture.
