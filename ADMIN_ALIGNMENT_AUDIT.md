# Gagan Admin Alignment Audit

Status: **PASS — shared geometry corrected and audited**  
Audit date: 3 September 2026  
Worktree: `codex/admin-operational-instrument-v1`  
Preview: `http://127.0.0.1:5188/`

## Scope

This audit treats the Credit Reviews screenshot as evidence of a possible shared layout defect. It checks the entire currently implemented Admin route set, rather than applying a one-off Credit Reviews offset.

The audit covers:

- all 23 permission-visible navigation routes
- the existing Ledger detail route
- the existing Staff detail route
- the existing Warehouses compatibility route
- shared content-grid geometry
- header and subtitle alignment
- first-surface alignment
- vertical rhythm and border clearance
- table/form/empty-state geometry where present
- selected, hover, loading, and Inspector relationships where present
- responsive geometry at 1440×900, 1280×800, and 1024×768

The browser audit used the real local Admin against the existing local backend and canonical seeded data. No business action was submitted during the audit.

## Shared geometry rule

The Admin has one shared route canvas at the `route-stage` boundary. Every normal direct page root now receives the same:

- full available main-column width
- centered route canvas
- 48px horizontal page inset at large desktop widths
- 34px horizontal inset at the 1024px audit breakpoint
- stable top and bottom page padding
- consistent header-to-surface start position

The existing `page-shell` reference surfaces use the same values. Legacy direct roots using `detail-narrow` now inherit the shared route canvas instead of bypassing it. Nested `detail-narrow` panels remain intentionally narrow when they are part of a larger page composition.

This is implemented in the shared stylesheet rather than through page-specific left-margin patches:

```css
.route-stage > div:not(.empty-state) {
  width: 100%;
  margin: 0 auto;
  padding: 40px 48px 72px;
}

.route-stage > .detail-narrow {
  max-width: 1500px;
}
```

## Root cause found

Two pages used `.detail-narrow` as their direct route root:

- `/credit-reviews`
- `/corrections`

The earlier shared selector excluded `.detail-narrow`. As a result, those pages skipped the standard route padding. Their titles and first surfaces began at the main-column edge (`x=232` at 1440px) while normal pages began at the shared content rail (`x=280`). The screenshot showed this clearly on Credit Reviews.

The fix normalizes the direct route-root geometry. At 1440px, the title and first surface now begin at `x=280` and end at `x=1392`, matching the normal page grid. At 1024px, the same rails are `x=266` and `x=990`.

## Route results

| Route | Alignment issue found | Shared/root cause | Fix applied | Viewports checked | Final result |
|---|---|---|---|---|---|
| `/` — Work | None | `page-shell` reference composition already owns the shared grid | No local change; retained custom flow-map geometry | 1440×900, 1280×800, 1024×768 | PASS |
| `/approvals` — Approvals | None after shared-route review | Normal direct page root | Shared route canvas; neutral selected-row styling verified | 1440×900, 1280×800, 1024×768 | PASS |
| `/collections` — Collections | None | Normal direct page root | Shared route canvas | 1440×900, 1280×800, 1024×768 | PASS |
| `/credit-reviews` — Credit reviews | Title and empty surface started at the sidebar/main edge | Direct `.detail-narrow` root bypassed route padding | Normalized direct `.detail-narrow` root through shared route canvas | 1440×900, 1280×800, 1024×768 | FIXED |
| `/orders` — Orders | None in shared rails; nested workspace intentionally has its own instrument grid | `page-shell` plus custom Orders workspace composition | No local alignment patch; preserved reference workspace geometry | 1440×900, 1280×800, 1024×768 | PASS |
| `/retailers` — Retailers | None | Normal direct page root | Shared route canvas | 1440×900, 1280×800, 1024×768 | PASS |
| `/retailer-approvals` — New retailers | None | Normal direct page root | Shared route canvas | 1440×900, 1280×800, 1024×768 | PASS |
| `/sales-organisation` — Organisation | None | Normal direct page root | Shared route canvas | 1440×900, 1280×800, 1024×768 | PASS |
| `/sales-leader` — Sales leader | None | Normal direct page root | Shared route canvas | 1440×900, 1280×800, 1024×768 | PASS |
| `/catalog` — Catalog | None | Normal direct page root | Shared route canvas | 1440×900, 1280×800, 1024×768 | PASS |
| `/ledger` — Ledger | None | Normal direct page root | Shared route canvas | 1440×900, 1280×800, 1024×768 | PASS |
| `/corrections` — Financial corrections | Title and empty surface started at the sidebar/main edge | Direct `.detail-narrow` root bypassed route padding | Normalized direct `.detail-narrow` root through shared route canvas | 1440×900, 1280×800, 1024×768 | FIXED |
| `/recovery` — Recovery | None | Normal direct page root | Shared route canvas | 1440×900, 1280×800, 1024×768 | PASS |
| `/legal` — Legal | None | Normal direct page root | Shared route canvas | 1440×900, 1280×800, 1024×768 | PASS |
| `/kyc` — KYC | None | Normal direct page root | Shared route canvas | 1440×900, 1280×800, 1024×768 | PASS |
| `/field-team` — Team & leave | None | Normal direct page root | Shared route canvas | 1440×900, 1280×800, 1024×768 | PASS |
| `/field-planning` — Routes & tasks | None | Normal direct page root | Shared route canvas | 1440×900, 1280×800, 1024×768 | PASS |
| `/field-expenses` — Expenses | None | Normal direct page root | Shared route canvas | 1440×900, 1280×800, 1024×768 | PASS |
| `/service-issues` — Issues | None | Normal direct page root | Shared route canvas | 1440×900, 1280×800, 1024×768 | PASS |
| `/locations` — Store locations | None | Normal direct page root | Shared route canvas | 1440×900, 1280×800, 1024×768 | PASS |
| `/visits` — Visits | None | Normal direct page root | Shared route canvas | 1440×900, 1280×800, 1024×768 | PASS |
| `/staff` — Users & roles | None | Normal direct page root | Shared route canvas | 1440×900, 1280×800, 1024×768 | PASS |
| `/sap` — SAP sync | None | Normal direct page root | Shared route canvas | 1440×900, 1280×800, 1024×768 | PASS |
| `/ledger/:retailerId` — Ledger detail | Detail header has an intentional back-link rhythm; content rails align | Normal direct page root | Shared route canvas; detail hierarchy retained | 1440×900; route-load checked | PASS |
| `/staff/:staffId` — Staff detail | Detail header has an intentional back-link rhythm; content rails align | Direct detail root now receives shared route canvas | Shared route canvas; detail hierarchy retained | 1440×900; route-load checked | PASS |
| `/warehouses` — compatibility route | No standalone page exists | Existing route redirects to `/sap` | No visual patch; treated as an intentional compatibility exception | 1440×900; redirect verified | INTENTIONAL EXCEPTION |

## Alignment checks

### Shared X-axis

The following elements now share the same page rails on normal pages:

- breadcrumb / kicker
- page title
- subtitle
- first surface
- table and form surfaces
- empty states
- major section headings

Measured content rails:

| Viewport | Main column | Standard left rail | Standard right rail | Horizontal overflow |
|---|---:|---:|---:|---|
| 1440×900 | x=232 → 1440 | x=280 | x=1392 | None |
| 1280×800 | x=232 → 1280 | x=280 | x=1232 | None |
| 1024×768 | x=232 → 1024 | x=266 | x=990 | None |

Credit Reviews after the fix measured exactly against these rails at all three sizes.

## Home Visual Read correction

The approved three-instrument Visual Read was restored directly below the Home header without removing the existing command strip, business-flow map, constraint/impact view, priority work, or recent movement sections.

The restored composition contains:

- Order Pace: current-day order count and a canonical intraday chart when today’s timestamps exist; otherwise the approved unavailable state
- System State: a qualitative ring instrument with `STABLE`, `DEGRADED`, `ATTENTION`, or `UNAVAILABLE` state derived from the SAP outbox signal and actual failure/pending counts
- Queue Ageing: real open-work counts in `<2h`, `2–6h`, `6–12h`, and `12h+` buckets with blue, violet, gold, and red escalation

No 97.4% health value, comparison percentage, arbitrary bar height, or fabricated order trend was added. The current live local data has no dated order in today’s local calendar day, so Order Pace intentionally shows its unavailable chart state while the primary value remains `0 orders today`.

Visual Read geometry after restoration:

| Viewport | Composition | Panel heights | Result |
|---|---|---:|---|
| 1440×900 | three columns at approximately 42% / 27% / 31% | 292px each | PASS |
| 1280×800 | three columns at approximately 42% / 27% / 31% | 292px each | PASS |
| 1024×768 | Order Pace spans the first row; System State and Queue Ageing share the second row | 292px each | PASS |

Evidence:

- [Home Visual Read — 1440×900](docs/admin-alignment-qa/home-visual-read-1440x900.png)
- [Home Visual Read — 1280×800](docs/admin-alignment-qa/home-visual-read-1280x800.png)
- [Home Visual Read — 1024×768](docs/admin-alignment-qa/home-visual-read-1024x768.png)

### Vertical rhythm

The audit checked the following relationships across the route set:

- utility bar to page header
- kicker to title
- title to subtitle
- subtitle to first surface
- surface-to-surface spacing
- section heading to content
- card title to body
- table header to rows
- form label to input
- Inspector section spacing where present
- empty-state border clearance

Normal pages now begin from the same route-stage top rhythm. Custom compositions such as Home, Orders, and detail pages retain intentional internal rhythms documented by their page structure rather than receiving arbitrary global offsets.

### Responsive behavior

At all three required sizes the audit found:

- no horizontal document overflow
- no clipped main content
- no clipped Inspector in the tested Orders workspace
- no title text touching a surface border
- no cards touching the viewport edge
- no collapsed page inset
- no table header/document-width mismatch
- sidebar and main column remain visually balanced

## Screenshot evidence

Representative evidence was captured at 1440×900, 1280×800, and 1024×768:

- [Credit Reviews — 1440×900](docs/admin-alignment-qa/credit-reviews-1440x900.png)
- [Orders — 1440×900](docs/admin-alignment-qa/orders-1440x900.png)
- [Retailers — 1440×900](docs/admin-alignment-qa/retailers-1440x900.png)
- [Ledger — 1440×900](docs/admin-alignment-qa/ledger-1440x900.png)
- [Field — 1440×900](docs/admin-alignment-qa/field-1440x900.png)
- [SAP Sync — 1440×900](docs/admin-alignment-qa/sap-sync-1440x900.png)
- [Users & Roles — 1440×900](docs/admin-alignment-qa/users-roles-1440x900.png)

Equivalent 1280×800 and 1024×768 captures are in the same directory for all seven representative routes.

The full route sweep evidence remains in:

- [Admin operational route QA](docs/admin-operational-instrument-qa/routes/)

## Final counts

- Pages/routes audited: **26 route entries**
- Permission-visible navigation routes: **23**
- Detail routes audited: **2**
- Compatibility routes audited: **1**
- Pages with alignment issues found: **2**
- Pages fixed through shared geometry: **2**
- Intentional exceptions: **1**
- Remaining misalignment defects: **None found in the audited route set**

## Boundaries

This was an alignment and consistency pass, not a functional redesign. The audit did not change:

- order logic
- inventory logic
- financial calculations
- credit rules
- SAP connector behavior
- permissions
- retailer behavior
- salesperson behavior
- backend contracts
- mobile apps
- Founder App

The Operational Instrument visual system remains locked. This pass makes the existing Admin pages obey its shared geometry; it does not introduce a new visual direction or propagate speculative functionality.
