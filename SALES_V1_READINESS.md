# Gagan Sales V1 — readiness

Assessed at commit `db7edb3` plus this cycle's rollout-safety work.
Evidence is automated tests, code inspection, and browser-driven UAT against a
live API and a live Postgres. **No mobile build has been run on a physical
device**, and that limitation propagates into several scores below.

Suites at the time of writing: backend **750**, retailer **31**, salesperson
**77**, admin **50** — all green.

---

## Scores

| Area | Verdict |
|---|---|
| Salesperson App | READY WITH LIMITATION |
| Manager Experience | READY |
| Retailer App integration | READY WITH LIMITATION |
| Admin | READY |
| Authorization | READY |
| Hierarchy | READY |
| Geo / Visits | READY WITH LIMITATION |
| Offline | READY WITH LIMITATION |
| Orders | READY |
| Collections | READY |
| Opportunities | READY |
| New retailer acquisition | READY |
| Performance | READY |
| Physical-device readiness | **NOT READY** |

---

### Salesperson App — READY WITH LIMITATION

77 automated tests covering the offline outbox, session resilience, device
location, field tracking, translations and design tokens. Every screen in the
day exists and is wired to canonical data.

**Limitation:** never executed on a handset. Everything below in Geo, Offline
and Physical-device readiness applies here.

### Manager Experience — READY

Verified in a browser against a live API using a **genuine `field_manager`
login, not platform-admin authorisation**, across a four-level tree:

- An area manager sees exactly their two reports on Sales leader.
- A regional manager one level above sees, and can decide, the area manager's
  own expense claim — proving scope reaches past direct reports.
- Moving a salesperson to a different manager removes them from the old
  manager's dashboard and adds them to the new one, with no store touched.

### Retailer App integration — READY WITH LIMITATION

31 tests. Order placement, ledger, pay-due and the product/pack grouping all
run against the same canonical models the salesperson app writes to; there is no
second order or balance. **Limitation:** same device gap as above.

### Admin — READY

50 tests. Sales organisation, sales leader, field team, expenses, issues, routes
and retailer approvals all exercised in a browser. Error codes are explained in
words rather than printed raw (fixed this cycle).

### Authorization — READY

Permission and reporting scope compose; neither substitutes for the other.
Verified over HTTP that:

- a manager cannot read or decide outside their tree (403, not an empty list);
- a salesperson gets 401 on every admin surface and 200 on their own;
- `org.view_all` grants org-wide reads to a holder with no reports at all;
- self-approval is refused even for an org-wide holder.

### Hierarchy — READY

One nullable self-relation on the existing employee model. Cycles, self-
management, inactive managers and over-deep chains are all rejected at write
time and detected by the readiness check. Reassignments are append-only audit
events and history is never overwritten — confirmed in the UI across two moves.

`npm run check:sales-org-readiness` exits non-zero on structural invalidity
only; verified by injecting a real cycle and removing it again.

### Geo / Visits — READY WITH LIMITATION

Check-in distance rules, planned-stop linking and the tracking state machine are
unit-tested, and location is only recorded while a workday is open.

**Limitation, and the most significant one in this document:** GPS has never
been exercised on real hardware. Desktop geolocation is a perfect fixed
coordinate; accuracy, drift and indoor degradation are exactly the conditions
the distance rules exist for, and none of them have been observed.

### Offline — READY WITH LIMITATION

The outbox distinguishes `LOCAL_PENDING` / `SYNCING` / `SYNCED` / `FAILED`,
retries with a cap, and exposes stranded items through `retryFailed()`. Money
movements are deliberately online-only. Unit-tested.

**Limitation:** tested against mocked failures, never against a real network
dropping out mid-write in a building.

### Orders — READY

Canonical `Order`/`OrderItem`, credit checks and approvals. SKU remains the
order unit; pack grouping is presentation only.

### Collections — READY

One ledger, one balance. Allocations and reversals are modelled, and a
collection recorded in the field moves the same balance the retailer sees.

### Opportunities — READY

Explainable rules over canonical rows, no stored opportunity table and no
fabricated ML. Now aggregates across a reporting tree in a fixed 4 queries.

### New retailer acquisition — READY

Proposal → review → one canonical `Retailer`. Routing follows the hierarchy;
the existing admin-approval policy is preserved because an org-wide reviewer
still sees every proposal. A proposer can never approve their own.

### Performance — READY

Benchmarked at 1 / 5 / 25 / 300 staff over 20,000 retailers, built and torn down
inside the test rather than seeded:

| Operation | Queries | Time |
|---|---|---|
| `getAllReports` (330 people) | 1 | 3 ms |
| `getManagementChain` (4 levels) | 1 | 1 ms |
| `getManagerTeamRetailers` (20,000 stores) | 3 | 28 ms |
| `bulkActuals` | 4 at 300 people, 4 at 2 | — |
| `opportunities.forTeam` | 4 at 300 people, 4 at 2 | 212 ms |
| `salesLeader.load` (whole dashboard) | 26 at 300 people, 26 at 2 | 44 ms |

Every count is flat with team size. Nothing is N+1.

### Physical-device readiness — NOT READY

No Android or iOS build has run on hardware.

- `adb` is not installed and no handset is attached.
- `Xcode.app` exists but `xcode-select` points at CommandLineTools, so even the
  iOS Simulator is unavailable.

`SALESPERSON_REAL_DEVICE_UAT.md` holds the full script, the blockers, and the
build command. Until it is executed, GPS, camera, real network loss, OS
backgrounding and battery behaviour are all unobserved.

---

## Overall: 78 / 100

The server-side product is in good shape: authorization, hierarchy, performance
and the manager experience are genuinely verified, not asserted. The deduction
is almost entirely one thing — **a field-sales product whose defining surface is
a phone in a market has never been run on a phone.** That is not a code quality
judgement; it is an evidence gap, and it is the single largest risk to V1.

## Remaining P0

1. **Physical Android UAT.** Blocked on tooling, not on code. Build with the
   existing staging profile and run the script.
2. **Populate reporting lines before deploying.** Managers see their tree and
   nothing else. An unpopulated chart is an apparent outage. Procedure in
   `SALES_HIERARCHY_ROLLOUT.md`.

## Remaining P1

1. **iOS Simulator, then iPhone.** One `sudo xcode-select` away for the
   simulator; a device build and provisioning after that.
2. **Staging database audit.** The readiness check has only been run against the
   local database; Render does not expose staging's `DATABASE_URL` here.
3. **`Priya Deshmukh` owns zero retailers but carries a ₹4,00,000 target**, so
   she is permanently 0% on every manager screen. Fixture data, not a code
   defect, but it reads as a broken dashboard in a demo.
4. **No `field_collector` is seeded**, so that role's scope behaviour has never
   been exercised end to end.
