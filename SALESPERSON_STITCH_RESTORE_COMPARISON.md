# Salesperson Stitch Restore Comparison

## Result

The approved Stitch presentation layer has been restored on top of the latest
fetched staging branch. This is a presentation restore, not a new SFA feature
pass.

- Current staging base: `e47e38e99cf08c0d71542ea230815c33dca17a26`
- Approved Stitch reference: `c5e85b1`
- Approved implementation source: `062ed67`
- Physical device: Moto E13, `ZD2229Q3KB`, 720 × 1600
- Data source: live staging session data; no screenshot values or fabricated
  route data were added.

## Before / after

### Home

Before, the accidental dirty worktree rendered a dashboard-like “Visual Read”
with analytical rings/bars and a different blue/orange token system. That
composition displaced the approved field workflow and made the next action
harder to find.

After, Home follows the approved field-companion order:

1. compact Gagan / Field Companion header
2. active-day or completed-day status
3. next-stop hero when staging publishes a route
4. sales and target instrument
5. milestone rail
6. field metrics
7. route / no-route state
8. quick actions
9. attention and field-day context

Evidence:

- [Home launch](docs/stitch-restore/evidence/home-launch.png)
- [Home lower scroll](docs/stitch-restore/evidence/home-lower.png)

The current staging identity has a completed day and no published route, so the
physical evidence truthfully shows the compact completed-day state and calm
no-route state. The route-enabled hero must be reviewed with a staging identity
that has a published route; no route was fabricated to make the screenshot look
full.

### Outlets

Before, the screen used the older generic customer rows and did not expose the
route summary as a first-class field-work context.

After, the screen uses the approved Stitch outlet hierarchy: title/count,
commercial summary, search, compact filters, route summary when available, and
large but calm outlet rows with consistent blue interaction treatment.

Evidence:

- [Outlets](docs/stitch-restore/evidence/outlets.png)

### Reports / activity

Before, activity and performance were separate conventional surfaces.

After, the screen uses the Stitch activity cockpit: timeline rail, compact
Timeline / Performance control, read-only performance presentation helpers, and
the blue primary operating instrument when performance is selected.

Evidence:

- [Reports timeline](docs/stitch-restore/evidence/reports.png)

### More

Before, secondary modules were presented as a conventional list of blocks.

After, More is a grouped field-companion workspace with duty status, identity,
work group, growth group, and account context, using the same surface and
navigation grammar as Home.

Evidence:

- [More](docs/stitch-restore/evidence/more.png)

### Retailer detail and order taking

The approved visual system is carried through the existing retailer detail and
order workflow without changing its contracts:

- [Retailer detail](docs/stitch-restore/evidence/retailer-detail.png)
- [Order taking](docs/stitch-restore/evidence/order-taking.png)

### New Retailer

The four-step New Retailer flow remains on the latest staging base, including
the secure-photo/storage boundary and validation behavior. The physical first
step was opened after restore:

- [New Retailer step 1](docs/stitch-restore/evidence/new-retailer.png)

## Geometry and interaction checks

- Normal-flow bottom tabs remain owned by React Navigation.
- Screen content keeps only the shared final content gap; no screen-level
  `TAB_BAR_SPACE` reservation was reintroduced.
- The Home lower screenshot shows content ending directly above the visible tab
  bar rather than an additional reserved band.
- Bottom navigation labels and active states are consistent across Home, Outlets,
  Reports, and More.
- Real staging values are used for sales, targets, retailer balances, and
  activity.

## Functional preservation

Preserved from latest staging:

- authentication/session restoration
- recoverable OTP challenge renewal and resend behavior
- attendance and day start/end
- route and visit flows
- retailer detail, catalog, pricing, credit, and inventory
- order placement and activity timeline
- performance read model
- New Retailer validation and secure-photo boundary
- offline/outbox handling
- SAP/mock connector contracts

No backend, Admin, Founder, Retailer App, production, or `main` files were
changed by this restore.
